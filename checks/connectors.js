// Connectors data checker for Spaces OS Ready Report v2

// Endpoint constants
const CONNECTORS_DETAILS = '/api/v1/connector/list';

class ConnectorChecker {
  constructor(domain) {
    this.domain = domain;
  }

  async execute() {
    const endpoints = [
        CONNECTORS_DETAILS
    ];
    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })));
    return { connectors: results };
  }

  static reportModule = {
    generateHTML: function(data) {
      return `
        <div class="section" id="connectors-section">
          <h2 class="section-title">Connectors Data</h2>
          <pre style="white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 1em; border-radius: 4px;">
            ${JSON.stringify(data, null, 2)}
          </pre>
        </div>
      `;
    },
    processData: function(rawData) {
      return rawData || {};
    }
  };
}

globalThis.ConnectorChecker = ConnectorChecker;