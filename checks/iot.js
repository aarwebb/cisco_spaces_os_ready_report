// Template data checker for Spaces OS Ready Report v2

console.log('REPORT DEBUG: iot.js loaded');

// Simple endpoints
const IOT_CONNECTORS = '/api/edm/v1/device/onboarding/status/connector'
const IOT_CONTROLLERS = '/api/edm/v1/device/onboarding/status/controller'
const IOT_AP_DEPLOYMENT_COUNT = '/api/edm/v1/device/ap/deployment/count'

// Paginated endpoints
const IOT_AP_GATEWAYS = '/api/edm/v1/device/ap'

class IoTChecker {
  constructor(domain) {
    this.domain = domain;
    console.log(`[IoTChecker] Initialized for domain: ${domain}`);
  }

  async execute() {
    const client = globalThis.createApiClient(this.domain);
    console.log('[IoTChecker] Starting IoT data collection');
    // Prepare all endpoints, with options for paginated ones
    const endpoints = [
      { endpoint: IOT_AP_GATEWAYS, options: { paginated: true, itemsKey: 'items', totalKey: 'pagination.totalCount', maxPageSize: 50 } },
      { endpoint: IOT_CONNECTORS },
      { endpoint: IOT_CONTROLLERS },
      { endpoint: IOT_AP_DEPLOYMENT_COUNT }
    ];
    // Use callMultiple, which now supports paginated endpoints with options
  const results = await client.callMultiple(endpoints);
  console.log('[IoTChecker] Final results to return:', results);
  return { iot: results };
  }

  static reportModule = {
    generateHTML: function(data) {
    return `
      <div class="section" id="iot-section">
        <h2 class="section-title">IoT Data</h2>
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

// Attach the checker class to globalThis for use in orchestrator
globalThis.IoTChecker = IoTChecker;