/**
 * Map Controller Module
 * Handles interactive OpenLayers map functionality for NSW councils
 */
import { formatCouncilStatus, logError, safeExecute } from './utils.js';

export class MapController {
    constructor(councils, sgarTracker) {
        this.councils = councils;
        this.sgarTracker = sgarTracker;
        this.map = null;
        this.vectorLayer = null;
        this.popup = null;
        this.vectorSource = null;
        this.currentFilter = null;
        this.nameMapping = null;
    }

    async init() {
        this.createMap();
        this.createPopup();
        await this.loadNameMapping();
        
        // Debug: Log council data info
        console.log(`MapController initialized with ${this.councils.length} councils`);
        console.log('Sample council names:', this.councils.slice(0, 5).map(c => `"${c.name}" (${c.status})`));
        
        this.loadCouncilBoundaries();
        this.setupMapControls();
    }

    async loadNameMapping() {
        try {
            const response = await fetch('./data/council_name_mapping.json');
            if (!response.ok) {
                throw new Error(`Failed to load name mapping: ${response.status}`);
            }
            this.nameMapping = await response.json();
            console.log('Council name mapping loaded successfully');
        } catch (error) {
            logError(error, 'MapController.loadNameMapping');
            console.warn('Using fallback name matching without mapping file');
        }
    }

    createMap() {
        // Create the map instance
        this.map = new ol.Map({
            target: 'map',
            layers: [
                // Base tile layer - OpenStreetMap
                new ol.layer.Tile({
                    source: new ol.source.OSM()
                })
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat([147.0, -32.0]), // Center on NSW
                zoom: 6,
                minZoom: 5,
                maxZoom: 12
            }),
            controls: [
                new ol.control.Attribution({
                    collapsible: false
                }),
                new ol.control.Rotate(),
                new ol.control.Zoom()
            ]
        });

        // Zoom control is already included in the default controls above

        // Add fullscreen control
        this.map.addControl(new ol.control.FullScreen());

        // Handle map click events
        this.map.on('singleclick', (evt) => {
            this.handleMapClick(evt);
        });

        // Handle pointer move for hover effects
        this.map.on('pointermove', (evt) => {
            this.handlePointerMove(evt);
        });
    }

    createPopup() {
        // Create popup overlay
        const popupElement = document.getElementById('map-popup');
        if (!popupElement) {
            // Create popup element if it doesn't exist
            const popup = document.createElement('div');
            popup.id = 'map-popup';
            popup.className = 'ol-popup';
            document.body.appendChild(popup);
        }

        this.popup = new ol.Overlay({
            element: document.getElementById('map-popup'),
            autoPan: true,
            autoPanAnimation: {
                duration: 250
            },
            positioning: 'bottom-center',
            stopEvent: false,
            offset: [0, -10]
        });

        this.map.addOverlay(this.popup);

        // Add close button functionality
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('popup-closer')) {
                this.closePopup();
            }
        });
    }

    loadCouncilBoundaries() {
        // Create vector source for council boundaries
        this.vectorSource = new ol.source.Vector();

        // Create vector layer with styling
        this.vectorLayer = new ol.layer.Vector({
            source: this.vectorSource,
            style: (feature) => this.getCouncilStyle(feature)
        });

        this.map.addLayer(this.vectorLayer);

        // Load NSW LGA boundaries from public data source
        // Using NSW Spatial Services WFS endpoint
        const wfsSource = new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            url: (extent) => {
                return `https://maps.six.nsw.gov.au/arcgis/services/public/NSW_Administrative_Boundaries/MapServer/WFSServer?` +
                       `service=WFS&version=1.1.0&request=GetFeature&typename=NSW_Administrative_Boundaries:LGA&` +
                       `outputFormat=application/json&srsname=EPSG:3857&` +
                       `bbox=${extent.join(',')},EPSG:3857`;
            },
            strategy: ol.loadingstrategy.bbox
        });

        // Create layer for LGA boundaries
        const lgaLayer = new ol.layer.Vector({
            source: wfsSource,
            style: (feature) => this.getLGAStyle(feature)
        });

        this.map.addLayer(lgaLayer);

        // Store reference for filtering
        this.lgaLayer = lgaLayer;

        // Listen for features loaded
        wfsSource.on('featuresloadend', () => {
            this.onBoundariesLoaded();
        });
        
        // Debug: Add error handling for WFS loading
        wfsSource.on('featuresloaderror', (event) => {
            console.error('Error loading WFS features:', event);
        });
    }

    getLGAStyle(feature) {
        const councilName = feature.get('lga_name') || feature.get('LGA_NAME') || feature.get('name');
        const council = this.findCouncilByName(councilName);
        
        // Debug: Log styling decisions for first few features
        if (Math.random() < 0.05) { // Only log ~5% of features to avoid spam
            console.log(`Styling feature with GIS name: "${councilName}", Found council:`, council ? `${council.name} (${council.status})` : 'NOT FOUND');
        }
        
        if (!council) {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#cccccc',
                    width: 1
                }),
                fill: new ol.style.Fill({
                    color: 'rgba(200, 200, 200, 0.1)'
                })
            });
        }

        const colors = this.getStatusColors(council.status);
        
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: colors.border,
                width: 2
            }),
            fill: new ol.style.Fill({
                color: colors.fill
            })
        });
    }

    getCouncilStyle(feature) {
        const council = feature.get('council');
        if (!council) return this.getDefaultStyle();

        const colors = this.getStatusColors(council.status);
        
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: colors.border,
                width: 2
            }),
            fill: new ol.style.Fill({
                color: colors.fill
            })
        });
    }

    getStatusColors(status) {
        switch (status) {
            case 'Yes':
                return {
                    fill: 'rgba(235, 73, 58, 0.3)',
                    border: '#EB493A'
                };
            case 'No':
                return {
                    fill: 'rgba(76, 175, 80, 0.3)',
                    border: '#4CAF50'
                };
            case 'Unknown':
            default:
                return {
                    fill: 'rgba(255, 167, 38, 0.3)',
                    border: '#FFA726'
                };
        }
    }

    getDefaultStyle() {
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#cccccc',
                width: 1
            }),
            fill: new ol.style.Fill({
                color: 'rgba(200, 200, 200, 0.1)'
            })
        });
    }

    findCouncilByName(gisName) {
        if (!gisName) return null;
        
        // If we have name mapping, use reverse lookup first
        if (this.nameMapping) {
            // Create reverse mapping (GIS name -> our name)
            const reverseMapping = {};
            for (const [ourName, gisFullName] of Object.entries(this.nameMapping)) {
                reverseMapping[gisFullName] = ourName;
            }
            
            // Try exact match with mapping
            if (reverseMapping[gisName]) {
                const ourName = reverseMapping[gisName];
                const foundCouncil = this.councils.find(council => {
                    // Compare both the title case name and the uppercase version
                    return council.name.toUpperCase() === ourName.toUpperCase() ||
                           council.name.toUpperCase().replace(/\s+/g, ' ') === ourName.toUpperCase().replace(/\s+/g, ' ');
                });
                if (foundCouncil) {
                    console.log(`Found council via mapping: GIS="${gisName}" -> Our="${ourName}" -> Council="${foundCouncil.name}" (${foundCouncil.status})`);
                }
                return foundCouncil;
            }
        }
        
        // Fallback to fuzzy matching
        const normalizedGisName = gisName.toUpperCase().trim();
        
        // Remove common prefixes/suffixes for comparison
        const cleanGisName = normalizedGisName
            .replace(/\b(CITY|SHIRE|REGIONAL|MUNICIPAL|COUNCIL|THE COUNCIL OF THE|MUNICIPALITY OF|CITY OF|SHIRE OF)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return this.councils.find(council => {
            const councilName = council.name.toUpperCase();
            
            // Exact match
            if (councilName === normalizedGisName) return true;
            
            // Clean name comparison  
            const cleanCouncilName = councilName
                .replace(/\b(CITY|SHIRE|REGIONAL|MUNICIPAL|COUNCIL)\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();
                
            return cleanCouncilName === cleanGisName ||
                   cleanCouncilName.includes(cleanGisName) ||
                   cleanGisName.includes(cleanCouncilName);
        });
    }

    handleMapClick(evt) {
        const features = this.map.getFeaturesAtPixel(evt.pixel);
        
        if (features && features.length > 0) {
            const feature = features[0];
            const councilName = feature.get('lga_name') || feature.get('LGA_NAME') || feature.get('name');
            const council = this.findCouncilByName(councilName);
            
            if (council) {
                this.showPopup(evt.coordinate, council);
            }
        } else {
            this.closePopup();
        }
    }

    handlePointerMove(evt) {
        const features = this.map.getFeaturesAtPixel(evt.pixel);
        const target = this.map.getTarget();
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        
        if (features && features.length > 0) {
            element.style.cursor = 'pointer';
        } else {
            element.style.cursor = '';
        }
    }

    showPopup(coordinate, council) {
        const statusInfo = formatCouncilStatus(council.status);
        const statusIcon = statusInfo.icon;
        const statusText = statusInfo.text;

        const popupContent = `
            <button class="popup-closer">×</button>
            <div class="popup-content">
                <h3>${council.name}</h3>
                <p><strong>SGAR Status:</strong> ${statusIcon} ${statusText}</p>
                <p><strong>Region:</strong> ${council.region}</p>
                <p><strong>Notes:</strong> ${council.notes}</p>
                <p><strong>Contact:</strong> <a href="mailto:${council.contactEmail}">${council.contactEmail}</a></p>
                <button class="council-action-btn primary" style="width: 100%; margin-top: 10px;" 
                        onclick="app.contactCouncil('${encodeURIComponent(JSON.stringify(council))}')">
                    Take Action
                </button>
            </div>
        `;

        document.getElementById('map-popup').innerHTML = popupContent;
        document.getElementById('map-popup').style.display = 'block';
        this.popup.setPosition(coordinate);
    }

    closePopup() {
        this.popup.setPosition(undefined);
        document.getElementById('map-popup').style.display = 'none';
    }

    setupMapControls() {
        // Add custom search control if available
        if (typeof ol.control !== 'undefined' && ol.control.SearchNominatim) {
            const searchControl = new ol.control.SearchNominatim({
                placeholder: 'Search councils...',
                target: document.getElementById('lga-search')
            });
            this.map.addControl(searchControl);
        }

        // Add legend
        this.createLegend();
    }

    createLegend() {
        const legendElement = document.querySelector('.map-legend');
        if (legendElement) {
            legendElement.innerHTML = `
                <h4>SGAR Status</h4>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #EB493A;"></span>
                    <span>Using SGARs</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #4CAF50;"></span>
                    <span>SGAR-Free</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #FFA726;"></span>
                    <span>Status Unknown</span>
                </div>
            `;
        }
    }

    onBoundariesLoaded() {
        console.log('NSW LGA boundaries loaded successfully');
        
        // Debug: Check what features were loaded
        if (this.lgaLayer) {
            const features = this.lgaLayer.getSource().getFeatures();
            console.log(`Loaded ${features.length} LGA features`);
            
            // Sample some feature names for debugging
            features.slice(0, 5).forEach((feature, index) => {
                const name = feature.get('lga_name') || feature.get('LGA_NAME') || feature.get('name');
                const council = this.findCouncilByName(name);
                console.log(`Feature ${index}: GIS name="${name}", Found council:`, council ? council.name : 'NOT FOUND');
            });
        }
        
        this.updateMapData();
    }

    updateMapData() {
        // Refresh the map styling based on current data
        if (this.lgaLayer) {
            this.lgaLayer.getSource().refresh();
        }
    }

    applyFilter(filter) {
        this.currentFilter = filter;
        
        if (this.lgaLayer) {
            this.lgaLayer.setStyle((feature) => {
                const councilName = feature.get('lga_name') || feature.get('LGA_NAME') || feature.get('name');
                const council = this.findCouncilByName(councilName);
                
                if (!council) {
                    return this.getDefaultStyle();
                }

                // Apply filter logic
                if (filter && filter.status && filter.status.length > 0) {
                    if (!filter.status.includes(council.status)) {
                        // Hide councils that don't match filter
                        return new ol.style.Style({});
                    }
                }

                return this.getLGAStyle(feature);
            });
        }
    }

    zoomToCouncil(councilName) {
        if (!this.lgaLayer) return;

        const features = this.lgaLayer.getSource().getFeatures();
        const feature = features.find(f => {
            const name = f.get('lga_name') || f.get('LGA_NAME') || f.get('name');
            return name && name.toUpperCase().includes(councilName.toUpperCase());
        });

        if (feature) {
            const extent = feature.getGeometry().getExtent();
            this.map.getView().fit(extent, {
                padding: [50, 50, 50, 50],
                duration: 1000
            });
        }
    }

    resize() {
        // Handle responsive map resizing
        if (this.map) {
            setTimeout(() => {
                this.map.updateSize();
            }, 100);
        }
    }

    destroy() {
        if (this.map) {
            this.map.dispose();
            this.map = null;
        }
    }
}