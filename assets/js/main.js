// Main application initialization
import { SGARTracker } from './sgar-tracker.js';
import { MapController } from './map-controller.js';
import { UIController } from './ui-controller.js';
import { logError, validateCouncilData, createError } from './utils.js';

// Global application instance
let app = null;
let mapController = null;
let uiController = null;

// Application initialization
async function initializeApp() {
    try {
        // Wait for council data to load
        const councilData = await window.councilDataPromise;
        
        if (!councilData || Object.keys(councilData).length === 0) {
            throw createError('Failed to load council data', 'NO_COUNCIL_DATA');
        }

        // Validate council data structure
        const validationErrors = [];
        Object.entries(councilData).forEach(([name, data]) => {
            const validation = validateCouncilData(data);
            if (!validation.isValid) {
                validationErrors.push(`${name}: ${validation.errors.join(', ')}`);
            }
        });

        if (validationErrors.length > 0) {
            console.warn('Council data validation warnings:', validationErrors);
        }
        
        // Initialize the main application with council data
        app = new SGARTracker(councilData);
        
        // Initialize the map controller with councils and app reference
        mapController = new MapController(app.councils, app);
        
        // Wait for map controller to fully initialize (including name mapping)
        await mapController.init();
        
        // Initialize the UI controller with both app and map references
        uiController = new UIController(app, mapController);
        
        // Establish bidirectional connections
        app.setMapController(mapController);
        app.setUIController(uiController);
        
        // Make all controllers globally available for inline event handlers
        window.app = app;
        window.mapController = mapController;
        window.uiController = uiController;
        
        console.log('SGAR Tracker initialized successfully');
        console.log('Map Controller initialized successfully');
        console.log('UI Controller initialized successfully');
        
    } catch (error) {
        logError(error, 'Application initialization', { 
            url: window.location.href,
            timestamp: new Date().toISOString()
        });
        showErrorMessage('Failed to load application. Please refresh the page.');
    }
}

// Error handling
function showErrorMessage(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-banner';
    errorContainer.innerHTML = `
        <div class="error-content">
            <h3>⚠️ Error</h3>
            <p>${message}</p>
            <button onclick="location.reload()" class="retry-btn">Retry</button>
        </div>
    `;
    
    // Insert at the top of the body
    document.body.insertBefore(errorContainer, document.body.firstChild);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export for potential external use
export { app, mapController, uiController };