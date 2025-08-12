/**
 * Utility Functions Module
 * Common helper functions used across the SGAR advocacy tool application
 */

// =============================================================================
// DATA FORMATTING AND VALIDATION
// =============================================================================

/**
 * Validates council data structure
 * @param {Object} councilData - The council data to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateCouncilData(councilData) {
    const errors = [];
    const requiredFields = ['sgars', 'notes', 'email'];
    
    if (!councilData || typeof councilData !== 'object') {
        return { isValid: false, errors: ['Council data must be an object'] };
    }

    // Check for required fields
    requiredFields.forEach(field => {
        if (!(field in councilData)) {
            errors.push(`Missing required field: ${field}`);
        }
    });

    // Validate SGAR status
    const validStatuses = ['Yes', 'No', 'Unknown'];
    if (councilData.sgars && !validStatuses.includes(councilData.sgars)) {
        errors.push(`Invalid SGAR status: ${councilData.sgars}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate email format
    if (councilData.email && !isValidEmail(councilData.email)) {
        errors.push(`Invalid email format: ${councilData.email}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email is valid
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Formats council status for display
 * @param {string} status - Council SGAR status
 * @returns {Object} Formatted status with text, icon, and class
 */
export function formatCouncilStatus(status) {
    const statusMap = {
        'Yes': {
            text: 'Using SGARs',
            icon: '⚠️',
            class: 'danger',
            description: 'This council currently uses Second Generation Anticoagulant Rodenticides'
        },
        'No': {
            text: 'SGAR-Free',
            icon: '✅',
            class: 'success',
            description: 'This council has committed to wildlife-safe pest management'
        },
        'Unknown': {
            text: 'Status Unknown',
            icon: '❓',
            class: 'warning',
            description: 'This council\'s SGAR usage status needs verification'
        }
    };

    return statusMap[status] || statusMap['Unknown'];
}

/**
 * Formats a number with appropriate units and locale
 * @param {number} num - Number to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted number
 */
export function formatNumber(num, options = {}) {
    const { 
        decimals = 0, 
        locale = 'en-AU', 
        style = 'decimal',
        currency = 'AUD' 
    } = options;

    if (typeof num !== 'number' || isNaN(num)) {
        return '0';
    }

    const formatOptions = {
        style,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    };

    if (style === 'currency') {
        formatOptions.currency = currency;
    }

    try {
        return new Intl.NumberFormat(locale, formatOptions).format(num);
    } catch (error) {
        // Fallback for unsupported locales
        return num.toFixed(decimals);
    }
}

/**
 * Formats percentage with proper rounding
 * @param {number} value - Value to format as percentage
 * @param {number} total - Total value for percentage calculation
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export function formatPercentage(value, total, decimals = 1) {
    if (!total || total === 0) return '0%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
}

// =============================================================================
// STRING MANIPULATION UTILITIES
// =============================================================================

/**
 * Capitalizes first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function titleCase(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Converts string to URL-friendly slug
 * @param {string} str - String to convert
 * @returns {string} URL slug
 */
export function slugify(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Truncates text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
    if (!text || typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Removes HTML tags from string
 * @param {string} html - HTML string to clean
 * @returns {string} Clean text
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

/**
 * Highlights search terms in text
 * @param {string} text - Text to highlight
 * @param {string} searchTerm - Term to highlight
 * @returns {string} Text with highlighted terms
 */
export function highlightText(text, searchTerm) {
    if (!text || !searchTerm) return text;
    const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Escapes special regex characters in string
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Formats date for display
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date
 */
export function formatDate(date, options = {}) {
    const { 
        format = 'short',
        locale = 'en-AU',
        timeZone = 'Australia/Sydney'
    } = options;

    if (!date) return '';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';

    const formatOptions = {
        timeZone,
        year: 'numeric',
        month: format === 'long' ? 'long' : 'short',
        day: 'numeric'
    };

    try {
        return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
    } catch (error) {
        // Fallback formatting
        return dateObj.toLocaleDateString();
    }
}

/**
 * Gets relative time string (e.g., "2 days ago")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export function getRelativeTime(date) {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';

    const now = new Date();
    const diffInMs = now - dateObj;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
}

/**
 * Checks if a date is recent (within specified days)
 * @param {Date|string} date - Date to check
 * @param {number} days - Number of days to consider recent (default: 30)
 * @returns {boolean} True if date is recent
 */
export function isRecentDate(date, days = 30) {
    if (!date) return false;
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return false;

    const now = new Date();
    const diffInMs = now - dateObj;
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    return diffInDays <= days;
}

// =============================================================================
// URL AND DATA EXPORT UTILITIES
// =============================================================================

/**
 * Generates CSV data from council information
 * @param {Array} councils - Array of council objects
 * @returns {string} CSV formatted string
 */
export function generateCSV(councils) {
    if (!Array.isArray(councils) || councils.length === 0) {
        return 'No data available';
    }

    const headers = ['Council Name', 'Region', 'SGAR Status', 'Notes', 'Contact Email', 'Last Updated'];
    const csvRows = [headers.join(',')];

    councils.forEach(council => {
        const row = [
            `"${council.name || ''}"`,
            `"${council.region || ''}"`,
            `"${council.status || ''}"`,
            `"${(council.notes || '').replace(/"/g, '""')}"`,
            `"${council.contactEmail || ''}"`,
            `"${council.lastUpdated || ''}"`
        ];
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
}

/**
 * Downloads data as file
 * @param {string} content - File content
 * @param {string} filename - Name of file to download
 * @param {string} mimeType - MIME type of file
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Generates shareable URL with parameters
 * @param {Object} params - Parameters to include in URL
 * @returns {string} Shareable URL
 */
export function generateShareableURL(params = {}) {
    const url = new URL(window.location.href);
    
    // Clear existing search params
    url.search = '';
    
    // Add new parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            url.searchParams.set(key, value);
        }
    });
    
    return url.toString();
}

/**
 * Parses URL parameters
 * @returns {Object} Object containing URL parameters
 */
export function parseURLParams() {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    
    for (const [key, value] of urlParams) {
        params[key] = value;
    }
    
    return params;
}

// =============================================================================
// PERFORMANCE OPTIMIZATION HELPERS
// =============================================================================

/**
 * Throttles function calls to specified interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Debounces function calls to prevent excessive execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * Memoizes function results for performance
 * @param {Function} func - Function to memoize
 * @param {Function} keyGenerator - Function to generate cache key
 * @returns {Function} Memoized function
 */
export function memoize(func, keyGenerator) {
    const cache = new Map();
    
    return function(...args) {
        const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
        
        if (cache.has(key)) {
            return cache.get(key);
        }
        
        const result = func.apply(this, args);
        cache.set(key, result);
        return result;
    };
}

/**
 * Batches function calls for performance
 * @param {Function} func - Function to batch
 * @param {number} batchSize - Maximum batch size
 * @returns {Function} Batched function
 */
export function batchProcess(func, batchSize = 50) {
    let queue = [];
    let processing = false;
    
    const processBatch = async () => {
        if (processing || queue.length === 0) return;
        
        processing = true;
        const batch = queue.splice(0, batchSize);
        
        try {
            await func(batch);
        } catch (error) {
            console.error('Batch processing error:', error);
        } finally {
            processing = false;
            if (queue.length > 0) {
                setTimeout(processBatch, 0);
            }
        }
    };
    
    return (item) => {
        queue.push(item);
        if (!processing) {
            setTimeout(processBatch, 0);
        }
    };
}

// =============================================================================
// BROWSER COMPATIBILITY DETECTION
// =============================================================================

/**
 * Detects browser support for various features
 * @returns {Object} Object containing feature support flags
 */
export function detectBrowserFeatures() {
    return {
        localStorage: (() => {
            try {
                const test = '__localStorage_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch {
                return false;
            }
        })(),
        
        webGL: (() => {
            try {
                const canvas = document.createElement('canvas');
                return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
            } catch {
                return false;
            }
        })(),
        
        serviceWorker: 'serviceWorker' in navigator,
        
        intersectionObserver: 'IntersectionObserver' in window,
        
        geolocation: 'geolocation' in navigator,
        
        touchEvents: 'ontouchstart' in window,
        
        mediaQueries: window.matchMedia && window.matchMedia('(min-width: 0px)').matches,
        
        cssGrid: CSS.supports('display', 'grid'),
        
        cssCustomProperties: CSS.supports('--custom', 'property'),
        
        fetch: 'fetch' in window,
        
        promises: 'Promise' in window,
        
        modules: 'noModule' in document.createElement('script')
    };
}

/**
 * Gets browser information
 * @returns {Object} Browser name and version information
 */
export function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';
    
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
        browser = 'Chrome';
        version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Firefox')) {
        browser = 'Firefox';
        version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browser = 'Safari';
        version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Edg')) {
        browser = 'Edge';
        version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
    }
    
    return { browser, version, userAgent: ua };
}

// =============================================================================
// LOCAL STORAGE HELPERS
// =============================================================================

/**
 * Safely gets item from localStorage with JSON parsing
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Stored value or default
 */
export function getStorageItem(key, defaultValue = null) {
    try {
        if (!detectBrowserFeatures().localStorage) {
            return defaultValue;
        }
        
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading from localStorage key "${key}":`, error);
        return defaultValue;
    }
}

/**
 * Safely sets item in localStorage with JSON serialization
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful
 */
export function setStorageItem(key, value) {
    try {
        if (!detectBrowserFeatures().localStorage) {
            return false;
        }
        
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn(`Error writing to localStorage key "${key}":`, error);
        return false;
    }
}

/**
 * Removes item from localStorage
 * @param {string} key - Storage key to remove
 * @returns {boolean} True if successful
 */
export function removeStorageItem(key) {
    try {
        if (!detectBrowserFeatures().localStorage) {
            return false;
        }
        
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn(`Error removing localStorage key "${key}":`, error);
        return false;
    }
}

/**
 * Clears all localStorage items with optional prefix filter
 * @param {string} prefix - Optional prefix to filter keys
 * @returns {boolean} True if successful
 */
export function clearStorage(prefix = '') {
    try {
        if (!detectBrowserFeatures().localStorage) {
            return false;
        }
        
        if (prefix) {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } else {
            localStorage.clear();
        }
        
        return true;
    } catch (error) {
        console.warn('Error clearing localStorage:', error);
        return false;
    }
}

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Creates standardized error object
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {*} details - Additional error details
 * @returns {Object} Standardized error object
 */
export function createError(message, code = 'UNKNOWN_ERROR', details = null) {
    return {
        message,
        code,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };
}

/**
 * Logs error with structured information
 * @param {Error|Object} error - Error to log
 * @param {string} context - Context where error occurred
 * @param {Object} additionalData - Additional data to log
 */
export function logError(error, context = '', additionalData = {}) {
    const errorInfo = {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace',
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...additionalData
    };
    
    console.error('Application Error:', errorInfo);
    
    // Here you could also send to error reporting service
    // sendToErrorReportingService(errorInfo);
}

/**
 * Safe function execution with error handling
 * @param {Function} func - Function to execute safely
 * @param {*} defaultReturn - Default return value on error
 * @param {string} context - Context for error logging
 * @returns {*} Function result or default value
 */
export function safeExecute(func, defaultReturn = null, context = '') {
    try {
        return func();
    } catch (error) {
        logError(error, context);
        return defaultReturn;
    }
}

/**
 * Retries function execution with exponential backoff
 * @param {Function} func - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with function result
 */
export async function retryWithBackoff(func, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await func();
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// =============================================================================
// DATA TRANSFORMATION FUNCTIONS
// =============================================================================

/**
 * Transforms raw council data to application format
 * @param {Object} rawData - Raw council data from JSON
 * @returns {Array} Transformed council array
 */
export function transformCouncilData(rawData) {
    if (!rawData || typeof rawData !== 'object') {
        return [];
    }
    
    return Object.entries(rawData).map(([name, data]) => ({
        name: titleCase(name),
        status: data.sgars || 'Unknown',
        notes: data.notes || '',
        contactEmail: data.email || '',
        region: data.region || 'Other',
        lastUpdated: data.lastUpdated || new Date().toISOString().split('T')[0]
    })).filter(council => council.name); // Remove entries without names
}

/**
 * Groups councils by region
 * @param {Array} councils - Array of council objects
 * @returns {Object} Object with regions as keys and council arrays as values
 */
export function groupCouncilsByRegion(councils) {
    return councils.reduce((groups, council) => {
        const region = council.region || 'Other';
        if (!groups[region]) {
            groups[region] = [];
        }
        groups[region].push(council);
        return groups;
    }, {});
}

/**
 * Groups councils by status
 * @param {Array} councils - Array of council objects
 * @returns {Object} Object with statuses as keys and council arrays as values
 */
export function groupCouncilsByStatus(councils) {
    return councils.reduce((groups, council) => {
        const status = council.status || 'Unknown';
        if (!groups[status]) {
            groups[status] = [];
        }
        groups[status].push(council);
        return groups;
    }, {});
}

/**
 * Filters councils based on criteria
 * @param {Array} councils - Array of council objects
 * @param {Object} criteria - Filter criteria
 * @returns {Array} Filtered councils
 */
export function filterCouncils(councils, criteria = {}) {
    return councils.filter(council => {
        // Status filter
        if (criteria.status && criteria.status.length > 0) {
            if (!criteria.status.includes(council.status)) {
                return false;
            }
        }
        
        // Region filter
        if (criteria.region && criteria.region.length > 0) {
            if (!criteria.region.includes(council.region)) {
                return false;
            }
        }
        
        // Search filter
        if (criteria.search) {
            const searchTerm = criteria.search.toLowerCase();
            const searchableText = [
                council.name,
                council.region,
                council.notes,
                council.contactEmail
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(searchTerm)) {
                return false;
            }
        }
        
        return true;
    });
}

/**
 * Sorts councils by specified criteria
 * @param {Array} councils - Array of council objects
 * @param {string} sortBy - Field to sort by
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted councils
 */
export function sortCouncils(councils, sortBy = 'name', direction = 'asc') {
    return [...councils].sort((a, b) => {
        let valueA = a[sortBy] || '';
        let valueB = b[sortBy] || '';
        
        // Handle different data types
        if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }
        
        let result = 0;
        if (valueA < valueB) result = -1;
        else if (valueA > valueB) result = 1;
        
        return direction === 'desc' ? -result : result;
    });
}

/**
 * Calculates statistics from council data
 * @param {Array} councils - Array of council objects
 * @returns {Object} Statistics object
 */
export function calculateCouncilStats(councils) {
    const total = councils.length;
    const byStatus = groupCouncilsByStatus(councils);
    const byRegion = groupCouncilsByRegion(councils);
    
    return {
        total,
        usingSgars: byStatus['Yes']?.length || 0,
        sgarFree: byStatus['No']?.length || 0,
        unknown: byStatus['Unknown']?.length || 0,
        regions: Object.keys(byRegion).length,
        byRegion: Object.entries(byRegion).map(([region, regionCouncils]) => ({
            region,
            total: regionCouncils.length,
            usingSgars: regionCouncils.filter(c => c.status === 'Yes').length,
            sgarFree: regionCouncils.filter(c => c.status === 'No').length,
            unknown: regionCouncils.filter(c => c.status === 'Unknown').length
        }))
    };
}

// =============================================================================
// UTILITY CONSTANTS AND EXPORTS
// =============================================================================

/**
 * Common constants used across the application
 */
export const CONSTANTS = {
    SGAR_STATUSES: ['Yes', 'No', 'Unknown'],
    NSW_REGIONS: [
        'Hunter', 'Illawarra', 'Metro North', 'Metro South', 'Metro West',
        'Mid North Coast', 'North Coast', 'Northern Inland', 'Central West',
        'Orana', 'South East', 'South West'
    ],
    LOCAL_STORAGE_KEYS: {
        USER_PREFERENCES: 'sgar_user_preferences',
        FILTER_STATE: 'sgar_filter_state',
        LAST_VISIT: 'sgar_last_visit'
    },
    API_ENDPOINTS: {
        COUNCILS_DATA: './data/councils.json'
    }
};

/**
 * Default configuration object
 */
export const DEFAULT_CONFIG = {
    animationDuration: 300,
    debounceDelay: 300,
    throttleLimit: 100,
    toastDuration: 4000,
    maxToasts: 3,
    csvFilename: 'nsw_councils_sgar_data.csv',
    dateFormat: 'short',
    locale: 'en-AU',
    timeZone: 'Australia/Sydney'
};

// Export all utility functions for easy importing
export default {
    // Data formatting and validation
    validateCouncilData,
    isValidEmail,
    formatCouncilStatus,
    formatNumber,
    formatPercentage,
    
    // String manipulation
    titleCase,
    slugify,
    truncateText,
    stripHtml,
    highlightText,
    escapeRegExp,
    
    // Date utilities
    formatDate,
    getRelativeTime,
    isRecentDate,
    
    // URL and export utilities
    generateCSV,
    downloadFile,
    generateShareableURL,
    parseURLParams,
    
    // Performance optimization
    throttle,
    debounce,
    memoize,
    batchProcess,
    
    // Browser compatibility
    detectBrowserFeatures,
    getBrowserInfo,
    
    // Local storage
    getStorageItem,
    setStorageItem,
    removeStorageItem,
    clearStorage,
    
    // Error handling
    createError,
    logError,
    safeExecute,
    retryWithBackoff,
    
    // Data transformation
    transformCouncilData,
    groupCouncilsByRegion,
    groupCouncilsByStatus,
    filterCouncils,
    sortCouncils,
    calculateCouncilStats,
    
    // Constants
    CONSTANTS,
    DEFAULT_CONFIG
};