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
        
        this.currentView = 'grid';
        this.filters = {
            status: [],
            region: [],
            search: '',
            quickFilter: null
        };
        this.mapController = null;
        this.uiController = null;
        this.init();
    }

    init() {
        this.updateStats();
        this.animateNumbers();
        this.setupEventListeners();
        this.renderCouncils();
        this.setupUnifiedSearch();
        this.setupViewToggle();
        this.initModalControls();
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
    }

    applyFilter(filterType) {
        // Reset filters
        this.filters = {
            status: [],
            region: [],
            search: '',
            quickFilter: filterType
        };

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
        this.currentView = view;
        
        // Update buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === view);
        });
        
        this.renderCouncils();
    }

    renderCouncils() {
        const container = document.getElementById('councils-container');
        if (!container) return;

        const filteredCouncils = this.getFilteredCouncils();
        
        if (this.currentView === 'grid') {
            container.className = 'councils-container council-grid';
            container.innerHTML = filteredCouncils.map(council => 
                this.createCouncilCard(council)
            ).join('');
        } else {
            container.className = 'councils-container council-list';
            container.innerHTML = filteredCouncils.map(council => 
                this.createCouncilListItem(council)
            ).join('');
        }
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

    createCouncilCard(council) {
        const statusInfo = formatCouncilStatus(council.status);
        const statusClass = statusInfo.class;
        const statusIcon = statusInfo.icon;

        return `
            <article class="council-card ${statusClass}">
                <div class="council-status-indicator"></div>
                <div class="council-card-header">
                    <h3 class="council-name">${council.name}</h3>
                    <span class="council-status ${statusClass}">
                        ${statusIcon} ${statusInfo.text}
                    </span>
                </div>
                <div class="council-card-body">
                    <div class="council-notes">${council.notes}</div>
                    <div class="council-contact">
                        📧 <a href="mailto:${council.contactEmail}">${council.contactEmail}</a>
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
                <div class="council-contact">
                    <a href="mailto:${council.contactEmail}" class="council-action-btn">Contact</a>
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
}