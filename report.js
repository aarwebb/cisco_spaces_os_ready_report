// Utility: sanitizeFilenamePart
globalThis.sanitizeFilenamePart = function(str) {
    return (str || '')
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

// Modular Report Generator
// This file serves as the interface/orchestrator for generating reports
// Individual check modules handle their own HTML generation and data processing

console.log('REPORT DEBUG: report.js file loaded');

class ModularReportGenerator {
  constructor() {
    this.collectedData = {};
    this.reportContainer = null;
  }

  async initialize() {
    this.reportContainer = document.getElementById('reportContainer') || document.getElementById('report-container');
    // Initialize button event listeners
    this.initializeButtons();
    try {
      const result = await chrome.storage.local.get(['reportData', 'collectionResults']);
      console.log(' Raw storage result:', result);
      console.log(' reportData:', result.reportData);
      console.log(' collectionResults:', result.collectionResults);
      // Handle both v1 format (reportData) and v2 format (collectionResults)
      this.collectedData = result.reportData || result.collectionResults || {};
      console.log(' Final collectedData:', this.collectedData);
      console.log(' collectedData keys:', Object.keys(this.collectedData));
      if (Object.keys(this.collectedData).length > 0) {
        await this.generateReport();
      } else {
        console.log(' No data found in storage');
        this.displayNoDataMessage();
      }
    } catch (error) {
      console.error('Error loading report:', error);
      this.displayErrorMessage(error.message);
    }
  }

  async generateReport() {
    console.log('Generating modular report...');
    console.log('Available data keys:', Object.keys(this.collectedData));
    // Hide loading indicator
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }

    // Show report container
    if (this.reportContainer) {
      this.reportContainer.style.display = 'block';
    }

    // --- Static Recommendations summary ---
    const staticRecommendations = [
      'Review all sections for warnings and errors.',
      'Address any missing data or integration failures.',
      'Ensure all locations and devices are mapped and reporting correctly.',
      'Consult Cisco Spaces documentation for remediation steps.'
    ];
    const recommendationsSummaryHTML = `
      <div class="section" id="report-recommendations-summary">
        <h2 class="section-title">Overall Recommendations</h2>
        <table class="summary-table" style="margin-bottom:16px;">
          <tr><th>Recommendations</th></tr>
          <tr><td>
            <ul class="recommendations-list">
              ${staticRecommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </td></tr>
        </table>
      </div>
    `;

    // Generate dynamic sections from enabled checks
    const sectionsHTML = await this.generateSections();

    // Generate metadata footer
    const metadataHTML = this.generateMetadata();

    // Assemble complete report (static recommendations first)
    const reportHTML = this.assembleCompleteReport(
      recommendationsSummaryHTML + sectionsHTML,
      metadataHTML
    );

    // Update the report container
    if (this.reportContainer) {
      this.reportContainer.innerHTML = reportHTML;
    }

    // Re-initialize buttons after HTML update
    this.initializeButtons();

    console.log('Modular report generation complete');
  }

  generateMetadata() {
  let reportGenerated = new Date().toLocaleString();
  let executionTime = this.collectedData['Execution Time'] || 'N/A';
  let domain = this.collectedData['Domain'] || 'N/A';
  const version = (globalThis.CONFIG_METADATA && globalThis.CONFIG_METADATA.version) ? globalThis.CONFIG_METADATA.version : 'N/A';

  // Try to extract domain from account data if available
  if (
    this.collectedData.account &&
    this.collectedData.account.data &&
    this.collectedData.account.data.summary &&
    this.collectedData.account.data.summary.accountDomain
  ) {
    domain = this.collectedData.account.data.summary.accountDomain;
  }

  return `
    <div class="metadata">
      <div class="metadata-title">Report Metadata</div>
      <div class="metadata-content">
        <div>Generated: ${reportGenerated}</div>
        <div>Execution Time: ${executionTime}</div>
        <div>Domain: ${domain}</div>
  <div>Version: v${version} (API-based)</div>
      </div>
    </div>
  `;
}

  async generateSections() {
    const sections = [];
    // Use modular analysis and reporting
    const allChecksWithReports = globalThis.REPORT_CHECKS
      ? globalThis.REPORT_CHECKS.filter(check => check.hasReport)
      : [];
    for (const checkConfig of allChecksWithReports) {
      try {
        const checkerClass = globalThis[checkConfig.checker];
        if (!checkerClass || !this.collectedData[checkConfig.key]) continue;

        // Always use parsedData for processedData
        const processedData = this.collectedData[checkConfig.key].parsedData;
        const analysisResults = this.collectedData[`${checkConfig.key}_analysis`] || (
          window.AnalysisModules && window.AnalysisModules[checkConfig.key]
            ? window.AnalysisModules[checkConfig.key](processedData)
            : { recommendations: [], indicators: {} }
        );

        // Targeted debug logging before HTML generation
        console.log('[REPORT DEBUG] Section:', checkConfig.key);
        console.log('[REPORT DEBUG] processedData:', processedData);
        console.log('[REPORT DEBUG] analysisResults:', analysisResults);
        console.log('[REPORT DEBUG] checkerClass:', checkerClass);

        // Generate HTML
        const html = checkerClass.reportModule && checkerClass.reportModule.generateHTML
          ? checkerClass.reportModule.generateHTML(processedData, analysisResults)
          : `<div class="section"><h2>${checkConfig.name}</h2><pre>${JSON.stringify(processedData, null, 2)}</pre></div>`;
        sections.push(html);
      } catch (error) {
        // Targeted error logging
        console.error('[REPORT ERROR] Exception in section:', checkConfig.key, error);
        sections.push(`
          <div class="section">
            <h2 class="section-title">${checkConfig.name}</h2>
            <p>Error generating this section: ${error.message}</p>
          </div>
        `);
      }
    }
    if (sections.length === 0) {
      sections.push(`
        <div class="section">
          <h2 class="section-title">No Data Available</h2>
          <p>No check data was collected or all checks failed. Please regenerate the report.</p>
        </div>
      `);
    }
    return sections.join('\n');
  }

  getDataForCheck(checkKey) {
    // V2 format: { checkKey: { success: true, data: {...}, timestamp: ... } }
    return this.collectedData[checkKey] || null;
  }

  assembleCompleteReport(sectionsHTML, metadataHTML) {
    return `
      ${sectionsHTML}
      ${metadataHTML}
    `;
  }

  displayNoDataMessage() {
    if (this.reportContainer) {
      this.reportContainer.innerHTML = `
        <div class="section">
          <h2 class="section-title">No Report Data Available</h2>
          <p>Please run the OS Ready check first to generate report data.</p>
        </div>
      `;
    }
  }

  displayErrorMessage(message) {
    if (this.reportContainer) {
      this.reportContainer.innerHTML = `
        <div class="section">
          <h2 class="section-title">Error Loading Report</h2>
          <p>${message}</p>
        </div>
      `;
    }
  }

  initializeButtons() {
    // Export PDF button
    const exportBtn = document.getElementById('exportPdf');
    if (exportBtn) {
      exportBtn.replaceWith(exportBtn.cloneNode(true));
      const newExportBtn = document.getElementById('exportPdf');
      if (newExportBtn) {
        // Size check: disable button if report is too large
        const reportElement = document.getElementById('reportContainer');
        let tooLarge = false;
        if (reportElement) {
          // Threshold: 20000px height (adjust as needed)
          const reportHeight = reportElement.scrollHeight;
          if (reportHeight > 20000) {
            tooLarge = true;
          }
        }
        if (tooLarge) {
          newExportBtn.disabled = true;
          newExportBtn.title = 'Report is too large to export as PDF. Please run fewer checks.';
          newExportBtn.style.cursor = 'not-allowed';
        } else {
          newExportBtn.disabled = false;
          newExportBtn.title = '';
          newExportBtn.style.cursor = '';
          newExportBtn.addEventListener('click', () => this.exportToPDF());
        }
      }
    }

    // Export JSON button
    const exportJsonBtn = document.getElementById('exportJson');
    if (exportJsonBtn) {
      exportJsonBtn.replaceWith(exportJsonBtn.cloneNode(true));
      const newExportJsonBtn = document.getElementById('exportJson');
      if (newExportJsonBtn) {
        newExportJsonBtn.addEventListener('click', () => this.exportToJSON());
      }
    }

    // Export Raw Data button
    const exportRawBtn = document.getElementById('exportRaw');
    if (exportRawBtn) {
      exportRawBtn.replaceWith(exportRawBtn.cloneNode(true));
      const newExportRawBtn = document.getElementById('exportRaw');
      if (newExportRawBtn) {
        newExportRawBtn.addEventListener('click', () => this.exportRawData());
      }
    }
  }

  // Should be updated to only export grouped "raw" data once report formatting is implemented
  async exportRawData() {
    try {
      // Only export grouped check data
      const groupedData = {};
      if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
        for (const check of globalThis.REPORT_CHECKS) {
          if (check.key && this.collectedData[check.key]) {
            groupedData[check.key] = this.collectedData[check.key];
          }
        }
      }
      if (Object.keys(groupedData).length === 0) {
        alert('No raw report data available to export.');
        return;
      }
      const fileName = await this.generateFileName('json');
      const rawFileName = fileName.replace(/\.json$/, '_raw.json');
      const jsonString = JSON.stringify(groupedData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = rawFileName;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      console.log('Raw report data exported successfully!');
    } catch (error) {
      console.error('Error exporting raw data:', error);
      alert('Error exporting raw data. Please try again.');
    }
  }

  async exportToPDF() {
    try {
      // Capture the entire report container
      const reportElement = document.getElementById('reportContainer');
      if (!reportElement) {
        alert('No report found for export.');
        return;
      }
      const rect = reportElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(reportElement);
      const elementWidth = parseInt(computedStyle.width);
      const elementHeight = reportElement.scrollHeight;
      const canvas = await html2canvas(reportElement, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fff',
        logging: false,
        imageTimeout: 0,
        width: elementWidth,
        height: elementHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: elementWidth,
        windowHeight: elementHeight
      });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 0;
      const contentWidth = 180;
      const contentHeight = pageHeight;
      // --- Add header logo ---
      const logo = new window.Image();
      logo.src = 'OS_Ready_Headline.png';
      logo.onload = () => {
        // Grow logo width by 10% and center align
        const logoWidth = contentWidth * .95;
        const logoHeight = logoWidth * (211 / 928); // keep aspect ratio
        const logoX = ((pageWidth - logoWidth) / 2) - 3;
        const logoY = margin;
        // --- Center align report content image below logo ---
        let imgWidth = contentWidth;
        let imgHeight = (canvas.height * imgWidth) / canvas.width;
        let contentX = (pageWidth - imgWidth) / 2;
        let contentY = logoY + logoHeight + 5; // 5mm spacing below logo
        pdf.addImage(logo, 'PNG', logoX, logoY, logoWidth, logoHeight);
        if (imgHeight <= (contentHeight - logoHeight - 5)) {
          pdf.addImage(imgData, 'PNG', contentX, contentY, imgWidth, imgHeight);
        } else {
          let yPosition = contentY;
          let remainingHeight = imgHeight;
          let sourceY = 0;
          let pageNumber = 1;
          while (remainingHeight > 0) {
            const availableHeight = contentHeight - logoHeight - 5;
            const sliceHeight = Math.min(remainingHeight, availableHeight);
            if (pageNumber > 1) {
              pdf.addPage();
              yPosition = margin;
            }
            const sourceHeight = (sliceHeight * canvas.height) / imgHeight;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = Math.ceil(sourceHeight);
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.fillStyle = '#fff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(
              canvas,
              0, Math.floor(sourceY), canvas.width, Math.ceil(sourceHeight),
              0, 0, tempCanvas.width, tempCanvas.height
            );
            const sliceData = tempCanvas.toDataURL('image/png');
            pdf.addImage(sliceData, 'PNG', contentX, yPosition, imgWidth, sliceHeight);
            remainingHeight -= sliceHeight;
            sourceY += sourceHeight;
            pageNumber++;
            if (pageNumber > 100) {
              alert('Report is extremely large and may not export reliably. Consider exporting in smaller sections.');
              break;
            }
          }
        }
        const fileName = this.generateFileName('pdf');
        Promise.resolve(fileName).then(name => pdf.save(name));
      };
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Error exporting to PDF. Please try again.');
    }
  }

  async exportToJSON() {
    try {
      if (!this.collectedData || Object.keys(this.collectedData).length === 0) {
        alert('No report data available to export.');
        return;
      }

      // Generate filename using account info
  const fileName = await this.generateFileName('json');

      // Create formatted JSON string
      const jsonString = JSON.stringify(this.collectedData, null, 2);

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link and trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = fileName;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up the URL
      URL.revokeObjectURL(url);

      console.log('JSON report exported successfully!');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Error exporting JSON. Please try again.');
    }
  }

  async generateFileName(extension) {
  // Get accountName, tenantId, and username from sessionStorage
  let rawAccountName = window.sessionStorage.getItem('customerName');
  let rawTenantId = window.sessionStorage.getItem('tenantId');
  console.log('[ReportGenerator] sessionStorage customerName:', rawAccountName);
  console.log('[ReportGenerator] sessionStorage tenantId:', rawTenantId);
    let accountName, tenantId;

    // Use messaging to get account info
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'get_account_info' }, (response) => {
        accountName = response?.customerName || 'unknown-account';
        tenantId = response?.tenantId || 'unknown-tenant';
        resolve();
      });
    });

  // Always sanitize
  accountName = globalThis.sanitizeFilenamePart(accountName);
  tenantId = globalThis.sanitizeFilenamePart(tenantId);
  console.log('[ReportGenerator] sanitized accountName:', accountName);
  console.log('[ReportGenerator] sanitized tenantId:', tenantId);

  // Generate date string
  const date = new Date().toISOString().split('T')[0];
  console.log('[ReportGenerator] filename date:', date);

  const filename = `cisco-spaces-os-ready-report-${accountName}-${tenantId}-${date}.${extension}`;
  console.log('[ReportGenerator] generated filename:', filename);
  return filename;
}
}

// Initialize the report generator when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('REPORT DEBUG: DOM loaded, initializing report generator');
  // Dynamically set version badge from config.js metadata
  const versionBadge = document.querySelector('.version-badge');
  if (versionBadge && globalThis.CONFIG_METADATA && globalThis.CONFIG_METADATA.version) {
    versionBadge.textContent = `v${globalThis.CONFIG_METADATA.version} API`;
  }
  try {
    const reportGenerator = new ModularReportGenerator();
    console.log('REPORT DEBUG: Created ModularReportGenerator instance');
    await reportGenerator.initialize();
    console.log('REPORT DEBUG: Report generator initialized successfully');
  } catch (error) {
    console.error('REPORT DEBUG: Error initializing report generator:', error);
  }
});

// Make it globally available for debugging
window.reportGenerator = ModularReportGenerator;
