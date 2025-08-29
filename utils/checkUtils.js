// Fetch username/email from login history endpoint
globalThis.getUsername = async function getUsername(domain) {
  // Read userName from browser sessionStorage for the current domain
  try {
    // This must run in the context of the page (content script)
    const username = window.sessionStorage.getItem('userName');
    console.log('[getUsername] Read from sessionStorage:', username);
    return username || null;
  } catch (error) {
    console.warn('❌ Could not retrieve username from sessionStorage:', error.message);
    return null;
  }
};
// Common utilities for check modules
// Shared helper functions used across multiple checks

globalThis.extractTenantInfo = function extractTenantInfo(data) {
  if (!data) return null;
  
  let tenantInfo = null;
  
  // Check user status API structure (current user status endpoint)
  if (data.data && data.data.licenseDetails) {
    const licenseDetails = data.data.licenseDetails;
    tenantInfo = {
      tenantId: licenseDetails.tenantId,
      clientId: licenseDetails.tenantId, // Use tenantId as clientId fallback
      accountId: licenseDetails.tenantId, // Use tenantId as accountId fallback
      accountName: licenseDetails.accountName,
      accountType: licenseDetails.accountType,
      licenseType: licenseDetails.licenseType
    };
  }
  
  // Check direct fields
  if (!tenantInfo && (data.tenantId || data.tenant?.id || data.clientId || data.accountId)) {
    tenantInfo = {
      tenantId: data.tenantId || data.tenant?.id || data.id,
      clientId: data.clientId || data.client?.id || data.tenantId || data.tenant?.id || data.id,
      accountId: data.accountId || data.account?.id || data.tenantId || data.tenant?.id || data.id
    };
  }
  
  // Check nested user structure
  if (!tenantInfo && data.user) {
    tenantInfo = {
      tenantId: data.user.tenantId || data.user.tenant?.id,
      clientId: data.user.clientId || data.user.client?.id || data.user.tenantId,
      accountId: data.user.accountId || data.user.account?.id || data.user.tenantId
    };
  }
  
  // Check organization/company structure
  if (!tenantInfo && (data.organization || data.company)) {
    const org = data.organization || data.company;
    tenantInfo = {
      tenantId: org.id || org.tenantId,
      clientId: org.clientId || org.id,
      accountId: org.accountId || org.id
    };
  }
  
  // Check profile structure (sometimes tenant info is in profile)
  if (!tenantInfo && data.profile) {
    tenantInfo = extractTenantInfo(data.profile);
  }
  
  return tenantInfo && tenantInfo.tenantId ? tenantInfo : null;
};

globalThis.getTenantInfo = async function getTenantInfo(domain) {
  // Read tenantId from browser sessionStorage for the current domain
  try {
    const tenantId = window.sessionStorage.getItem('tenantId');
    console.log('[getTenantInfo] Read tenantId from sessionStorage:', tenantId);
    if (tenantId) {
      return {
        tenantId,
        clientId: tenantId,
        accountId: tenantId
      };
    }
    console.warn('[getTenantInfo] No tenantId found in sessionStorage');
    return null;
  } catch (error) {
    console.warn('❌ Could not retrieve tenantId from sessionStorage:', error.message);
    return null;
  }
};

globalThis.createApiRequest = function createApiRequest(endpoint, options = {}) {
  return {
    endpoint,
    options: {
      method: 'GET',
      ...options
    }
  };
};

globalThis.summarizeApiResults = function summarizeApiResults(results) {
  const total = Object.keys(results).length;
  const successful = Object.values(results).filter(r => r.success).length;
  const failed = total - successful;
  
  const summary = {
    total,
    successful,
    failed,
    successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
    endpoints: {
      successful: Object.keys(results).filter(key => results[key].success),
      failed: Object.keys(results).filter(key => !results[key].success)
    }
  };
  
  console.log(`📊 API Summary: ${successful}/${total} successful (${summary.successRate}%)`);
  
  return summary;
};

globalThis.extractApiErrors = function extractApiErrors(results) {
  const errors = [];
  
  Object.entries(results).forEach(([endpoint, result]) => {
    if (!result.success) {
      if (result.statusCode === 401) {
        errors.push(`Authentication failed for ${endpoint}`);
      } else if (result.statusCode === 403) {
        errors.push(`Access denied for ${endpoint}`);
      } else if (result.statusCode === 404) {
        errors.push(`Endpoint not found: ${endpoint}`);
      } else if (result.statusCode >= 500) {
        errors.push(`Server error for ${endpoint}`);
      } else {
        errors.push(`Failed to fetch data from ${endpoint}: ${result.error}`);
      }
    }
  });
  
  return errors;
};

globalThis.validateDataFields = function validateDataFields(data, requiredFields) {
  const missing = [];
  
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    if (value === undefined || value === null) {
      missing.push(field);
    }
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
};

console.log('[checkUtils] getTenantInfo attached:', typeof globalThis.getTenantInfo);