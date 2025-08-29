// Integrations data checker for Spaces OS Ready Report v2
// This check is formatting the integrations data, not used right now.

// Endpoint constants
const DNAC_ACTIVATIONS_ENDPOINT = '/api/v1/dnac/activations/list';
const WEBEX_AUTH_STATUS_ENDPOINT = '/api/v1/wirelessprovider/getWebExAuthStatus';
const CALENDAR_ACTIVATIONS_BASE = '/api/v1/calendar/list/activations';

class IntegrationsChecker {
  constructor(domain) {
    this.domain = domain;
  }

  async execute() {
    console.log('[integrations] Starting integrations check for domain:', this.domain);

    const endpoints = [DNAC_ACTIVATIONS_ENDPOINT, WEBEX_AUTH_STATUS_ENDPOINT];
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

    return {
      integrations: {
        data: {
          integrations: Object.values(results).filter(r => r.success),
          endpoints_tested: endpoints.length,
          successful_calls: Object.values(results).filter(r => r.success).length,
          dnac_activations: results[DNAC_ACTIVATIONS_ENDPOINT]?.data,
          webex_auth_status: results[WEBEX_AUTH_STATUS_ENDPOINT]?.data,
          calendar_activations: calendarEndpoint ? results[calendarEndpoint]?.data : undefined,
          tenant_id: tenantId
        },
        summary: `Found ${Object.values(results).filter(r => r.success).length}/${endpoints.length} integration endpoints (DNAC, WebEx${calendarEndpoint ? ', Calendar' : ''})`,
        raw: results
      }
    };
  }

  static reportModule = {
    generateHTML: function(data) {
      console.log('[integrations] Generating HTML for integrations report');
      const integrationsData = this.processData(data);
      return `
        <div class="section" id="integrations-section">
          <h2 class="section-title">Integrations</h2>
          ${this.generateIntegrationsOverview(integrationsData)}
          ${this.generateIntegrationsDetails(integrationsData)}
          ${integrationsData.configurationIssues && integrationsData.configurationIssues.length > 0 ? this.generateIssuesTable(integrationsData.configurationIssues) : ''}
        </div>
      `;
    },

    generateIntegrationsOverview: function(integrationsData) {
      return `
        <h3 class="subsection-title">Integration Summary</h3>
        <table class="report-table">
          <tbody>
            <tr>
              <th>Total Available Integrations</th>
              <td>${integrationsData.totalIntegrations}</td>
            </tr>
            <tr>
              <th>Active Integrations</th>
              <td>${integrationsData.activeIntegrations}</td>
            </tr>
            <tr>
              <th>Catalyst Center</th>
              <td>${integrationsData.catalystCenterStatus}</td>
            </tr>
            <tr>
              <th>Microsoft Office 365/Exchange</th>
              <td>${integrationsData.ms365Status}</td>
            </tr>
            <tr>
              <th>Google Calendars</th>
              <td>${integrationsData.googleCalendarStatus}</td>
            </tr>
            <tr>
              <th>WebEx</th>
              <td>${integrationsData.webexStatus}</td>
            </tr>
            <tr>
              <th>Summary</th>
              <td>${integrationsData.summary}</td>
            </tr>
          </tbody>
        </table>
      `;
    },

    generateIntegrationsDetails: function(integrationsData) {
      let detailsHTML = `<h3 class="subsection-title">Integration Details</h3>`;

      // Catalyst Center Details
      if (integrationsData.catalystCenterDetails && Object.keys(integrationsData.catalystCenterDetails).length > 0) {
        let rows = [];

        if (integrationsData.catalystCenterDetails.totalInstances !== undefined) {
          rows.push(`<tr><th>Instances</th><td>${integrationsData.catalystCenterDetails.totalInstances}</td></tr>`);
          rows.push(`<tr><th>Active</th><td>${integrationsData.catalystCenterDetails.activatedCount}</td></tr>`);
          rows.push(`<tr><th>Not Activated</th><td>${integrationsData.catalystCenterDetails.notActivatedCount}</td></tr>`);
          rows.push(`<tr><th>Expired</th><td>${integrationsData.catalystCenterDetails.expiredCount}</td></tr>`);
          rows.push(`<tr><th>Deactivated</th><td>${integrationsData.catalystCenterDetails.deactivatedCount}</td></tr>`);
        } else if (integrationsData.catalystCenterDetails.connectionInfo) {
          rows.push(`<tr><th>Connection Status</th><td>Connected</td></tr>`);
        }

        detailsHTML += `
          <h4>Catalyst Center</h4>
          <table class="report-table">
            <tbody>
              ${rows.join('')}
            </tbody>
          </table>
        `;
      }

      // Calendars Details (Google + Microsoft combined)
      if (integrationsData.calendarDetails && Object.keys(integrationsData.calendarDetails).length > 0) {
        let rows = [];

        // Google Calendar details
        if (integrationsData.calendarDetails.google) {
          const googleData = integrationsData.calendarDetails.google;
          rows.push(`<tr><th>Google Calendar Rooms</th><td>${googleData.rooms || 0}</td></tr>`);
          rows.push(`<tr><th>Google Calendar Status</th><td>${googleData.status}</td></tr>`);
        }

        // Microsoft Office 365/Exchange details
        if (integrationsData.calendarDetails.ms365) {
          const ms365Data = integrationsData.calendarDetails.ms365;
          rows.push(`<tr><th>Microsoft 365 Rooms</th><td>${ms365Data.rooms || 0}</td></tr>`);
          rows.push(`<tr><th>Microsoft 365 Status</th><td>${ms365Data.status}</td></tr>`);
        }

        if (rows.length > 0) {
          detailsHTML += `
            <h4>Calendars</h4>
            <table class="report-table">
              <tbody>
                ${rows.join('')}
              </tbody>
            </table>
          `;
        }
      }

      // WebEx Details
      if (integrationsData.webexDetails && Object.keys(integrationsData.webexDetails).length > 0) {
        let rows = [];

        rows.push(`<tr><th>Sync Status</th><td>${integrationsData.webexDetails.syncStatus ? 'Active' : 'Inactive'}</td></tr>`);
        rows.push(`<tr><th>Authentication Status</th><td>${integrationsData.webexDetails.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</td></tr>`);

        detailsHTML += `
          <h4>WebEx</h4>
          <table class="report-table">
            <tbody>
              ${rows.join('')}
            </tbody>
          </table>
        `;
      }

      return detailsHTML;
    },

    generateIssuesTable: function(issues) {
      const issuesRows = issues.map(issue => `<tr><td>${issue}</td></tr>`).join('');

      return `
        <h3 class="subsection-title">Configuration Issues</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            ${issuesRows}
          </tbody>
        </table>
      `;
    },

    processData: function(rawData) {
      console.log('[integrations] Processing raw data for report:', rawData);
      if (!rawData) {
        return {
          totalIntegrations: '0',
          activeIntegrations: '0',
          catalystCenterStatus: 'Not Available',
          ms365Status: 'Not Available',
          googleCalendarStatus: 'Not Available',
          webexStatus: 'Not Available',
          catalystCenterDetails: {},
          ms365Details: {},
          googleCalendarDetails: {},
          webexDetails: {},
          configurationIssues: ['No integration data available'],
          tenantId: 'Not Available',
          summary: 'No summary available'
        };
      }

      let catalystCenterStatus = 'Not Available';
      let ms365Status = 'Not Available';
      let googleCalendarStatus = 'Not Available';
      let webexStatus = 'Not Available';
      let catalystCenterDetails = {};
      let ms365Details = {};
      let googleCalendarDetails = {};
      let webexDetails = {};
      let configurationIssues = [];
      let activeIntegrationCount = 0;
      let tenantId = 'Not Available';

      // Process Catalyst Center data - count where status === "ACTIVATED"
      if (rawData.dnac_activations) {
        let dnacData = null;
        if (rawData.dnac_activations.data && rawData.dnac_activations.data.data && Array.isArray(rawData.dnac_activations.data.data)) {
          dnacData = rawData.dnac_activations.data.data;
        } else if (rawData.dnac_activations.data && Array.isArray(rawData.dnac_activations.data)) {
          dnacData = rawData.dnac_activations.data;
        } else if (Array.isArray(rawData.dnac_activations)) {
          dnacData = rawData.dnac_activations;
        }

        if (Array.isArray(dnacData)) {
          const currentTime = Math.floor(Date.now() / 1000);
          let activatedCount = 0;
          let notActivatedCount = 0;
          let expiredCount = 0;
          let deactivatedCount = 0;

          dnacData.forEach(activation => {
            if (activation.status === "ACTIVATED") {
              activatedCount++;
            } else if (activation.status === "DEACTIVATED") {
              deactivatedCount++;
            } else if (activation.status === "NEW") {
              if (activation.exp && activation.exp < currentTime) {
                expiredCount++;
              } else {
                notActivatedCount++;
              }
            } else {
              expiredCount++;
            }
          });

          const totalInstances = dnacData.length;

          if (totalInstances > 0) {
            activeIntegrationCount++;
            catalystCenterStatus = `Connected`;
            catalystCenterDetails = {
              totalInstances: totalInstances,
              activatedCount: activatedCount,
              notActivatedCount: notActivatedCount,
              expiredCount: expiredCount,
              deactivatedCount: deactivatedCount,
              activations: dnacData.map(activation => {
                let effectiveStatus = activation.status;
                if (activation.status === "NEW") {
                  if (activation.exp && activation.exp < currentTime) {
                    effectiveStatus = "EXPIRED";
                  } else {
                    effectiveStatus = "NOT_ACTIVATED";
                  }
                }

                return {
                  id: activation.tokenId || 'Unknown',
                  name: activation.name || 'Unknown',
                  status: activation.status || 'Unknown',
                  effectiveStatus: effectiveStatus,
                  activationNo: activation.activationNo || 'Unknown',
                  exp: activation.exp || 'Unknown',
                  expDate: activation.exp ? new Date(activation.exp * 1000).toLocaleString() : 'Unknown'
                };
              })
            };
          } else {
            catalystCenterStatus = 'No Activations';
            catalystCenterDetails = { totalInstances: 0, activatedCount: 0, notActivatedCount: 0, expiredCount: 0, deactivatedCount: 0 };
          }
        } else if (rawData.dnac_activations.data && typeof rawData.dnac_activations.data === 'object') {
          activeIntegrationCount++;
          catalystCenterStatus = 'Connected';
          catalystCenterDetails = { connectionInfo: rawData.dnac_activations.data };
        }
      } else {
        catalystCenterStatus = 'No Data';
        configurationIssues.push('Catalyst Center activations endpoint not found');
      }

      // Process Calendar data - count MS365 and Google separately if status !== ""
      if (rawData.calendar_activations) {
        let calendarData = null;
        if (rawData.calendar_activations.data && rawData.calendar_activations.data.data) {
          calendarData = rawData.calendar_activations.data.data;
        } else {
          calendarData = rawData.calendar_activations.data || rawData.calendar_activations;
        }

        if (calendarData && typeof calendarData === 'object' && !Array.isArray(calendarData)) {
          if (calendarData.google) {
            const googleStatus = calendarData.google.status === "" ? "Not Activated" : calendarData.google.status;
            if (calendarData.google.status !== "") {
              activeIntegrationCount++;
              googleCalendarStatus = 'Connected';
            } else {
              googleCalendarStatus = 'Not Connected';
            }
            googleCalendarDetails = {
              rooms: calendarData.google.rooms || 0,
              status: googleStatus
            };
          } else {
            googleCalendarStatus = 'Not Connected';
            googleCalendarDetails = {};
          }

          if (calendarData.ms365) {
            let ms365StatusValue = calendarData.ms365.status === "" ? "Not Activated" : calendarData.ms365.status;
            if (calendarData.ms365.status !== "") {
              activeIntegrationCount++;
              ms365Status = 'Connected';
            } else {
              ms365Status = 'Not Connected';
            }
            ms365Details = {
              rooms: calendarData.ms365.rooms || 0,
              status: ms365StatusValue
            };
          } else {
            ms365Status = 'Not Connected';
            ms365Details = {};
          }

        } else if (Array.isArray(calendarData)) {
          ms365Status = 'Not Connected';
          googleCalendarStatus = 'Not Connected';
          ms365Details = {};
          googleCalendarDetails = {};
        } else {
          ms365Status = 'Not Connected';
          googleCalendarStatus = 'Not Connected';
          ms365Details = {};
          googleCalendarDetails = {};
        }
      } else {
        ms365Status = 'No Data';
        googleCalendarStatus = 'No Data';
        configurationIssues.push('Calendar activations endpoint not found');
      }

      // Process WebEx data - count if syncStatus === true
      if (rawData.webex_auth_status) {
        const webexData = rawData.webex_auth_status.data || rawData.webex_auth_status;
        if (webexData && typeof webexData === 'object') {
          if (webexData.syncStatus === true) {
            activeIntegrationCount++;
            webexStatus = 'Syncing';
          } else {
            webexStatus = 'Not Syncing';
          }

          webexDetails = {
            syncStatus: webexData.syncStatus || false,
            isAuthenticated: webexData.isAuthenticated || false
          };
        }
      } else {
        webexStatus = 'No Data';
        configurationIssues.push('WebEx auth status endpoint not found');
      }

      if (rawData.tenant_id) {
        tenantId = rawData.tenant_id;
      }

      const totalPossibleIntegrations = 4;

      return {
        totalIntegrations: totalPossibleIntegrations.toString(),
        activeIntegrations: activeIntegrationCount.toString(),
        catalystCenterStatus,
        ms365Status,
        googleCalendarStatus,
        webexStatus,
        catalystCenterDetails,
        webexDetails,
        calendarDetails: {
          google: googleCalendarDetails,
          ms365: ms365Details
        },
        configurationIssues,
        tenantId: tenantId.toString(),
        summary: configurationIssues.length === 0 ? `${activeIntegrationCount} of ${totalPossibleIntegrations} integrations active` : `${configurationIssues.length} issues found`
      };
    }
  };
}

globalThis.IntegrationsChecker = IntegrationsChecker;