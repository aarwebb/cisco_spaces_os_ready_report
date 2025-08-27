// Integrations data checker for Spaces OS Ready Report v2
// NOTE: This file is not used for data collection in V2 - functionality is built into background.js
// This file only provides the report module for displaying integration data

async function execute(domain, cookies) {
  return {
    status: 'not_implemented',
    message: 'V2 uses background.js for integrations check',
    data: {}
  };
}

// Make the checker available globally for report generation
globalThis.IntegrationsChecker = {
  execute: execute
};

// Report module for generating integrations section in reports
globalThis.IntegrationsChecker.reportModule = {
  generateHTML: function(data) {
    const integrationsData = this.processData(data);
    
    return `
      <div class="section" id="integrations-section">
        <h2 class="section-title">Integrations</h2>
        
        ${this.generateIntegrationsOverview(integrationsData)}
        ${this.generateIntegrationsDetails(integrationsData)}
        ${integrationsData.configurationIssues.length > 0 ? this.generateIssuesTable(integrationsData.configurationIssues) : ''}
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
      // Try multiple possible data paths
      let dnacData = null;
      if (rawData.dnac_activations.data && rawData.dnac_activations.data.data && Array.isArray(rawData.dnac_activations.data.data)) {
        dnacData = rawData.dnac_activations.data.data; // Nested structure
      } else if (rawData.dnac_activations.data && Array.isArray(rawData.dnac_activations.data)) {
        dnacData = rawData.dnac_activations.data; // Direct array
      } else if (Array.isArray(rawData.dnac_activations)) {
        dnacData = rawData.dnac_activations; // Top-level array
      }
      
      if (Array.isArray(dnacData)) {
        const currentTime = Math.floor(Date.now() / 1000); // Current time in epoch seconds
        
        // Categorize by GUI logic
        let activatedCount = 0;     // ACTIVATED status (always active regardless of timestamp)
        let notActivatedCount = 0;  // NEW status with future timestamp
        let expiredCount = 0;       // NEW status with past timestamp
        let deactivatedCount = 0;   // DEACTIVATED status
        
        dnacData.forEach(activation => {
          if (activation.status === "ACTIVATED") {
            activatedCount++; // ACTIVATED is always active
          } else if (activation.status === "DEACTIVATED") {
            deactivatedCount++;
          } else if (activation.status === "NEW") {
            if (activation.exp && activation.exp < currentTime) {
              expiredCount++; // NEW but timestamp expired
            } else {
              notActivatedCount++; // NEW with future or no timestamp (Not Activated)
            }
          } else {
            // Handle any other unexpected status as expired
            expiredCount++;
          }
        });
        
        const totalInstances = dnacData.length;
        
        if (totalInstances > 0) {
          activeIntegrationCount++; // Count Catalyst Center as 1 active integration if it has any instances
          catalystCenterStatus = `Connected`;
          catalystCenterDetails = {
            totalInstances: totalInstances,
            activatedCount: activatedCount,      // Active (ACTIVATED status)
            notActivatedCount: notActivatedCount, // Not Activated (NEW status, future timestamp)
            expiredCount: expiredCount,          // Expired (NEW status, past timestamp)
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
        // Handle nested object response - but still count as connected if we have data
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
      // Try the nested data structure first
      let calendarData = null;
      if (rawData.calendar_activations.data && rawData.calendar_activations.data.data) {
        calendarData = rawData.calendar_activations.data.data;
      } else {
        calendarData = rawData.calendar_activations.data || rawData.calendar_activations;
      }
      
      if (calendarData && typeof calendarData === 'object' && !Array.isArray(calendarData)) {
        // Handle the expected object structure with google and ms365 properties
        
        // Process Google Calendar
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
        
        // Process MS365/Exchange
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
        // Handle array format (legacy support)
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
    
    // Try to extract tenant ID from any of the responses
    if (rawData.tenant_id) {
      tenantId = rawData.tenant_id;
    }
    
    const totalPossibleIntegrations = 4; // Catalyst Center, MS365, Google Calendar, WebEx
    
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
