globalThis.DOMAINS = {
  EU: 'dnaspaces.eu',
  IO: 'dnaspaces.io',
  SG: 'dnaspaces.sg'
};


globalThis.URL_PATHS = {
  REPORT: '/report',
  HOME: '/home'
};

globalThis.TIMEOUTS = {
  URL_WAIT: 10000,
  ELEMENT_WAIT: 8000,
  ELEMENT_LOAD: 8000,
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 20000,
  VERY_SHORT: 1000,
  
  NAVIGATION: {
    BASE_DELAY: 1500,
    MENU_EXPAND: 1000,
    PROFILE_MENU: 500,
    PAGE_READY: 1500,
    LOADING_ADDITIONAL: 1000
  }
};

globalThis.SELECTORS = {
  HEADER_PROFILE: '.header-profile',
  CUSTOMER_NAME: '.customer-name',
  CUSTOMER_EMAIL: '.customer-email',
  ACCOUNT: {
    PROFILE_SECTION: '.profile-section'
  },
  NAV_LABEL: '.nav-label',
  CELL_LABEL: '.cell-label',
  NETWORKS_TEMPLATE: '.networks-template',
  NAV: {
    COLLAPSED_NAV: 'mat-sidenav[style*="width: 69px"]',
    ITEM: 'a[mat-list-item] .nav-icon img[src*="location-hierarchy"]',
    MENU_TOGGLE: '.menu-toggle'
  },
  LOADING: {
    INDICATORS: [
      '.loading-indicator',
      '.spinner',
      'mat-progress-spinner',
      '.mat-progress-spinner',
      '[role="progressbar"]'
    ],
    PAGE_CONTENT: {
      LOCATION: '.location-tree',
      WIRELESS: '.wireless-networks-list',
      CONNECTORS: '.connector-list'
    }
  }
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

globalThis.PROGRESS_STATUS = {
  IN_PROGRESS: 'In Progress...',
  COMPLETED: 'Task Completed',
  ERROR: 'ERROR',
  IDLE: 'Idle...',
  PENDING: 'Pending...'
};

globalThis.CONNECTOR_SIZES = {
  STANDARD: {
    name: 'Standard',
    maxMemoryGB: 4
  },
  ADVANCED_1: {
    name: 'Advanced 1',
    maxMemoryGB: 8
  },
  ADVANCED_2: {
    name: 'Advanced 2',
    maxMemoryGB: 16
  }
};

globalThis.OS_READY_GLOBALS = [
  'DOMAINS',
  'URL_PATHS',
  'TIMEOUTS',
  'SELECTORS',
  'STORAGE_KEYS',
  'MESSAGE_TYPES',
  'PROGRESS_STATUS',
  'CONNECTOR_SIZES'
];
