// Template data checker for Spaces OS Ready Report v2

class TemplateChecker {
  constructor(domain) {
    this.domain = domain;
  }

  async execute() {
    const endpoints = [
      // Add API endpoints here, e.g. '/api/v1/template/data'
    ];
    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })));
    // Always wrap results under the check key for consistency
    return { template: results };
  }

  static reportModule = {
    generateHTML: function(data) {
      return `
        <div class="section" id="template-section">
          <h2 class="section-title">Template Data</h2>
          <p>Template check is not implemented in V2 yet.</p>
        </div>
      `;
    },
    processData: function(rawData) {
      // Optionally transform raw API data for display
      return rawData || {};
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.TemplateChecker = TemplateChecker;