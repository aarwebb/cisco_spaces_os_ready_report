
// Consolidated configuration for all OS Ready Report checks
// This is the single source of truth for check configuration
// To add a new check: add an object with key, name, checker, method, file, enabled, and report properties
globalThis.REPORT_CHECKS = [
  {
    key: 'account',
    name: 'Extract Account Information',
    checker: 'AccountExtractor',
    method: 'extractAccountInfo',
    file: 'checks/account.js',
    enabled: true,
    // Report configuration
    reportTitle: 'Account Information',
    reportOrder: 1,
    hasReport: true
  },
  {
    key: 'location',
    name: 'Check Location Hierarchy',
    checker: 'LocationChecker',
    method: 'checkLocationHierarchy',
    file: 'checks/location.js',
    enabled: true,
    // Report configuration
    reportTitle: 'Location Hierarchy',
    reportOrder: 2,
    hasReport: true
  },
  {
    key: 'wireless',
    name: 'Check Wireless Networks',
    checker: 'WirelessChecker',
    method: 'checkWirelessNetworks',
    file: 'checks/wireless.js',
    enabled: true,
    // Report configuration
    reportTitle: 'Wireless Networks',
    reportOrder: 3,
    hasReport: true
  },
  {
    key: 'connector',
    name: 'Check Connector Status',
    checker: 'ConnectorChecker',
    method: 'checkConnectorStatus',
    file: 'checks/connectors.js',
    enabled: true,
    // Report configuration
    reportTitle: 'Connector Status',
    reportOrder: 4,
    hasReport: true
  },
  {
    key: 'integrations',
    name: 'Check Integrations',
    checker: 'IntegrationsChecker',
    method: 'checkIntegrations',
    file: 'checks/integrations.js',
    enabled: true,
    // Report configuration
    reportTitle: 'Integrations',
    reportOrder: 5,
    hasReport: true
  },
  {
    key: 'report',
    name: 'Generate OS Ready Report',
    checker: null, // No checker needed - handled by progress manager
    method: null,
    file: null,
    enabled: true,
    // No report section needed - this IS the report
    hasReport: false
  }
];
