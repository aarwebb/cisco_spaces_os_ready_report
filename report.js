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

    // Generate dynamic sections from enabled checks
    const sectionsHTML = await this.generateSections();
    
    // Generate metadata footer
    const metadataHTML = this.generateMetadata();
    
    // Assemble complete report
    const reportHTML = this.assembleCompleteReport(sectionsHTML, metadataHTML);
    
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
        <div>Version: v2.0.0 (API-based)</div>
      </div>
    </div>
  `;
}

  async generateSections() {
    const sections = [];
    // Debug: Log the full REPORT_CHECKS array
    console.log('DEBUG: REPORT_CHECKS:', globalThis.REPORT_CHECKS);
    // Get all checks with reports
    const allChecksWithReports = globalThis.REPORT_CHECKS
      ? globalThis.REPORT_CHECKS
          .filter(check => check.hasReport)
          .sort((a, b) => a.reportOrder - b.reportOrder)
      : [];
    console.log('DEBUG: All possible checks with reports:', allChecksWithReports.map(c => c.name));
    console.log('DEBUG: Available collected data keys:', Object.keys(this.collectedData));
    for (const checkConfig of allChecksWithReports) {
      try {
        // Debug: Log checker module presence
        console.log(`DEBUG: Checker for ${checkConfig.key}:`, checkConfig.checker, globalThis[checkConfig.checker]);
        const checker = globalThis[checkConfig.checker];
        if (checker && checker.reportModule) {
          console.log(`DEBUG: Generating section for ${checkConfig.key}...`);
          // Get the data for this specific check - v2 format has nested structure
          const checkData = this.getDataForCheck(checkConfig.key);
          console.log(`DEBUG: Data for ${checkConfig.key}:`, checkData);
          console.log(`DEBUG: Data structure for ${checkConfig.key}:`, JSON.stringify(checkData, null, 2));
          // Debug: Log key matching
          if (!this.collectedData.hasOwnProperty(checkConfig.key)) {
            console.warn(`DEBUG: collectedData does not have key '${checkConfig.key}'`);
          }
          // Generate section if checkData is a non-empty object (endpoint results)
          if (checkData && typeof checkData === 'object' && Object.keys(checkData).length > 0) {
            const sectionHTML = checker.reportModule.generateHTML(checkData);
            sections.push(sectionHTML);
            console.log(`DEBUG: Section generated for ${checkConfig.key}`);
          } else if (checkData && checkData.error) {
            // Show error section for failed checks
            sections.push(`
              <div class="section">
                <h2 class="section-title">${checkConfig.name}</h2>
                <p>Data collection failed: ${checkData.error || 'Unknown error'}</p>
              </div>
            `);
            console.log(`DEBUG: Error section generated for ${checkConfig.key}`);
          } else {
            console.log(`DEBUG: Skipping ${checkConfig.key} - no data available`);
          }
        } else {
          console.warn(`DEBUG: Missing report module for ${checkConfig.checker}`);
        }
      } catch (error) {
        console.error(`DEBUG: Error generating report section for ${checkConfig.key}:`, error);
        // Add error section instead of failing completely
        sections.push(`
          <div class="section">
            <h2 class="section-title"> ${checkConfig.name}</h2>
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
      newExportBtn.addEventListener('click', () => this.exportToPDF());
    }

    // Export JSON button
    const exportJsonBtn = document.getElementById('exportJson');
    if (exportJsonBtn) {
      exportJsonBtn.replaceWith(exportJsonBtn.cloneNode(true));
      const newExportJsonBtn = document.getElementById('exportJson');
      newExportJsonBtn.addEventListener('click', () => this.exportToJSON());
    }

    // Export Raw Data button
    const exportRawBtn = document.getElementById('exportRaw');
    if (exportRawBtn) {
      exportRawBtn.replaceWith(exportRawBtn.cloneNode(true));
      const newExportRawBtn = document.getElementById('exportRaw');
      newExportRawBtn.addEventListener('click', () => this.exportRawData());
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
      // Debug: Check what's available
      console.log('html2canvas available:', typeof html2canvas !== 'undefined');
      console.log('window.jspdf available:', typeof window.jspdf !== 'undefined');
      console.log('window.jsPDF available:', typeof window.jsPDF !== 'undefined');
      
      // Ensure html2canvas and jsPDF are loaded
      if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        console.error('PDF libraries not loaded');
        alert('PDF libraries not loaded. Please refresh the page and try again.');
        return;
      }

      // Hide buttons and other non-printable elements during PDF generation
      const elementsToHide = document.querySelectorAll('.actions, .action-btn');
      const originalDisplay = [];
      elementsToHide.forEach((element, index) => {
        originalDisplay[index] = element.style.display;
        element.style.display = 'none';
      });

      // Capture the entire report container, including logo and content
      const reportElement = document.querySelector('.report-container');
      
      // Add print styles to ensure proper formatting
      const printStyles = document.createElement('style');
      printStyles.innerHTML = `
        .actions, .action-btn { display: none !important; }
        .section { page-break-inside: avoid; margin-bottom: 16px; }
        .subsection { page-break-inside: avoid; margin-bottom: 12px; }
        table { page-break-inside: avoid; }
        .report-table { page-break-inside: avoid; }
        .report-container { background: white; box-shadow: none; }
      `;
      document.head.appendChild(printStyles);

      // Get the exact dimensions we need
      const rect = reportElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(reportElement);
      const elementWidth = parseInt(computedStyle.width);
      const elementHeight = reportElement.scrollHeight;

      const canvas = await html2canvas(reportElement, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 0,
        width: elementWidth,
        height: elementHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: elementWidth,
        windowHeight: elementHeight
      });

      // Remove print styles and restore hidden elements
      document.head.removeChild(printStyles);
      elementsToHide.forEach((element, index) => {
        element.style.display = originalDisplay[index];
      });

      // Convert canvas to compressed JPEG instead of PNG
      const imgData = canvas.toDataURL('image/jpeg', 0.75); // JPEG with 75% quality for smaller size
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true // Enable PDF compression
      });
      
      // Calculate dimensions with margins
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15; // Increased margin for better layout
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);
      
      // Calculate image dimensions to fit page width
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // If the image is small enough to fit on one page, just add it directly
      if (imgHeight <= contentHeight) {
        const compressedImgData = canvas.toDataURL('image/jpeg', 0.8);
        pdf.addImage(compressedImgData, 'JPEG', margin, margin, imgWidth, imgHeight);
      } else {
        // For larger images, use intelligent slicing that respects content boundaries
        let yPosition = margin;
        let remainingHeight = imgHeight;
        let sourceY = 0;
        let pageNumber = 1;
        
        while (remainingHeight > 0) {
          const availableHeight = pageNumber === 1 ? contentHeight : contentHeight;
          const sliceHeight = Math.min(remainingHeight, availableHeight);
          
          if (pageNumber > 1) {
            pdf.addPage();
            yPosition = margin;
          }
          
          // Calculate the portion of the image to use for this page
          const sourceHeight = (sliceHeight * canvas.height) / imgHeight;
          
          // Create a temporary canvas for this slice to reduce memory usage
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = Math.ceil(sourceHeight);
          const tempCtx = tempCanvas.getContext('2d');
          
          // Draw only the needed slice of the image
          tempCtx.drawImage(
            canvas,
            0, Math.floor(sourceY), canvas.width, Math.ceil(sourceHeight),
            0, 0, tempCanvas.width, tempCanvas.height
          );
          
          // Convert slice to compressed JPEG
          const sliceData = tempCanvas.toDataURL('image/jpeg', 0.8);
          
          // Add slice to PDF
          pdf.addImage(sliceData, 'JPEG', margin, yPosition, imgWidth, sliceHeight);
          
          // Update for next iteration
          remainingHeight -= sliceHeight;
          sourceY += sourceHeight;
          pageNumber++;
        }
      }

  const fileName = await this.generateFileName('pdf');
      pdf.save(fileName);
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
