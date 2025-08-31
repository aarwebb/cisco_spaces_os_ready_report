// Generic template checker for Spaces OS Ready Report v2
// Use this as a starting point for new check modules

// Example endpoint constant(s)
const EXAMPLE_ENDPOINT = '/api/v1/example/endpoint';

class CheckTemplateChecker {
  static endpoints = [
    EXAMPLE_ENDPOINT
    // Add more endpoints as needed
  ];

  constructor(domain) {
    this.domain = domain;
  }

  async execute({ onProgress } = {}) {
    // Prepare endpoints
    const endpoints = [...CheckTemplateChecker.endpoints];
    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })), onProgress);
    // Process results
    const parsedData = CheckTemplateChecker.processData(results.checkTemplate || results);
    // Return standard structure
    return {
      checkTemplate: {
        raw: results,
        parsedData
      }
    };
  }

  static getProgressUnitEstimate() {
    return CheckTemplateChecker.endpoints.length;
  }

  static processData(rawData) {
    // TODO: Extract and normalize data from rawData
    // Example: return { field1: rawData.field1, field2: ... }
    return {
      exampleField: rawData[EXAMPLE_ENDPOINT]?.data?.data || {},
      // Add more extracted fields as needed
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
        if (alertType === 'good') return 'row-good';
        return '';
      }

      // Aggregate alert icons for summary
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

      // Recommendations summary
      const recommendationsObj = analysisResults.recommendations || {};
      const recommendationList = Object.values(recommendationsObj).filter(Boolean);
      const summaryRecommendations = recommendationList.length > 0
        ? `<ul class="recommendations-list">${recommendationList.map(rec => `<li>${rec}</li>`).join('')}</ul>`
        : 'No Recommendations';

      // Recommendations table (top)
      const recommendationsTable = `
        <table class="summary-table" style="margin-bottom:16px;">
          <tr>
            <th>Recommendation(s)</th>
          </tr>
          <tr>
            <td>${summaryRecommendations}</td>
          </tr>
        </table>`;

      // Example summary table
      const summaryTable = `
        <table class="report-table" style="width:100%; margin-bottom:16px;">
          <tr><td>Example Field</td><td>${processedData.exampleField ? JSON.stringify(processedData.exampleField) : '-'}</td></tr>
          <!-- Add more summary rows as needed -->
        </table>
      `;

      return `
        <div class="section" id="checktemplate-section">
          <h2 class="section-title">Check Template</h2>
          <span class="alert-summary">${alertIconsSummary}</span>
          ${recommendationsTable}
          ${summaryTable}
        </div>
      `;
    }
  };
}

globalThis.CheckTemplateChecker = CheckTemplateChecker;
