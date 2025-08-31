// Wireless data checker for Spaces OS Ready Report v2

// Endpoint constants
const WIRELESS_CONTROLLERS_DETAILS = '/api/v1/connector/controllers';
const WIRELESS_CONTROLLERS_COUNT = '/api/v1/location/wlc/controller/count';
const WIRELESS_CMX_LOCATIONS_COUNT = '/api/v1/location/cmx/locations/count';

class WirelessChecker {
  static endpoints = [
    WIRELESS_CONTROLLERS_DETAILS,
    WIRELESS_CONTROLLERS_COUNT,
    WIRELESS_CMX_LOCATIONS_COUNT
  ];
  constructor(domain) {
    this.domain = domain;
  }

  async execute({ onProgress } = {}) {
    const endpoints = WirelessChecker.endpoints;
    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })), onProgress);
    const parsedData = WirelessChecker.processData(results.wireless || results);
    return {
        wireless: {
            raw: results,
            parsedData
        }
    };
  }

  static getProgressUnitEstimate() {
    return WirelessChecker.endpoints.length;
  }

  static processData(rawData) {
    // Extract controllers
    const controllersRaw = rawData[WIRELESS_CONTROLLERS_DETAILS]?.data?.data ?? [];
    const controllers = Array.isArray(controllersRaw)
      ? controllersRaw.map(ctrl => ({
          id: ctrl.id, // Add unique id field
          name: ctrl.name,
          type: ctrl.type,
          login: ctrl.login,
          reportStatus: ctrl.report?.status,
          isAssociateController: ctrl.isAssociateController,
          connectorName: ctrl.connectorName,
          controllerIp: ctrl.controllerIp,
          controllerVersion: ctrl.report?.controllerVersion,
          reachable: ctrl.report?.reachable,
          numberOfAps: ctrl.report?.numberOfAps,
          apModels: ctrl.report?.apModels,
          locationIpAddress: ctrl.report?.location?.ipAddress,
          controllerStatus: ctrl.report?.controllerStatus
        }))
      : [];

    // Extract controller counts -- No real use
    const controllerCountsRaw = rawData[WIRELESS_CONTROLLERS_COUNT]?.data?.data ?? {};
    const controllerCounts = {
      importedWLCCount: controllerCountsRaw.importedWLCCount,
      controllersCount: controllerCountsRaw.controllersCount,
      importedControllersCount: controllerCountsRaw.importedControllersCount,
      totalWLCCount: controllerCountsRaw.totalWLCCount,
      spacesDirectControllerCount: controllerCountsRaw.spacesDirectControllerCount
    };

    // Extract CMX location counts
    const cmxLocationCountsRaw = rawData[WIRELESS_CMX_LOCATIONS_COUNT]?.data?.data ?? {};
    const cmxLocationCounts = {
      importedCMXCount: cmxLocationCountsRaw.importedCMXCount,
      campus: cmxLocationCountsRaw.campus,
      building: cmxLocationCountsRaw.building,
      floor: cmxLocationCountsRaw.floor
    };

    return {
      controllers,
      controllerCounts,
      cmxLocationCounts
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

      // Aggregate alert icons for summary (dynamic)
      const alertsObj = analysisResults.alerts || {};
      const allAlertTypes = Object.values(alertsObj).flatMap(obj =>
        typeof obj === 'object' && obj !== null ? Object.values(obj) : typeof obj === 'string' ? [obj] : []
      ).filter(Boolean);
      const alertTypeCounts = allAlertTypes.reduce((acc, type) => {
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

      // Aggregate recommendations
      const recommendationsObj = analysisResults.recommendations || {};
      const recommendationList = Object.values(recommendationsObj).filter(Boolean);
      const summaryRecommendations = recommendationList.length > 0
        ? `<ul class="recommendations-list">${recommendationList.map(rec => `<li>${rec}</li>`).join('')}</ul>`
        : 'No Recommendations';

      // Table: Wireless Controllers (with Version column)
      const controllers = processedData.controllers || [];
      let controllersTable = `<table class="report-table wireless-controllers" style="margin-bottom:16px;">
        <tr><th colspan="6">Wireless Controllers</th></tr>
        <tr>
          <th class="th-secondary">Name</th>
          <th class="th-secondary">Status</th>
          <th class="th-secondary">Reachable</th>
          <th class="th-secondary">Type</th>
          <th class="th-secondary">Version</th>
          <th class="th-secondary">APs</th>
        </tr>`;
      controllers.forEach(ctrl => {
  // Determine alert classes for each cell using controller id and alert type mapping
  const statusClass = getRowClass(alertsObj.controllerStatus?.[ctrl.id]); // status alert
  const reachClass = getRowClass(alertsObj.controllerReachability?.[ctrl.id]); // reachability alert
  const typeClass = '';
  const versionClass = getRowClass(alertsObj.controllerVersion?.[ctrl.id]); // version alert
  const apsClass = getRowClass(alertsObj.apInventory?.[ctrl.id]); // AP inventory alert
        controllersTable += `
          <tr>
            <td>${ctrl.name || '-'}</td>
            <td class="${statusClass}">${ctrl.reportStatus || '-'}</td>
            <td class="${reachClass}">${ctrl.reachable ? 'Yes' : 'No'}</td>
            <td class="${typeClass}">${ctrl.type || '-'}</td>
            <td class="${versionClass}">${ctrl.controllerVersion || '-'}</td>
            <td class="${apsClass}">${typeof ctrl.numberOfAps === 'number' ? ctrl.numberOfAps : '-'}</td>
          </tr>`;
      });
      controllersTable += `</table>`;

      // Table: Access Points (compiled AP models)
      // Compile all apModels from all controllers
      const apModelCounts = {};
      controllers.forEach(ctrl => {
        if (ctrl.apModels && typeof ctrl.apModels === 'object') {
          Object.entries(ctrl.apModels).forEach(([model, count]) => {
            if (typeof count === 'number') {
              apModelCounts[model] = (apModelCounts[model] || 0) + count;
            }
          });
        }
      });
      let apModelsTable = `<table class="report-table access-points" style="margin-bottom:16px;">
        <tr><th colspan="2">Access Points</th></tr>`;
      Object.entries(apModelCounts).forEach(([model, count]) => {
        apModelsTable += `
          <tr>
            <td>${model}</td>
            <td>${count}</td>
          </tr>`;
      });
      apModelsTable += `</table>`;

      return `
        <div class="section" id="wireless-section">
          <h2 class="section-title">Wireless
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
          ${controllersTable}
          ${apModelsTable}
        </div>
      `;
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.WirelessChecker = WirelessChecker;