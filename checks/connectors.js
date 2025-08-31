// Connectors data checker for Spaces OS Ready Report v2

// Endpoint constants
const CONNECTORS_DETAILS = '/api/v1/connector/list';

class ConnectorChecker {
    static endpoints = [
        CONNECTORS_DETAILS
    ];

  constructor(domain) {
    this.domain = domain;
  }

  async execute({ onProgress } = {}) {
    const endpoints = [
        CONNECTORS_DETAILS
    ];
  const client = globalThis.createApiClient(this.domain);
  const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })), onProgress);
  const parsedData = ConnectorChecker.processData(results.connectors || results);
    return {
        connectors: {
            raw: results,
            parsedData
        }
    };
  }

    static processData(rawData) {
      // Extract standardized connector fields for analysis/reporting
      let connectorsRaw = [];
      const dataObj = rawData[CONNECTORS_DETAILS]?.data?.data;
      if (Array.isArray(dataObj)) {
        connectorsRaw = dataObj;
      } else if (Array.isArray(dataObj?.connectors)) {
        connectorsRaw = dataObj.connectors;
      }
      const connectors = connectorsRaw.map(conn => {
        // Extract node details if present (V3 connectors)
        let nodeDetails = [];
        if (conn.connectorNodes && typeof conn.connectorNodes === 'object') {
          nodeDetails = Object.values(conn.connectorNodes).map(node => ({
            vmResources: node.vmResources,
            ipAddress: node.ipAddress,
            buildInfo: node.buildInfo,
            haState: node.HA_STATE?.state
          }));
        }
        return {
          id: conn.id,
          name: conn.name,
          version: conn.version,
          associatedControllers: conn.associatedControllers,
          status: conn.status,
          connectorRelease: conn.connectorRelease,
          connectorPackageVersion: conn.connectorPackageVersion,
          connectorStatus: conn.connectorStatus,
          serviceDeployConfig: conn.serviceDeployConfig,
          reportUpgrade: conn.report?.upgrade,
          numberOfAps: conn.report?.connector?.numberOfAps,
          dataChannelMetrics: conn.report?.dataChannel?.connectionMetrics,
          edmStatus: conn.report?.edmStatus,
          nodeDetails
        };
      });
      return {
        connectors
      };
    }

    static getProgressUnitEstimate() {
      return ConnectorChecker.endpoints.length;
    }

  static reportModule = {
    generateHTML: function(processedData, analysisResults) {
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

      // Aggregate alert icons for summary
      const alertsObj = analysisResults.alerts || {};
      // Dynamically aggregate all alert types for summary (across all connector alert properties)
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


      // Table rows for each connector (multi-row, structured)
      const connectorRows = (processedData.connectors || []).map(conn => {
        // Alerts for this connector (per property)
        const connectorId = conn.id;
  const versionClass = getRowClass(alertsObj.version?.[connectorId]);
  const statusClass = getRowClass(alertsObj.status?.[connectorId]);
  const connectorStatusClass = getRowClass(alertsObj.connectorStatus?.[connectorId]);
  const packageVersionClass = getRowClass(alertsObj.connectorPackageVersion?.[connectorId]);
  const apsClass = getRowClass(alertsObj.apInventory?.[connectorId]);
  const nmspDroppedClass = getRowClass(alertsObj.nmspDropped?.[connectorId]);
  const edmStatusClass = getRowClass(alertsObj.edmStatus?.[connectorId]);
  const upgradeClass = getRowClass(alertsObj.upgradeInfo?.[connectorId]);

        // Node details as sub-table (full width, styled)
        let nodeTable = '';
        if (Array.isArray(conn.nodeDetails) && conn.nodeDetails.length > 0) {
          nodeTable = `
            <table class="sub-table" style="width:100%;margin:8px 0;background:#f7f9fa;border-radius:4px;">
              <tr><th colspan="4" class="sub-header" style="background:#1a355b;color:#fff;">Node Details</th></tr>
              <tr style="background:#e9eef6;"><th>Node</th><th>CPU</th><th>RAM (MB)</th><th>Disk (GB)</th></tr>
              ${conn.nodeDetails.map((node, idx) => {
                const disk = node.vmResources?.diskSpaceInGB?.total ?? node.vmResources?.diskInMB ?? 'N/A';
                return `<tr>
                  <td>Node ${idx + 1}</td>
                  <td>${node.vmResources?.cpuCount ?? 'N/A'}</td>
                  <td>${node.vmResources?.memoryInMB ?? 'N/A'}</td>
                  <td>${disk}</td>
                </tr>`;
              }).join('')}
            </table>
          `;
        }

        // Main connector info rows (per-cell alert class)
        return `
          <tr>
            <td class="label-col" style="font-weight:bold;">${conn.name}</td>
            <td class="value-col"></td>
          </tr>
          <tr class="${versionClass}">
            <td class="label-col">Version</td>
            <td class="value-col">${conn.version ?? 'N/A'}</td>
          </tr>
          <tr>
            <td class="label-col">Associated Controllers</td>
            <td class="value-col">${Array.isArray(conn.associatedControllers) ? conn.associatedControllers.length : 'N/A'}</td>
          </tr>
          <tr class="${statusClass}">
            <td class="label-col">Status</td>
            <td class="value-col">${conn.status ?? 'N/A'}</td>
          </tr>
          <tr class="${connectorStatusClass}">
            <td class="label-col">Connector Status</td>
            <td class="value-col">${conn.connectorStatus ?? 'N/A'}</td>
          </tr>
          <tr class="${packageVersionClass}">
            <td class="label-col">Package Version</td>
            <td class="value-col">${conn.connectorPackageVersion ?? 'N/A'}</td>
          </tr>
          <tr class="${apsClass}">
            <td class="label-col">APs</td>
            <td class="value-col">${conn.numberOfAps ?? 'N/A'}</td>
          </tr>
          <tr class="${nmspDroppedClass}">
            <td class="label-col">NMSP Dropped</td>
            <td class="value-col">${conn.dataChannelMetrics?.nmspDropped?.count ?? 'N/A'}</td>
          </tr>
          <tr class="${edmStatusClass}">
            <td class="label-col">EDM Status</td>
            <td class="value-col">${conn.edmStatus?.status ?? 'N/A'}</td>
          </tr>
          <tr class="${upgradeClass}">
              <td class="label-col">Upgrade Info</td>
              <td class="value-col">${conn.reportUpgrade?.gold && conn.reportUpgrade?.latest && conn.reportUpgrade.gold !== conn.reportUpgrade.latest ? `Upgrade available: ${conn.reportUpgrade.gold} -> ${conn.reportUpgrade.latest}` : 'Up-to-date'}</td>
          </tr>
          <tr>
            <td class="label-col">Node Details</td>
            <td class="value-col">${nodeTable}</td>
          </tr>
        `;
      });

      // Main table
      const connectorsTable = `
        <table class="report-table">
          <tr><th colspan="2" class="group-header">Connectors</th></tr>
          ${connectorRows.join('')}
        </table>
      `;

      // Section HTML
      return `
        <div class="section" id="connectors-section">
          <h2 class="section-title">Connectors
          <span class="alert-summary">${alertIconsSummary}</span>
          </h2>
          <table class="summary-table" style="width:100%; margin-bottom:16px;">
            <tr><th>Recommendation</th></tr>
            <tr><td>${summaryRecommendations}</td></tr>
          </table>
          ${connectorsTable}
        </div>
      `;
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.ConnectorChecker = ConnectorChecker;