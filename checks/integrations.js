// Integrations data checker for Spaces OS Ready Report v2

// Endpoint constants
const DNAC_ACTIVATIONS = '/api/v1/dnac/activations/list';
const WEBEX_AUTH_STATUS = '/api/v1/wirelessprovider/getWebExAuthStatus';
const CALENDAR_ACTIVATIONS_BASE = '/api/v1/calendar/list/activations';
const MERAKI_INTEGRATION = '/api/v1/locationsync/status/meraki/minimized';

class IntegrationsChecker {
  constructor(domain) {
    this.domain = domain;
  }

  async execute() {
    console.log('[integrations] Starting integrations check for domain:', this.domain);

    // Prepare endpoints to call, except requiring parameters
    const endpoints = [
        DNAC_ACTIVATIONS, 
        WEBEX_AUTH_STATUS,
        MERAKI_INTEGRATION
    ];
    const client = globalThis.createApiClient(this.domain);

    // Get tenant info for calendar endpoint
    let tenantId = null;
    let calendarEndpoint = null;
    try {
      console.log('[integrations] typeof globalThis.getTenantInfo:', typeof globalThis.getTenantInfo);
      const tenantInfo = await globalThis.getTenantInfo(this.domain);
      tenantId = tenantInfo?.tenantId || null;
      console.log('[integrations] Tenant info:', tenantInfo);
      if (tenantId) {
        calendarEndpoint = `${CALENDAR_ACTIVATIONS_BASE}?spacesTenantId=${tenantId}&clientId=${tenantId}&accountId=${tenantId}`;
        endpoints.push(calendarEndpoint);
      } else {
        console.warn('[integrations] No tenantId found, skipping calendar activations endpoint.');
      }
    } catch (e) {
      console.warn('[integrations] Failed to get tenant info:', e.message);
      tenantId = null;
    }

    console.log('[integrations] Endpoints to call:', endpoints);
    const results = await client.callMultiple(
      endpoints.map(endpoint => ({ endpoint }))
    );
    console.log('[integrations] API call results:', results);

    return { integrations: results };
  }

  static reportModule = {
    generateHTML: function(data) {
      // Display the raw data as formatted JSON in a <pre> block
      return `
        <div class="section" id="integrations-section">
          <h2 class="section-title">Integrations Data</h2>
          <pre style="white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 1em; border-radius: 4px;">
            ${JSON.stringify(data, null, 2)}
          </pre>
        </div>
      `;
    }
  };
}

globalThis.IntegrationsChecker = IntegrationsChecker;