/**
 * UI Controller Module
 * Handles UI interactions, state management, and user experience
 */
import { 
    debounce, 
    throttle, 
    detectBrowserFeatures, 
    getBrowserInfo, 
    logError, 
    safeExecute,
    getStorageItem,
    setStorageItem
} from './utils.js';

export class UIController {
    constructor(sgarTracker, mapController) {
        this.sgarTracker = sgarTracker;
        this.mapController = mapController;
        
        // UI State
        this.uiState = {
            isLoading: false,
            currentModal: null,
            isMobile: window.innerWidth <= 768,
            lastInteraction: Date.now(),
            keyboardNavigation: false,
            highContrast: false,
            reducedMotion: false
        };

        // Toast queue for notifications
        this.toastQueue = [];
        this.activeToasts = [];
        this.maxToasts = 3;

        // Loading states
        this.loadingStates = new Map();

        // Debounced functions
        this.debouncedResize = debounce(this.handleResize.bind(this), 250);
        this.debouncedSearch = debounce(this.handleSearch.bind(this), 300);

        this.init();
    }

    init() {
        this.detectUserPreferences();
        this.setupEventListeners();
        this.setupKeyboardNavigation();
        this.setupTouchGestures();
        this.initializeAccessibility();
        this.setupLoadingStates();
        this.createToastContainer();
        this.setupModalSystem();
    }

    detectUserPreferences() {
        // Load saved preferences
        const savedPrefs = getStorageItem('sgar_user_preferences', {});
        
        // Detect system preferences
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || savedPrefs.reducedMotion) {
            this.uiState.reducedMotion = true;
            document.body.classList.add('reduced-motion');
        }

        if (window.matchMedia('(prefers-contrast: high)').matches || savedPrefs.highContrast) {
            this.uiState.highContrast = true;
            document.body.classList.add('high-contrast');
        }

        // Detect browser features
        const browserFeatures = detectBrowserFeatures();
        if (!browserFeatures.localStorage) {
            console.warn('LocalStorage not available');
        }

        // Detect mobile device
        this.uiState.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (this.uiState.isMobile) {
            document.body.classList.add('mobile-device');
        }

        // Log browser info for debugging
        const browserInfo = getBrowserInfo();
        console.info('Browser info:', browserInfo);
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.debouncedResize);
        window.addEventListener('orientationchange', () => {
            setTimeout(this.handleResize.bind(this), 100);
        });

        // Keyboard events for accessibility
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // Focus events for keyboard navigation detection
        document.addEventListener('focusin', this.handleFocusIn.bind(this));
        document.addEventListener('focusout', this.handleFocusOut.bind(this));

        // Mouse events for keyboard navigation detection
        document.addEventListener('mousedown', () => {
            this.uiState.keyboardNavigation = false;
            document.body.classList.remove('keyboard-navigation');
        });

        // Enhanced search with loading states
        const searchInput = document.getElementById('council-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.setLoadingState('search', true);
                this.debouncedSearch(e.target.value);
            });
        }

        // Filter buttons with loading states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFilterClick(e);
            });
        });

        // View toggle buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleViewToggle(e);
            });
        });

        // ESC key for modal closing
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.uiState.currentModal) {
                this.closeCurrentModal();
            }
        });
    }

    setupKeyboardNavigation() {
        // Tab navigation enhancement
        const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.uiState.keyboardNavigation = true;
                document.body.classList.add('keyboard-navigation');
                
                // Enhanced tab navigation for complex layouts
                this.handleTabNavigation(e);
            }
        });
    }

    setupTouchGestures() {
        if (!this.uiState.isMobile) return;

        let touchStartY = 0;
        let touchEndY = 0;

        // Pull-to-refresh gesture
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].screenY;
            this.handleSwipeGesture(touchStartY, touchEndY);
        }, { passive: true });

        // Enhanced touch interactions for council cards
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }

    initializeAccessibility() {
        // Add ARIA labels and roles where missing
        this.enhanceAccessibility();
        
        // Announce page changes to screen readers
        this.createAriaLiveRegion();
        
        // Skip links for keyboard navigation
        this.addSkipLinks();
        
        // Focus management
        this.setupFocusManagement();
    }

    setupLoadingStates() {
        // Create loading overlay
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'loading-overlay';
        this.loadingOverlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p class="loading-text">Loading...</p>
            </div>
        `;
        document.body.appendChild(this.loadingOverlay);
    }

    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        this.toastContainer.setAttribute('aria-live', 'polite');
        this.toastContainer.setAttribute('aria-atomic', 'false');
        document.body.appendChild(this.toastContainer);
    }

    setupModalSystem() {
        // Enhanced modal backdrop
        this.modalBackdrop = document.createElement('div');
        this.modalBackdrop.className = 'modal-backdrop';
        this.modalBackdrop.addEventListener('click', this.closeCurrentModal.bind(this));
        document.body.appendChild(this.modalBackdrop);

        // Focus trap for modals
        this.modalFocusTrap = null;
    }

    // Event Handlers
    handleResize() {
        const wasMobile = this.uiState.isMobile;
        this.uiState.isMobile = window.innerWidth <= 768;

        if (wasMobile !== this.uiState.isMobile) {
            this.onBreakpointChange(this.uiState.isMobile);
        }

        // Update map size
        if (this.mapController) {
            this.mapController.resize();
        }

        this.announceToScreenReader(`Layout adjusted for ${this.uiState.isMobile ? 'mobile' : 'desktop'} view`);
    }

    handleKeyDown(e) {
        // Global keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                case 'f':
                    e.preventDefault();
                    this.focusSearch();
                    break;
                case '/':
                    e.preventDefault();
                    this.toggleHelpModal();
                    break;
            }
        }

        // Arrow navigation for council cards
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            this.handleArrowNavigation(e);
        }
    }

    handleKeyUp(e) {
        // Update last interaction time
        this.uiState.lastInteraction = Date.now();
    }

    handleFocusIn(e) {
        this.uiState.keyboardNavigation = true;
        document.body.classList.add('keyboard-navigation');
        
        // Ensure focused element is visible
        this.ensureElementVisible(e.target);
    }

    handleFocusOut(e) {
        // Clean up any temporary focus styles
    }

    handleSearch(value) {
        // Implement search with loading state
        setTimeout(() => {
            this.setLoadingState('search', false);
            this.announceToScreenReader(`Search results updated for "${value}"`);
        }, 100);
    }

    handleFilterClick(e) {
        const button = e.target.closest('.filter-btn');
        if (!button) return;

        this.setLoadingState('filter', true);
        
        // Add visual feedback
        button.classList.add('processing');
        
        setTimeout(() => {
            button.classList.remove('processing');
            this.setLoadingState('filter', false);
            
            const filter = button.getAttribute('data-filter');
            this.announceToScreenReader(`Filter applied: ${this.getFilterDisplayName(filter)}`);
        }, 200);
    }

    handleViewToggle(e) {
        const button = e.target.closest('.view-btn');
        if (!button) return;

        const view = button.getAttribute('data-view');
        this.setLoadingState('view-change', true);
        
        // Smooth transition
        const container = document.getElementById('councils-container');
        if (container) {
            container.style.opacity = '0.6';
        }

        setTimeout(() => {
            if (container) {
                container.style.opacity = '1';
            }
            this.setLoadingState('view-change', false);
            this.announceToScreenReader(`Switched to ${view} view`);
        }, 300);
    }

    handleTabNavigation(e) {
        const focusableElements = document.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        const focusableArray = Array.from(focusableElements);
        const currentIndex = focusableArray.indexOf(document.activeElement);
        
        if (e.shiftKey) {
            // Shift + Tab (backward)
            if (currentIndex === 0) {
                e.preventDefault();
                focusableArray[focusableArray.length - 1].focus();
            }
        } else {
            // Tab (forward)
            if (currentIndex === focusableArray.length - 1) {
                e.preventDefault();
                focusableArray[0].focus();
            }
        }
    }

    handleSwipeGesture(startY, endY) {
        const threshold = 100;
        const difference = startY - endY;

        if (Math.abs(difference) > threshold) {
            if (difference > 0) {
                // Swipe up - could trigger pull-to-refresh or next page
                this.handleSwipeUp();
            } else {
                // Swipe down - could trigger menu or previous page
                this.handleSwipeDown();
            }
        }
    }

    handleTouchStart(e) {
        const card = e.target.closest('.council-card');
        if (card) {
            card.classList.add('touch-active');
        }
    }

    handleTouchMove(e) {
        const card = document.querySelector('.council-card.touch-active');
        if (card) {
            card.classList.remove('touch-active');
        }
    }

    handleTouchEnd(e) {
        const card = e.target.closest('.council-card');
        if (card) {
            card.classList.remove('touch-active');
        }
    }

    handleArrowNavigation(e) {
        const focusedElement = document.activeElement;
        const councilCards = Array.from(document.querySelectorAll('.council-card'));
        
        if (!councilCards.length) return;

        const currentCard = focusedElement.closest('.council-card');
        if (!currentCard) return;

        const currentIndex = councilCards.indexOf(currentCard);
        let targetIndex = currentIndex;

        const isGridView = document.querySelector('.councils-container').classList.contains('council-grid');
        const cardsPerRow = isGridView ? Math.floor(window.innerWidth / 300) : 1;

        switch (e.key) {
            case 'ArrowLeft':
                targetIndex = currentIndex > 0 ? currentIndex - 1 : councilCards.length - 1;
                break;
            case 'ArrowRight':
                targetIndex = currentIndex < councilCards.length - 1 ? currentIndex + 1 : 0;
                break;
            case 'ArrowUp':
                targetIndex = currentIndex >= cardsPerRow ? currentIndex - cardsPerRow : currentIndex;
                break;
            case 'ArrowDown':
                targetIndex = currentIndex + cardsPerRow < councilCards.length ? currentIndex + cardsPerRow : currentIndex;
                break;
        }

        if (targetIndex !== currentIndex) {
            e.preventDefault();
            councilCards[targetIndex].focus();
        }
    }

    // UI State Management
    setLoadingState(key, isLoading, message = 'Loading...') {
        if (isLoading) {
            this.loadingStates.set(key, { message, timestamp: Date.now() });
        } else {
            this.loadingStates.delete(key);
        }

        this.updateGlobalLoadingState();
    }

    updateGlobalLoadingState() {
        const hasActiveLoading = this.loadingStates.size > 0;
        
        if (hasActiveLoading !== this.uiState.isLoading) {
            this.uiState.isLoading = hasActiveLoading;
            
            if (hasActiveLoading) {
                this.showGlobalLoading();
            } else {
                this.hideGlobalLoading();
            }
        }
    }

    showGlobalLoading() {
        document.body.classList.add('loading');
        this.loadingOverlay.classList.add('active');
    }

    hideGlobalLoading() {
        document.body.classList.remove('loading');
        this.loadingOverlay.classList.remove('active');
    }

    // Toast Notification System
    showToast(message, type = 'info', duration = 4000, actions = []) {
        const toast = {
            id: Date.now() + Math.random(),
            message,
            type,
            duration,
            actions,
            timestamp: Date.now()
        };

        this.toastQueue.push(toast);
        this.processToastQueue();
    }

    processToastQueue() {
        if (this.activeToasts.length >= this.maxToasts || this.toastQueue.length === 0) {
            return;
        }

        const toast = this.toastQueue.shift();
        this.displayToast(toast);
    }

    displayToast(toast) {
        const toastElement = document.createElement('div');
        toastElement.className = `toast toast-${toast.type}`;
        toastElement.setAttribute('role', 'alert');
        toastElement.setAttribute('aria-live', 'assertive');
        toastElement.dataset.toastId = toast.id;

        toastElement.innerHTML = `
            <div class="toast-content">
                <div class="toast-message">${toast.message}</div>
                ${toast.actions.length > 0 ? `
                    <div class="toast-actions">
                        ${toast.actions.map(action => `
                            <button class="toast-action" data-action="${action.id}">
                                ${action.label}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
                <button class="toast-close" aria-label="Close notification">×</button>
            </div>
            <div class="toast-progress"></div>
        `;

        // Event listeners
        toastElement.querySelector('.toast-close').addEventListener('click', () => {
            this.dismissToast(toast.id);
        });

        toast.actions.forEach(action => {
            const actionBtn = toastElement.querySelector(`[data-action="${action.id}"]`);
            if (actionBtn) {
                actionBtn.addEventListener('click', () => {
                    action.handler();
                    this.dismissToast(toast.id);
                });
            }
        });

        this.toastContainer.appendChild(toastElement);
        this.activeToasts.push({ ...toast, element: toastElement });

        // Animate in
        requestAnimationFrame(() => {
            toastElement.classList.add('toast-show');
        });

        // Auto dismiss
        if (toast.duration > 0) {
            setTimeout(() => {
                this.dismissToast(toast.id);
            }, toast.duration);
        }

        // Progress bar animation
        if (toast.duration > 0) {
            const progressBar = toastElement.querySelector('.toast-progress');
            progressBar.style.animationDuration = `${toast.duration}ms`;
        }
    }

    dismissToast(toastId) {
        const toastIndex = this.activeToasts.findIndex(t => t.id === toastId);
        if (toastIndex === -1) return;

        const toast = this.activeToasts[toastIndex];
        toast.element.classList.add('toast-hide');

        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            this.activeToasts.splice(toastIndex, 1);
            this.processToastQueue();
        }, 300);
    }

    // Modal Management
    showModal(modalId, options = {}) {
        this.closeCurrentModal();

        const modal = document.getElementById(modalId);
        if (!modal) return;

        this.uiState.currentModal = modalId;
        
        // Setup modal
        modal.classList.add('modal-active');
        this.modalBackdrop.classList.add('active');
        document.body.classList.add('modal-open');

        // Focus management
        this.setupModalFocusTrap(modal);
        
        // Announce to screen readers
        this.announceToScreenReader(`${options.title || 'Modal'} opened`);

        // Auto focus first focusable element
        setTimeout(() => {
            const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }, 100);
    }

    closeCurrentModal() {
        if (!this.uiState.currentModal) return;

        const modal = document.getElementById(this.uiState.currentModal);
        if (modal) {
            modal.classList.remove('modal-active');
        }

        this.modalBackdrop.classList.remove('active');
        document.body.classList.remove('modal-open');
        
        // Clean up focus trap
        if (this.modalFocusTrap) {
            this.modalFocusTrap.destroy();
            this.modalFocusTrap = null;
        }

        this.uiState.currentModal = null;
        
        this.announceToScreenReader('Modal closed');
    }

    setupModalFocusTrap(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleTabKey = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        modal.addEventListener('keydown', handleTabKey);
        
        this.modalFocusTrap = {
            destroy: () => {
                modal.removeEventListener('keydown', handleTabKey);
            }
        };
    }

    // Accessibility Enhancements
    enhanceAccessibility() {
        // Add missing ARIA labels
        const searchInput = document.getElementById('council-search');
        if (searchInput && !searchInput.getAttribute('aria-label')) {
            searchInput.setAttribute('aria-label', 'Search councils by name or region');
        }

        // Enhance council cards
        document.querySelectorAll('.council-card').forEach((card, index) => {
            if (!card.getAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            if (!card.getAttribute('role')) {
                card.setAttribute('role', 'article');
            }
        });

        // Enhance filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const filter = btn.getAttribute('data-filter');
            if (!btn.getAttribute('aria-label')) {
                btn.setAttribute('aria-label', `Filter councils by ${this.getFilterDisplayName(filter)}`);
            }
        });
    }

    createAriaLiveRegion() {
        this.ariaLiveRegion = document.createElement('div');
        this.ariaLiveRegion.setAttribute('aria-live', 'polite');
        this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
        this.ariaLiveRegion.className = 'sr-only';
        document.body.appendChild(this.ariaLiveRegion);
    }

    addSkipLinks() {
        const skipLinks = document.createElement('div');
        skipLinks.className = 'skip-links';
        skipLinks.innerHTML = `
            <a href="#stats-dashboard" class="skip-link">Skip to statistics</a>
            <a href="#council-search" class="skip-link">Skip to search</a>
            <a href="#councils-container" class="skip-link">Skip to council list</a>
            <a href="#map" class="skip-link">Skip to map</a>
        `;
        document.body.insertBefore(skipLinks, document.body.firstChild);
    }

    setupFocusManagement() {
        // Store focus when modals open
        this.lastFocusedElement = null;
        
        document.addEventListener('focusin', (e) => {
            if (!this.uiState.currentModal) {
                this.lastFocusedElement = e.target;
            }
        });
    }

    announceToScreenReader(message) {
        if (this.ariaLiveRegion) {
            this.ariaLiveRegion.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                this.ariaLiveRegion.textContent = '';
            }, 1000);
        }
    }

    ensureElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        
        if (!isVisible) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Utility Functions
    onBreakpointChange(isMobile) {
        if (isMobile) {
            document.body.classList.add('mobile-layout');
            document.body.classList.remove('desktop-layout');
        } else {
            document.body.classList.add('desktop-layout');
            document.body.classList.remove('mobile-layout');
        }

        // Adjust map controls for mobile
        if (this.mapController) {
            this.mapController.resize();
        }
    }

    focusSearch() {
        const searchInput = document.getElementById('council-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    toggleHelpModal() {
        if (this.uiState.currentModal === 'helpModal') {
            this.closeCurrentModal();
        } else {
            this.showModal('helpModal', { title: 'Help & Shortcuts' });
        }
    }

    getFilterDisplayName(filter) {
        const filterNames = {
            'all': 'all councils',
            'using-sgars': 'councils using SGARs',
            'sgar-free': 'SGAR-free councils',
            'unknown': 'councils with unknown status'
        };
        return filterNames[filter] || filter;
    }

    handleSwipeUp() {
        // Could implement pull-to-refresh or pagination
        this.showToast('Pull to refresh', 'info', 2000);
    }

    handleSwipeDown() {
        // Could implement menu toggle or other actions
    }


    // Public API for integration
    updateCouncilData() {
        this.setLoadingState('data-update', true, 'Updating council data...');
        
        // Simulate data update
        setTimeout(() => {
            this.setLoadingState('data-update', false);
            this.showToast('Council data updated successfully', 'success');
            this.announceToScreenReader('Council data has been updated');
        }, 1000);
    }

    // Save user preferences
    saveUserPreferences() {
        const preferences = {
            reducedMotion: this.uiState.reducedMotion,
            highContrast: this.uiState.highContrast,
            lastSaved: new Date().toISOString()
        };
        
        setStorageItem('sgar_user_preferences', preferences);
    }

    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    showErrorMessage(message) {
        this.showToast(message, 'error', 6000);
    }

    showInfoMessage(message) {
        this.showToast(message, 'info');
    }

    showWarningMessage(message) {
        this.showToast(message, 'warning');
    }

    destroy() {
        // Clean up event listeners and resources
        window.removeEventListener('resize', this.debouncedResize);
        
        if (this.modalFocusTrap) {
            this.modalFocusTrap.destroy();
        }

        // Remove created elements
        if (this.toastContainer && this.toastContainer.parentNode) {
            this.toastContainer.parentNode.removeChild(this.toastContainer);
        }
        
        if (this.loadingOverlay && this.loadingOverlay.parentNode) {
            this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
        }
        
        if (this.modalBackdrop && this.modalBackdrop.parentNode) {
            this.modalBackdrop.parentNode.removeChild(this.modalBackdrop);
        }
        
        if (this.ariaLiveRegion && this.ariaLiveRegion.parentNode) {
            this.ariaLiveRegion.parentNode.removeChild(this.ariaLiveRegion);
        }
    }
}