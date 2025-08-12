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
        console.log('🗺️ Starting loadCouncilBoundaries...');
        
        // Create vector source for council boundaries
        this.vectorSource = new ol.source.Vector();

        // Create vector layer with styling
        this.vectorLayer = new ol.layer.Vector({
            source: this.vectorSource,
            style: (feature) => this.getCouncilStyle(feature)
        });

        this.map.addLayer(this.vectorLayer);
        console.log('✅ Added vectorLayer to map');

        // Load NSW LGA boundaries from OpenDataSoft (reliable alternative)
        // Using official Australian LGA data filtered for NSW only
        const geoJsonUrl = 'https://data.opendatasoft.com/api/records/1.0/search/?dataset=georef-australia-local-government-area@public&q=NSW&format=geojson&rows=200';
        console.log('🌐 Loading GeoJSON from OpenDataSoft:', geoJsonUrl);
        
        const lgaSource = new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            url: geoJsonUrl
        });

        // Create layer for LGA boundaries
        const lgaLayer = new ol.layer.Vector({
            source: lgaSource,
            style: (feature) => this.getLGAStyle(feature)
        });

        console.log('📍 Adding LGA layer to map...');
        this.map.addLayer(lgaLayer);
        console.log('✅ LGA layer added to map');

        // Store reference for filtering
        this.lgaLayer = lgaLayer;

        // Debug: Monitor loading states
        lgaSource.on('featuresloadstart', () => {
            console.log('🔄 Features loading started...');
        });

        // Listen for features loaded
        lgaSource.on('featuresloadend', () => {
            console.log('✅ Features loading completed!');
            this.onBoundariesLoaded();
        });
        
        // Debug: Add error handling for loading
        lgaSource.on('featuresloaderror', (event) => {
            console.error('❌ Error loading GeoJSON features:', event);
        });
        
        // Simplified debug check (reduced to prevent loops)
        setTimeout(() => {
            console.log('🔍 Layer status: visible=' + lgaLayer.getVisible() + ', features=' + lgaSource.getFeatures().length);
        }, 3000);
    }

    getLGAStyle(feature) {
        // Debug: Track total style calls with rate limiting
        if (!this.styleCallCount) this.styleCallCount = 0;
        if (!this.lastStyleLogTime) this.lastStyleLogTime = 0;
        this.styleCallCount++;
        
        // Try multiple possible property names for LGA name (OpenDataSoft format)
        const councilName = feature.get('lga_name_2021') || feature.get('lga_name') || feature.get('LGA_NAME') || 
                           feature.get('name') || feature.get('NAME') || feature.get('lga_nam11') || 
                           feature.get('lga_name16') || feature.get('LGA_NAME22') || feature.get('lgaName') || 
                           feature.get('LGA_NAM');
        const council = this.findCouncilByName(councilName);
        
        // Debug: Rate limited logging (max once per second)
        const now = Date.now();
        if (this.styleCallCount <= 5 && now - this.lastStyleLogTime > 1000) {
            console.log(`🎨 Style call ${this.styleCallCount}: GIS name="${councilName}", Found council:`, council ? `${council.name} (${council.status})` : 'NOT FOUND');
            const props = feature.getProperties();
            console.log('Feature properties:', Object.keys(props).filter(k => k !== 'geometry'));
            this.lastStyleLogTime = now;
        }
        
        if (!council) {
            // Default style for unmapped councils
            const defaultStyle = new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: '#cccccc',
                    width: 1
                }),
                fill: new ol.style.Fill({
                    color: 'rgba(200, 200, 200, 0.1)'
                })
            });
            
            // Removed debug log to prevent console spam
            return defaultStyle;
        }

        const colors = this.getStatusColors(council.status);
        
        const style = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: colors.border,
                width: 2
            }),
            fill: new ol.style.Fill({
                color: colors.fill
            })
        });
        
        // Removed debug log to prevent console spam
        
        return style;
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
            const councilName = feature.get('lga_name_2021') || feature.get('lga_name') || feature.get('LGA_NAME') || 
                               feature.get('name') || feature.get('NAME') || feature.get('lga_nam11') || 
                               feature.get('lga_name16') || feature.get('LGA_NAME22') || feature.get('lgaName') || 
                               feature.get('LGA_NAM');
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
        console.log('🎉 NSW LGA boundaries loaded successfully');
        
        // Debug: Check what features were loaded
        if (this.lgaLayer) {
            const features = this.lgaLayer.getSource().getFeatures();
            console.log(`📊 Loaded ${features.length} LGA features`);
            
            if (features.length === 0) {
                console.error('❌ No features found in loaded data!');
                return;
            }
            
            // Sample some feature names for debugging
            features.slice(0, 5).forEach((feature, index) => {
                const properties = feature.getProperties();
                const propertyNames = Object.keys(properties).filter(key => key !== 'geometry');
                console.log(`📝 Feature ${index} properties:`, propertyNames);
                
                // Show all property values for first feature
                if (index === 0) {
                    console.log('📝 First feature all properties:', properties);
                }
                
                const name = feature.get('lga_name_2021') || feature.get('lga_name') || feature.get('LGA_NAME') || 
                           feature.get('name') || feature.get('NAME') || feature.get('lga_nam11') || 
                           feature.get('lga_name16') || feature.get('LGA_NAME22') || feature.get('lgaName') || 
                           feature.get('LGA_NAM');
                const council = this.findCouncilByName(name);
                console.log(`🏛️ Feature ${index}: GIS name="${name}", Found council:`, council ? `${council.name} (${council.status})` : 'NOT FOUND');
                
                // Check geometry
                const geometry = feature.getGeometry();
                if (geometry) {
                    console.log(`🗺️ Feature ${index} geometry type:`, geometry.getType());
                    const extent = geometry.getExtent();
                    console.log(`📐 Feature ${index} extent:`, extent);
                } else {
                    console.error(`❌ Feature ${index} has no geometry!`);
                }
            });
            
            // Note: Removed forced style refresh to prevent infinite loops
            
            // Check if layer is visible and has proper z-index
            console.log('👀 Layer visibility checks:');
            console.log('- Layer visible:', this.lgaLayer.getVisible());
            console.log('- Layer opacity:', this.lgaLayer.getOpacity());
            console.log('- Layer z-index:', this.lgaLayer.getZIndex());
        }
        
        this.updateMapData();
    }

    updateMapData() {
        // Note: Removed refresh() call to prevent infinite loops
        // The layer should auto-update when data is loaded
        console.log('📊 updateMapData called');
    }

    applyFilter(filter) {
        this.currentFilter = filter;
        
        if (this.lgaLayer) {
            this.lgaLayer.setStyle((feature) => {
                const councilName = feature.get('lga_name_2021') || feature.get('lga_name') || feature.get('LGA_NAME') || 
                                  feature.get('name') || feature.get('NAME') || feature.get('lga_nam11') || 
                                  feature.get('lga_name16') || feature.get('LGA_NAME22') || feature.get('lgaName') || 
                                  feature.get('LGA_NAM');
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
            const name = f.get('lga_name_2021') || f.get('lga_name') || f.get('LGA_NAME') || 
                        f.get('name') || f.get('NAME') || f.get('lga_nam11') || 
                        f.get('lga_name16') || f.get('LGA_NAME22') || f.get('lgaName') || 
                        f.get('LGA_NAM');
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