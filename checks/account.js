const ACCOUNT_PATH = '/accountpreference';

globalThis.getAccountLinkSelectors = function() {
  return [
    '.header-profile',
    '.my-account',
    'a[href*="/accountpreference"]',
    'span.my-account',
    'a:contains("My Account")'
  ];
}

class AccountExtractor {
  constructor(baseDomain) {
    this.baseDomain = baseDomain;
    this.navigationController = new window.NavigationController(baseDomain);
  }

  async navigateToAccountPage() {
    console.log('=== ACCOUNT NAVIGATION START ===');
    console.log('Starting account-specific navigation...');
    globalThis.updateProgressMessage('Locating account page navigation...');
    console.log('Current URL:', window.location.href);
    
    // First try the profile menu approach (most reliable for account page)
    const profileResult = await this.tryProfileNavigation();
    if (profileResult) {
      console.log('Successfully navigated via profile menu');
      return true;
    }
    
    // Fallback to direct link navigation
    console.log('Profile navigation failed, trying direct link navigation...');
    globalThis.updateProgressMessage('Trying alternate navigation method...');
    const linkResult = await this.navigationController.tryLinkNavigation(
      ACCOUNT_PATH,
      null,
      null,
      globalThis.getAccountLinkSelectors
    );
    
    if (linkResult) {
      console.log('Successfully navigated via direct links');
      return true;
    }
    
    console.log('All account navigation methods failed');
    return false;
  }

  async tryProfileNavigation() {
    try {
      console.log('Attempting profile menu navigation to account page...');
      globalThis.updateProgressMessage('Opening profile menu for account access...');
      
      const headerProfile = document.querySelector('.header-profile');
      if (!headerProfile) {
        console.log('Header profile button not found');
        return false;
      }

      const isMenuOpen = async () => {
        const dialog = document.querySelector('app-magnetic-profile-dialog');
        return !!dialog;
      };

      const closeMenu = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          if (await isMenuOpen()) {
            const anyDialogCloseBtn = document.querySelector('.user-account[mat-dialog-close], .user-logout[mat-dialog-close]');
            if (anyDialogCloseBtn) {
              anyDialogCloseBtn.click();
              await window.sleep(window.TIMEOUTS.MEDIUM);
            }

            if (await isMenuOpen()) {
              const headerProfile = document.querySelector('.header-profile');
              if (headerProfile) {
                headerProfile.click();
                await window.sleep(window.TIMEOUTS.MEDIUM);
              }
            }
            
            if (!await isMenuOpen()) {
              return true;
            }
          } else {
            return true;
          }
        }
        return false;
      };

      // Close any existing menu
      if (await isMenuOpen()) {
        console.log('Closing existing profile menu...');
        globalThis.updateProgressMessage('Closing existing profile menu...');
        await closeMenu();
        await window.sleep(window.TIMEOUTS.MEDIUM);
      }

      // Open the profile menu
      console.log('Clicking header profile to open menu...');
      globalThis.updateProgressMessage('Opening profile menu...');
      window.clickElement(headerProfile);
      await window.sleep(window.TIMEOUTS.SHORT);

      // Ensure menu is open
      let menuOpened = false;
      for (let i = 0; i < 2; i++) {
        if (await isMenuOpen()) {
          menuOpened = true;
          break;
        }
        headerProfile.click();
        await window.sleep(window.TIMEOUTS.SHORT);
      }

      if (!menuOpened) {
        console.log('Failed to open profile menu');
        return false;
      }

      // Find and click the account link
      console.log('Looking for account link in profile menu...');
      globalThis.updateProgressMessage('Locating account link in profile menu...');
      let accountLink = null;
      for (let i = 0; i < 3; i++) {
        accountLink = document.querySelector('mat-dialog-container .user-account[mat-dialog-close]');
        if (accountLink && window.getComputedStyle(accountLink).display !== 'none') {
          break;
        }
        await window.sleep(200);
      }

      if (!accountLink || window.getComputedStyle(accountLink).display === 'none') {
        console.log('Account link not found or not visible');
        await closeMenu();
        return false;
      }

      console.log('Clicking account link...');
      globalThis.updateProgressMessage('Navigating to account page...');
      window.clickElement(accountLink);
      await window.sleep(window.TIMEOUTS.SHORT);

      // Wait for navigation to complete
      console.log('Waiting for navigation to account page...');
      globalThis.updateProgressMessage('Waiting for account page to load...');
      const startTime = Date.now();
      while (Date.now() - startTime < 2000) {
        if (window.location.pathname.includes(ACCOUNT_PATH.replace('/', ''))) {
          console.log('Successfully navigated to account page');
          return true;
        }
        await window.sleep(200);
      }

      console.log('Navigation timeout - account page not reached');
      return false;

    } catch (error) {
      console.error('Error in profile navigation:', error);
      try {
        await closeMenu(5);
      } catch (e) {}
      return false;
    }
  }

  async extractAccountInfo() {
    try {
      console.log('=== ACCOUNT EXTRACTION START ===');
      console.log('Starting account information extraction...');
      globalThis.updateProgressMessage('Starting account information extraction...');
      
      const currentUrl = window.location.pathname;
      console.log('Current pathname:', currentUrl);
      
      if (!currentUrl.includes(ACCOUNT_PATH)) {
        console.log('Not on account page, attempting navigation...');
        globalThis.updateProgressMessage('Navigating to account preferences page...');
        const navigationSuccess = await this.navigateToAccountPage();
        
        if (!navigationSuccess && !window.location.pathname.includes(ACCOUNT_PATH)) {
          throw new Error('Could not navigate to Account page using any method.');
        }
        
        if (navigationSuccess || window.location.pathname.includes(ACCOUNT_PATH)) {
          globalThis.updateProgressMessage('Successfully reached account page');
        }
      } else {
        console.log('Already on account page');
        globalThis.updateProgressMessage('Already on account page, proceeding with extraction...');
      }

      console.log('Extracting account information...');
      globalThis.updateProgressMessage('Loading account details page...');
      let accountName = 'Not found';
      let tenantId = 'Not found';
      
      try {
        console.log('Looking for account name...');
        globalThis.updateProgressMessage('Extracting account name...');
        const nameDiv = await window.waitForElement('.accountNameDiv', window.TIMEOUTS.ELEMENT_LOAD);
        accountName = nameDiv.textContent.trim();
        console.log('Account name found:', accountName);
      } catch (e) {
        console.log('Account name not found:', e.message);
      }
      
      try {
        console.log('Looking for tenant ID...');
        globalThis.updateProgressMessage('Extracting tenant ID...');
        const tenantDiv = await window.waitForElement('.tenantIdDiv', window.TIMEOUTS.ELEMENT_LOAD);
        let tidText = tenantDiv.textContent.trim();
        tenantId = tidText.replace(/Tenant ID:\s*/, '');
        console.log('Tenant ID found:', tenantId);
      } catch (e) {
        console.log('Tenant ID not found:', e.message);
      }
      
      globalThis.updateProgressMessage('Processing account data...');
      const result = {
        'Account Name': accountName,
        'Tenant ID': tenantId,
        'Account Domain': window.getAccountDomain()
      };
      
      console.log('Account extraction completed:', result);
      globalThis.updateProgressMessage('Account information extraction complete');
      return result;

    } catch (error) {
      console.error('Account extraction failed:', error);
      globalThis.updateProgressMessage(`Error during account extraction: ${error.message}`);
      throw new Error(`Failed to extract account information: ${error.message}`);
    }
  }
}

globalThis.AccountExtractor = AccountExtractor;

// Report module for generating account section in reports
globalThis.AccountExtractor.reportModule = {
  generateHTML: function(data) {
    const accountData = this.processData(data);
    
    return `
      <div class="section" id="account-section">
        <h2 class="section-title">Account Information</h2>
        <table class="report-table">
          <tbody>
            <tr>
              <th>Account Name</th>
              <td>${accountData.accountName}</td>
            </tr>
            <tr>
              <th>Tenant ID</th>
              <td>${accountData.tenantId}</td>
            </tr>
            <tr>
              <th>Account Domain</th>
              <td>${accountData.accountDomain}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },
  
  processData: function(rawData) {
    if (!rawData) {
      return {
        accountName: 'Not Available',
        tenantId: 'Not Available',
        accountDomain: 'Not Available'
      };
    }
    
    return {
      accountName: rawData['Account Name'] || rawData.accountName || 'Not Available',
      tenantId: rawData['Tenant ID'] || rawData.tenantId || 'Not Available',
      accountDomain: rawData['Account Domain'] || rawData.accountDomain || 'Not Available'
    };
  },
  
  hasData: function(data) {
    if (!data) return false;
    const processedData = this.processData(data);
    return processedData.accountName !== 'Not Available' || 
           processedData.tenantId !== 'Not Available' ||
           processedData.accountDomain !== 'Not Available';
  }
};