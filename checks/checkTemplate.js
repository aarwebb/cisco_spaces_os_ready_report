// Template checker for Spaces OS Ready Report v2
// Use this as a starting point for new check modules

console.log('REPORT DEBUG: checkTemplate.js loaded');

// Example endpoint constant
const EXAMPLE_ENDPOINT = '/api/v1/example/endpoint';

class CheckTemplateChecker {
  constructor(domain) {
    this.domain = domain;
    console.log(`[CheckTemplateChecker] Initialized for domain: ${domain}`);
  }

  async execute() {
    console.log('[CheckTemplateChecker] Starting data collection');
    const client = globalThis.createApiClient(this.domain);
    // Add endpoint(s) as needed
    const endpoints = [EXAMPLE_ENDPOINT];
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })));
    console.log('[CheckTemplateChecker] API call results:', results);
    return { checkTemplate: results };
  }

  static reportModule = {
    generateHTML: function(data) {
      console.log('[CheckTemplateChecker] Generating HTML for data:', data);
      return `
        <div class="section" id="checktemplate-section">
          <h2 class="section-title">Check Template Data</h2>
          <pre style="white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 1em; border-radius: 4px;">
            ${JSON.stringify(data, null, 2)}
          </pre>
        </div>
      `;
    },
    processData: function(rawData) {
      console.log('[CheckTemplateChecker] Processing raw data:', rawData);
      return rawData || {};
    }
  };
}

globalThis.CheckTemplateChecker = CheckTemplateChecker;
