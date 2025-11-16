/**
 * Backend Configuration for AutoCorrect Extension
 * Configure connection to FastAPI backend (optional)
 */

const BACKEND_CONFIG = {
  // Enable/disable backend API
  enabled: false,  // Set to true to use backend

  // Backend API endpoint
  endpoint: "http://localhost:8000/correct",

  // Request timeout (milliseconds)
  timeout: 1000,

  // Fall back to client-side if backend fails
  fallbackToClientSide: true,

  // Cache backend results
  cacheEnabled: true
};

// Load settings from Chrome storage
chrome.storage.sync.get({
  backendEnabled: false,
  backendURL: 'http://localhost:8000/correct',
  backendTimeout: 1000,
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
