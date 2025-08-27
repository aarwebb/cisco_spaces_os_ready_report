// Configuration for all OS Ready Report checks - v2 API-based version
// Updated for API-based data collection instead of DOM manipulation

console.log('REPORT DEBUG: config.js loaded');

// To add a new check: add an object with key, name, checker, method, file, enabled, and report properties
globalThis.CHECKS = {
  'account': {
    key: 'account',
    name: 'Account Information',
    checker: 'AccountChecker',
    method: 'execute',
    file: 'account.js',
    enabled: true,
    hasReport: true,
    reportOrder: 1,
    description: 'Extracts account and organization information via API calls'
  },
  'location': {
    key: 'location',
    name: 'Location Data',
    checker: 'LocationChecker',
    method: 'execute', 
    file: 'location.js',
    enabled: true,
    hasReport: true,
    reportOrder: 2,
    description: 'Collects location and facility data via API calls'
  },
  'wireless': {
    key: 'wireless',
    name: 'Wireless Networks',
    checker: 'WirelessChecker',
    method: 'execute',
    file: 'wireless.js', 
    enabled: true,
    hasReport: true,
    reportOrder: 3,
    description: 'Gathers WiFi and network configuration via API calls'
  },
  'connectors': {
    key: 'connectors',
    name: 'Connector Status',
    checker: 'ConnectorChecker',
    method: 'execute',
    file: 'connectors.js',
    enabled: true,
    hasReport: true,
    reportOrder: 4,
    description: 'Retrieves hardware connector and device information via API calls'
  },
  'integrations': {
    key: 'integrations',
    name: 'Integrations',
    checker: 'IntegrationsChecker',
    method: 'execute',
    file: 'integrations.js',
    enabled: true,
    hasReport: true,
    reportOrder: 5,
    description: 'Analyzes third-party integrations and external services via API calls'
  }
};

// Convenience arrays for easier access
globalThis.ENABLED_CHECKS = Object.values(globalThis.CHECKS).filter(check => check.enabled);
globalThis.REPORT_CHECKS = Object.values(globalThis.CHECKS).filter(check => check.hasReport);

console.log('v2 Checks configuration loaded:');
console.log('   Total checks:', Object.keys(globalThis.CHECKS).length);
console.log('   Enabled checks:', globalThis.ENABLED_CHECKS.map(c => c.key));
console.log('   Report checks:', globalThis.REPORT_CHECKS.map(c => c.key));

// Metadata about this configuration
globalThis.CONFIG_METADATA = {
  version: '2.0.0',
  lastUpdated: '2025-08-26',
  approach: 'API-based',
  description: 'Configuration for Spaces OS Ready Report v2 with API-based data collection'
};
