/**
 * SGAR Tracker Module
 * Manages the display and interaction with NSW council SGAR data
 */
import { 
    titleCase, 
    formatCouncilStatus, 
    debounce, 
    logError, 
    safeExecute,
    generateCSV,
    downloadFile
} from './utils.js';

// Helper function to assign regions to councils
function getCouncilRegion(councilName) {
    const regions = {
        'Hunter': ['CENTRAL COAST', 'CESSNOCK', 'DUNGOG', 'LAKE MACQUARIE', 'MAITLAND', 'MUSWELLBROOK', 'NEWCASTLE', 'PORT STEPHENS', 'SINGLETON', 'UPPER HUNTER'],
        'Illawarra': ['KIAMA', 'SHELLHARBOUR', 'SHOALHAVEN', 'WINGECARRIBEE', 'WOLLONDILLY', 'WOLLONGONG'],
        'Metro North': ['HORNSBY', 'HUNTERS HILL', 'KU-RING-GAI', 'LANE COVE', 'MOSMAN', 'NORTH SYDNEY', 'NORTHERN BEACHES', 'RYDE', 'THE HILLS SHIRE', 'WILLOUGHBY'],
        'Metro South': ['BAYSIDE', 'BURWOOD', 'CANADA BAY', 'CANTERBURY-BANKSTOWN', 'GEORGES RIVER', 'INNER WEST', 'RANDWICK', 'STRATHFIELD', 'SUTHERLAND SHIRE', 'SYDNEY', 'WAVERLEY', 'WOOLLAHRA'],
        'Metro West': ['BLACKTOWN', 'BLUE MOUNTAINS', 'CAMDEN', 'CAMPBELLTOWN', 'CITY OF PARRAMATTA', 'CUMBERLAND', 'FAIRFIELD', 'HAWKESBURY', 'LIVERPOOL', 'PENRITH'],
        'Mid North Coast': ['BELLINGEN', 'COFFS HARBOUR', 'KEMPSEY', 'MID-COAST', 'NAMBUCCA VALLEY', 'PORT MACQUARIE-HASTINGS'],
        'North Coast': ['BALLINA', 'BYRON', 'CLARENCE VALLEY', 'KYOGLE', 'LISMORE', 'RICHMOND VALLEY', 'TWEED'],
        'Northern Inland': ['ARMIDALE REGIONAL', 'GLEN INNES SEVERN', 'GUNNEDAH', 'GWYDIR', 'INVERELL', 'LIVERPOOL PLAINS', 'MOREE PLAINS', 'NARRABRI', 'TAMWORTH REGIONAL', 'TENTERFIELD', 'URALLA', 'WALCHA'],
        'Central West': ['BATHURST REGIONAL', 'BLAYNEY', 'CABONNE', 'COWRA', 'FORBES', 'LACHLAN', 'LITHGOW CITY', 'OBERON', 'ORANGE', 'PARKES', 'WEDDIN'],
        'Orana': ['BOGAN', 'BOURKE', 'BREWARRINA', 'BROKEN HILL', 'CENTRAL DARLING', 'COBAR', 'COONAMBLE', 'DUBBO REGIONAL', 'GILGANDRA', 'MID-WESTERN REGIONAL', 'NARROMINE', 'WALGETT', 'WARREN', 'WARRUMBUNGLE'],
        'South East': ['BEGA VALLEY', 'EUROBODALLA', 'GOULBURN MULWAREE', 'QUEANBEYAN-PALERANG REGIONAL', 'SNOWY MONARO REGIONAL', 'UPPER LACHLAN SHIRE', 'YASS VALLEY'],
        'South West': ['ALBURY CITY', 'BALRANALD', 'BERRIGAN', 'BLAND', 'CARRATHOOL', 'COOLAMON', 'COOTAMUNDRA-GUNDAGAI REGIONAL', 'EDWARD RIVER', 'FEDERATION', 'GREATER HUME SHIRE', 'GRIFFITH', 'HAY', 'HILLTOPS', 'JUNEE', 'LEETON', 'LOCKHART', 'MURRAY RIVER', 'MURRUMBIDGEE', 'NARRANDERA', 'SNOWY VALLEYS', 'TEMORA', 'WAGGA WAGGA', 'WENTWORTH']
    };

    const upperName = councilName.toUpperCase();
    for (const [region, councils] of Object.entries(regions)) {
        if (councils.includes(upperName)) {
            return region;
        }
    }
    return "Other"; // Default fallback
}

export class SGARTracker {
    constructor(councilData) {
        // Transform council data to expected format with regions
        this.councils = Object.entries(councilData).map(([name, data]) => ({
            name: titleCase(name),
            status: data.sgars,
            notes: data.notes,
            contactEmail: data.email,
            region: getCouncilRegion(name),
            lastUpdated: "2025-01-22"
        }));
        
        this.currentView = 'map';
        this.filters = {
            status: [],
            region: [],
            search: '',
            quickFilter: null
        };
        this.pagination = {
            currentPage: 1,
            cardsPerPage: this.getCardsPerPage(),
            totalPages: 1
        };
        this.mapController = null;
        this.uiController = null;
        this.init();
    }

    init() {
        this.updateStats();
        this.animateNumbers();
        this.setupEventListeners();
        this.setupUnifiedSearch();
        this.setupViewToggle();
        this.setupPagination();
        this.setupProfessionalFilters();
        this.initModalControls();
        
        // Set initial view to map
        this.switchView(this.currentView);
        
        // Initialize clear filters button visibility
        this.updateClearFiltersVisibility();
        
        // Initialize results counter
        this.updateFilteredResultsCounter();
        
        // Handle responsive pagination
        window.addEventListener('resize', () => {
            this.pagination.cardsPerPage = this.getCardsPerPage();
            if (this.currentView !== 'map') {
                this.renderCouncils();
            }
        });
    }

    getCardsPerPage() {
        const width = window.innerWidth;
        if (width >= 1024) {
            return 24; // Desktop: 4 columns × 6 rows
        } else if (width >= 768) {
            return 18; // Tablet: 3 columns × 6 rows
        } else {
            return 12; // Mobile: 2 columns × 6 rows
        }
    }

    updateStats() {
        const stats = {
            total: this.councils.length,
            usingSgars: this.councils.filter(c => c.status === 'Yes').length,
            sgarFree: this.councils.filter(c => c.status === 'No').length,
            unknown: this.councils.filter(c => c.status === 'Unknown').length
        };

        // Update stat values with correct IDs
        const usingSgarsEl = document.getElementById('councils-using-sgars');
        const sgarFreeEl = document.getElementById('sgar-free-councils');
        const unknownEl = document.getElementById('unknown-status');
        
        if (usingSgarsEl) usingSgarsEl.setAttribute('data-count', stats.usingSgars);
        if (sgarFreeEl) sgarFreeEl.setAttribute('data-count', stats.sgarFree);
        if (unknownEl) unknownEl.setAttribute('data-count', stats.unknown);

        // Update filter counts
        const filterDangerEl = document.getElementById('filter-count-danger');
        const filterSuccessEl = document.getElementById('filter-count-success');
        
        if (filterDangerEl) filterDangerEl.textContent = `${stats.usingSgars} councils`;
        if (filterSuccessEl) filterSuccessEl.textContent = `${stats.sgarFree} councils`;

        // Update progress
        const progressPercent = Math.round((stats.sgarFree / stats.total) * 100);
        const progressEl = document.getElementById('progress-bar');
        if (progressEl) progressEl.style.width = `${progressPercent}%`;
        
        // Update professional results counter
        this.updateResultsCounter(stats.total, stats.total);
    }

    animateNumbers() {
        const animatedElements = document.querySelectorAll('[data-count]');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    const count = parseInt(target.getAttribute('data-count'));
                    const duration = 2000;
                    const start = 0;
                    const increment = count / (duration / 16);
                    let current = start;

                    const updateNumber = () => {
                        current += increment;
                        if (current < count) {
                            target.textContent = Math.floor(current);
                            requestAnimationFrame(updateNumber);
                        } else {
                            target.textContent = count;
                        }
                    };

                    updateNumber();
                    observer.unobserve(target);
                }
            });
        });

        animatedElements.forEach(el => observer.observe(el));
    }

    setupEventListeners() {
        // Set up filter button listeners
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.getAttribute('data-filter');
                this.applyFilter(filter);
            });
        });

        // Set up clear filters button listener
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
    }

    applyFilter(filterType) {
        // Reset filters and pagination
        this.filters = {
            status: [],
            region: [],
            search: '',
            quickFilter: filterType
        };
        this.pagination.currentPage = 1;

        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === filterType);
        });

        switch(filterType) {
            case 'using-sgars':
                this.filters.status = ['Yes'];
                break;
            case 'sgar-free':
                this.filters.status = ['No'];
                break;
            case 'unknown':
                this.filters.status = ['Unknown'];
                break;
            case 'all':
            default:
                // Show all councils
                break;
        }

        this.renderCouncils();
        
        // Update map if controller is available
        if (this.mapController) {
            this.mapController.applyFilter(this.filters);
        }

        // Update clear filters button visibility
        this.updateClearFiltersVisibility();
    }

    setupUnifiedSearch() {
        const searchInput = document.getElementById('council-search');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase();
            this.filters.search = value;
            this.renderCouncils();
            
            // Update map if controller is available
            if (this.mapController) {
                this.mapController.applyFilter(this.filters);
            }

            // Update clear filters button visibility and results counter
            this.updateClearFiltersVisibility();
            this.updateFilteredResultsCounter();
        });
    }

    setupViewToggle() {
        const viewBtns = document.querySelectorAll('.view-btn');
        
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                this.switchView(view);
            });
        });
    }

    switchView(view) {
        console.log(`🔄 Switching to ${view} view`);
        this.currentView = view;
        
        // Update buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        });
        
        // Get all necessary elements
        const councilsContainer = document.getElementById('councils-container');
        const mapSection = document.getElementById('map-section');
        const mapContainer = document.getElementById('map');
        const mapContainerParent = document.querySelector('.map-container');
        const paginationSection = document.getElementById('pagination-section');
        
        console.log(`📍 Elements found - councilsContainer: ${!!councilsContainer}, mapSection: ${!!mapSection}, mapContainer: ${!!mapContainer}`);
        
        if (view === 'map') {
            console.log('🗺️ Switching to MAP VIEW');
            
            // Hide councils completely
            if (councilsContainer) {
                councilsContainer.style.display = 'none';
                councilsContainer.style.visibility = 'hidden';
                councilsContainer.style.setProperty('display', 'none', 'important');
                // Remove all grid/list classes to prevent CSS conflicts
                councilsContainer.classList.remove('council-grid', 'council-list');
                councilsContainer.className = 'councils-container';
                console.log('✅ Councils container hidden');
            }
            
            if (paginationSection) {
                paginationSection.style.display = 'none';
                paginationSection.style.setProperty('display', 'none', 'important');
                console.log('✅ Pagination hidden');
            }
            
            // Show map section with explicit overrides and CSS classes
            if (mapSection) {
                mapSection.classList.remove('hide-map');
                mapSection.classList.add('show-map');
                mapSection.style.display = 'block';
                mapSection.style.visibility = 'visible';
                mapSection.style.setProperty('display', 'block', 'important');
                console.log('✅ Map section shown');
            }
            
            // Ensure map container itself is visible
            if (mapContainer) {
                mapContainer.classList.remove('hide-map');
                mapContainer.classList.add('show-map');
                mapContainer.style.display = 'block';
                mapContainer.style.visibility = 'visible';
                mapContainer.style.setProperty('display', 'block', 'important');
                console.log('✅ Map container shown');
            }
            
            // Ensure map container parent is visible
            if (mapContainerParent) {
                mapContainerParent.classList.remove('hide-map');
                mapContainerParent.classList.add('show-map');
                mapContainerParent.style.display = 'block';
                mapContainerParent.style.visibility = 'visible';
                mapContainerParent.style.setProperty('display', 'block', 'important');
                console.log('✅ Map container parent shown');
            }
            
            // Force map container dimensions update and trigger resize
            if (this.mapController && this.mapController.map) {
                console.log('🔄 Triggering map resize...');
                // Multiple resize attempts to ensure proper map display
                setTimeout(() => {
                    this.mapController.resize();
                    console.log('✅ Map resize 1 complete');
                }, 50);
                setTimeout(() => {
                    this.mapController.resize();
                    console.log('✅ Map resize 2 complete');
                }, 150);
                setTimeout(() => {
                    this.mapController.resize();
                    console.log('✅ Map resize 3 complete');
                    // Final check
                    const finalMapCheck = document.getElementById('map');
                    if (finalMapCheck) {
                        console.log(`🔍 Final map visibility check: display=${getComputedStyle(finalMapCheck).display}, visibility=${getComputedStyle(finalMapCheck).visibility}`);
                    }
                }, 300);
            }
            
        } else {
            console.log(`📋 Switching to ${view.toUpperCase()} VIEW`);
            
            // Hide map completely
            if (mapSection) {
                mapSection.classList.remove('show-map');
                mapSection.classList.add('hide-map');
                mapSection.style.display = 'none';
                mapSection.style.visibility = 'hidden';
                mapSection.style.setProperty('display', 'none', 'important');
                console.log('✅ Map section hidden');
            }
            
            if (mapContainer) {
                mapContainer.classList.remove('show-map');
                mapContainer.classList.add('hide-map');
                mapContainer.style.display = 'none';
                mapContainer.style.visibility = 'hidden';
                mapContainer.style.setProperty('display', 'none', 'important');
                console.log('✅ Map container hidden');
            }
            
            if (mapContainerParent) {
                mapContainerParent.classList.remove('show-map');
                mapContainerParent.classList.add('hide-map');
                console.log('✅ Map container parent hidden');
            }
            
            // Show councils container
            if (councilsContainer) {
                // Clear any previous inline styles that might interfere
                councilsContainer.style.removeProperty('display');
                councilsContainer.style.removeProperty('visibility');
                councilsContainer.style.display = 'block';
                councilsContainer.style.visibility = 'visible';
                councilsContainer.style.setProperty('display', 'block', 'important');
                console.log('✅ Councils container shown');
            }
            
            // Show pagination for grid view only
            if (paginationSection) {
                paginationSection.style.display = view === 'grid' ? 'block' : 'none';
                console.log(`✅ Pagination ${view === 'grid' ? 'shown' : 'hidden'}`);
            }
            
            // Render councils for grid/list view
            this.renderCouncils();
            console.log('✅ Councils rendered');
        }
        
        console.log(`✅ View switch to ${view} complete`);
    }

    renderCouncils() {
        const container = document.getElementById('councils-container');
        if (!container) return;

        const filteredCouncils = this.getFilteredCouncils();
        
        // Update pagination info
        this.pagination.totalPages = Math.ceil(filteredCouncils.length / this.pagination.cardsPerPage);
        
        // Ensure current page is valid
        if (this.pagination.currentPage > this.pagination.totalPages) {
            this.pagination.currentPage = 1;
        }
        
        // Get councils for current page
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.cardsPerPage;
        const endIndex = startIndex + this.pagination.cardsPerPage;
        const paginatedCouncils = filteredCouncils.slice(startIndex, endIndex);
        
        if (this.currentView === 'grid') {
            container.className = 'councils-container council-grid';
            container.innerHTML = paginatedCouncils.map(council => 
                this.createCouncilCard(council)
            ).join('');
        } else {
            container.className = 'councils-container council-list';
            // List view doesn't use pagination - show all results
            container.innerHTML = filteredCouncils.map(council => 
                this.createCouncilListItem(council)
            ).join('');
        }
        
        // Update pagination controls
        this.updatePaginationControls(filteredCouncils.length);
    }

    getFilteredCouncils() {
        return this.councils.filter(council => {
            // Status filter
            if (this.filters.status.length > 0 && !this.filters.status.includes(council.status)) {
                return false;
            }
            
            // Region filter
            if (this.filters.region.length > 0 && !this.filters.region.includes(council.region)) {
                return false;
            }
            
            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                return council.name.toLowerCase().includes(searchTerm) ||
                       council.region.toLowerCase().includes(searchTerm) ||
                       council.notes.toLowerCase().includes(searchTerm);
            }
            
            return true;
        });
    }

    createActionButton(council) {
        const { status, contactEmail, name } = council;
        
        // Define button properties based on status
        let buttonText, buttonClass, subject, body, ariaLabel;
        
        switch (status) {
            case 'Yes': // Using SGARs
                buttonText = '📧 Take Action';
                buttonClass = 'action-btn-danger';
                subject = `Urgent: Stop Using Harmful SGARs - Protect NSW Wildlife`;
                body = `Dear ${name} Council,\n\nI am writing to urge you to immediately stop using Second Generation Anticoagulant Rodenticides (SGARs) in your pest control programs.\n\nSGARs pose severe risks to NSW wildlife through secondary poisoning, affecting native birds, mammals, and reptiles. Many councils across NSW have successfully transitioned to safer alternatives.\n\nPlease join them in protecting our precious wildlife by:\n1. Reviewing your current rodenticide policy\n2. Transitioning to non-anticoagulant alternatives\n3. Publishing your pest control methods for transparency\n\nOur wildlife depends on your leadership.\n\nThank you for considering this urgent request.\n\nSincerely,`;
                ariaLabel = `Contact ${name} to urge them to stop using SGARs`;
                break;
                
            case 'No': // SGAR-free
                buttonText = '📧 Thank Council';
                buttonClass = 'action-btn-success';
                subject = `Thank You for Protecting NSW Wildlife - SGAR-Free Policy`;
                body = `Dear ${name} Council,\n\nThank you for your leadership in protecting NSW wildlife by maintaining a SGAR-free pest control policy.\n\nYour commitment to avoiding Second Generation Anticoagulant Rodenticides demonstrates environmental responsibility and sets an excellent example for other councils across NSW.\n\nBy choosing safer alternatives, you are:\n1. Protecting native birds, mammals, and reptiles from secondary poisoning\n2. Maintaining healthy ecosystems in your local area\n3. Leading by example for other councils\n\nPlease continue this important work and consider sharing your success story to inspire other councils.\n\nWith sincere appreciation,`;
                ariaLabel = `Thank ${name} for their SGAR-free policy`;
                break;
                
            default: // Unknown status
                buttonText = '📧 Request Transparency';
                buttonClass = 'action-btn-warning';
                subject = `Request for Transparency: Rodenticide Policy Information`;
                body = `Dear ${name} Council,\n\nI am writing to request transparency regarding your current rodenticide and pest control policies.\n\nAs a concerned resident/advocate, I would like to understand:\n1. What rodenticides (if any) does your council currently use?\n2. Do you use Second Generation Anticoagulant Rodenticides (SGARs)?\n3. What is your policy regarding wildlife-safe pest control alternatives?\n4. Are you considering transitioning to non-anticoagulant alternatives?\n\nThis information is important for understanding how local councils are protecting NSW wildlife from the harmful effects of SGARs through secondary poisoning.\n\nI would appreciate a clear response regarding your current practices and any plans for wildlife-safe alternatives.\n\nThank you for your time and consideration.\n\nSincerely,`;
                ariaLabel = `Request transparency from ${name} about their rodenticide policy`;
                break;
        }
        
        // Encode the mailto link
        const mailtoLink = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        return `
            <a href="${mailtoLink}" 
               class="council-action-btn ${buttonClass}"
               aria-label="${ariaLabel}"
               title="${ariaLabel}">
               ${buttonText}
            </a>
        `;
    }

    createCouncilCard(council) {
        const statusInfo = formatCouncilStatus(council.status);
        const statusClass = statusInfo.class;
        const statusIcon = statusInfo.icon;
        
        // Add wildlife impact indicator for councils using SGARs
        const wildlifeIndicator = council.status === 'Yes' ? 
            '<div class="wildlife-impact" title="Wildlife at Risk - Council uses SGARs">🦉</div>' : '';

        return `
            <article class="council-card ${statusClass}">
                <div class="council-status-indicator"></div>
                ${wildlifeIndicator}
                <div class="council-card-header">
                    <h3 class="council-name">${council.name}</h3>
                    <span class="council-status ${statusClass}">
                        ${statusIcon} ${statusInfo.text}
                    </span>
                </div>
                <div class="council-card-body">
                    <div class="council-notes">${council.notes}</div>
                    <div class="council-action">
                        ${this.createActionButton(council)}
                        <button class="council-action-btn secondary view-details-btn" 
                                onclick="app.openCouncilDetails('${encodeURIComponent(JSON.stringify(council))}')"
                                aria-label="View detailed information for ${council.name}">
                            📋 View Details
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    createCouncilListItem(council) {
        const statusInfo = formatCouncilStatus(council.status);
        const statusClass = statusInfo.class;
        const statusIcon = statusInfo.icon;

        return `
            <article class="council-card ${statusClass}" style="display: flex; align-items: center; padding: var(--space-lg);">
                <div class="council-status-indicator"></div>
                <div style="flex: 1;">
                    <h3 class="council-name" style="margin-bottom: var(--space-xs);">${council.name}</h3>
                    <span class="council-status ${statusClass}">
                        ${statusIcon} ${statusInfo.text}
                    </span>
                </div>
                <div class="council-action">
                    ${this.createActionButton(council)}
                </div>
            </article>
        `;
    }

    initModalControls() {
        const modal = document.getElementById('actionModal');
        const closeBtn = document.querySelector('.modal-close-button');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeActionModal();
            });
        }

        if (modal) {
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    this.closeActionModal();
                }
            });
        }
    }

    openActionModal(councilData) {
        const modal = document.getElementById('actionModal');
        const embedContainer = document.getElementById('actionNetworkEmbedContainer');
        
        if (!modal || !embedContainer) return;
        
        // Campaign URLs based on status
        const campaignUrls = {
            'Yes': 'URL_FOR_YES_STATUS_CAMPAIGN',
            'No': 'URL_FOR_NO_STATUS_CAMPAIGN',
            'Unknown': 'URL_FOR_UNKNOWN_STATUS_CAMPAIGN'
        };

        const campaignUrl = campaignUrls[councilData.status] || campaignUrls['Unknown'];
        
        // Create iframe for Action Network form
        embedContainer.innerHTML = `
            <iframe 
                src="${campaignUrl}" 
                style="width: 100%; height: 600px; border: none;"
                title="Take Action Form"
            ></iframe>
        `;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeActionModal() {
        const modal = document.getElementById('actionModal');
        const embedContainer = document.getElementById('actionNetworkEmbedContainer');
        
        if (modal) modal.style.display = 'none';
        if (embedContainer) embedContainer.innerHTML = '';
        document.body.style.overflow = 'auto';
    }

    selectCouncil(councilName) {
        const searchInput = document.getElementById('council-search');
        if (searchInput) {
            searchInput.value = councilName;
            this.filters.search = councilName.toLowerCase();
            this.renderCouncils();
        }
    }

    contactCouncil(encodedData) {
        safeExecute(() => {
            const councilData = JSON.parse(decodeURIComponent(encodedData));
            this.openActionModal(councilData);
        }, null, 'SGARTracker.contactCouncil');
    }

    viewDetails(councilName) {
        const council = this.councils.find(c => c.name === councilName);
        if (council) {
            alert(`Council: ${council.name}\nStatus: ${council.status}\nNotes: ${council.notes}\nContact: ${council.contactEmail}`);
        }
    }

    showToast(message, type = 'info') {
        // Use UI controller toast system if available, otherwise fallback
        if (this.uiController) {
            this.uiController.showToast(message, type);
        } else {
            // Fallback toast implementation
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            
            // Add to page temporarily
            document.body.appendChild(toast);
            
            // Show toast
            setTimeout(() => toast.classList.add('show'), 100);
            
            // Remove after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => document.body.removeChild(toast), 300);
            }, 3000);
        }
    }

    // Set controller references for integration
    setMapController(mapController) {
        this.mapController = mapController;
    }

    setUIController(uiController) {
        this.uiController = uiController;
    }

    // Export council data as CSV
    exportToCSV() {
        const csvContent = generateCSV(this.councils);
        const filename = `nsw_councils_sgar_data_${new Date().toISOString().split('T')[0]}.csv`;
        downloadFile(csvContent, filename, 'text/csv');
        
        if (this.uiController) {
            this.uiController.showSuccessMessage('Council data exported successfully');
        }
    }

    // Get filtered councils for export
    exportFilteredData() {
        const filteredCouncils = this.getFilteredCouncils();
        const csvContent = generateCSV(filteredCouncils);
        const filename = `filtered_nsw_councils_sgar_data_${new Date().toISOString().split('T')[0]}.csv`;
        downloadFile(csvContent, filename, 'text/csv');
        
        if (this.uiController) {
            this.uiController.showSuccessMessage(`${filteredCouncils.length} councils exported successfully`);
        }
    }

    setupPagination() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.pagination.currentPage > 1) {
                    this.pagination.currentPage--;
                    this.renderCouncils();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.pagination.currentPage < this.pagination.totalPages) {
                    this.pagination.currentPage++;
                    this.renderCouncils();
                }
            });
        }

        // Event delegation for page number buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-number')) {
                const page = parseInt(e.target.getAttribute('data-page'));
                this.goToPage(page);
            }
        });
    }

    updatePaginationControls(totalResults) {
        const paginationSection = document.getElementById('pagination-section');
        const counter = document.getElementById('pagination-counter');
        const pageNumbers = document.getElementById('page-numbers');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (!paginationSection) return;

        // Show/hide pagination based on view and results
        if (this.currentView === 'grid' && totalResults > 0) {
            paginationSection.style.display = 'block';
        } else {
            paginationSection.style.display = 'none';
            return;
        }

        // Update counter
        if (counter) {
            const startItem = (this.pagination.currentPage - 1) * this.pagination.cardsPerPage + 1;
            const endItem = Math.min(this.pagination.currentPage * this.pagination.cardsPerPage, totalResults);
            counter.textContent = `Showing ${startItem}-${endItem} of ${totalResults} councils`;
        }

        // Update page numbers
        if (pageNumbers) {
            pageNumbers.innerHTML = this.generatePageNumbers();
        }

        // Update navigation buttons
        if (prevBtn) {
            prevBtn.disabled = this.pagination.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.pagination.currentPage >= this.pagination.totalPages;
        }
    }

    generatePageNumbers() {
        const { currentPage, totalPages } = this.pagination;
        const pageNumbers = [];
        
        // Always show first page
        if (totalPages > 1) {
            pageNumbers.push(1);
        }
        
        // Add ellipsis if needed
        if (currentPage > 3) {
            pageNumbers.push('...');
        }
        
        // Add pages around current page
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            if (!pageNumbers.includes(i)) {
                pageNumbers.push(i);
            }
        }
        
        // Add ellipsis if needed
        if (currentPage < totalPages - 2) {
            pageNumbers.push('...');
        }
        
        // Always show last page
        if (totalPages > 1 && !pageNumbers.includes(totalPages)) {
            pageNumbers.push(totalPages);
        }

        return pageNumbers.map(page => {
            if (page === '...') {
                return '<span class="page-ellipsis">...</span>';
            } else {
                const isActive = page === currentPage;
                return `<button class="page-number ${isActive ? 'active' : ''}" 
                               data-page="${page}" 
                               aria-label="Go to page ${page}"
                               ${isActive ? 'aria-current="page"' : ''}>
                               ${page}
                        </button>`;
            }
        }).join('');
    }

    goToPage(page) {
        if (page >= 1 && page <= this.pagination.totalPages) {
            this.pagination.currentPage = page;
            this.renderCouncils();
        }
    }

    clearAllFilters() {
        // Reset all filters to default state
        this.filters = {
            status: [],
            region: [],
            search: '',
            quickFilter: null
        };
        
        // Reset pagination
        this.pagination.currentPage = 1;

        // Clear search input
        const searchInput = document.getElementById('council-search');
        if (searchInput) {
            searchInput.value = '';
        }

        // Reset professional dropdown selectors
        const statusFilter = document.getElementById('status-filter');
        const regionFilter = document.getElementById('region-filter');
        if (statusFilter) statusFilter.value = 'all';
        if (regionFilter) regionFilter.value = 'all';

        // Reset filter buttons to "All" active state (for legacy compatibility)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
        });

        // Render councils with cleared filters
        this.renderCouncils();
        
        // Update map if controller is available
        if (this.mapController) {
            this.mapController.applyFilter(this.filters);
        }

        // Hide clear filters button and update results counter
        this.updateClearFiltersVisibility();
        this.updateFilteredResultsCounter();
    }

    updateClearFiltersVisibility() {
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (!clearFiltersBtn) return;

        // Check if any filters are active
        const hasActiveFilters = 
            this.filters.search.length > 0 ||
            this.filters.status.length > 0 ||
            this.filters.region.length > 0 ||
            (this.filters.quickFilter && this.filters.quickFilter !== 'all');

        // Show/hide button based on active filters
        clearFiltersBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
    }

    hasActiveFilters() {
        return this.filters.search.length > 0 ||
               this.filters.status.length > 0 ||
               this.filters.region.length > 0 ||
               (this.filters.quickFilter && this.filters.quickFilter !== 'all');
    }

    contactCouncil(encodedCouncilData) {
        console.log('Contact council called with:', encodedCouncilData);
    }

    openCouncilDetails(encodedCouncilData) {
        try {
            const council = JSON.parse(decodeURIComponent(encodedCouncilData));
            this.showCouncilDetailsModal(council);
        } catch (error) {
            console.error('Error parsing council data:', error);
        }
    }

    showCouncilDetailsModal(council) {
        const modal = document.getElementById('councilDetailsModal');
        const container = document.getElementById('councilDetailsContainer');
        
        if (!modal || !container) return;

        // Generate modal content
        container.innerHTML = this.createCouncilDetailsContent(council);

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scroll

        // Set up event listeners
        this.setupModalEventListeners(modal);
    }

    createCouncilDetailsContent(council) {
        const statusInfo = formatCouncilStatus(council.status);
        const statusIcon = statusInfo.icon;
        const statusText = statusInfo.text;
        
        // Format last updated date if available
        const lastUpdated = council.lastUpdated ? 
            new Date(council.lastUpdated).toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'Not specified';

        return `
            <div class="council-details-header">
                <h2 class="council-details-title">${council.name}</h2>
                <div class="council-details-status">
                    ${statusIcon} ${statusText}
                </div>
            </div>
            <div class="council-details-body">
                <div class="detail-section">
                    <div class="detail-label">SGAR Status</div>
                    <div class="detail-content">${statusText} - ${this.getStatusDescription(council.status)}</div>
                </div>
                
                <div class="detail-section">
                    <div class="detail-label">Region</div>
                    <div class="detail-content">${council.region || 'Not specified'}</div>
                </div>
                
                <div class="detail-section">
                    <div class="detail-label">Contact Information</div>
                    <a href="mailto:${council.contactEmail}" class="detail-content email">
                        ${council.contactEmail}
                    </a>
                </div>
                
                <div class="detail-section">
                    <div class="detail-label">Last Updated</div>
                    <div class="detail-content">${lastUpdated}</div>
                </div>
                
                <div class="detail-section">
                    <div class="detail-label">Detailed Notes</div>
                    <div class="detail-content">${council.notes}</div>
                </div>
            </div>
        `;
    }

    getStatusDescription(status) {
        switch (status) {
            case 'Yes':
                return 'Council currently uses Second Generation Anticoagulant Rodenticides in pest control programs';
            case 'No':
                return 'Council has adopted SGAR-free pest control methods, protecting local wildlife';
            case 'Unknown':
            default:
                return 'Council policy regarding SGAR usage is not publicly available or unclear';
        }
    }

    setupModalEventListeners(modal) {
        // Close button
        const closeBtn = modal.querySelector('.details-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeCouncilDetailsModal();
        }

        // Click outside modal
        const overlay = modal.querySelector('.modal-overlay');
        if (overlay) {
            overlay.onclick = () => this.closeCouncilDetailsModal();
        }

        // ESC key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeCouncilDetailsModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Store event handler for cleanup
        modal._escapeHandler = handleEscape;
    }

    closeCouncilDetailsModal() {
        const modal = document.getElementById('councilDetailsModal');
        if (!modal) return;

        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore background scroll

        // Clean up event listener
        if (modal._escapeHandler) {
            document.removeEventListener('keydown', modal._escapeHandler);
            delete modal._escapeHandler;
        }
    }

    updateResultsCounter(showing, total) {
        const resultsCountEl = document.getElementById('results-count');
        const totalCountEl = document.getElementById('total-count');
        
        if (resultsCountEl) resultsCountEl.textContent = showing;
        if (totalCountEl) totalCountEl.textContent = total;
    }

    setupProfessionalFilters() {
        // Status filter dropdown
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'all') {
                    this.filters.status = [];
                } else {
                    // Map dropdown values to internal status values
                    const statusMap = {
                        'using-sgars': ['Yes'],
                        'sgar-free': ['No'], 
                        'unknown': ['Unknown']
                    };
                    this.filters.status = statusMap[value] || [];
                }
                this.renderCouncils();
                this.updateClearFiltersVisibility();
                this.updateFilteredResultsCounter();
            });
        }

        // Region filter dropdown
        const regionFilter = document.getElementById('region-filter');
        if (regionFilter) {
            regionFilter.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'all') {
                    this.filters.region = [];
                } else {
                    // Map dropdown values to internal region values
                    const regionMap = {
                        'sydney-metropolitan': ['Sydney Metropolitan'],
                        'regional-nsw': ['Regional NSW'],
                        'hunter-region': ['Hunter Region'],
                        'illawarra-region': ['Illawarra Region']
                    };
                    this.filters.region = regionMap[value] || [value];
                }
                this.renderCouncils();
                this.updateClearFiltersVisibility();
                this.updateFilteredResultsCounter();
            });
        }
    }

    updateFilteredResultsCounter() {
        const filteredCouncils = this.getFilteredCouncils();
        this.updateResultsCounter(filteredCouncils.length, this.councils.length);
    }
}