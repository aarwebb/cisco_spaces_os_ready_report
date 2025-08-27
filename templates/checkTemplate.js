// Template for creating new check modules
// Copy this file and customize for your specific check

import { createApiClient } from '../utils/apiClient.js';
import { getTenantInfo, createApiRequest, summarizeApiResults, extractApiErrors } from '../utils/checkUtils.js';

export async function execute(domain, cookies) {
  console.log('Executing [CHECK_NAME] check for domain:', domain);
  
  // Create API client
  const apiClient = createApiClient(domain, cookies);
  
  // Get tenant info if needed for parameterized endpoints
  const tenantInfo = await getTenantInfo(domain, cookies);
  
  // Define your API requests
  const requests = [
    createApiRequest('/api/v1/example/endpoint'),
    createApiRequest('/api/v1/another/endpoint'),
    // Add more endpoints as discovered
  ];
  
  // Add parameterized requests if tenant info is available
  if (tenantInfo?.tenantId) {
    requests.push(
      createApiRequest('/api/v1/tenant/specific/endpoint', {
        params: {
          tenantId: tenantInfo.tenantId,
          clientId: tenantInfo.clientId
        }
      })
    );
  }
  
  // Make all API calls
  const results = await apiClient.callMultiple(requests);
  
  // Generate summary and log results
  const apiSummary = summarizeApiResults(results);
  const errors = extractApiErrors(results);
  
  if (errors.length > 0) {
    console.warn('❌ API Errors:', errors);
  }
  
  return {
    summary: extractCheckSummary(results),
    details: results,
    raw: results,
    tenantInfo: tenantInfo,
    apiSummary: apiSummary,
    errors: errors
  };
}

function extractCheckSummary(results) {
  const summary = {
    // Add your specific summary fields here
    totalItems: 0,
    activeItems: 0,
    configuredItems: [],
    issues: [],
    warnings: []
  };
  
  // Process each successful API response
  Object.entries(results).forEach(([endpoint, result]) => {
    if (result.success && result.data) {
      // Extract data based on your specific API responses
      // This is where you'll parse the marked values from your discovery tool
      
      // Example processing:
      // if (endpoint.includes('example/endpoint')) {
      //   const items = result.data.items || [];
      //   summary.totalItems += items.length;
      //   // Process items...
      // }
    } else {
      summary.issues.push(`Failed to fetch data from ${endpoint}: ${result.error}`);
    }
  });
  
  // Generate warnings based on business logic
  if (summary.totalItems === 0) {
    summary.warnings.push('No items found');
  }
  
  return summary;
}

// Report module for HTML generation
export const reportModule = {
  generateHTML: function(data) {
    if (!data || !data.summary) {
      return `
        <div class="section">
          <h2 class="section-title">❌ [CHECK_TITLE]</h2>
          <p>No data available</p>
        </div>
      `;
    }
    
    const summary = data.summary;
    let html = `
      <div class="section" id="[check-id]-section">
        <h2 class="section-title">[CHECK_TITLE]</h2>
    `;
    
    // Summary statistics table
    html += `
        <table class="report-table">
          <tbody>
            <tr>
              <th>Total Items</th>
              <td>\${summary.totalItems}</td>
            </tr>
            <tr>
              <th>Active Items</th>
              <td>\${summary.activeItems}</td>
            </tr>
            <!-- Add more summary rows as needed -->
          </tbody>
        </table>
    `;
    
    // Add detailed tables based on your data structure
    // if (summary.configuredItems.length > 0) {
    //   html += generateItemsTable(summary.configuredItems);
    // }
    
    // Issues and warnings
    if (summary.warnings.length > 0 || summary.issues.length > 0) {
      html += `
        <h3 class="subsection-title">Issues Found</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      summary.warnings.forEach(warning => {
        html += `
            <tr>
              <td>⚠️ Warning</td>
              <td>\${warning}</td>
            </tr>
        `;
      });
      
      summary.issues.forEach(issue => {
        html += `
            <tr>
              <td>❌ Error</td>
              <td>\${issue}</td>
            </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
    }
    
    html += `
      </div>
    `;
    
    return html;
  }
};

// Make the checker available globally for report generation
// Replace [CheckerName] with your actual checker name (e.g., AccountChecker, LocationChecker)
// globalThis.YourCheckerNameChecker = {
//   execute: execute,
//   reportModule: reportModule
// };
