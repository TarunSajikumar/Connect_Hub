// ============================================================
// SOCIAL HUB — modules/downloader/providers/base-provider.js
// Abstract Base Provider Class
// ============================================================

export class BaseProvider {
  /**
   * @param {object} config
   * @param {string} config.name - Identifier for the provider
   * @param {string[]} config.supportedPlatforms - Array of supported platforms ('youtube', 'instagram')
   * @param {number} [config.timeoutMs=35000] - Default execution timeout
   */
  constructor({ name, supportedPlatforms = [], timeoutMs = 35000 }) {
    this.name = name;
    this.supportedPlatforms = supportedPlatforms;
    this.timeoutMs = timeoutMs;
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.totalSuccess = 0;
    this.totalFailures = 0;
  }

  /**
   * Check if provider is supported and healthy.
   *
   * @returns {Promise<{ available: boolean, reason?: string }>}
   */
  async checkHealth() {
    return { available: true };
  }

  /**
   * Perform media download.
   * Must return an object with `{ filePath: string, title?: string, mimeType?: string }`.
   *
   * @param {object} context
   * @param {string} context.url - Target URL
   * @param {string} context.jobDir - Isolated working directory
   * @param {number} context.timestamp - Job timestamp
   * @param {object} [context.options={}] - Additional options (audioOnly, format, etc.)
   * @param {AbortSignal} [context.signal] - Abort signal
   * @returns {Promise<{ filePath: string, title?: string, mimeType?: string }>}
   */
  async download(context) {
    throw new Error(`Provider ${this.name} has not implemented download()`);
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();
    this.totalSuccess++;
  }

  recordFailure() {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    this.totalFailures++;
  }

  /**
   * Circuit breaker: If 3 consecutive failures occur within the last 60s,
   * consider the provider temporarily degraded/cooldown.
   */
  isCircuitOpen() {
    if (this.consecutiveFailures >= 3) {
      const cooldownMs = 60 * 1000;
      if (Date.now() - this.lastFailureTime < cooldownMs) {
        return true;
      }
      // Cooldown expired, half-open state allows a retry
      return false;
    }
    return false;
  }
}
