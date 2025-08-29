// Account data checker for Spaces OS Ready Report v2
// Collects account/organization information

// Endpoint constants
const ACCOUNT = '/api/v1/user/current/status';
const SMART_LICENSE = '/api/v1/user/getSmartLicenseDetail';
const LICENSE_USAGE = '/api/v1/location2/license/globalUsage';
const ADMIN_USERS = '/api/v1/rbac/admins';

class AccountChecker {
  constructor(domain) {
    this.domain = domain;
  }

  async execute() {
    const endpoints = [
        ACCOUNT,
        LICENSE_USAGE,
        SMART_LICENSE,
        ADMIN_USERS
    ];
    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })));
    return { account: results };
  }

  static reportModule = {
    generateHTML: function(data) {
      return `
        <div class="section" id="account-section">
          <h2 class="section-title">Account Data</h2>
          <pre style="white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 1em; border-radius: 4px;">
            ${JSON.stringify(data, null, 2)}
          </pre>
        </div>
      `;
    },
    processData: function(rawData) {
      return rawData || {};
    }
  };
}

globalThis.AccountChecker = AccountChecker;