// Progress callback pattern for checkers and API clients
// Usage: pass { onProgress } to checker.execute and API helpers, call onProgress(1) after each progress unit
// Example: await callApi(endpoint, options, onProgress)
// Constants for Spaces OS Ready Report

// Global constants, keep this list updated for debugging
globalThis.OS_READY_GLOBALS = [
    'API_CALL_DELAY',
    'DOMAINS',
    'STORAGE_KEYS',
    'MESSAGE_TYPES',
    'ALERT_LEVELS',
    'ALERT_ICONS'
];

// Delay (ms) between API calls to avoid server overload
globalThis.API_CALL_DELAY = 1000; // 1 second

globalThis.DOMAINS = {
  EU: 'dnaspaces.eu',
  IO: 'dnaspaces.io',
  SG: 'dnaspaces.sg'
};

globalThis.STORAGE_KEYS = {
  PROGRESS: 'progress',
  CURRENT_STEP: 'currentStep',
  CURRENT_INSTRUCTION: 'currentInstruction',
  REPORT_DATA: 'reportData',
  DEBUG_MODE: 'debugMode'
};

globalThis.MESSAGE_TYPES = {
  START_COLLECTION: 'start_collection',
  GENERATE_REPORT: 'generate_report',
  REPORT_COMPLETE: 'report_complete',
  RESET_COLLECTION: 'reset_collection',
  OPEN_REPORT_TAB: 'open_report_tab',
  ANALYSIS_STARTED: 'analysis_started',
  ANALYSIS_COMPLETED: 'analysis_completed',
  ANALYSIS_ERROR: 'analysis_error',
  ANALYSIS_PROGRESS: 'analysis_progress',
  ANALYSIS_DATA_UPDATED: 'analysis_data_updated'
};

// Standard alerting levels and icon pairing
globalThis.ALERT_LEVELS = {
  success: 'Success',
  info: 'Info',
  warning: 'Warning',
  error: 'Error'
};

globalThis.ALERT_ICONS = {
  success: 'icons/alerts/success.svg',
  info: 'icons/alerts/info.svg',
  warning: 'icons/alerts/warning.svg',
  error: 'icons/alerts/error.svg'
};

// Helper to determine if IoT Services are enabled for a connector
// Connector and VM sizing limits for analysis
globalThis.OS_READY_CONNECTOR_LIMITS = {
  VM_MIN_CPU: 8,
  VM_MIN_RAM: 16 * 1024, // MB
  VM_MIN_DISK: 120, // GB
  // Max values for Location
  MAX_AP_COUNT: 15000,
  MAX_CLIENT_COUNT: 150000,
  MAX_NMSP_MSG_RATE: 38000,
  // Max values for IoT Services
  MAX_GRPC_AP_COUNT: 3000,
  MAX_IOT_CLIENT_COUNT: 30000,
  MAX_BLE_MSG_RATE: 170000
};

// Allowed map sources for location analysis
globalThis.ALLOWED_MAP_SOURCES = ['DNAC', 'Webex', 'Meraki', 'CMX'];