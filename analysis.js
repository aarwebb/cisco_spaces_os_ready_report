// Modular Analysis Layer for Spaces OS Ready Report v2
// This module provides baseline analysis functions for each check

console.log('REPORT DEBUG: analysis.js loaded');

const AnalysisModules = {};

// Account analysis rules
AnalysisModules.account = function(processedData) {
  console.log('[AnalysisModules.account] Input:', processedData);
  const recommendations = {};
  const alerts = {};
  // 1. Smart License Registration
  if (!processedData.isSmartLicenseRegistered) {
    alerts.smartLicense = 'warning';
    recommendations.smartLicense = 'Register account for Smart Licensing.';
  }
  // 2. License Expiry
  if (processedData.endDate) {
    const now = new Date();
    const endDate = new Date(processedData.endDate);
    const daysToExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    if (daysToExpiry <= 90) {
      alerts.licenseExpiry = 'warning';
      recommendations.licenseExpiry = `License expires in ${daysToExpiry} days. Renew license soon.`;
    } else if (daysToExpiry <= 180) {
      alerts.licenseExpiry = 'info';
      recommendations.licenseExpiry = `License expires in ${daysToExpiry} days. Monitor license expiry.`;
    }
  }
  // 3. License Consumption
  if (typeof processedData.consumedLicenses === 'number' && typeof processedData.licenseCount === 'number') {
    if (processedData.consumedLicenses > processedData.licenseCount) {
      alerts.licenseConsumption = 'error';
      recommendations.licenseConsumption = 'Consumed licenses exceed total license count. Review account licenses.';
    } else if (processedData.licenseCount > 0) {
      const percentUsed = (processedData.consumedLicenses / processedData.licenseCount) * 100;
      if (percentUsed === 100) {
        // OK, no alert
      } else if (percentUsed >= 80) {
        alerts.licenseConsumption = 'info';
        recommendations.licenseConsumption = 'Additional licenses can still be activated.';
      } else {
        alerts.licenseConsumption = 'warning';
        recommendations.licenseConsumption = 'Large amount of licenses have not been activated.';
      }
    }
  }
  // 4. Entitlement Compliance
  if (processedData.entitlementInfo && Array.isArray(processedData.entitlementInfo)) {
    const outOfCompliance = processedData.entitlementInfo.some(e => e.enforceMode === 'OutOfCompliance');
    if (outOfCompliance) {
      alerts.entitlementCompliance = 'warning';
      recommendations.entitlementCompliance = 'Review smart account.';
    }
  }
  // 5. Admin Users Count
  if (processedData.adminUsers && Array.isArray(processedData.adminUsers)) {
    const adminCount = processedData.adminUsers.length;
    if (adminCount === 1 || adminCount === 2) {
      alerts.adminUsers = 'info';
      recommendations.adminUsers = 'Ensure Line of Business users may not be invited yet.';
    }
  }
  // 6. Admin Roles
  if (processedData.adminRoles && Array.isArray(processedData.adminRoles)) {
    if (processedData.adminRoles.length === 1 && processedData.adminRoles[0] === 'Dashboard Admin Role') {
      alerts.adminRoles = 'info';
      recommendations.adminRoles = 'Only default role is present.';
    }
  }
  const result = {
    recommendations,
    alerts
  };
  console.log('[AnalysisModules.account] Output:', result);
  return result;
};

// Location analysis rules
AnalysisModules.location = function(processedData) {
  console.log('[AnalysisModules.location] Input:', processedData);
  const recommendations = {};
  const alerts = {};

  // 1. Source Validation
  const allowedSources = globalThis.ALLOWED_MAP_SOURCES;
  let allSources = new Set();
  if (processedData.locationProcessor && Array.isArray(processedData.locationProcessor)) {
    processedData.locationProcessor.forEach(loc => {
      if (Array.isArray(loc.hierarchyMapSources)) {
        loc.hierarchyMapSources.forEach(src => allSources.add(src));
      }
    });
  } else if (Array.isArray(processedData.floors)) {
    processedData.floors.forEach(floor => {
      if (Array.isArray(floor.hierarchyMapSources)) {
        floor.hierarchyMapSources.forEach(src => allSources.add(src));
      }
    });
  }
  const unknownSources = Array.from(allSources).filter(src => !allowedSources.includes(src));
  if (unknownSources.length > 0) {
    recommendations.sources = `Unknown map sources detected: [${unknownSources.join(', ')}]`;
    alerts.sources = 'warning';
  }

  // 2. Locations Without GPS Markers
  let locationsNoGPS = 0;
  if (processedData.locationProcessor && Array.isArray(processedData.locationProcessor)) {
    locationsNoGPS = processedData.locationProcessor.filter(loc => {
      return !(loc.lat && loc.long && Number(loc.lat) !== 0 && Number(loc.long) !== 0);
    }).length;
  } else if (Array.isArray(processedData.buildings?.buildings)) {
    locationsNoGPS = processedData.buildings.buildings.filter(b => {
      return !(b.lat && b.long && Number(b.lat) !== 0 && Number(b.long) !== 0);
    }).length;
  }
  if (locationsNoGPS > 0) {
    recommendations.gps = `${locationsNoGPS} locations without GPS markers`;
    alerts.gps = 'alert';
  }

  // 3. Buildings Without Floors
  let buildingsNoFloors = 0;
  if (processedData.locationProcessor && Array.isArray(processedData.locationProcessor)) {
    buildingsNoFloors = processedData.locationProcessor.filter(loc => {
      return loc.type === 'building' && (!loc.floors || loc.floors.length === 0);
    }).length;
  } else if (Array.isArray(processedData.buildings?.buildings)) {
    buildingsNoFloors = processedData.buildings.buildings.filter(b => {
      return !b.floors || b.floors.length === 0;
    }).length;
  }
  if (buildingsNoFloors > 0) {
    recommendations.buildings = `${buildingsNoFloors} buildings without floors`;
    alerts.buildings = 'alert';
  }

  // 4. Maps With Error or In Review Status
  let mapsWithIssues = 0;
  const checkStatuses = (mapsArr) => {
    mapsArr.forEach(map => {
      if (Array.isArray(map.processingStatuses)) {
        map.processingStatuses.forEach(statusObj => {
          if (['ERROR', 'IN_REVIEW'].includes(statusObj.status)) {
            mapsWithIssues++;
          }
        });
      }
    });
  };
  if (processedData.locationProcessor && Array.isArray(processedData.locationProcessor)) {
    processedData.locationProcessor.forEach(loc => {
      if (Array.isArray(loc.maps)) checkStatuses(loc.maps);
    });
  } else if (Array.isArray(processedData.floors)) {
    processedData.floors.forEach(floor => {
      if (Array.isArray(floor.maps)) checkStatuses(floor.maps);
    });
  } else if (Array.isArray(processedData.buildings?.buildings)) {
    processedData.buildings.buildings.forEach(b => {
      if (Array.isArray(b.maps)) checkStatuses(b.maps);
    });
  }
  if (mapsWithIssues > 0) {
    recommendations.maps = `${mapsWithIssues} maps with ERROR or IN_REVIEW status`;
    alerts.maps = 'info';
  }

  const result = {
    recommendations,
    alerts
  };
  console.log('[AnalysisModules.location] Output:', result);
  return result;
};

// Wireless analysis rules
AnalysisModules.wireless = function(processedData) {
  console.log('[AnalysisModules.wireless] Input:', processedData);
  const recommendations = {};
  const alerts = {
    controllerStatus: {},
    controllerReachability: {},
    controllerVersion: {},
    apInventory: {}
  };

  if (Array.isArray(processedData.controllers)) {
    processedData.controllers.forEach(ctrl => {
      // 1. Controller Health
      if (ctrl.reportStatus !== 'ACTIVE') {
        alerts.controllerStatus[ctrl.id] = 'warning';
      }
      // 2. Controller Reachability
      if (ctrl.reachable === false) {
        alerts.controllerReachability[ctrl.id] = 'error';
      }
      // 3. Controller Version
      if (['Unknown', 'INDETERMINATE'].includes(ctrl.controllerVersion)) {
        alerts.controllerVersion[ctrl.id] = 'info';
      }
      // 4. AP Inventory
      if (ctrl.numberOfAps === 0) {
        alerts.apInventory[ctrl.id] = 'info';
      }
    });
  }

  // Section-level recommendations (unchanged)
  if (Object.keys(alerts.controllerStatus).length > 0) {
    recommendations.controllerStatus = 'Some controllers are inactive. Check connectivity and configuration.';
  }
  if (Object.keys(alerts.controllerReachability).length > 0) {
    recommendations.controllerReachability = 'One or more controllers are unreachable. Investigate network issues.';
  }
  if (Object.keys(alerts.controllerVersion).length > 0) {
    recommendations.controllerVersion = 'Controller version is unknown. Update controller firmware or check integration.';
  }
  if (Object.keys(alerts.apInventory).length > 0) {
    recommendations.apInventory = 'No APs detected for some controllers. Verify AP registration.';
  }

  const result = {
    recommendations,
    alerts
  };
  console.log('[AnalysisModules.wireless] Output:', result);
  return result;
};

// Connectors analysis rules
AnalysisModules.connectors = function(processedData) {
  // Helper to determine if IoT Services are enabled for a connector
  function isIoTServicesEnabled(conn) {
    if (!conn.serviceDeployConfig || typeof conn.serviceDeployConfig !== 'object') return false;
    return Object.keys(conn.serviceDeployConfig).some(key => key.startsWith('iot-'));
  }
  console.log('[AnalysisModules.connectors] Input:', processedData);
  const recommendations = {};
  const alerts = {};
  const indicators = {};

  const {
    VM_MIN_CPU,
    VM_MIN_RAM,
    VM_MIN_DISK,
    MAX_AP_COUNT,
    MAX_CLIENT_COUNT,
    MAX_NMSP_MSG_RATE,
    MAX_GRPC_AP_COUNT,
    MAX_IOT_CLIENT_COUNT,
    MAX_BLE_MSG_RATE
  } = globalThis.OS_READY_CONNECTOR_LIMITS;

  if (!processedData.connectors || processedData.connectors.length === 0) {
    recommendations.section = 'No connectors found. Please verify deployment.';
    indicators.connectorsStatus = 'warning';
    return { recommendations, alerts, indicators };
  }

  processedData.connectors.forEach(conn => {
    // VM sizing check (all nodes)
    if (Array.isArray(conn.nodeDetails)) {
      conn.nodeDetails.forEach((node, idx) => {
        if (node.vmResources) {
          const underSized =
            node.vmResources.cpuCount < VM_MIN_CPU ||
            node.vmResources.memoryInMB < VM_MIN_RAM ||
            node.vmResources.diskSpaceInGB?.total < VM_MIN_DISK;
          if (underSized) {
            alerts[`vmSizing_${conn.id}_${idx}`] = 'warning';
            recommendations[`vmSizing_${conn.id}_${idx}`] = `Connector ${conn.name} node ${idx} is under-sized (CPU, RAM, or Disk below minimum requirements).`;
          }
        }
      });
    }

    // Service upgrade check for each service in serviceDeployConfig
    if (conn.serviceDeployConfig && typeof conn.serviceDeployConfig === 'object') {
      Object.entries(conn.serviceDeployConfig).forEach(([serviceName, serviceObj]) => {
        if (serviceObj.imageConfig && serviceObj.imageConfig.gold && serviceObj.imageConfig.latest) {
          const goldVer = serviceObj.imageConfig.gold.version;
          const latestVer = serviceObj.imageConfig.latest.version;
          if (goldVer && latestVer && goldVer !== latestVer) {
            recommendations[`serviceUpgrade_${conn.id}_${serviceName}`] = `Upgrade service '${serviceName}' for connector ${conn.name} from ${goldVer} to latest version ${latestVer}.`;
          }
        }
      });
    }

    // IoT Services enabled check
    const isIoT = isIoTServicesEnabled(conn);

    // Max value checks
    if (isIoT) {
      if (conn.numberOfAps > MAX_GRPC_AP_COUNT) {
        alerts[`grpcApCount_${conn.id}`] = 'warning';
        recommendations[`grpcApCount_${conn.id}`] = `Connector ${conn.name} exceeds recommended GRPC AP count (${MAX_GRPC_AP_COUNT}).`;
      }
      if (conn.dataChannelMetrics?.nmspMessages?.count > MAX_BLE_MSG_RATE) {
        alerts[`bleMsgRate_${conn.id}`] = 'warning';
        recommendations[`bleMsgRate_${conn.id}`] = `Connector ${conn.name} exceeds recommended BLE message rate (${MAX_BLE_MSG_RATE}).`;
      }
      if (conn.dataChannelMetrics?.connectionCount?.count > MAX_IOT_CLIENT_COUNT) {
        alerts[`iotClientCount_${conn.id}`] = 'warning';
        recommendations[`iotClientCount_${conn.id}`] = `Connector ${conn.name} exceeds recommended IoT client count (${MAX_IOT_CLIENT_COUNT}).`;
      }
    } else {
      if (conn.numberOfAps > MAX_AP_COUNT) {
        alerts[`apCount_${conn.id}`] = 'warning';
        recommendations[`apCount_${conn.id}`] = `Connector ${conn.name} exceeds recommended AP count (${MAX_AP_COUNT}).`;
      }
      if (conn.dataChannelMetrics?.connectionCount?.count > MAX_CLIENT_COUNT) {
        alerts[`clientCount_${conn.id}`] = 'warning';
        recommendations[`clientCount_${conn.id}`] = `Connector ${conn.name} exceeds recommended client count (${MAX_CLIENT_COUNT}).`;
      }
      if (conn.dataChannelMetrics?.nmspMessages?.count > MAX_NMSP_MSG_RATE) {
        alerts[`nmspMsgRate_${conn.id}`] = 'warning';
        recommendations[`nmspMsgRate_${conn.id}`] = `Connector ${conn.name} exceeds recommended NMSP message rate (${MAX_NMSP_MSG_RATE}).`;
      }
    }

    // Status checks
    if (conn.status !== 'Connected') {
      alerts[`status_${conn.id}`] = 'warning';
      recommendations[`status_${conn.id}`] = `Connector ${conn.name} is not connected.`;
    }
    if (conn.connectorStatus !== 'Up') {
      alerts[`connectorStatus_${conn.id}`] = 'warning';
      recommendations[`connectorStatus_${conn.id}`] = `Connector ${conn.name} is not Up.`;
    }
    if (conn.edmStatus?.status !== 'ENABLED') {
      alerts[`edmStatus_${conn.id}`] = 'warning';
      recommendations[`edmStatus_${conn.id}`] = `EDM is not enabled for connector ${conn.name}.`;
    }

    // APs and metrics
    if (!conn.numberOfAps || conn.numberOfAps === 0) {
      recommendations[`numberOfAps_${conn.id}`] = `No APs associated with connector ${conn.name}.`;
    }
    if (conn.dataChannelMetrics?.nmspDropped?.count > 10000) { // Example threshold
      alerts[`nmspDropped_${conn.id}`] = 'warning';
      recommendations[`nmspDropped_${conn.id}`] = `High NMSP drop rate for connector ${conn.name}.`;
    }

    // Service version upgrade
    if (conn.reportUpgrade?.gold && conn.reportUpgrade?.latest && conn.reportUpgrade.gold !== conn.reportUpgrade.latest) {
      recommendations[`upgrade_${conn.id}`] = `Upgrade connector ${conn.name} from ${conn.reportUpgrade.gold} to latest version ${conn.reportUpgrade.latest}.`;
    }

    // Version warning
    if (conn.version === 'V2') {
      alerts[`version_${conn.id}`] = 'warning';
      recommendations[`version_${conn.id}`] = `Connector ${conn.name} is running V2. Upgrade to V3 is recommended.`;
    }
  });

  indicators.connectorsStatus = 'good';
  if (Object.keys(alerts).length > 0) {
    indicators.connectorsStatus = 'warning';
  }

  const result = {
    recommendations,
    alerts,
    indicators
  };
  console.log('[AnalysisModules.connectors] Output:', result);
  return result;
};

// Integrations analysis rules
AnalysisModules.integrations = function(processedData) {
  console.log('[AnalysisModules.integrations] Input:', processedData);
  const recommendations = {};
  const alerts = {};

    const catcList = Array.isArray(processedData.dnacActivations) ? processedData.dnacActivations : [];
    const activeCatc = catcList.filter(item => item.status === 'ACTIVATED');
    const notActiveCatc = catcList.length - activeCatc.length;
    if (catcList.length > 0 && notActiveCatc > 0) {
      const catcInstancesAlert = 'info';
      recommendations.catcInstances = `Clean up any old CatC instances (${notActiveCatc} not activated).`;
      alerts.catcInstances = catcInstancesAlert;
    }

  // WebEx logic
  if (processedData.webexAuthStatus && processedData.webexAuthStatus.syncStatus === false) {
    alerts.webexSync = 'info';
    recommendations.webexSync = 'Enable Webex Control Hub integration.';
  }

  // Calendar logic
  // Need to confirm if "ACTIVATED" is the correct value
  if (processedData.calendarActivations) {
    const ms365 = processedData.calendarActivations.ms365;
    const google = processedData.calendarActivations.google;
    if (ms365 && ms365.status === 'ACTIVATED' && ms365.rooms === 0) {
      alerts.ms365Rooms = 'warning';
      recommendations.ms365Rooms = 'No rooms discovered via Microsoft Office 365 integration.';
    }
    if (google && google.status === 'ACTIVATED' && google.rooms === 0) {
      alerts.googleRooms = 'warning';
      recommendations.googleRooms = 'No rooms discovered via Google integration.';
    }
  }

  // Meraki logic
  if (processedData.merakiIntegration && processedData.merakiIntegration.sync === 'active') {
    const providers = processedData.merakiIntegration.wirelessProvidersCount || [];
    providers.forEach(provider => {
      if (provider.failed > 0 && provider.success === 0) {
        alerts.merakiProvider = 'error';
        recommendations.merakiProvider = 'Verify Meraki Integration settings.';
      }
    });
  }

  const result = {
    recommendations,
    alerts
  };
  console.log('[AnalysisModules.integrations] Output:', result);
  return result;
};

// IoT analysis rules
AnalysisModules.iot = function(processedData) {
  console.log('[AnalysisModules.iot] Input:', processedData);
  const recommendations = {};
  const alerts = {};

  // AP Deployment rules
  const apDeployment = processedData.apDeployment || {};
  if (apDeployment.deploymentCount === 0) {
    recommendations.apDeployment = 'No AP deployments detected.';
    alerts.apDeployment = 'warning';
  }
  if (apDeployment.failureCount > 0) {
    recommendations.apDeploymentFailures = `${apDeployment.failureCount} AP deployments failed.`;
    alerts.apDeploymentFailures = 'error';
  }
  if (apDeployment.progressCount > 0) {
    recommendations.apDeploymentProgress = `${apDeployment.progressCount} AP deployments are in progress.`;
    alerts.apDeploymentProgress = 'info';
  }
  if (apDeployment.notActivateCount > 0) {
    recommendations.apDeploymentNotActivated = `${apDeployment.notActivateCount} AP deployments are not activated.`;
    alerts.apDeploymentNotActivated = 'info';
  }

  // Controller rules
  const controllers = processedData.controllers || [];
  const notInitiatedControllers = controllers.filter(ctrl => ctrl.activationStatus === 'NOT_INITIATED');
  if (notInitiatedControllers.length > 0) {
    recommendations.controllerActivation = `${notInitiatedControllers.length} controllers have not initiated activation.`;
    alerts.controllerActivation = 'warning';
  }
  // Placeholder for other statuses

  // Connectors rules (wirelessConnectorCount)
  const wirelessConnectorCount = processedData.wirelessConnectorCount || {};
  if (wirelessConnectorCount.failed > 0) {
    recommendations.connectorFailures = `${wirelessConnectorCount.failed} wireless connectors failed.`;
    alerts.connectorFailures = 'error';
  }
  if (wirelessConnectorCount.pending > 0) {
    recommendations.connectorPending = `${wirelessConnectorCount.pending} wireless connectors pending activation.`;
    alerts.connectorPending = 'warning';
  }
  if (wirelessConnectorCount.notActivated > 0) {
    recommendations.connectorNotActivated = `${wirelessConnectorCount.notActivated} wireless connectors not activated.`;
    alerts.connectorNotActivated = 'info';
  }

  // AP Gateways aggregate rules
  const apGateways = processedData.apGateways || [];
  const totalAPs = apGateways.length;
  if (totalAPs === 0) {
    recommendations.apGateways = 'No APs discovered.';
    alerts.apGateways = 'warning';
  } else {
    // Inactive/disconnected
    const inactiveAPs = apGateways.filter(ap => ap.status !== 'ACTIVE' || ap.connected === false).length;
    const percentInactive = totalAPs > 0 ? (inactiveAPs / totalAPs) * 100 : 0;
    if (percentInactive > 5) {
      recommendations.apGatewaysInactive = `${inactiveAPs} APs (${percentInactive.toFixed(1)}%) are inactive or disconnected.`;
      alerts.apGatewaysInactive = 'warning';
    }
    // Unmapped
    const unmappedAPs = apGateways.filter(ap => !ap.x || !ap.y || !ap.z || !ap.displayName).length;
    const percentUnmapped = totalAPs > 0 ? (unmappedAPs / totalAPs) * 100 : 0;
    if (percentUnmapped > 5) {
      recommendations.apGatewaysUnmapped = `${unmappedAPs} APs (${percentUnmapped.toFixed(1)}%) are not mapped to a location.`;
      alerts.apGatewaysUnmapped = 'info';
    }
    // Missing location info
    const missingLocationAPs = apGateways.filter(ap => !ap.floor_name || !ap.building_name || !ap.campus_name).length;
    const percentMissingLocation = totalAPs > 0 ? (missingLocationAPs / totalAPs) * 100 : 0;
    if (percentMissingLocation > 5) {
      recommendations.apGatewaysMissingLocation = `${missingLocationAPs} APs (${percentMissingLocation.toFixed(1)}%) are missing location hierarchy data.`;
      alerts.apGatewaysMissingLocation = 'info';
    }
    // BLE/USB/Zigbee disabled
    const bleDisabled = apGateways.filter(ap => ap.config && ap.config.BLE === false).length;
    const usbDisabled = apGateways.filter(ap => ap.config && ap.config.USB === false).length;
    const zigbeeDisabled = apGateways.filter(ap => ap.config && ap.config.Zigbee === false).length;
    const percentBLE = totalAPs > 0 ? (bleDisabled / totalAPs) * 100 : 0;
    const percentUSB = totalAPs > 0 ? (usbDisabled / totalAPs) * 100 : 0;
    const percentZigbee = totalAPs > 0 ? (zigbeeDisabled / totalAPs) * 100 : 0;
    if (percentBLE > 5) {
      recommendations.apGatewaysBLE = `${bleDisabled} APs (${percentBLE.toFixed(1)}%) have BLE disabled.`;
      alerts.apGatewaysBLE = 'info';
    }
    if (percentUSB > 5) {
      recommendations.apGatewaysUSB = `${usbDisabled} APs (${percentUSB.toFixed(1)}%) have USB disabled.`;
      alerts.apGatewaysUSB = 'info';
    }
    if (percentZigbee > 5) {
      recommendations.apGatewaysZigbee = `${zigbeeDisabled} APs (${percentZigbee.toFixed(1)}%) have Zigbee disabled.`;
      alerts.apGatewaysZigbee = 'info';
    }
    // All APs unmapped/inactive
    if (percentUnmapped === 100) {
      recommendations.apGatewaysAllUnmapped = 'All APs are unmapped.';
      alerts.apGatewaysAllUnmapped = 'error';
    }
    if (percentInactive === 100) {
      recommendations.apGatewaysAllInactive = 'All APs are inactive or disconnected.';
      alerts.apGatewaysAllInactive = 'error';
    }
  }

  const result = {
    recommendations,
    alerts
  };
  console.log('[AnalysisModules.iot] Output:', result);
  return result;
};

// Right Now analysis rules
AnalysisModules.rightNow = function(processedData) {
  console.log('[AnalysisModules.rightNow] Input:', processedData);
    const recommendations = {};
    const alerts = {};
    const ssidList = processedData.ssidList || {};
    const excludedSSIDs = processedData.excludedSSIDs || {};
    const includedDevices = processedData.includedDevices || [];
    const typeCounts = {};
    Object.values(ssidList).forEach(type => {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    const totalSSIDs = Object.keys(ssidList).length;
    const totalExcluded = Object.keys(excludedSSIDs).length;

    // Total SSIDs
    if (totalSSIDs === 0) {
      recommendations.totalSSIDs = 'No SSIDs found.';
      alerts.totalSSIDs = 'warning';
    } else if (totalSSIDs < 3) {
      recommendations.totalSSIDs = 'Low number of SSIDs.';
      alerts.totalSSIDs = 'info';
    }

    // Excluded SSIDs
    if (totalExcluded === 0) {
      recommendations.excludedSSIDs = 'No SSIDs are excluded.';
      alerts.excludedSSIDs = 'info';
    } else if (totalExcluded < totalSSIDs / 2) {
      recommendations.excludedSSIDs = 'Review the excluded SSIDs, including too many SSIDs can impact data accuracy.';
      alerts.excludedSSIDs = 'warning';
    }

    // SSID Types
    if (Object.keys(typeCounts).length === 0) {
      recommendations.ssidTypes = 'No SSID types found.';
      alerts.ssidTypes = 'warning';
    } else if (Object.keys(typeCounts).length < 2) {
      recommendations.ssidTypes = 'Only one SSID type found.';
      alerts.ssidTypes = 'info';
    }

    // Included Devices
    if (includedDevices.length === 0) {
      recommendations.includedDevices = 'No included devices.';
      alerts.includedDevices = 'warning';
    }

  const result = {
    recommendations,
    alerts
  };
  console.log('[AnalysisModules.rightNow] Output:', result);
  return result;
};

// Cross-check analysis: compare SSIDs in rightNow with location buildings
AnalysisModules.crossCheckLocationSSIDs = function(allProcessedData) {
  console.log('[AnalysisModules.crossCheckLocationSSIDs] Input:', allProcessedData);
  // Placeholder for cross-check analysis rules
  // Example: Compare or correlate data between multiple checks
  // Input: allProcessedData (object containing processed data for all checks)
  // Output: custom cross-check results

  // TODO: Implement specific cross-check logic here
  const result = {
    result: null,
    message: 'No cross-check rules implemented yet.'
  };
  console.log('[AnalysisModules.crossCheckLocationSSIDs] Output:', result);
  return result;
};

// Export for global use
window.AnalysisModules = AnalysisModules;