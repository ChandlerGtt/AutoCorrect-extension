/**
 * API Client for AutoCorrect Backend
 * Connects browser extension to FastAPI backend
 */

class AutoCorrectAPIClient {
  constructor(config = {}) {
    this.endpoint = config.endpoint || "http://localhost:8000/correct";
    this.timeout = config.timeout || 1000; // 1 second
    this.enabled = config.enabled !== false;
    this.fallbackToClientSide = config.fallbackToClientSide !== false;
  }

  /**
   * Correct text using backend API
   * @param {string} text - Text to correct
   * @param {Array<string>} context - Context words
   * @param {string} mode - Correction mode: 'auto', 'suggestions', 'grammar'
   * @returns {Promise<Object>} Correction result or null if failed
   */
  async correctText(text, context = [], mode = 'auto') {
    if (!this.enabled) {
      return null; // Fall back to client-side
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          context: context,
          mode: mode,
          max_suggestions: 3,
          use_neural: true,
          use_cache: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Backend API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      return {
        corrected: data.corrected,
        suggestions: data.suggestions.map(s => ({
          text: s.text,
          confidence: s.confidence,
          source: s.source
        })),
        confidence: data.confidence,
        changes_made: data.changes_made,
        processing_time_ms: data.processing_time_ms,
        source: 'backend'
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Backend API timeout');
      } else {
        console.warn('Backend API error:', error.message);
      }
      return null; // Fall back to client-side
    }
  }

  /**
   * Check if backend is available
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const healthEndpoint = this.endpoint.replace('/correct', '/health');
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Enable backend API
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable backend API
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Update backend endpoint URL
   * @param {string} url - New endpoint URL
   */
  setEndpoint(url) {
    this.endpoint = url;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoCorrectAPIClient;
}
