// Account data checker for Spaces OS Ready Report v2
// Collects account/organization information

async function execute(domain, cookies) {
  console.log('Executing account check for domain:', domain);
  
  const endpoints = [
    `/api/v1/user/profile`,
    `/api/v1/organization`,
    `/api/v1/tenant/info`,
    `/api/account`
  ];
  
  const results = {};
  
  for (const endpoint of endpoints) {
    try {
      const url = `https://${domain}${endpoint}`;
      const data = await makeApiCall(url, cookies);
      results[endpoint] = {
        success: true,
        data: data,
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn(`Account endpoint ${endpoint} failed:`, error);
      results[endpoint] = {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  return {
    summary: extractAccountSummary(results),
    details: results
  };
}

function extractAccountSummary(results) {
  const summary = {
    organizationName: null,
    tenantId: null,
    userInfo: null,
    accountType: null,
    subscription: null
  };
  
  // Extract key information from successful API calls
  for (const [endpoint, result] of Object.entries(results)) {
    if (result.success && result.data) {
      const data = result.data;
      
      // Extract organization name
      if (data.organizationName || data.orgName || data.name) {
        summary.organizationName = data.organizationName || data.orgName || data.name;
      }
      
      // Extract tenant ID
      if (data.tenantId || data.id) {
        summary.tenantId = data.tenantId || data.id;
      }
      
      // Extract user info
      if (data.userName || data.email || data.userEmail) {
        summary.userInfo = {
          name: data.userName || data.displayName,
          email: data.email || data.userEmail,
          role: data.role || data.userRole
        };
      }
      
      // Extract account type
      if (data.accountType || data.subscriptionType) {
        summary.accountType = data.accountType || data.subscriptionType;
      }
      
      // Extract subscription info
      if (data.subscription || data.license) {
        summary.subscription = data.subscription || data.license;
      }
    }
  }
  
  return summary;
}

async function makeApiCall(url, cookies) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': cookies,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

// Make the checker available globally for report generation
globalThis.AccountChecker = {
  execute: execute
};

// Report module for generating account section in reports
globalThis.AccountChecker.reportModule = {
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
            <tr>
              <th>Organization Type</th>
              <td>${accountData.organizationType}</td>
            </tr>
            <tr>
              <th>Total Users</th>
              <td>${accountData.totalUsers}</td>
            </tr>
            <tr>
              <th>Active Locations</th>
              <td>${accountData.activeLocations}</td>
            </tr>
            <tr>
              <th>API Version</th>
              <td>${accountData.apiVersion}</td>
            </tr>
          </tbody>
        </table>
        
        ${accountData.subscriptionInfo ? this.generateSubscriptionTable(accountData.subscriptionInfo) : ''}
        ${accountData.configurationIssues.length > 0 ? this.generateIssuesTable(accountData.configurationIssues) : ''}
      </div>
    `;
  },
  
  generateSubscriptionTable: function(subscriptionInfo) {
    return `
      <h3 class="subsection-title">Subscription Details</h3>
      <table class="report-table">
        <tbody>
          <tr>
            <th>Plan Type</th>
            <td>${subscriptionInfo.planType || 'Not Available'}</td>
          </tr>
          <tr>
            <th>Status</th>
            <td>${subscriptionInfo.status || 'Not Available'}</td>
          </tr>
          <tr>
            <th>Expiry Date</th>
            <td>${subscriptionInfo.expiryDate || 'Not Available'}</td>
          </tr>
          <tr>
            <th>License Count</th>
            <td>${subscriptionInfo.licenseCount || 'Not Available'}</td>
          </tr>
        </tbody>
      </table>
    `;
  },
  
  generateIssuesTable: function(issues) {
    const issuesRows = issues.map(issue => `<tr><td>${issue}</td></tr>`).join('');
    
    return `
      <h3 class="subsection-title">Configuration Issues</h3>
      <table class="report-table">
        <thead>
          <tr>
            <th>Issue</th>
          </tr>
        </thead>
        <tbody>
          ${issuesRows}
        </tbody>
      </table>
    `;
  },
  
  processData: function(rawData) {
    if (!rawData || !rawData.summary) {
      return {
        accountName: 'Not Available',
        tenantId: 'Not Available',
        accountDomain: 'Not Available',
        organizationType: 'Not Available',
        totalUsers: 'Not Available',
        activeLocations: 'Not Available',
        apiVersion: 'Not Available',
        subscriptionInfo: null,
        configurationIssues: []
      };
    }
    
    const summary = rawData.summary;
    
    return {
      accountName: summary.accountName || 'Not Available',
      tenantId: summary.tenantId || 'Not Available', 
      accountDomain: summary.accountDomain || 'Not Available',
      organizationType: summary.organizationType || 'Not Available',
      totalUsers: summary.totalUsers || 'Not Available',
      activeLocations: summary.activeLocations || 'Not Available',
      apiVersion: summary.apiVersion || 'Not Available',
      subscriptionInfo: summary.subscriptionInfo || null,
      configurationIssues: summary.configurationIssues || []
    };
  }
};
