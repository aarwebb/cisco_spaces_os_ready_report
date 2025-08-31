// Right Now checker for Spaces OS Ready Report v2
console.log('REPORT DEBUG: rightnow.js loaded');

const RIGHT_NOW_SSIDS_SETTINGS = '/api/v1/report/rightnow/settings';
const RIGHT_NOW_SSIDS_LIST = '/api/v1/report/rightnow/ssidlist';

class RightNowChecker {
  constructor(domain) {
    this.domain = domain;
    console.log(`[RightNowChecker] Initialized for domain: ${domain}`);
  }
  static endpoints = [
    RIGHT_NOW_SSIDS_SETTINGS,
    RIGHT_NOW_SSIDS_LIST
  ];

  async execute({ onProgress } = {}) {
    console.log('[RightNowChecker] Starting data collection');
    const endpoints = RightNowChecker.endpoints;
  const client = globalThis.createApiClient(this.domain);
  const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })), onProgress);
    console.log('[RightNowChecker] API call results:', results);
    // Process and log parsed data for debugging
    const parsedData = RightNowChecker.processData(results.rightNow || results);
    console.log('[RightNowChecker] Parsed data:', parsedData);
    // Always wrap results under the check key for consistency
    return {
      rightNow: {
        raw: results,
        parsedData
      }
    };
  }
  
  static getProgressUnitEstimate() {
    return RightNowChecker.endpoints.length;
  }

  static processData(rawData) {
    const settings = rawData[RIGHT_NOW_SSIDS_SETTINGS]?.data?.data?.Settings ?? {};
    const ssidList = rawData[RIGHT_NOW_SSIDS_LIST]?.data?.data?.ssidList ?? {};
    return {
      excludedSSIDs: settings.excludedSSIDs,
      includedDevices: settings.includedDevices,
      visitorCategory: settings.visitorCategory,
      ssidList: ssidList
    };
  }

  static reportModule = {
    generateHTML: function(processedData, analysisResults) {
      // Use ALERT_ICONS from constants.js
      const ALERT_ICONS = (typeof window !== 'undefined' && window.ALERT_ICONS) 
      ? window.ALERT_ICONS 
      : (typeof globalThis !== 'undefined' ? globalThis.ALERT_ICONS : {});
      
      // Helper to get row class based on alert type
      function getRowClass(alertType) {
        if (alertType === 'warning') return 'row-warning';
        if (alertType === 'info') return 'row-info';
        if (alertType === 'error') return 'row-error';
        return '';
      }
      
      // Dynamically aggregate all alert types for summary, showing each icon type and count
      const alertsObj = analysisResults.alerts || {};
      // Count each alert type occurrence
      const alertTypeCounts = {};
      Object.values(alertsObj).filter(Boolean).forEach(type => {
        alertTypeCounts[type] = (alertTypeCounts[type] || 0) + 1;
      });
      const uniqueAlertTypes = Object.keys(alertTypeCounts);

      // Show each icon type and its count
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

      // SSID stats
      const ssidList = processedData.ssidList || {};
      const excludedSSIDs = processedData.excludedSSIDs || {};
      const includedDevices = processedData.includedDevices || [];
      const totalSSIDs = Object.keys(ssidList).length;
      const totalExcluded = Object.keys(excludedSSIDs).length;
      // Breakdown of SSID types
      const typeCounts = {};
      Object.values(ssidList).forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      const typeBreakdown = Object.entries(typeCounts)
        .map(([type, count]) => `${type} (${count})`)
        .join(', ');

      // Included devices list (comma separated)
      const includedDevicesStr = includedDevices.length > 0
        ? includedDevices.join(', ')
        : '-';

      return `
        <div class="section" id="rightnow-section">
          <h2 class="section-title">Right Now
            <span class="alert-summary">${alertIconsSummary}</span>
          </h2>
          <table class="summary-table">
            <tr>
              <th>Recommendation(s)</th>
            </tr>
            <tr>
              <td>${summaryRecommendations}</td>
            </tr>
          </table>
          <table class="report-table">
            <tr><th colspan="2">Right Now Settings</th></tr>
            <tr class="${getRowClass(analysisResults.alerts?.totalSSIDs)}">
              <td class="label-col">Total SSIDs</td>
              <td class="value-col">${totalSSIDs}</td>
            </tr>
            <tr class="${getRowClass(analysisResults.alerts?.excludedSSIDs)}">
              <td class="label-col">Excluded SSIDs</td>
              <td class="value-col">${totalExcluded}</td>
            </tr>
            <tr class="${getRowClass(analysisResults.alerts?.ssidTypes)}">
              <td class="label-col">SSID Types</td>
              <td class="value-col">${typeBreakdown}</td>
            </tr>
            <tr class="${getRowClass(analysisResults.alerts?.includedDevices)}">
              <td class="label-col">Included Devices</td>
              <td class="value-col">${includedDevicesStr}</td>
            </tr>
          </table>
        </div>
      `;
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.RightNowChecker = RightNowChecker;