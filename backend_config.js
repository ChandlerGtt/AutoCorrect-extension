/**
 * Backend Configuration for AutoCorrect Extension
 * Configure connection to FastAPI backend
 */

const BACKEND_CONFIG = {
  // Enable/disable backend API
  enabled: true,

  // Backend API endpoint
  endpoint: "http://localhost:8000/correct",

  // Request timeout (milliseconds) - increase for ML model
  timeout: 3000,

  // Fall back to client-side if backend fails
  fallbackToClientSide: true,

  // Cache backend results
  cacheEnabled: true
};

// Load settings from Chrome storage (with backend enabled by default)
chrome.storage.sync.get({
  backendEnabled: true,  // Changed to true
  backendURL: 'http://localhost:8000/correct',
  backendTimeout: 3000,  // Increased timeout for ML
  backendFallback: true
}, (settings) => {
  BACKEND_CONFIG.enabled = settings.backendEnabled;
  BACKEND_CONFIG.endpoint = settings.backendURL;
  BACKEND_CONFIG.timeout = settings.backendTimeout;
  BACKEND_CONFIG.fallbackToClientSide = settings.backendFallback;
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BACKEND_CONFIG;
}