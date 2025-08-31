// Integrations data checker for Spaces OS Ready Report v2

// Endpoint constants
const DNAC_ACTIVATIONS = '/api/v1/dnac/activations/list';
const WEBEX_AUTH_STATUS = '/api/v1/wirelessprovider/getWebExAuthStatus';
const CALENDAR_ACTIVATIONS_BASE = '/api/v1/calendar/list/activations';
const MERAKI_INTEGRATION = '/api/v1/locationsync/status/meraki/minimized';

class IntegrationsChecker {
  constructor(domain) {
    this.domain = domain;
    console.log(`[IntegrationsChecker] Initialized for domain: ${domain}`);
  }
  static endpoints = [
    DNAC_ACTIVATIONS,
    WEBEX_AUTH_STATUS,
    MERAKI_INTEGRATION
    // Calendar endpoint is added dynamically if tenantId is available
  ];

  async execute({ onProgress } = {}) {
    console.log('[IntegrationsChecker] Starting data collection');

    // Prepare endpoints to call, except requiring parameters
      let endpoints = [...IntegrationsChecker.endpoints];

    // Get tenant info for calendar endpoint
    let tenantId = null;
    let calendarEndpoint = null;
    try {
      console.log('[integrations] typeof globalThis.getTenantInfo:', typeof globalThis.getTenantInfo);
      const tenantInfo = await globalThis.getTenantInfo(this.domain);
      tenantId = tenantInfo?.tenantId || null;
      console.log('[integrations] Tenant info:', tenantInfo);
      if (tenantId) {
          endpoints = endpoints.map(endpoint =>
            endpoint === CALENDAR_ACTIVATIONS_BASE
              ? `${CALENDAR_ACTIVATIONS_BASE}?spacesTenantId=${tenantId}&clientId=${tenantId}&accountId=${tenantId}`
              : endpoint
          );
      } else {
        console.warn('[integrations] No tenantId found, skipping calendar activations endpoint.');
      }
    } catch (e) {
      console.warn('[integrations] Failed to get tenant info:', e.message);
      tenantId = null;
    }

    console.log('[integrations] Endpoints to call:', endpoints);

    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })), onProgress);
    console.log('[IntegrationsChecker] API call results:', results);
    // Process and log parsed data for debugging
    const parsedData = IntegrationsChecker.processData(results.integrations || results);
    console.log('[IntegrationsChecker] Parsed data:', parsedData);
    // Always wrap results under the check key for consistency
    return {
      integrations: {
        raw: results,
        parsedData
      }
    };
  }
  
  static getProgressUnitEstimate() {
    // Calendar endpoint is dynamic, so add 1 if tenantId is available
    return IntegrationsChecker.endpoints.length;
  }

  static processData(rawData) {
    const dnacRaw = rawData[DNAC_ACTIVATIONS]?.data?.data ?? [];
    const dnacActivations = Array.isArray(dnacRaw)
      ? dnacRaw.map(item => ({
          status: item.status,
          name: item.name,
          memberId: item.memberId,
          exp: item.exp
        }))
      : [];

    const webexRaw = rawData[WEBEX_AUTH_STATUS]?.data?.data ?? {};
    const webexAuthStatus = {
      status: webexRaw.status,
      syncStatus: webexRaw.syncStatus,
      authStatus: webexRaw.authStatus
    };

    const calendarRaw = rawData[CALENDAR_ACTIVATIONS_BASE]?.data?.data ?? {};
    const calendarActivations = {};
    if (calendarRaw.ms365) {
      calendarActivations.ms365 = {
        status: calendarRaw.ms365.status,
        rooms: calendarRaw.ms365.rooms
      };
    }
    if (calendarRaw.google) {
      calendarActivations.google = {
        status: calendarRaw.google.status,
        rooms: calendarRaw.google.rooms
      };
    }

    const merakiRaw = rawData[MERAKI_INTEGRATION]?.data?.data ?? {};
    const merakiIntegration = {
      sync: merakiRaw.sync,
      wirelessProvidersCount: Array.isArray(merakiRaw.wirelessProvidersCount)
        ? merakiRaw.wirelessProvidersCount.map(p => ({
            name: p.name,
            success: p.success,
            failed: p.failed
          }))
        : []
    };

    return {
      dnacActivations,
      webexAuthStatus,
      calendarActivations,
      merakiIntegration
    };
  }

  static reportModule = {
    generateHTML: function(processedData, analysisResults) {
      const ALERT_ICONS = (typeof window !== 'undefined' && window.ALERT_ICONS) ? window.ALERT_ICONS : (typeof globalThis !== 'undefined' ? globalThis.ALERT_ICONS : {});

      // Helper to get row class based on alert type
      function getRowClass(alertType) {
        if (alertType === 'warning') return 'row-warning';
        if (alertType === 'info') return 'row-info';
        if (alertType === 'good') return 'row-good';
        return '';
      }

      // Dynamically aggregate all alert types for summary
      const alertsObj = analysisResults.alerts || {};
      const alertTypeCounts = Object.values(alertsObj)
        .filter(Boolean)
        .reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
      const uniqueAlertTypes = Object.keys(alertTypeCounts);

      const alertIconsSummary = uniqueAlertTypes.map(type => {
        const iconUrl = ALERT_ICONS[type] || '';
        const count = alertTypeCounts[type];
        return iconUrl
          ? `<span class="alert-summary-icon"><img src="${iconUrl}" alt="${type}" title="${type}" /><span class="alert-summary-count">${count}</span></span>`
          : '';
      }).join('');

      // Aggregate all recommendations into summary
      const recommendationsObj = analysisResults.recommendations || {};
      const recommendationList = Object.values(recommendationsObj).filter(Boolean);
      const summaryRecommendations = recommendationList.length > 0
        ? `<ul class="recommendations-list">${recommendationList.map(rec => `<li>${rec}</li>`).join('')}</ul>`
        : 'No Recommendations';

      // Recommendations table
      let recommendationsTable = `<table class="summary-table">
            <tr>
              <th>Recommendation(s)</th>
            </tr>
            <tr>
              <td>${summaryRecommendations}</td>
            </tr>
          </table>`;

      // CatC table with per-row coloring
      const catcList = Array.isArray(processedData.dnacActivations) ? processedData.dnacActivations : [];
      const activeCatc = catcList.filter(item => item.status === 'ACTIVATED');
      const notActiveCatc = catcList.length - activeCatc.length;
      let catcTable = '';
      if (catcList.length > 0) {
        catcTable = `<table class="report-table" style="margin-bottom:16px;">
          <tr><th colspan="2">Catalyst Center Integrations</th></tr>
          <tr>
            <td class="label-col">Status</td>
            <td class="value-col">${activeCatc.length > 0 ? 'ACTIVE' : 'NOT ACTIVE'}</td>
          </tr>
          <tr class="${getRowClass(analysisResults.alerts?.catcInstances)}">
            <td class="label-col">Number of Instances</td>
            <td class="value-col"><span class="bold-text">Active:</span> ${activeCatc.length}<br/><span class="bold-text">Not Active:</span> ${notActiveCatc}</td>
          </tr>
          <tr>
            <td class="label-col">Active Instances</td>
            <td class="value-col">${activeCatc.map(item => item.name).join(', ') || '-'}</td>
          </tr>
        </table>`;
      }

      // Webex table with per-row coloring
      let webexTable = '';
      if (processedData.webexAuthStatus) {
        const webexStatus = processedData.webexAuthStatus.syncStatus === true ? 'ACTIVE' : 'NOT ACTIVE';
        webexTable = `<table class="report-table" style="margin-bottom:16px;">
          <tr><th colspan="2">Webex Integration</th></tr>
          <tr class="${getRowClass(analysisResults.alerts?.webexSync)}">
            <td class="label-col">Status</td>
            <td class="value-col">${webexStatus}</td>
          </tr>
        </table>`;
      }

      // Calendar Integrations: single table for both types, always show status rows
      let calendarTable = '';
      if (processedData.calendarActivations) {
        const ms365 = processedData.calendarActivations.ms365 || {};
        const google = processedData.calendarActivations.google || {};
        calendarTable += `<table class="report-table" style="margin-bottom:8px;">
          <tr><th colspan="2">Calendar Integrations</th></tr>`;
        calendarTable += `<tr class="${getRowClass(analysisResults.alerts?.ms365Rooms)}">
            <td class="label-col">Microsoft Office 365 Status</td>
            <td class="value-col">${ms365.status ?? '-'}</td>
          </tr>`;
        if (ms365.status === 'ACTIVATED') {
          calendarTable += `<tr class="${getRowClass(analysisResults.alerts?.ms365Rooms)}">
            <td class="label-col">Microsoft Office 365 Rooms</td>
            <td class="value-col">${ms365.rooms}</td>
          </tr>`;
        }
        calendarTable += `<tr class="${getRowClass(analysisResults.alerts?.googleRooms)}">
            <td class="label-col">Google Status</td>
            <td class="value-col">${google.status ?? '-'}</td>
          </tr>`;
        if (google.status === 'ACTIVATED') {
          calendarTable += `<tr class="${getRowClass(analysisResults.alerts?.googleRooms)}">
            <td class="label-col">Google Rooms</td>
            <td class="value-col">${google.rooms}</td>
          </tr>`;
        }
        calendarTable += `</table>`;
      }

      // Meraki table with per-row coloring
      let merakiTable = '';
      if (processedData.merakiIntegration) {
        let merakiStatus = 'NOT ACTIVE';
        let merakiRowClass = getRowClass(analysisResults.alerts?.merakiProvider);
        if (processedData.merakiIntegration.sync === 'active') {
          merakiStatus = 'ACTIVE';
          if (analysisResults.alerts && analysisResults.alerts.merakiProvider) {
            merakiStatus = 'ERROR';
          }
        }
        merakiTable = `<table class="report-table" style="margin-bottom:16px;">
          <tr><th colspan="2">Meraki Integration</th></tr>
          <tr class="${merakiRowClass}">
            <td class="label-col">Status</td>
            <td class="value-col">${merakiStatus}</td>
          </tr>
        </table>`;
      }

      return `
        <div class="section" id="integrations-section">
          <h2 class="section-title">Integrations
            <span class="alert-summary">${alertIconsSummary}</span>
          </h2>
          ${recommendationsTable}
          ${catcTable}
          ${webexTable}
          ${calendarTable}
          ${merakiTable}
        </div>
      `;
    }
  };
}
// Attach the checker class to globalThis for use in orchestrator
globalThis.IntegrationsChecker = IntegrationsChecker;