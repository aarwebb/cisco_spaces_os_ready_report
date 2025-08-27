const CONNECTORS_PATH = '/setup/connectors';

// Configuration constants for ConnectorChecker
const ConnectorConfig = {
  paths: {
    connectors: '/setup/connectors',
    wireless: '/setup/wirelessnetwork'
  },
  
  selectors: {
    // Main containers
    wirelessContent: '.step_content.withBorder',
    connectorTable: '.connector-table table.userTable',
    connectorTableBody: '.connector-table table.userTable tbody',
    connectorRows: '.connector-table table.userTable tbody tr.tableTr',
    
    // Accordion and panels
    accordionToggles: 'accordion-toggle',
    tileHeader: '.tile_header',
    panelCollapse: '.panel-collapse.in, .panel-collapse.show, .collapse.in, .collapse.show',
    
    // Summary sections
    summaryDiv: '.summary',
    summaryDetail: '.summary .summary-detail',
    summarySubDetail: '.summary-sub-detail',
    serviceElements: '.service-summmary',
    
    // Connector details
    connectorWrapper: '.cmxConnectorWrapper',
    connectorNameLink: '.userListName a.userNameLink',
    connectorStatus: '.userAccess',
    connectorRelease: 'td:nth-child(2) span',
    
    // Pagination
    pagination: '.pagination',
    paginationDescription: '.pagination .description .page-counts',
    numericButton: '.numericButton',
    activeButton: '.numericButton.active',
    nextButton: 'button[aria-label="Next"], .pagination-next, .pagination .next, .next-page',
    disabledLink: '.pagination .link.disabled',
    
    // Breadcrumb navigation
    breadcrumbHeader: '.cmxConnectorHeading',
    connectorPath: '.connector-path'
  },
  
  messages: {
    starting: 'Starting connector status check...',
    navigatingWireless: 'Navigating to wireless setup page...',
    loadingContent: 'Loading connector page content...',
    locatingSection: 'Locating Spaces Connector section...',
    expandingAccordion: 'Expanding Spaces Connector accordion...',
    extractingInfo: 'Extracting connector information...',
    analyzingReleases: 'Analyzing connector releases and details...',
    processingData: 'Processing connector data...',
    analysisComplete: 'Connector status analysis complete',
    checkingPages: 'Checking for additional connector pages...',
    movingToPage: (page) => `Moving to connector page ${page}...`,
    processingPage: (page) => `Analyzing connector page ${page}...`,
    analyzingConnector: (name, index, total, page) => `Analyzing ${name} (${index}/${total} on page ${page})...`,
    analyzingDegradedConnector: (name) => `Analyzing degraded connector: ${name}...`,
    navigationFailed: 'Failed to navigate to connectors page - falling back to legacy check',
    completedAnalysis: (count) => `Analysis complete: ${count} connectors found`
  },
  
  releaseSelectors: [
    'td:nth-child(2) span',
    'td:nth-child(2) .release-div',
    'td:nth-child(2) div span',
    'td:nth-child(2) div .ng-star-inserted',
    'td:nth-child(2)'
  ],
  
  alternativeConnectorSelectors: [
    '.cmxConnectorAdd',
    '.cmxConnectorHeading',
    '.summary .rightSummary',
    '.connector-table',
    '.grayDiv-service'
  ],
  
  serviceKeys: [
    'Hotspot Enabled',
    'Location Enabled',
    'Iot Services Enabled',
    'Iot Wired Enabled'
  ],
  
  limits: {
    maxPages: 20,
    maxPagesLegacy: 10
  },
  
  timeIntervals: {
    default: 'Last 24 Hours',
    fallbacks: ['Last 1 Hour', 'Last 1 Week', 'Last 2 Week']
  }
};

globalThis.getConnectorWirelessLinkSelectors = function() {
  return [
    'a[href*="/setup/wirelessnetwork"]',
    '.nav-label:contains("Wireless Networks")',
    'span.nav-label:contains("Wireless Networks")',
    '.nav-label:contains("Wireless")',
    'span.nav-label:contains("Wireless")',
    'img[src*="wireless"]',
    '.nav-label:contains("Setup")',
    'span.nav-label:contains("Setup")',
    'a[href*="/setup"]'
  ];
}

// Navigation manager for connector-related navigation
class ConnectorNavigationManager {
  constructor(baseDomain) {
    this.baseDomain = baseDomain;
    this.navigationController = new window.NavigationController(baseDomain);
  }

  async ensureOnWirelessPage() {
    const onWirelessPage = window.location.pathname.includes(ConnectorConfig.paths.wireless);
    
    if (!onWirelessPage) {
      globalThis.updateProgressMessage(ConnectorConfig.messages.navigatingWireless);
      await this.navigationController.navigateToPath(
        ConnectorConfig.paths.wireless,
        { 
          label: 'Wireless Networks',
          section: 'Setup'
        },
        ConnectorConfig.selectors.wirelessContent,
        globalThis.getConnectorWirelessLinkSelectors()
      );
    }
    return true;
  }

  async ensureOnConnectorsPage() {
    globalThis.updateProgressMessage('Navigating to connectors page...');
    const success = await this.navigationController.navigateToPage('connectors');
    if (!success) {
      throw new Error('Failed to navigate to connectors page');
    }
    return true;
  }

  async navigateToConnectorDetails(nameElement, connectorName) {
    console.log(`Navigating to ${connectorName} details...`);
    globalThis.updateProgressMessage(`Navigating to ${connectorName} details...`);
    
    nameElement.click();
    await window.sleep(window.TIMEOUTS.MEDIUM);

    // Wait for details page to load
    const detailsSection = await window.waitForElement(ConnectorConfig.selectors.connectorWrapper, window.TIMEOUTS.ELEMENT_WAIT);
    if (!detailsSection) {
      // Try alternative selectors
      let foundSection = null;
      for (const selector of ConnectorConfig.alternativeConnectorSelectors) {
        foundSection = await window.waitForElement(selector, window.TIMEOUTS.SHORT);
        if (foundSection) {
          console.log(`Found connector details with selector: ${selector}`);
          break;
        }
      }

      if (!foundSection) {
        console.warn(`No connector details structure found for ${connectorName}`);
        const pageTitle = document.title;
        const hasConnectorPath = document.querySelector(ConnectorConfig.selectors.connectorPath)?.textContent || 'Not found';
        console.log('Page title:', pageTitle);
        console.log('Connector path element:', hasConnectorPath);
        throw new Error('Details page structure not found');
      }
    }
    return true;
  }

  async returnToConnectorsPage(originalPageInfo = null) {
    try {
      console.log('Returning to connectors page using breadcrumb navigation...');
      globalThis.updateProgressMessage('Returning to connectors list...');

      const connectorPath = document.querySelector(ConnectorConfig.selectors.connectorPath);
      if (!connectorPath) {
        throw new Error('Connector path breadcrumb not found');
      }

      connectorPath.click();
      await window.sleep(window.TIMEOUTS.MEDIUM);
      await window.waitForElement(ConnectorConfig.selectors.connectorTable, window.TIMEOUTS.ELEMENT_WAIT);

      console.log('Successfully returned to connectors page');
      return true;

    } catch (error) {
      console.error('Error returning to connectors page:', error);
      return false;
    }
  }
}

// Pagination manager for handling page navigation
class PaginationManager {
  async navigateToSpecificPage(targetPageNumber) {
    try {
      console.log(`Navigating to page ${targetPageNumber}`);
      
      const pageButtons = document.querySelectorAll(ConnectorConfig.selectors.numericButton);
      let targetButton = null;
      
      for (const button of pageButtons) {
        if (button.textContent.trim() === targetPageNumber.toString()) {
          targetButton = button;
          break;
        }
      }
      
      if (!targetButton) {
        console.error(`Page button for page ${targetPageNumber} not found`);
        return false;
      }
      
      targetButton.click();
      await this.waitForPageLoad();
      
      const currentActiveButton = document.querySelector(ConnectorConfig.selectors.activeButton);
      if (currentActiveButton && currentActiveButton.textContent.trim() === targetPageNumber.toString()) {
        console.log(`Successfully navigated to page ${targetPageNumber}`);
        return true;
      } else {
        console.error(`Failed to navigate to page ${targetPageNumber}`);
        return false;
      }
    } catch (error) {
      console.error('Error navigating to specific page:', error);
      return false;
    }
  }

  getCurrentPageNumber() {
    try {
      const activeButton = document.querySelector(ConnectorConfig.selectors.activeButton);
      if (activeButton) {
        const pageNum = parseInt(activeButton.textContent.trim());
        console.log(`Current page number: ${pageNum}`);
        return pageNum;
      }
      console.log('No active page button found, assuming page 1');
      return 1;
    } catch (error) {
      console.error('Error getting current page number:', error);
      return 1;
    }
  }

  isOnLastPage() {
    try {
      // Get current page from active button
      const currentPage = this.getCurrentPageNumber();
      
      // Get all page buttons to find max page
      const pageButtons = document.querySelectorAll(ConnectorConfig.selectors.numericButton);
      if (pageButtons.length > 0) {
        const maxPage = Math.max(...Array.from(pageButtons).map(b => parseInt(b.textContent.trim())).filter(n => !isNaN(n)));
        const isLast = currentPage >= maxPage;
        console.log(`Current page: ${currentPage}, Max page: ${maxPage}, Is last: ${isLast}`);
        return isLast;
      }
      
      console.log('No page buttons found - assuming last page');
      return true;
    } catch (error) {
      console.error('Error checking if last page:', error);
      return false;
    }
  }

  async waitForPageLoad() {
    try {
      await window.sleep(window.TIMEOUTS.MEDIUM);
      await window.waitForElement(ConnectorConfig.selectors.connectorTable, window.TIMEOUTS.ELEMENT_WAIT);
      await window.sleep(window.TIMEOUTS.SHORT);
    } catch (error) {
      console.error('Error waiting for page load:', error);
    }
  }
}

// Data extraction utilities for connector information
class ConnectorDataExtractor {
  extractSummaryData() {
    try {
      const summaryDiv = document.querySelector(ConnectorConfig.selectors.summaryDiv);
      if (!summaryDiv) {
        console.log('Summary div not found');
        return null;
      }

      const summaryDetail = summaryDiv.querySelector(ConnectorConfig.selectors.summaryDetail);
      if (!summaryDetail) {
        console.log('Summary detail not found');
        return null;
      }

      const totalConnectors = summaryDetail.querySelector('span.num-summary')?.textContent.trim() || 'Not found';
      const upConnectors = summaryDetail.querySelector('span.up-green')?.textContent.trim() || 'Not found';
      const degradedConnectors = summaryDetail.querySelector('span.degraded-yellow, span.degraded-orange')?.textContent.trim() || '0';
      const downConnectors = summaryDetail.querySelector('span.down-red')?.textContent.trim() || 'Not found';

      return {
        totalConnectors,
        upConnectors,
        degradedConnectors,
        downConnectors
      };
    } catch (error) {
      console.error('Error extracting summary data:', error);
      return null;
    }
  }

  extractServiceData() {
    try {
      const services = {};
      const summaryDiv = document.querySelector(ConnectorConfig.selectors.summaryDiv);
      const subDetail = summaryDiv?.querySelector(ConnectorConfig.selectors.summarySubDetail);
      
      if (subDetail) {
        console.log('Found summary-sub-detail, extracting services...');
        const serviceElements = subDetail.querySelectorAll(ConnectorConfig.selectors.serviceElements);
        console.log(`Found ${serviceElements.length} service elements`);
        
        serviceElements.forEach((element, index) => {
          const count = element.querySelector('.num-summary')?.textContent.trim() || 'Not found';
          const text = element.querySelector('.parameter-text')?.textContent.trim() || '';
          
          console.log(`Service ${index + 1}: count="${count}", text="${text}"`);
          
          if (text && count) {
            let serviceName = text;
            if (text.includes('enabled')) {
              serviceName = text.replace('enabled', '').trim();
            }
            
            const readableKey = serviceName
              .split(/[-_\s]+/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ') + ' Enabled';
            
            services[readableKey] = count;
            console.log(`Extracted service: ${serviceName} -> ${readableKey} = ${count}`);
          }
        });
      } else {
        console.log('No summary-sub-detail found');
      }

      return services;
    } catch (error) {
      console.error('Error extracting service data:', error);
      return {};
    }
  }

  extractResourceSizing(metricsData = null) {
    try {
      // Calculate connector size based on memory metrics if available
      if (metricsData && typeof metricsData === 'object' && metricsData !== 'No Metrics') {
        const memoryUsage = metricsData['Memory Usage'];
        const memoryPercentage = metricsData['Memory Percentage Usage'];
        
        if (memoryUsage && memoryPercentage) {
          // Parse memory usage (remove "MB" suffix and convert to number)
          const memoryUsageMB = parseFloat(memoryUsage.toString().replace(' MB', ''));
          
          // Parse memory percentage (remove "%" suffix and convert to decimal)
          const memoryPercentageDecimal = parseFloat(memoryPercentage.toString().replace('%', '')) / 100;
          
          if (!isNaN(memoryUsageMB) && !isNaN(memoryPercentageDecimal) && memoryPercentageDecimal > 0) {
            // Calculate total memory: memory usage / memory percentage
            const totalMemoryMB = memoryUsageMB / memoryPercentageDecimal;
            const totalMemoryGB = totalMemoryMB / 1024;
            
            console.log(`Memory calculation: ${memoryUsageMB} MB / ${memoryPercentageDecimal} = ${totalMemoryMB} MB (${totalMemoryGB.toFixed(2)} GB)`);
            
            // Map to connector sizes using constants (round up to nearest available size)
            let connectorSize;
            if (totalMemoryGB <= globalThis.CONNECTOR_SIZES.STANDARD.maxMemoryGB) {
              connectorSize = globalThis.CONNECTOR_SIZES.STANDARD.name;
            } else if (totalMemoryGB <= globalThis.CONNECTOR_SIZES.ADVANCED_1.maxMemoryGB) {
              connectorSize = globalThis.CONNECTOR_SIZES.ADVANCED_1.name;
            } else {
              connectorSize = globalThis.CONNECTOR_SIZES.ADVANCED_2.name;
            }
            
            return `${connectorSize} (${totalMemoryGB.toFixed(2)} GB calculated)`;
          }
        }
      }
      
      // Fallback: Unable to calculate connector size from metrics
      console.log('Unable to calculate connector size from metrics - metrics not available or invalid');
      return 'Unable to determine connector size';
    } catch (error) {
      console.error('Error extracting resource sizing:', error);
      return 'Unable to determine connector size';
    }
  }

  extractServiceDetails() {
    try {
      console.log('[ServiceExtraction] Starting service details extraction...');
      // Look for the service table using the specific connector table selector
      const serviceTable = document.querySelector('.connector-table tbody');
      if (serviceTable) {
        const serviceRows = serviceTable.querySelectorAll('tr.tableTr');
        console.log(`[ServiceExtraction] Found ${serviceRows.length} service rows`);
        const services = [];
        
        serviceRows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            // Extract service name from first column (inside .userNameLink span)
            const serviceNameElement = cells[0]?.querySelector('.userNameLink');
            const serviceName = serviceNameElement?.textContent?.trim() || 'Unknown Service';
            
            // Extract version from second column - handle upgrade icons and tooltips
            const versionCell = cells[1];
            let serviceVersion = 'Unknown Version';
            
            if (versionCell) {
              // Strategy 1: Try to find version in .version-link (when no upgrade available)
              const versionLink = versionCell.querySelector('.version-link');
              if (versionLink) {
                serviceVersion = versionLink.textContent?.trim() || 'Unknown Version';
                console.log(`[ServiceExtraction] Found version via .version-link: ${serviceVersion}`);
              } else {
                // Strategy 2: Handle upgrade tooltip structure (when upgrade is available)
                const tooltipSpan = versionCell.querySelector('.tooltip');
                if (tooltipSpan) {
                  // Clone the element to avoid modifying the original DOM
                  const tooltipClone = tooltipSpan.cloneNode(true);
                  // Remove the tooltiptext span that contains "Version X.X.X.X is available"
                  const tooltipTextSpans = tooltipClone.querySelectorAll('.tooltiptext');
                  tooltipTextSpans.forEach(span => span.remove());
                  // Remove the upgrade icon img
                  const upgradeIcons = tooltipClone.querySelectorAll('img');
                  upgradeIcons.forEach(img => img.remove());
                  // Get the remaining text which should be the version
                  serviceVersion = tooltipClone.textContent?.trim() || 'Unknown Version';
                  console.log(`[ServiceExtraction] Found version via .tooltip cleanup: ${serviceVersion}`);
                } else {
                  // Strategy 3: Fallback - try direct text content cleanup
                  const cellClone = versionCell.cloneNode(true);
                  // Remove any potential tooltiptext spans
                  const tooltipTextSpans = cellClone.querySelectorAll('.tooltiptext');
                  tooltipTextSpans.forEach(span => span.remove());
                  // Remove any images
                  const images = cellClone.querySelectorAll('img');
                  images.forEach(img => img.remove());
                  serviceVersion = cellClone.textContent?.trim() || 'Unknown Version';
                  console.log(`[ServiceExtraction] Found version via fallback cleanup: ${serviceVersion}`);
                }
              }
              
              // Clean up any extra whitespace and non-breaking spaces
              serviceVersion = serviceVersion.replace(/\s+/g, ' ').trim();
            }
            
            console.log(`Service: ${serviceName}, Version: ${serviceVersion}`);
            services.push(`${serviceName} (${serviceVersion})`);
          }
        });
        
        console.log(`[ServiceExtraction] Extracted ${services.length} services:`, services);
        return services.length > 0 ? services.join(', ') : 'No services found';
      }
      console.log('[ServiceExtraction] No service table found');
      return 'No service table found';
    } catch (error) {
      console.error('Error extracting service details:', error);
      return 'Error extracting services';
    }
  }

  extractControllerDetails() {
    try {
      console.log('[ConnectorAnalysis] Starting controller details extraction...');
      // Look for the controller table using the specific connector controller table selector
      const controllerTable = document.querySelector('.connector-table_controller tbody');
      if (controllerTable) {
        console.log('[ConnectorAnalysis] Found controller table, processing rows...');
        const controllerRows = controllerTable.querySelectorAll('tr.tableTr');
        console.log(`[ConnectorAnalysis] Found ${controllerRows.length} controller rows`);
        const upControllers = [];
        const degradedControllers = [];
        const downControllers = [];
        
        controllerRows.forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          console.log(`[ConnectorAnalysis] Row ${index + 1}: Found ${cells.length} cells`);
          
          if (cells.length >= 6) {
            // Extract controller name from first column (full text, extract first part)
            const fullControllerText = cells[0]?.textContent?.trim() || 'Unknown Controller';
            const controllerName = fullControllerText.split(/\s{2,}/)[0] || 'Unknown Controller'; // Split on multiple spaces
            console.log(`[ConnectorAnalysis] Row ${index + 1}: Controller name = "${controllerName}"`);
            
            // Extract IP from second column
            const ipAddress = cells[1]?.textContent?.trim() || 'Unknown IP';
            console.log(`[ConnectorAnalysis] Row ${index + 1}: IP address = "${ipAddress}"`);
            
            // Extract AP count from third column (Cell 2)
            const apCount = cells[2]?.textContent?.trim() || '0';
            console.log(`[ConnectorAnalysis] Row ${index + 1}: AP count = "${apCount}"`);
            
            // Log all cell contents for debugging
            cells.forEach((cell, cellIndex) => {
              console.log(`[ConnectorAnalysis] Row ${index + 1}, Cell ${cellIndex}: "${cell.textContent?.trim()}"`);
            });
            
            // Extract status from sixth column (Cell 5) - check both text and icons
            const statusElement = cells[5];
            const statusText = statusElement?.textContent?.trim().toLowerCase() || '';
            
            // Check for status icons/images
            const statusIcon = statusElement?.querySelector('img');
            const iconSrc = statusIcon?.src || '';
            console.log(`[ConnectorAnalysis] Row ${index + 1}: Status text = "${statusText}", Icon src = "${iconSrc}"`);
            
            // Determine status based on both text and icon
            let status = 'unknown';
            if (iconSrc.includes('degraded.svg') || statusText.includes('degraded')) {
              status = 'degraded';
            } else if (iconSrc.includes('down.svg') || statusText.includes('down') || statusText.includes('inactive')) {
              status = 'down';
            } else if (statusText.includes('active') || statusText.includes('up') || statusText.includes('online') || statusText.includes('connected')) {
              status = 'active';
            } else if (statusElement?.classList.contains('inactive')) {
              // If we have inactive class but no specific icon, check for degraded vs down
              if (iconSrc.includes('degraded')) {
                status = 'degraded';
              } else {
                status = 'down';
              }
            }
            
            console.log(`[ConnectorAnalysis] Row ${index + 1}: Determined status = "${status}"`);
            
            const controllerData = {
              name: controllerName,
              ip: ipAddress,
              apCount: parseInt(apCount) || 0,
              status: status
            };
            
            if (status === 'active') {
              upControllers.push(controllerData);
            } else if (status === 'degraded') {
              degradedControllers.push(controllerData);
            } else {
              downControllers.push(controllerData);
            }
          }
        });
        
        // Return structured data
        const structuredData = {
          up: upControllers,
          degraded: degradedControllers,
          down: downControllers,
          totalControllers: upControllers.length + degradedControllers.length + downControllers.length,
          totalAPs: [...upControllers, ...degradedControllers, ...downControllers].reduce((sum, controller) => sum + controller.apCount, 0)
        };
        
        console.log(`[ConnectorAnalysis] Controller extraction complete:`, structuredData);
        return structuredData;
      }
      console.log('[ConnectorAnalysis] No controller table found');
      return { up: [], degraded: [], down: [], totalControllers: 0, totalAPs: 0 };
    } catch (error) {
      console.error('[ConnectorAnalysis] Error extracting controller details:', error);
      return { up: [], degraded: [], down: [], totalControllers: 0, totalAPs: 0, error: error.message };
    }
  }

  extractInstanceCount() {
    try {
      const summaryDetail = document.querySelector(ConnectorConfig.selectors.summaryDetail);
      if (summaryDetail) {
        // Extract total instances
        const totalInstancesDiv = summaryDetail.querySelector('.floatleft-detail');
        let totalInstances = null;
        if (totalInstancesDiv) {
          const instancesSpan = totalInstancesDiv.querySelector('.num-summary');
          const parameterText = totalInstancesDiv.querySelector('.parameter-text');
          if (instancesSpan && parameterText && parameterText.textContent.trim() === 'Instances') {
            totalInstances = instancesSpan.textContent.trim();
          }
        }

        // Extract active instances
        let activeInstances = null;
        const activeSpan = summaryDetail.querySelector('.up-green.num-summary');
        if (activeSpan) {
          activeInstances = activeSpan.textContent.trim();
        }

        // Extract inactive instances
        let inactiveInstances = null;
        const inactiveSpan = summaryDetail.querySelector('.down-red.num-summary');
        if (inactiveSpan) {
          inactiveInstances = inactiveSpan.textContent.trim();
        }

        // Build the result string
        if (totalInstances) {
          let result = `${totalInstances} instances`;
          
          // Add status details if available
          if (inactiveInstances && parseInt(inactiveInstances) > 0) {
            result += ` (${inactiveInstances} inactive)`;
          } else if (activeInstances && inactiveInstances) {
            // All instances are active, we can optionally mention this
            result += ` (all active)`;
          }
          
          return result;
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting instance count:', error);
      return null;
    }
  }

  extractConnectorReleaseInfo(row) {
    let release = 'Unknown';
    
    for (const selector of ConnectorConfig.releaseSelectors) {
      const releaseElement = row.querySelector(selector);
      if (releaseElement && releaseElement.textContent.trim()) {
        release = releaseElement.textContent.trim();
        break;
      }
    }
    
    return release;
  }

  async extractMetricsData() {
    try {
      console.log('Starting metrics data extraction...');
      
      // Step 1: Ensure we're on the Metrics tab
      const metricsTabSuccess = await this.navigateToMetricsTab();
      if (!metricsTabSuccess) {
        console.log('Metrics tab not available - returning "No Metrics"');
        return "No Metrics";
      }
      
      // Step 2: Select "system" from the dropdown
      await this.selectSystemDropdown();
      
      // Step 3: Check if Memory charts are available, if not try different time intervals
      console.log('Waiting for charts to fully render...');
      await window.sleep(window.TIMEOUTS.SHORT);
      
      console.log('Extracting initial metrics data...');
      let metricsData = this.extractAllChartData();
      
      if (!this.hasMemoryMetrics(metricsData)) {
        console.log(`Memory metrics not found with default interval, trying "${ConnectorConfig.timeIntervals.default}"...`);
        globalThis.updateProgressMessage(`Adjusting time interval to find memory metrics...`);
        const intervalSuccess = await this.selectTimeInterval(ConnectorConfig.timeIntervals.default);
        if (intervalSuccess) {
          console.log('Time interval changed successfully, re-extracting metrics...');
          await window.sleep(window.TIMEOUTS.MEDIUM);
          metricsData = this.extractAllChartData();
          
          if (this.hasMemoryMetrics(metricsData)) {
            console.log('Memory metrics found after changing time interval!');
          } else {
            console.log('Memory metrics still not found after changing time interval');
          }
        } else {
          console.log('Failed to change time interval');
        }
      } else {
        console.log('Memory metrics found with default interval');
      }
      
      // Step 4: Wait for charts to load and extract data
      console.log('Metrics data extracted:', metricsData);
      return metricsData;
      
    } catch (error) {
      console.log('Error extracting metrics data:', error.message);
      return "No Metrics";
    }
  }

  async extractInstanceStatuses() {
    try {
      console.log('Starting instance status extraction...');
      
      // Step 1: Navigate to the Instances tab
      const instancesTabSuccess = await this.navigateToInstancesTab();
      if (!instancesTabSuccess) {
        console.log('Instances tab not available or not needed');
        return null;
      }
      
      // Step 2: Extract instance statuses
      await window.sleep(window.TIMEOUTS.MEDIUM);
      const instanceStatuses = await this.extractInstanceStatusData();
      
      console.log('Instance statuses extracted:', instanceStatuses);
      return instanceStatuses;
      
    } catch (error) {
      console.log('Error extracting instance statuses:', error.message);
      return null;
    }
  }

  async navigateToInstancesTab() {
    try {
      // Find the tab navigation
      const tabContainer = document.querySelector('ul.header-inner');
      if (!tabContainer) {
        console.log('Tab navigation not found');
        return false;
      }

      // Check if Instances tab exists
      const instancesTab = Array.from(tabContainer.querySelectorAll('li.header-blocks')).find(tab => {
        const spanText = tab.querySelector('span.active-name')?.textContent?.trim();
        return spanText === 'Instances';
      });

      if (!instancesTab) {
        console.log('Instances tab not found');
        return false;
      }

      // Check if already active
      if (instancesTab.classList.contains('active-block')) {
        console.log('Instances tab already active');
        return true;
      }

      // Click on the Instances tab
      console.log('Clicking on Instances tab...');
      instancesTab.click();
      
      // Wait for content to load
      await window.sleep(window.TIMEOUTS.MEDIUM);
      
      // Verify the tab is now active
      if (instancesTab.classList.contains('active-block')) {
        console.log('Successfully navigated to Instances tab');
        return true;
      } else {
        console.log('Failed to activate Instances tab');
        return false;
      }

    } catch (error) {
      console.error('Error navigating to Instances tab:', error);
      return false;
    }
  }

  async extractInstanceStatusData() {
    try {
      // Wait for instance containers to be present
      console.log('Waiting for instance containers to load...');
      const instanceContainersLoaded = await window.waitForElement('.connector-table-instance .child', window.TIMEOUTS.LONG);
      if (!instanceContainersLoaded) {
        console.log('Instance containers did not load within timeout');
        return {};
      }
      
      const instanceStatuses = {};
      
      // Find all instance containers
      const instanceContainers = document.querySelectorAll('.connector-table-instance .child');
      console.log(`Found ${instanceContainers.length} instance containers`);
      
      instanceContainers.forEach((container, index) => {
        try {
          // Extract instance ID
          const instanceIdElement = container.querySelector('.instance-section');
          if (!instanceIdElement) {
            console.log(`No instance ID found for container ${index}`);
            return;
          }
          
          const instanceId = instanceIdElement.textContent.trim();
          console.log(`Processing instance: ${instanceId}`);
          
          // Extract instance status - find the Status row in the instance details table
          const instanceTable = container.querySelector('.instance-details table');
          if (!instanceTable) {
            console.log(`No instance table found for instance ${instanceId}`);
            return;
          }
          
          const statusRows = instanceTable.querySelectorAll('tr');
          let statusText = 'Unknown';
          
          for (const row of statusRows) {
            const firstCell = row.querySelector('td:first-child');
            if (firstCell && firstCell.textContent.trim().toLowerCase().includes('status')) {
              const statusCell = row.querySelector('td:last-child .instance-column');
              if (statusCell) {
                statusText = statusCell.textContent.trim();
                break;
              }
            }
          }
          
          console.log(`Instance ${instanceId} status: ${statusText}`);
          instanceStatuses[instanceId] = statusText;
          
        } catch (error) {
          console.error(`Error processing instance container ${index}:`, error);
        }
      });
      
      return instanceStatuses;
      
    } catch (error) {
      console.error('Error extracting instance status data:', error);
      return {};
    }
  }

  async navigateToMetricsTab() {
    try {
      // Find the tab navigation
      const tabContainer = document.querySelector('ul.header-inner');
      if (!tabContainer) {
        console.log('Tab navigation not found - no metrics available');
        return false;
      }

      // Check if Metrics tab is already active
      const metricsTab = Array.from(tabContainer.querySelectorAll('li.header-blocks')).find(tab => {
        const spanText = tab.querySelector('span.active-name')?.textContent?.trim();
        return spanText === 'Metrics';
      });

      if (!metricsTab) {
        console.log('Metrics tab not found - no metrics available');
        return false;
      }

      // Check if already active
      if (metricsTab.classList.contains('active-block')) {
        console.log('Already on Metrics tab');
        return true;
      }

      // Click the Metrics tab
      console.log('Clicking Metrics tab...');
      metricsTab.click();
      
      // Wait for tab to activate
      await window.sleep(window.TIMEOUTS.SHORT);
      
      // Verify the tab is now active
      if (metricsTab.classList.contains('active-block')) {
        console.log('Successfully switched to Metrics tab');
        return true;
      } else {
        console.log('Failed to activate Metrics tab');
        return false;
      }
      
    } catch (error) {
      console.log('Error navigating to Metrics tab:', error.message);
      return false;
      throw error;
    }
  }

  async selectSystemDropdown() {
    try {
      console.log('Selecting system from dropdown...');
      
      // Find the dropdown container
      const dropdownContainer = document.querySelector('lib-generic-dropdown .genericDropdownContainer');
      if (!dropdownContainer) {
        throw new Error('Dropdown container not found');
      }

      // Check if system is already selected
      const selectedDropdown = dropdownContainer.querySelector('.selectedDropdown');
      if (selectedDropdown && selectedDropdown.textContent.trim().toLowerCase() === 'system') {
        console.log('System is already selected');
        return true;
      }

      // Click to open dropdown
      console.log('Opening dropdown...');
      selectedDropdown.click();
      await window.sleep(window.TIMEOUTS.SHORT);

      // Find and click the "system" option
      const dropdownList = dropdownContainer.querySelector('.genericDropdownList');
      if (!dropdownList) {
        throw new Error('Dropdown list not found after clicking');
      }

      const systemOption = Array.from(dropdownList.querySelectorAll('.eachElement')).find(element => {
        return element.textContent.trim().toLowerCase() === 'system';
      });

      if (!systemOption) {
        throw new Error('System option not found in dropdown');
      }

      console.log('Clicking system option...');
      systemOption.click();
      
      // Wait for selection to take effect
      await window.sleep(window.TIMEOUTS.SHORT);
      
      // Verify system is now selected
      const newSelection = dropdownContainer.querySelector('.selectedDropdown');
      if (newSelection && newSelection.textContent.trim().toLowerCase() === 'system') {
        console.log('Successfully selected system');
        return true;
      } else {
        throw new Error('Failed to select system option');
      }
      
    } catch (error) {
      console.error('Error selecting system dropdown:', error);
      throw error;
    }
  }

  async selectTimeInterval(intervalText) {
    try {
      console.log(`Selecting time interval: ${intervalText}...`);
      
      // Find the time interval dropdown using the class you provided
      const intervalDropdown = document.querySelector('lib-generic-dropdown.metricInterval .genericDropdownContainer');
      if (!intervalDropdown) {
        console.log('Time interval dropdown not found');
        return false;
      }

      // Check if the desired interval is already selected
      const selectedDropdown = intervalDropdown.querySelector('.selectedDropdown');
      if (selectedDropdown && selectedDropdown.textContent.trim() === intervalText) {
        console.log(`${intervalText} is already selected`);
        return true;
      }

      // Click to open the dropdown
      console.log('Opening time interval dropdown...');
      selectedDropdown.click();
      await window.sleep(window.TIMEOUTS.SHORT);

      // Find and click the desired interval option
      const dropdownList = intervalDropdown.querySelector('.genericDropdownList');
      if (!dropdownList) {
        console.log('Time interval dropdown list not found after clicking');
        return false;
      }

      const intervalOption = Array.from(dropdownList.querySelectorAll('.eachElement')).find(element => {
        return element.textContent.trim() === intervalText;
      });

      if (!intervalOption) {
        console.log(`Time interval option "${intervalText}" not found in dropdown`);
        return false;
      }

      console.log(`Clicking time interval option: ${intervalText}...`);
      intervalOption.click();
      
      // Wait for selection to take effect and charts to reload
      await window.sleep(window.TIMEOUTS.MEDIUM);
      
      // Verify the interval is now selected
      const newSelection = intervalDropdown.querySelector('.selectedDropdown');
      if (newSelection && newSelection.textContent.trim() === intervalText) {
        console.log(`Successfully selected time interval: ${intervalText}`);
        return true;
      } else {
        console.log(`Failed to select time interval: ${intervalText}`);
        return false;
      }
      
    } catch (error) {
      console.error('Error selecting time interval:', error);
      return false;
    }
  }

  hasMemoryMetrics(metricsData) {
    if (!metricsData || typeof metricsData !== 'object') {
      return false;
    }
    
    // Check if any of the chart titles or data contains memory-related information
    const memoryKeywords = ['memory', 'ram', 'heap', 'memory usage', 'memory utilization'];
    
    // Check chart titles/keys
    const chartTitles = Object.keys(metricsData);
    const hasMemoryChart = chartTitles.some(title => 
      memoryKeywords.some(keyword => title.toLowerCase().includes(keyword))
    );
    
    if (hasMemoryChart) {
      console.log('Found memory metrics in chart titles:', chartTitles.filter(title => 
        memoryKeywords.some(keyword => title.toLowerCase().includes(keyword))
      ));
      return true;
    }
    
    console.log('No memory metrics found in chart titles:', chartTitles);
    return false;
  }

  extractAllChartData() {
    try {
      // First, check if this is a multi-instance connector
      const multiInstanceData = this.extractMultiInstanceData();
      if (multiInstanceData.isMultiInstance) {
        return multiInstanceData;
      }
      
      // Fall back to single instance extraction
      return this.extractSingleInstanceData();
    } catch (error) {
      console.error('Error extracting chart data:', error);
      return { error: 'Failed to extract chart data' };
    }
  }

  extractMultiInstanceData() {
    try {
      // Find all chart containers on the page
      const chartContainers = document.querySelectorAll('.metric-chart');
      console.log(`Found ${chartContainers.length} charts on the page`);
      
      if (chartContainers.length === 0) {
        return { isMultiInstance: false, message: 'No charts found on the page' };
      }

      // Check if any chart has multiple line groups (instances)
      let totalLineGroups = 0;
      let totalLegendEntries = 0;
      
      chartContainers.forEach(chartContainer => {
        const lineGroups = chartContainer.querySelectorAll('g.lines g.line-group');
        const legendEntries = chartContainer.querySelectorAll('.legendContainer');
        totalLineGroups += lineGroups.length;
        totalLegendEntries += legendEntries.length;
      });

      // If we have multiple line groups or legend entries, this is multi-instance
      const hasMultipleInstances = totalLegendEntries > chartContainers.length;
      
      if (!hasMultipleInstances) {
        return { isMultiInstance: false };
      }

      console.log('Detected multi-instance connector');
      
      // Extract instance-specific data
      const instances = {};
      
      chartContainers.forEach((chartContainer, chartIndex) => {
        try {
          const metricTitle = chartContainer.querySelector('.metric-param')?.textContent?.trim() || `Chart ${chartIndex + 1}`;
          const lineGroups = chartContainer.querySelectorAll('g.lines g.line-group');
          const legendEntries = chartContainer.querySelectorAll('.legendContainer .legendName');
          
          console.log(`Chart: ${metricTitle}, Line groups: ${lineGroups.length}, Legends: ${legendEntries.length}`);
          
          // Extract data for each instance in this chart
          lineGroups.forEach((lineGroup, instanceIndex) => {
            const linePath = lineGroup.querySelector('path.line');
            if (!linePath) return;
            
            // Get instance ID from legend
            let instanceId = `Instance ${instanceIndex + 1}`;
            if (legendEntries[instanceIndex]) {
              instanceId = legendEntries[instanceIndex].textContent.trim();
            }
            
            // Initialize instance data if not exists
            if (!instances[instanceId]) {
              instances[instanceId] = {
                instanceId: instanceId,
                metrics: {},
                isActive: true
              };
            }
            
            // Extract metric value for this instance
            const metricValue = this.extractMetricFromPath(linePath, chartContainer);
            instances[instanceId].metrics[metricTitle] = metricValue;
          });
          
          // Handle inactive instances (in legend but no line data)
          legendEntries.forEach((legendEntry, legendIndex) => {
            if (legendIndex >= lineGroups.length) {
              const instanceId = legendEntry.textContent.trim();
              if (!instances[instanceId]) {
                instances[instanceId] = {
                  instanceId: instanceId,
                  metrics: {},
                  isActive: false
                };
              }
              instances[instanceId].metrics[metricTitle] = 'No Data (Inactive)';
            }
          });
          
        } catch (error) {
          console.error(`Error processing multi-instance chart ${chartIndex}:`, error);
        }
      });

      return {
        isMultiInstance: true,
        instances: instances
      };
      
    } catch (error) {
      console.error('Error extracting multi-instance data:', error);
      return { isMultiInstance: false, error: 'Failed to extract multi-instance data' };
    }
  }

  extractSingleInstanceData() {
    try {
      const results = {};
      
      // Find all chart containers on the page
      const chartContainers = document.querySelectorAll('.metric-chart');
      console.log(`Found ${chartContainers.length} charts on the page`);
      
      if (chartContainers.length === 0) {
        return { message: 'No charts found on the page' };
      }
      
      chartContainers.forEach((chartContainer, index) => {
        try {
          // Get the metric title
          const metricTitle = chartContainer.querySelector('.metric-param')?.textContent?.trim() || `Chart ${index + 1}`;
          
          // Find the SVG path that contains the line data
          const linePath = chartContainer.querySelector('g.lines g.line-group path.line');
          if (!linePath) {
            console.log(`No line path found for chart: ${metricTitle}`);
            results[metricTitle] = 'No data available';
            return;
          }
          
          // Extract metric value using helper method
          const metricValue = this.extractMetricFromPath(linePath, chartContainer);
          results[metricTitle] = metricValue;
          
        } catch (error) {
          console.error(`Error processing chart ${index + 1}:`, error);
          results[`Chart ${index + 1}`] = 'Error processing chart';
        }
      });
      
      return results;
    } catch (error) {
      console.error('Error extracting single instance data:', error);
      return { error: 'Failed to extract single instance data' };
    }
  }

  extractMetricFromPath(linePath, chartContainer) {
    try {
      // Extract the 'd' attribute which contains the path coordinates
      const pathData = linePath.getAttribute('d');
      if (!pathData) {
        return 'No path data';
      }
      
      // Parse the path data to extract coordinates
      const coordinates = [];
      const pathSegments = pathData.split('L');
      
      // Handle the first 'M' command
      if (pathSegments[0].startsWith('M')) {
        const firstPoint = pathSegments[0].substring(1).split(',');
        coordinates.push({
          x: parseFloat(firstPoint[0]),
          y: parseFloat(firstPoint[1])
        });
      }
      
      // Handle all 'L' commands
      for (let i = 1; i < pathSegments.length; i++) {
        const point = pathSegments[i].split(',');
        if (point.length >= 2) {
          coordinates.push({
            x: parseFloat(point[0]),
            y: parseFloat(point[1])
          });
        }
      }
      
      if (coordinates.length === 0) {
        return 'No coordinates';
      }
      
      // Get the last (rightmost) coordinate
      const lastCoordinate = coordinates[coordinates.length - 1];
      
      // Convert SVG Y coordinate to actual value with better Y-axis parsing
      const yAxisTicks = chartContainer.querySelectorAll('.y.axis .tick text');
      let maxValue = 100; // Default fallback
      let minValue = 0;
      
      if (yAxisTicks.length > 0) {
        const values = Array.from(yAxisTicks)
          .map(tick => {
            const text = tick.textContent.trim();
            // Convert K, M notation to actual numbers
            if (text.includes('K')) {
              return parseFloat(text.replace('K', '')) * 1000;
            } else if (text.includes('M')) {
              return parseFloat(text.replace('M', '')) * 1000000;
            } else {
              return parseFloat(text);
            }
          })
          .filter(v => !isNaN(v))
          .sort((a, b) => a - b); // Sort to ensure proper min/max
          
        if (values.length > 0) {
          minValue = values[0];
          maxValue = values[values.length - 1];
        }
      }
      
      // Calculate the actual value based on Y coordinate
      // SVG coordinate system: 0 at top (maxValue), yAxisHeight at bottom (minValue)
      const yAxisHeight = 270; // Standard height
      const valueRange = maxValue - minValue;
      const actualValue = maxValue - (lastCoordinate.y / yAxisHeight * valueRange);
      
      // Round to 2 decimal places
      const roundedValue = Math.round(actualValue * 100) / 100;
      
      // Determine the unit based on chart container's metric title
      const metricTitle = chartContainer.querySelector('.metric-param')?.textContent?.trim() || '';
      let unit = '';
      const title = metricTitle.toLowerCase();
      if (title.includes('percentage') || title.includes('percent') || title.includes('%')) {
        unit = '%';
      } else if (title.includes('memory') && !title.includes('percentage')) {
        unit = ' MB';
      } else if (title.includes('cpu') && !title.includes('percentage')) {
        unit = ' MHz';
      } else if (title.includes('bytes')) {
        unit = ' bytes/sec';
      }
      
      return `${roundedValue}${unit}`;
      
    } catch (error) {
      console.error('Error extracting metric from path:', error);
      return 'Error extracting data';
    }
  }
}

class ConnectorChecker {
  constructor(baseDomain) {
    this.baseDomain = baseDomain;
    this.navigationManager = new ConnectorNavigationManager(baseDomain);
    this.dataExtractor = new ConnectorDataExtractor();
    this.paginationManager = new PaginationManager();
  }

  async checkConnectorStatus() {
    try {
      globalThis.updateProgressMessage(ConnectorConfig.messages.starting);
      
      await this.navigationManager.ensureOnWirelessPage();

      globalThis.updateProgressMessage(ConnectorConfig.messages.loadingContent);
      const wirelessContent = await window.waitForElement(ConnectorConfig.selectors.wirelessContent, window.TIMEOUTS.ELEMENT_WAIT);
      
      if (!wirelessContent) {
        return {
          'Number of Connectors': 'Not found (wireless page content missing)',
          'Active Connectors': 'Not found (wireless page content missing)',
          'Degraded Connectors': 'Not found (wireless page content missing)',
          'Inactive Connectors': 'Not found (wireless page content missing)'
        };
      }

      await window.sleep(window.TIMEOUTS.MEDIUM);
      
      // Expand the Spaces Connector accordion box
      console.log('Looking for Spaces Connector accordion box...');
      globalThis.updateProgressMessage(ConnectorConfig.messages.locatingSection);
      const accordionToggles = document.querySelectorAll(ConnectorConfig.selectors.accordionToggles);
      console.log(`Found ${accordionToggles.length} accordion boxes`);
      
      let spacesConnectorToggle = null;
      let spacesConnectorPanel = null;
      
      for (const toggle of accordionToggles) {
        const headerText = toggle.querySelector(ConnectorConfig.selectors.tileHeader)?.textContent?.trim() || '';
        console.log(`Found accordion box: ${headerText}`);
        
        if (headerText.includes('Spaces Connector')) {
          spacesConnectorToggle = toggle;
          console.log('Found Spaces Connector accordion box');
          break;
        }
      }
      
      if (!spacesConnectorToggle) {
        console.log('Spaces Connector accordion box not found');
        return {
          'Number of Connectors': 'Not found (Spaces Connector box not found)',
          'Active Connectors': 'Not found (Spaces Connector box not found)',
          'Degraded Connectors': 'Not found (Spaces Connector box not found)',
          'Inactive Connectors': 'Not found (Spaces Connector box not found)'
        };
      }
      
      // Click to expand the Spaces Connector box if not already expanded
      console.log('Checking if Spaces Connector accordion box is expanded...');
      globalThis.updateProgressMessage(ConnectorConfig.messages.expandingAccordion);
      const parentGroup = spacesConnectorToggle.closest('accordion-group');
      spacesConnectorPanel = parentGroup?.querySelector(ConnectorConfig.selectors.panelCollapse);
      
      if (!spacesConnectorPanel) {
        console.log('Expanding Spaces Connector accordion box...');
        spacesConnectorToggle.click();
        await window.sleep(window.TIMEOUTS.SHORT);
        spacesConnectorPanel = parentGroup?.querySelector(ConnectorConfig.selectors.panelCollapse);
      } else {
        console.log('Spaces Connector accordion box is already expanded, skipping click');
      }
      
      if (!spacesConnectorPanel) {
        console.log('Spaces Connector content panel not found after expansion');
        return {
          'Number of Connectors': 'Not found (Spaces Connector panel not found)',
          'Active Connectors': 'Not found (Spaces Connector panel not found)',
          'Degraded Connectors': 'Not found (Spaces Connector panel not found)',
          'Inactive Connectors': 'Not found (Spaces Connector panel not found)'
        };
      }
      
      console.log('Spaces Connector panel expanded successfully');
      globalThis.updateProgressMessage('Analyzing connector configurations...');
      await window.sleep(window.TIMEOUTS.MEDIUM);

      // Now look for the View Connectors link within the expanded panel
      let viewConnectorsLink = null;

      // Search for View Connectors link within the Spaces Connector panel
      const methods = [
        () => {
          const spans = spacesConnectorPanel.querySelectorAll('span');
          return Array.from(spans).find(span => 
            span.textContent.trim() === 'View Connectors' && 
            (span.classList.contains('link') || span.closest('.link'))
          );
        },
        () => {
          const rightDivs = spacesConnectorPanel.querySelectorAll('.rightDiv');
          for (const div of rightDivs) {
            const link = Array.from(div.querySelectorAll('span')).find(
              span => span.textContent.trim() === 'View Connectors'
            );
            if (link) return link;
          }
          return null;
        },
        () => {
          const walker = document.createTreeWalker(
            spacesConnectorPanel,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: node => {
                return node.textContent.trim() === 'View Connectors' 
                  ? NodeFilter.FILTER_ACCEPT 
                  : NodeFilter.FILTER_SKIP;
                }
              }
            );
            let node;
            while (node = walker.nextNode()) {
              if (node.parentElement.classList.contains('link') || 
                  node.parentElement.closest('.link')) {
                return node.parentElement;
              }
            }
            return null;
          }
        ];

        for (const method of methods) {
          viewConnectorsLink = method();
          if (viewConnectorsLink) {
            console.log('Found View Connectors link in Spaces Connector panel');
            break;
          }
        }

      if (!viewConnectorsLink) {
        return {
          'Number of Connectors': 'Not found (link not found)',
          'Active Connectors': 'Not found (link not found)',
          'Degraded Connectors': 'Not found (link not found)',
          'Inactive Connectors': 'Not found (link not found)'
        };
      }
      
      globalThis.updateProgressMessage('Navigating to connector details page...');
      const clickMethods = [
        () => viewConnectorsLink.click(),
        () => {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          viewConnectorsLink.dispatchEvent(clickEvent);
        },
        () => {
          if (viewConnectorsLink.tagName.toLowerCase() === 'span') {
            const parent = viewConnectorsLink.parentElement;
            if (parent) parent.click();
          }
        },
        () => {
          const clickable = viewConnectorsLink.closest('a, button, [role="button"]');
          if (clickable) clickable.click();
        }
      ];

      let clickSuccess = false;
      for (const method of clickMethods) {
        try {
          method();
          await window.sleep(window.TIMEOUTS.SHORT);
          if (window.location.pathname.includes(CONNECTORS_PATH)) {
            clickSuccess = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      let navigationComplete = window.location.pathname.includes(CONNECTORS_PATH);
      
      if (!navigationComplete) {
        navigationComplete = await window.waitForUrlPath(CONNECTORS_PATH, window.TIMEOUTS.URL_WAIT);
      }
      
      if (!navigationComplete) {
        return {
          'Number of Connectors': 'Not found (navigation failed)',
          'Active Connectors': 'Not found (navigation failed)',
          'Degraded Connectors': 'Not found (navigation failed)',
          'Inactive Connectors': 'Not found (navigation failed)'
        };
      }

      await window.sleep(window.TIMEOUTS.MEDIUM);

      globalThis.updateProgressMessage('Extracting connector information...');
      const connectorInfo = await this.extractConnectorInfo();
      
      // NEW: Extract detailed connector data including release versions and individual details
      globalThis.updateProgressMessage('Analyzing connector releases and details...');
      const detailedConnectorData = await this.extractDetailedConnectorData();
      
      globalThis.updateProgressMessage('Processing connector data...');
      // Return base info plus all dynamically found services
      const result = {
        'Number of Connectors': connectorInfo.connectorCount,
        'Active Connectors': connectorInfo.activeConnectors,
        'Degraded Connectors': connectorInfo.degradedConnectors || '0',
        'Inactive Connectors': connectorInfo.inactiveConnectors
      };

      // Add all other properties (services) dynamically
      Object.entries(connectorInfo).forEach(([key, value]) => {
        if (!['connectorCount', 'activeConnectors', 'degradedConnectors', 'inactiveConnectors'].includes(key)) {
          result[key] = value;
        }
      });

      // Add detailed connector data
      if (detailedConnectorData.releaseBreakdown) {
        result['Release Breakdown'] = detailedConnectorData.releaseBreakdown;
      }
      if (detailedConnectorData.activeConnectorDetails) {
        result['Active Connector Details'] = detailedConnectorData.activeConnectorDetails;
      }

      console.log('Final connector status result:', result);
      globalThis.updateProgressMessage('Connector status analysis complete');
      return result;

    } catch (error) {
      globalThis.updateProgressMessage(`Error during connector analysis: ${error.message}`);
      return {
        'Number of Connectors': `Not found (error: ${error.message})`,
        'Active Connectors': `Not found (error: ${error.message})`,
        'Degraded Connectors': `Not found (error: ${error.message})`,
        'Inactive Connectors': `Not found (error: ${error.message})`
      };
    }
  }

  async check() {
    try {
      globalThis.updateProgressMessage('Starting comprehensive connector analysis...');
      
      const result = {
        status: 'pass',
        message: 'Comprehensive connector analysis completed successfully',
        timestamp: new Date().toISOString(),
        details: {}
      };

      try {
        await this.navigationManager.ensureOnConnectorsPage();
      } catch (error) {
        globalThis.updateProgressMessage(ConnectorConfig.messages.navigationFailed);
        // Fall back to legacy wireless connector check
        const legacyResult = await this.checkConnectorStatus();
        result.details.legacy = legacyResult;
        result.message = 'Used legacy wireless connector check (navigation failed)';
        return result;
      }

      globalThis.updateProgressMessage('Extracting connector summary...');
      
      // Get connector summary from the cards
      const connectorSummary = await this.extractConnectorSummary();
      result.details.summary = connectorSummary;

      // Extract detailed connector data including release breakdown and active details
      const detailedData = await this.extractDetailedConnectorData();
      result.details.releaseBreakdown = detailedData.releaseBreakdown;
      result.details.activeConnectorDetails = detailedData.activeConnectorDetails;

      // Calculate final totals for summary
      const totalConnectors = Object.values(detailedData.releaseBreakdown).reduce((sum, data) => sum + data.total, 0);
      const totalActiveDetails = detailedData.activeConnectorDetails.length;
      
      globalThis.updateProgressMessage(`Comprehensive connector analysis complete: ${totalConnectors} total connectors, ${totalActiveDetails} active connectors analyzed`);
      
      console.log('ConnectorChecker comprehensive analysis completed successfully');
      console.log('Summary:', connectorSummary);
      console.log('Release breakdown:', detailedData.releaseBreakdown);
      console.log(`Active connector details: ${detailedData.activeConnectorDetails.length} items`);
      
      return result;
      
    } catch (error) {
      console.error('ConnectorChecker comprehensive analysis error:', error);
      globalThis.updateProgressMessage(`Connector analysis failed: ${error.message} - attempting legacy check`);
      
      // Fall back to legacy check on error
      try {
        const legacyResult = await this.checkConnectorStatus();
        return {
          status: 'partial',
          message: `Primary analysis failed, used legacy check: ${error.message}`,
          timestamp: new Date().toISOString(),
          details: { legacy: legacyResult, error: error.message }
        };
      } catch (legacyError) {
        console.error('Legacy connector check also failed:', legacyError);
        return {
          status: 'fail',
          message: `Both comprehensive and legacy connector checks failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          details: { error: error.message, legacyError: legacyError.message }
        };
      }
    }
  }

  async extractConnectorSummary() {
    try {
      globalThis.updateProgressMessage('Reading connector summary cards...');
      
      // Wait for connector summary cards to load
      const summaryCards = await window.waitForElement('.summary-card, .connector-card, .summary', window.TIMEOUTS.ELEMENT_WAIT);
      if (!summaryCards) {
        console.log('Connector summary cards not found');
        return {
          totalConnectors: 'Not found',
          activeConnectors: 'Not found',
          inactiveConnectors: 'Not found'
        };
      }

      // Try to extract from various summary card formats
      const summary = {};
      
      // Look for numeric summaries
      const totalElement = document.querySelector('.total-connectors, .num-summary, .summary .total');
      const activeElement = document.querySelector('.active-connectors, .up-green, .summary .active');
      const degradedElement = document.querySelector('.degraded-connectors, .degraded-yellow, .degraded-orange, .summary .degraded');
      const inactiveElement = document.querySelector('.inactive-connectors, .down-red, .summary .inactive');
      
      summary.totalConnectors = totalElement?.textContent?.trim() || 'Not found';
      summary.activeConnectors = activeElement?.textContent?.trim() || 'Not found';
      summary.degradedConnectors = degradedElement?.textContent?.trim() || '0';
      summary.inactiveConnectors = inactiveElement?.textContent?.trim() || 'Not found';

      console.log('Extracted connector summary:', summary);
      return summary;

    } catch (error) {
      console.error('Error extracting connector summary:', error);
      return {
        totalConnectors: `Error: ${error.message}`,
        activeConnectors: `Error: ${error.message}`,
        inactiveConnectors: `Error: ${error.message}`
      };
    }
  }

  async extractConnectorInfo() {
    try {
      globalThis.updateProgressMessage('Reading connector summary information...');
      
      // Extract basic summary data using the data extractor
      const summaryData = this.dataExtractor.extractSummaryData();
      if (!summaryData) {
        return {
          connectorCount: 'Not found (summary data missing)',
          activeConnectors: 'Not found (summary data missing)',
          degradedConnectors: 'Not found (summary data missing)',
          inactiveConnectors: 'Not found (summary data missing)'
        };
      }

      // Extract service data
      const services = this.dataExtractor.extractServiceData();

      // Build result object with base connector info
      const result = {
        connectorCount: summaryData.totalConnectors,
        activeConnectors: summaryData.upConnectors,
        degradedConnectors: summaryData.degradedConnectors || '0',
        inactiveConnectors: summaryData.downConnectors,
        ...services  // Spread all found services into the result
      };

      console.log('Final connector extraction result:', result);
      globalThis.updateProgressMessage('Connector information extracted successfully');
      return result;

    } catch (error) {
      console.error('Error extracting connector info:', error);
      return {
        connectorCount: `Not found (error: ${error.message})`,
        activeConnectors: `Not found (error: ${error.message})`,
        degradedConnectors: `Not found (error: ${error.message})`,
        inactiveConnectors: `Not found (error: ${error.message})`
      };
    }
  }

  async extractDetailedConnectorData() {
    try {
      globalThis.updateProgressMessage('Scanning connector table for detailed analysis...');
      
      const releaseBreakdown = {};
      const activeConnectorDetails = [];
      
      // Wait for the connector table to load
      const connectorTable = await window.waitForElement('.connector-table table.userTable', window.TIMEOUTS.ELEMENT_WAIT);
      if (!connectorTable) {
        console.log('Connector table not found');
        globalThis.updateProgressMessage('Connector table not found - skipping detailed analysis');
        return { releaseBreakdown: {}, activeConnectorDetails: [] };
      }

      // Allow additional time for table and pagination to fully render
      await window.sleep(window.TIMEOUTS.SHORT);

      let currentPage = 1;
      let hasMorePages = true;
      let totalProcessed = 0;
      let totalActive = 0;
      const maxPages = 10; // Safety limit to prevent infinite loops
      const processedPages = new Set(); // Track which pages we've processed

      while (hasMorePages && currentPage <= maxPages) {
        // Check current page info to verify we're where we expect to be
        const pageDescription = document.querySelector('.pagination .description .page-counts');
        const currentPageInfo = pageDescription ? pageDescription.textContent.trim() : 'Unknown';
        console.log(`Processing page ${currentPage}, page info: ${currentPageInfo}`);
        
        // FIRST: Check if we're on the last page BEFORE processing any connectors
        const isLastPage = this.paginationManager.isOnLastPage();
        console.log(`Page ${currentPage}: Is last page: ${isLastPage}`);
        
        // Check if we've already processed this page content (infinite loop detection)
        const pageId = `page-${currentPage}-${currentPageInfo}`;
        if (processedPages.has(pageId)) {
          console.warn(`Already processed page content "${pageId}" - breaking to prevent infinite loop`);
          break;
        }
        processedPages.add(pageId);

        globalThis.updateProgressMessage(`Analyzing connectors on page ${currentPage}...`);
        
        // Process connectors on current page, passing the current page number
        const pageData = await this.processConnectorPage(currentPage);
        
        // If no data was processed, we might be in an error state
        if (!pageData || Object.keys(pageData.releaseBreakdown).length === 0) {
          console.warn(`No data processed on page ${currentPage} - ending pagination`);
          break;
        }
        
        // Update totals for progress messages
        const pageTotal = Object.values(pageData.releaseBreakdown).reduce((sum, data) => sum + data.total, 0);
        totalProcessed += pageTotal;
        totalActive += pageData.activeConnectorDetails.length;
        
        console.log(`Page ${currentPage}: processed ${pageTotal} connectors, ${pageData.activeConnectorDetails.length} active`);
        globalThis.updateProgressMessage(`Processed ${totalProcessed} connectors, found ${totalActive} active`);
        
        // Merge release breakdown data
        Object.entries(pageData.releaseBreakdown).forEach(([release, data]) => {
          if (!releaseBreakdown[release]) {
            releaseBreakdown[release] = { up: 0, degraded: 0, down: 0, total: 0 };
          }
          releaseBreakdown[release].up += data.up;
          releaseBreakdown[release].degraded += data.degraded || 0;
          releaseBreakdown[release].down += data.down;
          releaseBreakdown[release].total += data.total;
        });

        // Add active connector details
        activeConnectorDetails.push(...pageData.activeConnectorDetails);

        // Check if there are more pages - use pagination manager
        globalThis.updateProgressMessage(ConnectorConfig.messages.checkingPages);
        
        if (this.paginationManager.isOnLastPage()) {
          console.log('Reached last page - stopping pagination');
          hasMorePages = false;
        } else {
          // Try to navigate to next page by page number instead of clicking Next
          const nextPageNumber = this.paginationManager.getCurrentPageNumber() + 1;
          console.log(`Attempting to navigate to page ${nextPageNumber}`);
          
          const success = await this.paginationManager.navigateToSpecificPage(nextPageNumber);
          if (success) {
            currentPage++;
            globalThis.updateProgressMessage(ConnectorConfig.messages.movingToPage(currentPage));
          } else {
            console.log(`Failed to navigate to page ${nextPageNumber} - stopping pagination`);
            hasMorePages = false;
          }
        }
      }

      globalThis.updateProgressMessage(`Connector analysis complete: ${totalProcessed} total, ${totalActive} active connectors processed`);
      console.log('Final release breakdown:', releaseBreakdown);
      console.log(`Total active connector details collected: ${activeConnectorDetails.length}`);

      return {
        releaseBreakdown,
        activeConnectorDetails
      };

    } catch (error) {
      console.error('Error extracting detailed connector data:', error);
      globalThis.updateProgressMessage(`Error during detailed connector analysis: ${error.message}`);
      return { releaseBreakdown: {}, activeConnectorDetails: [] };
    }
  }

  async processConnectorPage() {
    try {
      const releaseBreakdown = {};
      const activeConnectorDetails = [];

      // Process connectors in batches to avoid stale DOM references
      let processedCount = 0;
      let hasMoreConnectorsOnPage = true;
      let pageRestored = false; // Track if we've already restored the page after detail navigation

      while (hasMoreConnectorsOnPage) {
        // Re-query DOM to get fresh references after each navigation
        const connectorRows = document.querySelectorAll('.connector-table table.userTable tbody tr.tableTr');
        console.log(`Found ${connectorRows.length} connector rows on current page (processing from index ${processedCount})`);

        if (processedCount >= connectorRows.length) {
          console.log('All connectors on this page have been processed');
          hasMoreConnectorsOnPage = false;
          break;
        }

        const row = connectorRows[processedCount];
        console.log(`Processing row ${processedCount + 1} of ${connectorRows.length}`);
        
        // Debug: Log the row HTML structure
        console.log(`Row ${processedCount} HTML:`, row.outerHTML.substring(0, 200) + '...');
        
        try {
          // Extract connector info from row
          const nameElement = row.querySelector('.userListName a.userNameLink');
          const statusElement = row.querySelector('.userAccess');
          
          // Handle different release element structures between pages
          let releaseElement = null;
          let release = 'Unknown';
          
          // Try multiple selectors for release information
          const releaseSelectors = [
            'td:nth-child(2) span',                    // Original selector
            'td:nth-child(2) .release-div',            // Page 2 structure with .release-div
            'td:nth-child(2) div span',                // Page 2 structure with div > span
            'td:nth-child(2) div .ng-star-inserted',   // Alternative page 2 structure
            'td:nth-child(2)'                          // Fallback to td content
          ];
          
          for (const selector of releaseSelectors) {
            releaseElement = row.querySelector(selector);
            if (releaseElement && releaseElement.textContent.trim()) {
              release = releaseElement.textContent.trim();
              break;
            }
          }
          
          if (!nameElement || !statusElement) {
            console.log(`Skipping row ${processedCount}: missing required elements (name or status)`);
            console.log(`Name element found: ${!!nameElement}, Status element found: ${!!statusElement}`);
            console.log(`Release found: ${release}`);
            if (!nameElement) {
              console.log('Name element selector ".userListName a.userNameLink" failed');
            }
            if (!statusElement) {
              console.log('Status element selector ".userAccess" failed');
            }
            processedCount++;
            continue;
          }

          const name = nameElement.textContent.trim();
          
          // Enhanced status detection - check for active, degraded, or down
          const isActive = statusElement.classList.contains('active');
          const statusIcon = statusElement.querySelector('img');
          const iconSrc = statusIcon?.src || '';
          
          let status = 'down';
          let statusCategory = 'Down';
          
          if (isActive) {
            status = 'up';
            statusCategory = 'Up';
          } else if (iconSrc.includes('degraded.svg') || statusElement.textContent.toLowerCase().includes('degraded')) {
            status = 'degraded';
            statusCategory = 'Degraded';
          }

          console.log(`Connector ${processedCount + 1}: ${name}, Release: ${release}, Status: ${status}, Category: ${statusCategory}, Icon: ${iconSrc}`);

          // Update release breakdown with degraded status
          if (!releaseBreakdown[release]) {
            releaseBreakdown[release] = { up: 0, degraded: 0, down: 0, total: 0 };
          }
          releaseBreakdown[release][status]++;
          releaseBreakdown[release].total++;

          // Extract detailed information for active AND degraded connectors
          if (isActive || status === 'degraded') {
            const connectorType = status === 'degraded' ? 'degraded' : 'active';
            globalThis.updateProgressMessage(`Getting details for ${connectorType} connector: ${name}...`);
            const result = await this.getConnectorDetails(nameElement, name);
            
            activeConnectorDetails.push({
              name,
              release,
              status: statusCategory,
              details: result.details
            });
            
            // Only restore page once per page processing session
            if (!pageRestored && result.currentPageNumber > 1) {
              // Wait for connector table to fully reload after navigation
              await window.sleep(window.TIMEOUTS.SHORT);
              
              console.log(`Returning to page ${result.currentPageNumber}...`);
              await this.paginationManager.navigateToSpecificPage(result.currentPageNumber);
              pageRestored = true; // Mark that we've restored the page
            } else if (!pageRestored) {
              // Still need to wait for table to reload even on page 1
              await window.sleep(window.TIMEOUTS.SHORT);
              pageRestored = true;
            }
            
            // After returning from details, DOM references are stale, so we'll re-query in next iteration
          }

          processedCount++;

        } catch (error) {
          console.error(`Error processing connector row ${processedCount}:`, error);
          processedCount++; // Move to next connector even if this one failed
        }
      }

      console.log(`Processed ${processedCount} connectors on current page`);
      return { releaseBreakdown, activeConnectorDetails };

    } catch (error) {
      console.error('Error processing connector page:', error);
      return { releaseBreakdown: {}, activeConnectorDetails: [] };
    }
  }

  async getConnectorDetails(nameElement, connectorName) {
    try {
      console.log(`[ConnectorAnalysis] Starting data extraction for ${connectorName}...`);
      globalThis.updateProgressMessage(`Extracting details for ${connectorName}...`);
      
      // Capture current page number before navigating
      const currentPageNumber = this.paginationManager.getCurrentPageNumber();
      console.log(`Currently on page ${currentPageNumber} before navigating to ${connectorName} details`);
      
      // Navigate to connector details using navigation manager
      await this.navigationManager.navigateToConnectorDetails(nameElement, connectorName);

      globalThis.updateProgressMessage(`Analyzing ${connectorName} configuration...`);

      // STEP 1: Extract table data first (services, controllers, instances) from default tab
      console.log(`[ConnectorAnalysis] Extracting table data from default tab...`);
      const serviceDetails = this.dataExtractor.extractServiceDetails();
      const controllerDetails = this.dataExtractor.extractControllerDetails();
      const instanceCount = this.dataExtractor.extractInstanceCount();

      // STEP 1.5: Extract instance statuses if needed (multi-instance with potential down instances)
      let instanceStatuses = null;
      const shouldExtractInstanceStatuses = this.shouldExtractInstanceStatuses(instanceCount);
      if (shouldExtractInstanceStatuses) {
        console.log(`[ConnectorAnalysis] Extracting instance statuses for multi-instance connector...`);
        globalThis.updateProgressMessage(`Checking instance statuses for ${connectorName}...`);
        instanceStatuses = await this.dataExtractor.extractInstanceStatuses();
      }

      // STEP 2: Navigate to Metrics tab and extract metrics data
      console.log(`[ConnectorAnalysis] Navigating to Metrics tab for chart data...`);
      globalThis.updateProgressMessage(`Extracting metrics for ${connectorName}...`);
      const metricsData = await this.dataExtractor.extractMetricsData();

      // STEP 3: Calculate resource sizing using metrics data
      console.log(`[ConnectorAnalysis] Calculating resource sizing...`);
      
      let details;
      
      // Check if this is multi-instance data
      if (metricsData && metricsData.isMultiInstance) {
        console.log(`[ConnectorAnalysis] Detected multi-instance connector with ${Object.keys(metricsData.instances).length} instances`);
        
        // For multi-instance, we structure the data differently
        details = {
          serviceDetails: serviceDetails || 'No service details found',
          controllerDetails: controllerDetails || 'No controller details found', 
          instanceCount: instanceCount || 'Not found',
          instances: metricsData.instances,
          instanceStatuses: instanceStatuses, // Add instance statuses
          metrics: metricsData // Keep the original data for reference
        };
      } else {
        // Single instance - existing behavior
        const resourceSizing = this.dataExtractor.extractResourceSizing(metricsData);
        
        details = {
          resourceSizing: resourceSizing || 'Unable to determine connector size',
          serviceDetails: serviceDetails || 'No service details found',
          controllerDetails: controllerDetails || 'No controller details found', 
          instanceCount: instanceCount || 'Not found',
          instanceStatuses: instanceStatuses, // Add instance statuses for consistency
          metrics: metricsData
        };
      }

      console.log(`[ConnectorAnalysis] Extracted details for ${connectorName}:`, details);
      globalThis.updateProgressMessage(`Completed analysis of ${connectorName}`);

      // Return to connectors page (caller will handle page restoration)
      await this.navigationManager.returnToConnectorsPage();

      return { details, currentPageNumber };
    } catch (error) {
      console.error(`Error getting details for ${connectorName}:`, error);
      globalThis.updateProgressMessage(`Error extracting details for ${connectorName}: ${error.message}`);
      
      // Attempt to return to connectors page
      try {
        await this.navigationManager.returnToConnectorsPage();
      } catch (returnError) {
        console.error('Error returning to connectors page:', returnError);
      }
      
      return { resourceSizing: `Error: ${error.message}` };
    }
  }

  shouldExtractInstanceStatuses(instanceCount) {
    if (!instanceCount || typeof instanceCount !== 'string') {
      return false;
    }
    
    // Check if there are multiple instances and any mention of inactive
    const hasMultipleInstances = instanceCount.includes('instances') && !instanceCount.startsWith('1 ');
    const hasInactiveInstance = instanceCount.toLowerCase().includes('inactive');
    
    console.log(`Instance count: "${instanceCount}", Multiple instances: ${hasMultipleInstances}, Has inactive: ${hasInactiveInstance}`);
    
    return hasMultipleInstances && hasInactiveInstance;
  }
}

globalThis.ConnectorChecker = ConnectorChecker;
// Report module for generating connector status section in reports
globalThis.ConnectorChecker.reportModule = {
  generateHTML: function(data) {
    const connectorData = this.processData(data);
    
    let servicesHTML = '';
    if (connectorData.services && connectorData.services.length > 0) {
      servicesHTML = `
        <div class="subsection">
          <h3 class="subsection-title">Service Status</h3>
          <table class="report-table">
            <tbody>
              ${connectorData.services.map(service => `
                <tr>
                  <th>${service.name}</th>
                  <td>${service.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let releaseBreakdownHTML = '';
    if (connectorData.releaseBreakdown && Object.keys(connectorData.releaseBreakdown).length > 0) {
      releaseBreakdownHTML = `
        <div class="subsection">
          <h3 class="subsection-title">Release Breakdown</h3>
          <table class="report-table">
            <thead>
              <tr>
                <th>Release</th>
                <th style="width: 20%;">Up</th>
                <th style="width: 20%;">Degraded</th>
                <th style="width: 20%;">Down</th>
                <th style="width: 20%;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(connectorData.releaseBreakdown).map(([release, data]) => `
                <tr>
                  <th>${release}</th>
                  <td style="width: 20%;">${data.up}</td>
                  <td style="width: 20%;">${data.degraded}</td>
                  <td style="width: 20%;">${data.down}</td>
                  <td style="width: 20%;">${data.total}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let activeConnectorDetailsHTML = '';
    if (connectorData.activeConnectorDetails && connectorData.activeConnectorDetails.length > 0) {
      activeConnectorDetailsHTML = `
        <div class="subsection">
          <h3 class="subsection-title">Active Connector Details</h3>
          ${connectorData.activeConnectorDetails.map(connector => this.generateConnectorHTML(connector)).join('')}
        </div>
      `;
    }
    
    return `
      <div class="section" id="connector-section">
        <h2 class="section-title">Connector Status</h2>
        <table class="report-table">
          <tbody>
            <tr>
              <th>Number of Connectors</th>
              <td>${connectorData.totalConnectors}</td>
            </tr>
            <tr>
              <th>Active Connectors</th>
              <td>${connectorData.activeConnectors}</td>
            </tr>
            <tr>
              <th>Inactive Connectors</th>
              <td>${connectorData.inactiveConnectors}</td>
            </tr>
          </tbody>
        </table>
        ${servicesHTML}
        ${releaseBreakdownHTML}
        ${activeConnectorDetailsHTML}
      </div>
    `;
  },
  
  formatMetrics: function(metrics) {
    if (!metrics) {
      return 'Not Available';
    }
    
    if (metrics === 'No Metrics') {
      return 'No Metrics Available';
    }
    
    if (typeof metrics === 'object' && metrics.error) {
      return `Error: ${metrics.error}`;
    }
    
    if (typeof metrics === 'object') {
      // Format metrics data into a readable string
      const metricEntries = Object.entries(metrics);
      if (metricEntries.length === 0) {
        return 'No Metrics Data';
      }
      
      return metricEntries.map(([key, value]) => {
        // Clean up the key name for display
        const cleanKey = key.replace(/\s*\([^)]*\)/g, ''); // Remove parenthetical text
        return `${cleanKey}: ${value}`;
      }).join('<br>');
    }
    
    return String(metrics);
  },

  formatControllerDetails: function(controllerData) {
    // Handle missing data or errors
    if (!controllerData) {
      return 'Not Available';
    }
    
    if (controllerData.error) {
      return `Error: ${controllerData.error}`;
    }
    
    // Format structured controller data
    const sections = [];
    
    // UP Controllers
    if (controllerData.up && controllerData.up.length > 0) {
      const upList = controllerData.up
        .map(controller => `<li>${controller.name}[${controller.ip}] - ${controller.apCount} APs</li>`)
        .join('');
      sections.push(`
        <div class="controller-section">
          <strong class="controller-status up">UP Controllers (${controllerData.up.length}):</strong>
          <ul class="controller-list">${upList}</ul>
        </div>
      `);
    }
    
    // DEGRADED Controllers
    if (controllerData.degraded && controllerData.degraded.length > 0) {
      const degradedList = controllerData.degraded
        .map(controller => `<li>${controller.name}[${controller.ip}] - ${controller.apCount} APs</li>`)
        .join('');
      sections.push(`
        <div class="controller-section">
          <strong class="controller-status degraded">DEGRADED Controllers (${controllerData.degraded.length}):</strong>
          <ul class="controller-list">${degradedList}</ul>
        </div>
      `);
    }
    
    // DOWN Controllers
    if (controllerData.down && controllerData.down.length > 0) {
      const downList = controllerData.down
        .map(controller => `<li>${controller.name}[${controller.ip}] - ${controller.apCount} APs</li>`)
        .join('');
      sections.push(`
        <div class="controller-section">
          <strong class="controller-status down">DOWN Controllers (${controllerData.down.length}):</strong>
          <ul class="controller-list">${downList}</ul>
        </div>
      `);
    }
    
    // Add summary
    if (controllerData.totalControllers > 0) {
      sections.push(`
        <div class="controller-summary">
          <small><strong>Summary:</strong> ${controllerData.totalControllers} Controllers, ${controllerData.totalAPs} Total APs</small>
        </div>
      `);
    }
    
    return sections.length > 0 ? sections.join('') : 'No controllers found';
  },

  generateConnectorHTML: function(connector) {
    // Check if this is a multi-instance connector
    if (connector.details && connector.details.instances) {
      return this.generateMultiInstanceConnectorHTML(connector);
    } else {
      return this.generateSingleInstanceConnectorHTML(connector);
    }
  },

  generateSingleInstanceConnectorHTML: function(connector) {
    return `
      <div class="connector-details" style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <h4 class="connector-title">${connector.name}</h4>
        <table class="report-table">
          <tbody>
            <tr><th>Release</th><td>${connector.release}</td></tr>
            <tr><th>Status</th><td>${connector.status}</td></tr>
            <tr><th>Service Details</th><td>${connector.details?.serviceDetails || 'Not Available'}</td></tr>
            <tr><th>Controller Details</th><td>${this.formatControllerDetails(connector.details?.controllerDetails)}</td></tr>
            <tr><th>Instance Count</th><td>${connector.details?.instanceCount || 'Not Available'}</td></tr>
            <tr><th>Resource Sizing</th><td>${connector.details?.resourceSizing || 'Not Available'}</td></tr>
            <tr><th>System Metrics</th><td>${this.formatMetrics(connector.details?.metrics)}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  },

  generateMultiInstanceConnectorHTML: function(connector) {
    const instances = connector.details.instances;
    const instanceStatuses = connector.details.instanceStatuses;
    const instanceIds = Object.keys(instances);
    
    // Generate shared information section
    const sharedInfoHTML = `
      <div class="connector-details" style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <h4 class="connector-title">${connector.name}</h4>
        
        <!-- Shared Information -->
        <table class="report-table" style="margin-bottom: 0;">
          <tbody>
            <tr><th>Release</th><td>${connector.release}</td></tr>
            <tr><th>Status</th><td>${connector.status}</td></tr>
            <tr><th>Service Details</th><td>${connector.details?.serviceDetails || 'Not Available'}</td></tr>
            <tr><th>Controller Details</th><td>${this.formatControllerDetails(connector.details?.controllerDetails)}</td></tr>
            <tr><th>Instance Count</th><td>${connector.details?.instanceCount || 'Not Available'}</td></tr>
          </tbody>
        </table>
        
        <!-- Instance-Specific Information -->
        <div class="instances-container" style="display: flex; gap: 15px; margin-top: 0; flex-wrap: wrap;">
          ${instanceIds.map(instanceId => this.generateInstanceHTML(instanceId, instances[instanceId], instanceStatuses)).join('')}
        </div>
      </div>
    `;
    
    return sharedInfoHTML;
  },

  generateInstanceHTML: function(instanceId, instanceData, instanceStatuses) {
    const resourceSizing = this.calculateResourceSizing(instanceData.metrics);
    
    // Determine status for header
    let statusText = 'Active'; // Default to Active
    if (instanceStatuses && instanceStatuses[instanceId]) {
      const extractedStatus = instanceStatuses[instanceId].toLowerCase();
      if (extractedStatus.includes('down') || extractedStatus.includes('inactive')) {
        statusText = 'Inactive';
      } else if (extractedStatus.includes('up') || extractedStatus.includes('active')) {
        statusText = 'Active';
      }
    } else if (!instanceData.isActive) {
      statusText = 'Inactive';
    }
    
    return `
      <div class="instance-details" style="flex: 1; min-width: 300px;">
        <table class="report-table" style="margin-bottom: 0; margin-top: 0;">
          <thead>
            <tr style="background-color: #E8F2F7 !important; color: #1C3D59 !important;">
              <th colspan="2" style="text-align: center; font-size: 0.95em; padding: 8px; background-color: #E8F2F7 !important; color: #1C3D59 !important;">Instance: ${instanceId} (${statusText})</th>
            </tr>
          </thead>
          <tbody>
            <tr><th>Resource Sizing</th><td>${resourceSizing}</td></tr>
            <tr><th>System Metrics</th><td>${this.formatMetrics(instanceData.metrics)}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  },

  calculateResourceSizing: function(metrics) {
    if (!metrics || typeof metrics !== 'object') {
      return 'Not Available';
    }

    // Look for memory percentage usage to calculate sizing
    const memoryPercentageKey = Object.keys(metrics).find(key => 
      key.toLowerCase().includes('memory') && key.toLowerCase().includes('percentage')
    );
    
    const memoryUsageKey = Object.keys(metrics).find(key => 
      key.toLowerCase().includes('memory') && key.toLowerCase().includes('usage') && !key.toLowerCase().includes('percentage')
    );

    if (memoryPercentageKey && memoryUsageKey) {
      const memoryPercentage = parseFloat(metrics[memoryPercentageKey]);
      const memoryUsage = parseFloat(metrics[memoryUsageKey]);
      
      if (!isNaN(memoryPercentage) && !isNaN(memoryUsage) && memoryPercentage > 0) {
        // Calculate total memory: usage / (percentage / 100)
        const totalMemoryMB = memoryUsage / (memoryPercentage / 100);
        const totalMemoryGB = totalMemoryMB / 1024;
        
        // Determine sizing tier
        let tier = 'Custom';
        if (totalMemoryGB <= 4.5) {
          tier = 'Standard';
        } else if (totalMemoryGB <= 8.5) {
          tier = 'Large';
        } else if (totalMemoryGB <= 16.5) {
          tier = 'Extra Large';
        }
        
        return `${tier} (${totalMemoryGB.toFixed(2)} GB calculated)`;
      }
    }
    
    return 'Unable to calculate';
  },
  
  processData: function(rawData) {
    if (!rawData) {
      return {
        totalConnectors: 'Not Available',
        activeConnectors: 'Not Available',
        inactiveConnectors: 'Not Available',
        services: [],
        releaseBreakdown: {},
        activeConnectorDetails: []
      };
    }
    
    // Extract only connector-specific information
    const services = [];
    let totalConnectors = rawData['Number of Connectors'] || 'Not Available';
    let activeConnectors = rawData['Active Connectors'] || 'Not Available';
    let degradedConnectors = rawData['Degraded Connectors'] || '0';
    let inactiveConnectors = rawData['Inactive Connectors'] || 'Not Available';
    
    // Only include data that is specifically about connector services
    const connectorServiceKeys = [
      'Hotspot Enabled',
      'Location Enabled', 
      'Iot Services Enabled',
      'Iot Wired Enabled'
    ];
    
    connectorServiceKeys.forEach(key => {
      if (rawData[key] !== undefined) {
        services.push({
          name: key,
          status: rawData[key]
        });
      }
    });

    // Extract release breakdown data
    const releaseBreakdown = rawData['Release Breakdown'] || {};

    // Extract active connector details
    const activeConnectorDetails = rawData['Active Connector Details'] || [];
    
    return {
      totalConnectors: totalConnectors,
      activeConnectors: activeConnectors,
      degradedConnectors: degradedConnectors,
      inactiveConnectors: inactiveConnectors,
      services: services,
      releaseBreakdown: releaseBreakdown,
      activeConnectorDetails: activeConnectorDetails
    };
  },
  
  hasData: function(data) {
    if (!data) return false;
    const processedData = this.processData(data);
    return processedData.totalConnectors !== 'Not Available' || 
           processedData.activeConnectors !== 'Not Available' ||
           processedData.inactiveConnectors !== 'Not Available' ||
           processedData.services.length > 0 ||
           Object.keys(processedData.releaseBreakdown).length > 0 ||
           processedData.activeConnectorDetails.length > 0;
  }
};
