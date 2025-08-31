// Account data checker for Spaces OS Ready Report v2
// Collects account/organization information

// Endpoint constants
const ACCOUNT = '/api/v1/user/current/status';
const SMART_LICENSE = '/api/v1/user/getSmartLicenseDetail';
const LICENSE_USAGE = '/api/v1/location2/license/globalUsage';
const ADMIN_USERS = '/api/v1/rbac/admins';
const ADMIN_ROLES = '/api/v1/rbac/admin/roles/list';

class AccountChecker {
  constructor(domain) {
    this.domain = domain;
    console.log(`[AccountChecker] Initialized for domain: ${domain}`);
  }
  static endpoints = [
    ACCOUNT,
    SMART_LICENSE,
    LICENSE_USAGE,
    ADMIN_USERS,
    ADMIN_ROLES
  ];

  async execute({ onProgress } = {}) {
    const endpoints = AccountChecker.endpoints;
    const client = globalThis.createApiClient(this.domain);
    const results = await client.callMultiple(endpoints.map(endpoint => ({ endpoint })), onProgress);
    console.log('[AccountChecker] API call results:', results);
    // Attach the domain used for API calls to the raw results for processData
    const rawResults = results.account || results;
    rawResults.__domain = this.domain;
    // Process and log parsed data for debugging
    const parsedData = AccountChecker.processData(rawResults);

    return {
      account: {
        raw: results,
        parsedData
      }
    };
  }
  
  static getProgressUnitEstimate() {
    return AccountChecker.endpoints.length;
  }

  static processData(rawData) {
    console.log('[AccountChecker.processData] Raw input:', rawData);
    // Extract and normalize all confirmed parsed fields from each endpoint
    // 1. /api/v1/user/current/status
    const accountStatus = rawData[ACCOUNT]?.data?.data || {};
    const licenseDetails = accountStatus.licenseDetails || {};
    const startDate = licenseDetails.startDate || null;
    const endDate = licenseDetails.endDate || null;
    const licenseDuration = licenseDetails.licenseDuration || null;
    const accountName = licenseDetails.accountName || null;
    const tenantId = licenseDetails.tenantId || null;

    

    // 2. /api/v1/location2/license/globalUsage
    const licenseUsage = rawData[LICENSE_USAGE]?.data?.data || {};
    const licenseCount = licenseUsage.licenseCount || null;
    const licenseType = licenseUsage.customerLicenseType || null;
    const consumedLicenses = licenseUsage.consumedLicenses || null;
    const allowedLicenseTypes = licenseUsage.allowedLicenseTypes || [];
    const childPrecedence = licenseUsage.childPrecedence || null;
    const parentPrecedence = licenseUsage.parentPrecedence || null;
    // Flexible deviceLicenseStats key
    const deviceLicenseStats = (() => {
      const keys = ['act', 'unlimited', 'see', 'extend'];
      for (const key of keys) {
        if (licenseUsage[key]) return licenseUsage[key];
      }
      // fallback: first object key if present
      const foundKey = Object.keys(licenseUsage).find(k => typeof licenseUsage[k] === 'object' && licenseUsage[k] !== null && k !== 'allowedLicenseTypes');
      return foundKey ? licenseUsage[foundKey] : null;
    })();

    // 3. /api/v1/user/getSmartLicenseDetail
    const smartLicenseDetailData = rawData[SMART_LICENSE]?.data || {};
    const details = smartLicenseDetailData.data?.details || {};
    let isSmartLicenseRegistered = null;
    if (smartLicenseDetailData.status === "unavailable") {
      isSmartLicenseRegistered = false;
    } else if (typeof details.isRegistered !== "undefined") {
      isSmartLicenseRegistered = details.isRegistered;
    }
    const smartLicenseRaw = details;
    const licenseTag = typeof smartLicenseRaw.licenseTag !== 'undefined' ? smartLicenseRaw.licenseTag : null;
    const smartAccountName = typeof smartLicenseRaw.smartAccountName !== 'undefined' ? smartLicenseRaw.smartAccountName : null;
    const virtualAccountName = typeof smartLicenseRaw.virtualAccountName !== 'undefined' ? smartLicenseRaw.virtualAccountName : null;
    const locationsCount = typeof smartLicenseRaw.locationsCount !== 'undefined' ? smartLicenseRaw.locationsCount : null;
    // Filtered entitlementInfo array
    const entitlementInfo = Array.isArray(smartLicenseRaw.entitlementInfo)
      ? smartLicenseRaw.entitlementInfo.map(e => ({
          registeredDate: e.registeredDate,
          expiryDateTimestamp: e.expiryDateTimestamp,
          expiryDate: e.expiryDate,
          expiryDays: e.expiryDays,
          entitledLicenseTag: e.entitledLicenseTag,
          enforceMode: e.enforceMode,
          consumedAps: e.consumedAps,
          apsCount: e.apsCount,
          displayName: e.displayName
        }))
      : [];

    // 4. /api/v1/rbac/admins
    const adminUsersRaw = rawData[ADMIN_USERS]?.data?.data || [];
    const adminUsers = Array.isArray(adminUsersRaw)
      ? adminUsersRaw.map(u => ({
          id: u.id,
          status: u.status,
          roleName: u.role?.roleName || null
        }))
      : [];

    // 5. /api/v1/rbac/admin/roles/list
    const adminRolesRaw = rawData[ADMIN_ROLES]?.data?.data || [];
    const adminRoles = Array.isArray(adminRolesRaw)
      ? adminRolesRaw.map(r => r.roleName)
      : [];

    // Store the API domain used for this check
    const apiDomain = rawData.__domain || null;
    return {
      startDate,
      endDate,
      licenseDuration,
      accountName,
      tenantId,
      domain: apiDomain,
      isSmartLicenseRegistered,
      licenseCount,
      licenseType,
      consumedLicenses,
      allowedLicenseTypes,
      childPrecedence,
      parentPrecedence,
      deviceLicenseStats,
      licenseTag,
      smartAccountName,
      virtualAccountName,
      locationsCount,
      entitlementInfo,
      adminUsers,
      adminRoles
    };
  }

  static reportModule = {
    generateHTML: function(processedData, analysisResults) {
      // Use ALERT_ICONS from constants.js
      const ALERT_ICONS = (typeof window !== 'undefined' && window.ALERT_ICONS) ? window.ALERT_ICONS : (typeof globalThis !== 'undefined' ? globalThis.ALERT_ICONS : {});

      // Helper to get row class based on alert type
      function getRowClass(alertType) {
        if (alertType === 'warning') return 'row-warning';
        if (alertType === 'info') return 'row-info';
        if (alertType === 'good') return 'row-good';
        return '';
      }

      // Dynamically aggregate all alert types for summary, showing each icon type and count
      const alertsObj = analysisResults.alerts || {};
      const alertTypeCounts = {};
      Object.values(alertsObj).filter(Boolean).forEach(type => {
        alertTypeCounts[type] = (alertTypeCounts[type] || 0) + 1;
      });
      const uniqueAlertTypes = Object.keys(alertTypeCounts);
      const alertIconsSummary = uniqueAlertTypes.map(type => {
        const iconUrl = ALERT_ICONS[type] || '';
        const count = alertTypeCounts[type];
        return iconUrl
          ? `<span class="alert-summary-icon"><img src="${iconUrl}" alt="${type}" title="${type}" /><span class="alert-summary-count">${count}</span></span>`
          : '';
      }).join('');

      // Aggregate all recommendations into summary
      const recommendationsObj = analysisResults.recommendations || {};
      const recommendationList = Object.values(recommendationsObj).filter(Boolean);
      const summaryRecommendations = recommendationList.length > 0
        ? `<ul class="recommendations-list">${recommendationList.map(rec => `<li>${rec}</li>`).join('')}</ul>`
        : 'No Recommendations';

      // Account summary table rows
      const summaryRows = [
        { label: 'Account Name', value: processedData.accountName || '', alert: null },
        { label: 'Tenant ID', value: processedData.tenantId || '', alert: null },
        { label: 'Domain', value: processedData.domain || '', alert: null }
      ];

      // License group rows
      const licenseRows = [
        { label: 'Smart License Registered', value: processedData.isSmartLicenseRegistered ? 'Yes' : 'No', alert: analysisResults.alerts?.smartLicense },
        { label: 'Start Date', value: processedData.startDate || '', alert: null },
        { label: 'End Date', value: processedData.endDate || '', alert: analysisResults.alerts?.licenseExpiry },
        { label: 'License Duration', value: processedData.licenseDuration || '', alert: null },
        { label: 'Total License Count', value: processedData.licenseCount ?? '', alert: null },
        { label: 'Consumed Licenses', value: processedData.consumedLicenses ?? '', alert: analysisResults.alerts?.licenseConsumption },
        { label: 'License Type', value: processedData.licenseType || '', alert: null },
        { label: 'Smart Account Name', value: processedData.smartAccountName || '', alert: null },
        { label: 'Virtual Account Name', value: processedData.virtualAccountName || '', alert: null },
        { label: 'Entitlement Compliance', value: (processedData.entitlementInfo && processedData.entitlementInfo.some(e => e.enforceMode === 'OutOfCompliance')) ? 'Out of Compliance' : 'Compliant', alert: analysisResults.alerts?.entitlementCompliance }
      ];
      // Admin group rows
      const adminCount = Array.isArray(processedData.adminUsers) ? processedData.adminUsers.length : 0;
      const roleCount = Array.isArray(processedData.adminRoles) ? processedData.adminRoles.length : 0;
      const adminRows = [
        { label: 'Dashboard Admins', value: adminCount, alert: analysisResults.alerts?.adminUsers },
        { label: 'Roles', value: roleCount, alert: analysisResults.alerts?.adminRoles }
      ];

      // Recommendations table at the top
      const recommendationsTable = `
        <table class="summary-table">
          <tr>
            <th>Recommendation(s)</th>
          </tr>
          <tr>
            <td>${summaryRecommendations}</td>
          </tr>
        </table>`;

      // Account summary table
      const summaryTable = `
        <table class="report-table">
          <tr><th colspan="2" class="group-header">Account Summary</th></tr>
          ${summaryRows.map(row => `
            <tr>
              <td class="label-col">${row.label}</td>
              <td class="value-col">${row.value}</td>
            </tr>`).join('')}
        </table>`;

      // License summary table
      const licenseTable = `
        <table class="report-table">
          <tr><th colspan="2" class="group-header">License</th></tr>
          ${licenseRows.map(row => `
            <tr class="${getRowClass(row.alert)}">
              <td class="label-col">${row.label}</td>
              <td class="value-col">${row.value}</td>
            </tr>`).join('')}
        </table>`;

      // Admin summary table
        const adminTable = `
          <table class="report-table">
            <tr><th colspan="2" class="group-header">Admins</th></tr>
            ${adminRows.map(row => `
              <tr class="${getRowClass(row.alert)}">
                <td class="label-col">${row.label}</td>
                <td class="value-col">${row.value}</td>
              </tr>`).join('')}
          </table>`;

      return `
        <div class="section" id="account-section">
          <h2 class="section-title">Account ${alertIconsSummary}</h2>
          ${recommendationsTable}
          ${summaryTable}
          ${licenseTable}
          ${adminTable}
        </div>
      `;
    }
  };
}

// Attach the checker class to globalThis for use in orchestrator
globalThis.AccountChecker = AccountChecker;