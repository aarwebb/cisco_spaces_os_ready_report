// Right Now checker for Spaces OS Ready Report v2
console.log('REPORT DEBUG: rightnow.js loaded');

const RIGHT_NOW_SSIDS_SETTINGS = '/api/v1/report/rightnow/settings';
const RIGHT_NOW_SSIDS_LIST = '/api/v1/report/rightnow/ssidlist';

class RightNowChecker {
  constructor(domain) {
    this.domain = domain;
    console.log(`[RightNowChecker] Initialized for domain: ${domain}`);
  }

  async execute() {
    console.log('[RightNowChecker] Starting data collection');
    const client = globalThis.createApiClient(this.domain);
    const endpoints = [RIGHT_NOW_SSIDS_SETTINGS, RIGHT_NOW_SSIDS_LIST];
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })));
    console.log('[RightNowChecker] API call results:', results);
    // Always wrap results under the check key for consistency
    return { rightNow: results };
  }

  static reportModule = {
    generateHTML: function(data) {
      console.log('[RightNowChecker] Generating HTML for data:', data);
      return `
        <div class="section" id="rightnow-section">
          <h2 class="section-title">Right Now Data</h2>
          <pre style="white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 1em; border-radius: 4px;">
            ${JSON.stringify(data, null, 2)}
          </pre>
        </div>
      `;
    },
    processData: function(rawData) {
      console.log('[RightNowChecker] Processing raw data:', rawData);
      return rawData || {};
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.RightNowChecker = RightNowChecker;