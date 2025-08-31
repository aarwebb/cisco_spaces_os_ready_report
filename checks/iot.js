// IoT data checker for Spaces OS Ready Report v2

console.log('REPORT DEBUG: iot.js loaded');

// Simple endpoints
const IOT_CONNECTORS = '/api/edm/v1/device/onboarding/status/connector'
const IOT_CONTROLLERS = '/api/edm/v1/device/onboarding/status/controller'
const IOT_AP_DEPLOYMENT_COUNT = '/api/edm/v1/device/ap/deployment/count'

// Paginated endpoints
const IOT_AP_GATEWAYS = '/api/edm/v1/device/ap'

class IoTChecker {
    static endpoints = [
        { endpoint: IOT_AP_GATEWAYS, options: { paginated: true, itemsKey: 'items', totalKey: 'pagination.totalCount', maxPageSize: 50 } },
        { endpoint: IOT_CONNECTORS },
        { endpoint: IOT_CONTROLLERS },
        { endpoint: IOT_AP_DEPLOYMENT_COUNT, options: { paginated: true, itemsKey: 'items', totalKey: 'pagination.totalCount', maxPageSize: 1000 } }
    ]


  constructor(domain) {
    this.domain = domain;
    console.log(`[IoTChecker] Initialized for domain: ${domain}`);
  }

  async execute({ onProgress } = {}) {
    console.log('[IoTChecker] Starting IoT data collection');
    // Prepare all endpoints, with options for paginated ones
    const endpoints = IoTChecker.endpoints;
  const client = globalThis.createApiClient(this.domain);
  const results = await client.callMultiple(endpoints, onProgress);
  const parsedData = IoTChecker.processData(results.iot || results);
    console.log('[IoTChecker] Final results to return:', results);
    return { iot: {
        raw: results,
        parsedData
    }
  };
  }

 static getProgressUnitEstimate() {
    return IoTChecker.endpoints.length;
  }

  static processData(rawData) {
    // /api/edm/v1/device/ap
    const apGateways = (rawData[IOT_AP_GATEWAYS]?.data?.items || []).map(ap => ({
      id: ap.id,
      mac: ap.mac,
      pid: ap.pid,
      status: ap.status,
      connector_id: ap.connector_id,
      wlc_ip: ap.wlc_ip,
      config: ap.config,
      ap_name: ap.ap_name,
      importType: ap.ap_map_details?.importType,
      z: ap.ap_map_details?.z,
      y: ap.ap_map_details?.y,
      x: ap.ap_map_details?.x,
      displayName: ap.ap_map_details?.displayName,
      model: ap.ap_map_details?.model,
      floorNumber: ap.floor_map_details?.floorNumber,
      connected: ap.connected,
      iotmode: ap.iotmode,
      ioxcapable: ap.ioxcapable,
      ap_ip: ap.ap_ip,
      floor_name: ap.floor_name,
      building_name: ap.building_name,
      campus_name: ap.campus_name,
      hierarchy: ap.hierarchy
    }));

    // /api/edm/v1/device/onboarding/status/connector
    const wirelessConnectorCount = rawData[IOT_CONNECTORS]?.data?.wirelessConnectorCount || {};
    const wiredConnectorCount = rawData[IOT_CONNECTORS]?.data?.wiredConnectorCount || {};
    const wirelessConnectors = (rawData[IOT_CONNECTORS]?.data?.wireless || []).map(conn => ({
      activationStatus: conn.activationStatus,
      activationMessage: conn.activationMessage,
      id: conn.id,
      name: conn.name,
      version: conn.version,
      associatedControllers: conn.associatedControllers,
      associatedSwitches: conn.associatedSwitches,
      apCount: conn.apCount,
      switchCount: conn.switchCount,
      ip: conn.ip
    }));
    const wiredConnectors = (rawData[IOT_CONNECTORS]?.data?.wired || []).map(conn => ({
      activationStatus: conn.activationStatus,
      activationMessage: conn.activationMessage,
      id: conn.id,
      name: conn.name,
      version: conn.version,
      associatedControllers: conn.associatedControllers,
      associatedSwitches: conn.associatedSwitches,
      apCount: conn.apCount,
      switchCount: conn.switchCount,
      ip: conn.ip
    }));

    // /api/edm/v1/device/onboarding/status/controller
    const controllerCount = rawData[IOT_CONTROLLERS]?.data?.count || {};
    const controllers = (rawData[IOT_CONTROLLERS]?.data?.controllers || []).map(ctrl => ({
      activationStatus: ctrl.activationStatus,
      activationMessage: ctrl.activationMessage,
      id: ctrl.id,
      name: ctrl.name,
      connectorName: ctrl.connectorName,
      connectorId: ctrl.connectorId,
      ip: ctrl.ip,
      apCount: ctrl.apCount
    }));

    // /api/edm/v1/device/ap/deployment/count
    const deploymentCount = rawData[IOT_AP_DEPLOYMENT_COUNT]?.data?.deploymentCount;
    const deployment = rawData[IOT_AP_DEPLOYMENT_COUNT]?.data?.deployment || {};
    const apDeployment = {
      deploymentCount,
      successCount: deployment.successCount,
      failureCount: deployment.failureCount,
      progressCount: deployment.progressCount,
      notActivateCount: deployment.notActivateCount
    };

    return {
      apGateways,
      wirelessConnectorCount,
      wiredConnectorCount,
      wirelessConnectors,
      wiredConnectors,
      controllerCount,
      controllers,
      apDeployment
    };
  }

  static reportModule = {
    generateHTML: function(processedData, analysisResults) {
      const ALERT_ICONS = (typeof window !== 'undefined' && window.ALERT_ICONS) ? window.ALERT_ICONS : (typeof globalThis !== 'undefined' ? globalThis.ALERT_ICONS : {});
      function getRowClass(alertType) {
        if (alertType === 'warning') return 'row-warning';
        if (alertType === 'info') return 'row-info';
        if (alertType === 'error') return 'row-error';
        return '';
      }
      // Alert summary icons
      const alertsObj = analysisResults.alerts || {};
      const alertTypeCounts = Object.values(alertsObj).filter(Boolean).reduce((acc, type) => {
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

      // AP Gateways Table
      const apGateways = processedData.apGateways || [];
      const totalAPs = apGateways.length;
      const inactiveAPs = analysisResults.recommendations?.apGatewaysInactive || '-';
      const unmappedAPs = analysisResults.recommendations?.apGatewaysUnmapped || '-';
      const missingLocationAPs = analysisResults.recommendations?.apGatewaysMissingLocation || '-';
      const bleDisabled = analysisResults.recommendations?.apGatewaysBLE || '-';
      const usbDisabled = analysisResults.recommendations?.apGatewaysUSB || '-';
      const zigbeeDisabled = analysisResults.recommendations?.apGatewaysZigbee || '-';
      const allUnmapped = analysisResults.recommendations?.apGatewaysAllUnmapped || '';
      const allInactive = analysisResults.recommendations?.apGatewaysAllInactive || '';
      let apGatewaysTable = `<table class="report-table" style="margin-bottom:16px;">
        <tr><th colspan="2">AP Gateways Summary</th></tr>
        <tr><td>Total APs</td><td>${totalAPs}</td></tr>
        <tr class="${getRowClass(alertsObj.apGatewaysInactive)}"><td>Inactive/Disconnected APs</td><td>${inactiveAPs}</td></tr>
        <tr class="${getRowClass(alertsObj.apGatewaysUnmapped)}"><td>Unmapped APs</td><td>${unmappedAPs}</td></tr>
        <tr class="${getRowClass(alertsObj.apGatewaysMissingLocation)}"><td>APs Missing Location Info</td><td>${missingLocationAPs}</td></tr>
        <tr class="${getRowClass(alertsObj.apGatewaysBLE)}"><td>APs with BLE Disabled</td><td>${bleDisabled}</td></tr>
        <tr class="${getRowClass(alertsObj.apGatewaysUSB)}"><td>APs with USB Disabled</td><td>${usbDisabled}</td></tr>
        <tr class="${getRowClass(alertsObj.apGatewaysZigbee)}"><td>APs with Zigbee Disabled</td><td>${zigbeeDisabled}</td></tr>
        ${allUnmapped ? `<tr class="${getRowClass(alertsObj.apGatewaysAllUnmapped)}"><td>All APs Unmapped</td><td>${allUnmapped}</td></tr>` : ''}
        ${allInactive ? `<tr class="${getRowClass(alertsObj.apGatewaysAllInactive)}"><td>All APs Inactive/Disconnected</td><td>${allInactive}</td></tr>` : ''}
      </table>`;

      // AP Deployment Table
      const apDeployment = processedData.apDeployment || {};
      let apDeploymentTable = `<table class="report-table" style="margin-bottom:16px;">
        <tr><th colspan="2">AP Deployment</th></tr>
        <tr><td>Total Deployments</td><td>${apDeployment.deploymentCount ?? '-'}</td></tr>
        <tr class="${getRowClass(alertsObj.apDeploymentFailures)}"><td>Failed Deployments</td><td>${apDeployment.failureCount ?? '-'}</td></tr>
        <tr class="${getRowClass(alertsObj.apDeploymentProgress)}"><td>Deployments In Progress</td><td>${apDeployment.progressCount ?? '-'}</td></tr>
        <tr class="${getRowClass(alertsObj.apDeploymentNotActivated)}"><td>Not Activated Deployments</td><td>${apDeployment.notActivateCount ?? '-'}</td></tr>
      </table>`;

      // Controllers Table
      const controllers = processedData.controllers || [];
      let controllersTable = `<table class="report-table" style="margin-bottom:16px;">
        <tr><th colspan="2">Controllers</th></tr>
        <tr><td>Total Controllers</td><td>${controllers.length}</td></tr>
        <tr class="${getRowClass(alertsObj.controllerActivation)}"><td>Controllers Not Initiated</td><td>${analysisResults.recommendations?.controllerActivation || '-'}</td></tr>
      </table>`;

      // Connectors Table
      let connectorsTable = `<table class="report-table" style="margin-bottom:16px;">
        <tr><th colspan="2">Connectors</th></tr>
        <tr class="${getRowClass(alertsObj.connectorFailures)}"><td>Wireless Connector Failures</td><td>${analysisResults.recommendations?.connectorFailures || '-'}</td></tr>
        <tr class="${getRowClass(alertsObj.connectorPending)}"><td>Wireless Connector Pending</td><td>${analysisResults.recommendations?.connectorPending || '-'}</td></tr>
        <tr class="${getRowClass(alertsObj.connectorNotActivated)}"><td>Wireless Connector Not Activated</td><td>${analysisResults.recommendations?.connectorNotActivated || '-'}</td></tr>
      </table>`;

      return `
        <div class="section" id="iot-section">
          <h2 class="section-title">IoT
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
          ${apGatewaysTable}
          ${apDeploymentTable}
          ${controllersTable}
          ${connectorsTable}
        </div>
      `;
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.IoTChecker = IoTChecker;