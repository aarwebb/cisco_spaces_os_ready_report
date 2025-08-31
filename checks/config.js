// Configuration for all OS Ready Report checks - v2 API-based version
// Updated for API-based data collection instead of DOM manipulation

console.log('REPORT DEBUG: config.js loaded');

// To add a new check: add an object with key, name, checker, method, and hasReport
// 'enabled' is now managed in chrome.storage, not here

globalThis.CHECKS = {
  'account': {
    key: 'account',
    name: 'Account Information',
    checker: 'AccountChecker',
    method: 'execute',
    hasReport: true
  },
  'location': {
    key: 'location',
    name: 'Location Data',
    checker: 'LocationChecker',
    method: 'execute',
    hasReport: true
  },
  'wireless': {
    key: 'wireless',
    name: 'Wireless Networks',
    checker: 'WirelessChecker',
    method: 'execute',
    hasReport: true
  },
  'connectors': {
    key: 'connectors',
    name: 'Connector Status',
    checker: 'ConnectorChecker',
    method: 'execute',
    hasReport: true
  },
  'integrations': {
    key: 'integrations',
    name: 'Integrations',
    checker: 'IntegrationsChecker',
    method: 'execute',
    hasReport: true
  },
  'iot': {
    key: 'iot',
    name: 'IoT Devices',
    checker: 'IoTChecker',
    method: 'execute',
    hasReport: true
  },
  'rightNow': {
    key: 'rightNow',
    name: 'Right Now Settings',
    checker: 'RightNowChecker',
    method: 'execute',
    hasReport: true
  }
};

// Only keep reportable checks
// ENABLED_CHECKS logic removed; enabled status is managed in chrome.storage

globalThis.REPORT_CHECKS = Object.values(globalThis.CHECKS).filter(check => check.hasReport);

console.log('v2 Checks configuration loaded:');
console.log('   Total checks:', Object.keys(globalThis.CHECKS).length);
console.log('   Report checks:', globalThis.REPORT_CHECKS.map(c => c.key));

// Metadata about this configuration (optional, for debugging/versioning)
globalThis.CONFIG_METADATA = {
  version: '2.1.0',
  lastUpdated: '2025-08-31',
  approach: 'API-based',
  description: 'Configuration for Spaces OS Ready Report v2 with API-based data collection'
};
