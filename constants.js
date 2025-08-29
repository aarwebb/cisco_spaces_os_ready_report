// Delay (ms) between API calls to avoid server overload
globalThis.API_CALL_DELAY = 1000; // 1 second
globalThis.DOMAINS = {
  EU: 'dnaspaces.eu',
  IO: 'dnaspaces.io',
  SG: 'dnaspaces.sg'
};


globalThis.URL_PATHS = {
  REPORT: '/report',
  HOME: '/home'
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
  OPEN_REPORT_TAB: 'open_report_tab'
};

globalThis.OS_READY_GLOBALS = [
    'API_CALL_DELAY',
    'DOMAINS',
    'URL_PATHS',
    'STORAGE_KEYS',
    'MESSAGE_TYPES'
];
