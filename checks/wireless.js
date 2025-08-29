// Wireless data checker for Spaces OS Ready Report v2

// Endpoint constants
const WIRELESS_CONTROLLERS_DETAILS = '/api/v1/connector/controllers';
const WIRELESS_CONTROLLERS_COUNT = '/api/v1/location/wlc/controller/count';

class WirelessChecker {
  constructor(domain) {
    this.domain = domain;
  }

  async execute() {
    const endpoints = [
      WIRELESS_CONTROLLERS_DETAILS,
      WIRELESS_CONTROLLERS_COUNT
    ];
    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })));
    return { wireless: results };
  }

  static reportModule = {
    generateHTML: function(data) {
      return `
        <div class="section" id="wireless-section">
          <h2 class="section-title">Wireless Data</h2>
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

globalThis.WirelessChecker = WirelessChecker;