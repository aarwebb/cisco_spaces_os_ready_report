// Location data checker for Spaces OS Ready Report v2
// NOTE: This file is not used by V2 - functionality is built into background.js

async function execute(domain, cookies) {
  console.log('This location check file is not used in V2');
  console.log('Location logic is built into background.js');
  return {
    status: 'not_implemented',
    message: 'V2 uses background.js for location check',
    data: {}
  };
}

// Make the checker available globally for report generation
globalThis.LocationChecker = {
  execute: execute
};

// Report module for generating location section in reports
globalThis.LocationChecker.reportModule = {
  generateHTML: function(data) {
    return `
      <div class="section" id="location-section">
        <h2 class="section-title">Location Data</h2>
        <p>Location check is not implemented in V2. Data collection is handled by background.js.</p>
      </div>
    `;
  },
  
  processData: function(rawData) {
    return rawData || {};
  }
};
