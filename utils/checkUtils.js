// Common utilities for check modules
// Shared helper functions used across multiple checks

import { createApiClient } from './apiClient.js';

/**
 * Extract tenant information from API responses
 * Handles various response structures commonly found in Spaces APIs
 * @param {Object} data - API response data
 * @returns {Object|null} Extracted tenant info or null if not found
 */
export function extractTenantInfo(data) {
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
}

/**
 * Get tenant information by trying multiple common endpoints
 * @param {string} domain - The domain to call
 * @param {string} cookies - Authentication cookies
 * @returns {Promise<Object|null>} Tenant info or null if not found
 */
export async function getTenantInfo(domain, cookies) {
  console.log('🔍 Retrieving tenant information');
  
  const apiClient = createApiClient(domain, cookies);
  
  // Common endpoints that typically contain tenant info
  // Start with the most reliable endpoint first
  const endpoints = [
    '/api/v1/user/current/status',  // Primary endpoint with comprehensive tenant info
    '/api/v1/user/profile',
    '/api/v1/account/info',
    '/api/v1/account/tenant',
    '/api/v1/tenant',
    '/api/v1/organization',
    '/api/v1/client/info',
    '/api/v1/auth/profile',
    '/api/v1/me'
  ];
  
  try {
    const result = await apiClient.callFirstSuccess(endpoints);
    const tenantInfo = extractTenantInfo(result.data);
    
    if (tenantInfo) {
      console.log(`✅ Retrieved tenant info from: ${result.endpoint}`, tenantInfo);
      return tenantInfo;
    }
    
    console.warn('⚠️ No tenant info found in API responses');
  } catch (error) {
    console.warn('❌ Could not retrieve tenant information:', error.message);
  }
  
  return null;
}

/**
 * Create a standardized API request configuration
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @returns {Object} Request configuration object
 */
export function createApiRequest(endpoint, options = {}) {
  return {
    endpoint,
    options: {
      method: 'GET',
      ...options
    }
  };
}

/**
 * Generate a summary of API call results
 * @param {Object} results - Results from API calls
 * @returns {Object} Summary statistics
 */
export function summarizeApiResults(results) {
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
}

/**
 * Extract common error patterns and generate user-friendly messages
 * @param {Object} results - Results from API calls
 * @returns {Array} Array of error messages
 */
export function extractApiErrors(results) {
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
}

/**
 * Validate required data fields are present
 * @param {Object} data - Data to validate
 * @param {Array<string>} requiredFields - Array of required field paths (e.g., ['user.id', 'organization.name'])
 * @returns {Object} Validation result with missing fields
 */
export function validateDataFields(data, requiredFields) {
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
}
