const INTEGRATIONS_PATH = '/integrations';

globalThis.getIntegrationsLinkSelectors = function() {
  return [
    'mat-nav-list a[mat-list-item]:has(span.nav-label:contains("Integrations"))',
    'a[mat-list-item]:has(.nav-label:contains("Integrations"))',
    'span.nav-label:contains("Integrations")',
    'img[src*="integrations-icon-plug"]',
    '.magnetic-side-nav-main-item-sel:has(.nav-label:contains("Integrations"))',
  ];
}

class IntegrationsChecker {
  constructor(baseDomain) {
    console.log('=== INTEGRATIONS CHECKER CONSTRUCTOR ===');
    console.log('IntegrationsChecker constructor called with baseDomain:', baseDomain);
    console.log('Current URL at construction:', window.location.href);
    this.baseDomain = baseDomain;
    this.navigationController = new window.NavigationController(baseDomain);
    console.log('IntegrationsChecker constructor completed');
  }

  async checkIntegrations() {
    try {
      console.log('=== INTEGRATIONS CHECKER START ===');
      console.log('Current URL:', window.location.href);
      
      globalThis.updateProgressMessage('Starting integrations check...');
      
      const onIntegrationsPage = window.location.pathname.includes(INTEGRATIONS_PATH);
      console.log('Already on integrations page?', onIntegrationsPage);

      if (!onIntegrationsPage) {
        globalThis.updateProgressMessage('Navigating to integrations page...');
        console.log('Not on integrations page, attempting navigation...');
        
        try {
          const navResult = await this.navigationController.navigateToPath(
            INTEGRATIONS_PATH,
            { 
              label: 'Integrations'
            }
          );
          
          if (!navResult) {
            console.log('Failed to navigate to integrations page');
            globalThis.updateProgressMessage('Failed to navigate to integrations page');
            return this.getDefaultIntegrationsData('Navigation failed');
          }
          
          console.log('Successfully navigated to integrations page');
          globalThis.updateProgressMessage('Successfully navigated to integrations page');
        } catch (navError) {
          console.log('Navigation error:', navError);
          globalThis.updateProgressMessage('Failed to navigate to integrations page');
          return this.getDefaultIntegrationsData('Navigation failed: ' + navError.message);
        }
      }

      globalThis.updateProgressMessage('Loading integrations page content...');
      
      // Wait for the main content area to load
      const contentArea = await window.waitForElement('.integrations-base-container', window.TIMEOUTS.ELEMENT_WAIT);
      if (!contentArea) {
        console.log('Main content area not found on integrations page');
        globalThis.updateProgressMessage('Main content area not found on integrations page');
        return this.getDefaultIntegrationsData('Content area not found');
      }

      await window.sleep(window.TIMEOUTS.MEDIUM);
      
      globalThis.updateProgressMessage('Extracting integration information...');
      
      // Extract integration data
      const integrationsData = await this.extractIntegrationsData();
      
      console.log('Integrations extraction completed:', integrationsData);
      globalThis.updateProgressMessage('Integration information extraction complete');
      return integrationsData;

    } catch (error) {
      console.error('Integrations check failed:', error);
      globalThis.updateProgressMessage(`Error during integrations check: ${error.message}`);
      return this.getDefaultIntegrationsData(`Error: ${error.message}`);
    }
  }

  async extractIntegrationsData() {
    console.log('Starting integrations data extraction...');
    
    const data = {};
    
    try {
      // Look for the main integrations wrapper
      globalThis.updateProgressMessage('Scanning for configured integrations...');
      
      const integrationsWrapper = document.querySelector('.integrations-base-wrapper');
      if (!integrationsWrapper) {
        console.log('Integrations wrapper not found');
        data['Total Integrations Found'] = 0;
        return data;
      }

      // Find all integration cards in the "My Integrations" section
      const integrationCards = integrationsWrapper.querySelectorAll('li.integrations-base-card');
      data['Total Integrations Found'] = integrationCards.length;
      console.log(`Found ${integrationCards.length} integration cards`);

      // Collect active integration names (those with success indicators)
      const activeIntegrationElements = integrationsWrapper.querySelectorAll('li.integrations-base-card:has(.integration-calendar-logo-success)');
      const activeIntegrationNames = [];
      activeIntegrationElements.forEach(card => {
        const nameElement = card.querySelector('.integrations-base-card-desc');
        if (nameElement) {
          activeIntegrationNames.push(nameElement.textContent.trim());
        }
      });
      data['Active Integrations'] = activeIntegrationNames.length > 0 ? activeIntegrationNames.join(', ') : 'None';
      console.log(`Active integrations: ${data['Active Integrations']}`);

      // Extract details from each integration card
      const integrationDetails = [];
      const configuredIntegrationNames = [];
      
      for (let i = 0; i < integrationCards.length; i++) {
        const card = integrationCards[i];
        
        try {
          // Get integration name from the specific div
          const nameElement = card.querySelector('.integrations-base-card-desc');
          console.log(`Card ${i}: nameElement found:`, nameElement);
          console.log(`Card ${i}: nameElement textContent:`, nameElement ? nameElement.textContent : 'null');
          
          const name = nameElement ? nameElement.textContent.trim() : `Integration ${i + 1}`;
          console.log(`Card ${i}: Extracted integration name: "${name}"`);
          
          // Get connection status
          const statusElement = card.querySelector('.connection-status');
          const status = statusElement ? statusElement.textContent.trim() : 'Unknown status';
          console.log(`Card ${i}: Connection status: "${status}"`);
          
          // Check if it has success indicator
          const hasSuccessIcon = card.querySelector('.integration-calendar-logo-success') !== null;
          console.log(`Card ${i}: Has success icon:`, hasSuccessIcon);
          
          // Check if it's configured (has instances or is active)
          const isConfigured = status.includes('configured') || status.includes('instances') || hasSuccessIcon;
          if (isConfigured) {
            configuredIntegrationNames.push(name);
          }
          
          console.log(`Processing integration: ${name}, Status: ${status}, Active: ${hasSuccessIcon}, Configured: ${isConfigured}`);
          
          // Store the integration info
          const integrationInfo = {
            name: name,
            status: status,
            active: hasSuccessIcon,
            configured: isConfigured,
            details: null
          };
          
          integrationDetails.push(integrationInfo);

          // Click on Manage link to get more details
          globalThis.updateProgressMessage(`Getting details for ${name}...`);
          const manageDetails = await this.getIntegrationDetails(card, name);
          if (manageDetails) {
            integrationDetails[integrationDetails.length - 1].details = manageDetails;
          }
          
        } catch (error) {
          console.error(`Error processing integration card ${i}:`, error);
        }
      }

      // Store integration details
      data['Integration Details'] = integrationDetails;
      
      // Store configured integration names instead of count
      data['Configured Integrations'] = configuredIntegrationNames.length > 0 ? configuredIntegrationNames.join(', ') : 'None';
      console.log(`Configured integrations: ${data['Configured Integrations']}`);

      // Look for any error indicators
      const errorElements = integrationsWrapper.querySelectorAll('.error, .warning, [class*="error"], [class*="warning"]');
      data['Integrations with Errors'] = errorElements.length;

    } catch (error) {
      console.error('Error extracting integrations data:', error);
      data['Extraction Error'] = error.message;
    }

    return data;
  }

  async getIntegrationDetails(card, integrationName) {
    try {
      // Find and click the Manage link
      const manageLink = card.querySelector('.knowmorelink');
      if (!manageLink || manageLink.textContent.trim() !== 'Manage') {
        console.log(`No Manage link found for ${integrationName}`);
        return null;
      }

      console.log(`Clicking Manage for ${integrationName}...`);
      manageLink.click();

      // Wait for navigation or modal to load
      await window.sleep(window.TIMEOUTS.MEDIUM);

      // Try to detect if we're on a details page or if a modal opened
      let detailsContainer = await window.waitForElement(
        '.integration-list, .integration-details, .modal-content, .dialog-content, .details-panel, .config-panel',
        window.TIMEOUTS.ELEMENT_WAIT
      );

      if (!detailsContainer) {
        console.log(`No details container found for ${integrationName}`);
        // Go back if we navigated away
        if (window.location.pathname !== INTEGRATIONS_PATH) {
          window.history.back();
          await window.sleep(window.TIMEOUTS.MEDIUM);
        }
        return null;
      }

      console.log(`Details container found for ${integrationName}:`, detailsContainer);
      console.log(`Container class: ${detailsContainer.className}`);
      console.log(`Container tag: ${detailsContainer.tagName}`);

      // Check if we need to wait longer for the integration list to load
      if (!detailsContainer.querySelector('.integration-list')) {
        console.log('Waiting additional time for integration list to load...');
        await window.sleep(window.TIMEOUTS.MEDIUM);
        
        // Check again
        const integrationList = document.querySelector('.integration-list');
        if (integrationList) {
          console.log('Found integration list after additional wait');
          // Use the integration list as the container
          detailsContainer = integrationList.closest('div') || integrationList;
        }
      }

      // Extract details from the opened view
      const details = this.extractDetailedIntegrationInfo(detailsContainer, integrationName);

      // Close modal or go back
      const closeButton = detailsContainer.querySelector('.close, .cancel, [mat-dialog-close], .back-button');
      if (closeButton) {
        closeButton.click();
        await window.sleep(window.TIMEOUTS.SHORT);
      } else if (window.location.pathname !== INTEGRATIONS_PATH) {
        window.history.back();
        await window.sleep(window.TIMEOUTS.MEDIUM);
      }

      return details;

    } catch (error) {
      console.error(`Error getting details for ${integrationName}:`, error);
      return null;
    }
  }

  extractDetailedIntegrationInfo(container, integrationName) {
    const details = {
      name: integrationName,
      configuration: {},
      status: 'Unknown',
      instances: {
        total: 0,
        active: 0,
        expired: 0,
        deactivated: 0
      }
    };

    try {
      console.log(`Starting extraction for ${integrationName}`);
      console.log('Container element:', container);
      console.log('Container classes:', container.className);
      console.log('Container innerHTML (first 500 chars):', container.innerHTML.substring(0, 500));
      
      // The container itself is the integration list, or look for one inside it
      let integrationList = container;
      if (!container.classList.contains('integration-list')) {
        integrationList = container.querySelector('.integration-list');
      }
      
      console.log('Integration list found:', !!integrationList);
      
      if (integrationList) {
        console.log(`Found integration list for ${integrationName}`);
        
        // Count all integration activation boxes
        const activationBoxes = integrationList.querySelectorAll('.integration-activation');
        details.instances.total = activationBoxes.length;
        console.log(`Total instances found: ${details.instances.total}`);
        
        // Count by activation status
        activationBoxes.forEach((box, index) => {
          const statusElement = box.querySelector('.activation-status');
          if (statusElement) {
            const statusText = statusElement.textContent.trim().toLowerCase();
            console.log(`Instance ${index + 1} status: ${statusText}`);
            
            if (statusText.includes('active')) {
              details.instances.active++;
            } else if (statusText.includes('expired')) {
              details.instances.expired++;
            } else if (statusText.includes('deactivated')) {
              details.instances.deactivated++;
            }
          } else {
            console.log(`Instance ${index + 1}: No status element found`);
          }
          
          // Get instance name for logging
          const nameElement = box.querySelector('.activation-name');
          if (nameElement) {
            console.log(`Instance ${index + 1} name: ${nameElement.textContent.trim()}`);
          }
        });
        
        console.log(`Instance counts for ${integrationName}:`, details.instances);
        
        // Set overall status based on instances
        if (details.instances.active > 0) {
          details.status = `${details.instances.active} Active, ${details.instances.expired} Expired, ${details.instances.deactivated} Deactivated`;
        } else if (details.instances.total > 0) {
          details.status = `${details.instances.total} Instances (No Active)`;
        } else {
          details.status = 'No Instances';
        }
      } else {
        console.log(`No integration list found for ${integrationName}`);
        console.log('Available elements in container:');
        const allElements = container.querySelectorAll('*');
        for (let i = 0; i < Math.min(10, allElements.length); i++) {
          console.log(`  ${i}: ${allElements[i].tagName}.${allElements[i].className}`);
        }
      }

      // Look for additional configuration details as fallback
      const configElements = container.querySelectorAll('.config-item, .setting-item, .parameter-item');
      configElements.forEach(element => {
        const label = element.querySelector('.label, .name, .key');
        const value = element.querySelector('.value, .setting-value');
        
        if (label && value) {
          details.configuration[label.textContent.trim()] = value.textContent.trim();
        }
      });

      // Look for general status information as fallback
      if (details.status === 'Unknown') {
        const statusElement = container.querySelector('.status, .connection-status, .health-status');
        if (statusElement) {
          details.status = statusElement.textContent.trim();
        }
      }

      console.log(`Extracted details for ${integrationName}:`, details);

    } catch (error) {
      console.error(`Error extracting details for ${integrationName}:`, error);
    }

    return details;
  }

  getDefaultIntegrationsData(reason) {
    console.log('Returning default integrations data, reason:', reason);
    return {
      'Total Integrations Found': `Not available (${reason})`,
      'Active Integrations': `Not available (${reason})`,
      'Configured Integrations': `Not available (${reason})`,
      'Integrations with Errors': `Not available (${reason})`
    };
  }
}

globalThis.IntegrationsChecker = IntegrationsChecker;

// Report module for generating integrations section in reports
globalThis.IntegrationsChecker.reportModule = {
  generateHTML: function(data) {
    const integrationsData = this.processData(data);
    
    let integrationsHTML = '';
    if (integrationsData.integrations && integrationsData.integrations.length > 0) {
      integrationsHTML = `
        <div class="subsection">
          <h3 class="subsection-title">Integration Details</h3>
          ${integrationsData.integrations.map(integration => {
            let tableHTML = '';
            
            // Add instance information if available
            if (integration.details && integration.details.instances) {
              const instances = integration.details.instances;
              tableHTML = `
                <h4 class="integration-title">${integration.name}</h4>
                <table class="report-table">
                  <tbody>
                    <tr><th>Instances</th><td>${instances.total}</td></tr>
                    <tr><th>Active</th><td>${instances.active}</td></tr>
                    <tr><th>Expired</th><td>${instances.expired}</td></tr>
                    <tr><th>Deactivated</th><td>${instances.deactivated}</td></tr>
                  </tbody>
                </table>
              `;
            } else {
              // Fallback if no detailed instance data
              tableHTML = `
                <h4 class="integration-title">${integration.name}</h4>
                <table class="report-table">
                  <tbody>
                    <tr><th>Status</th><td>${integration.configured}</td></tr>
                  </tbody>
                </table>
              `;
            }
            
            return tableHTML;
          }).join('')}
        </div>
      `;
    }
    
    return `
      <div class="section" id="integrations-section">
        <h2 class="section-title">Integrations</h2>
        <table class="report-table">
          <tbody>
            <tr>
              <th>Total Integrations Found</th>
              <td>${integrationsData.totalIntegrations}</td>
            </tr>
            <tr>
              <th>Configured Integrations</th>
              <td>${integrationsData.configuredIntegrations}</td>
            </tr>
            <tr>
              <th>Active Integrations</th>
              <td>${integrationsData.activeIntegrations}</td>
            </tr>
            <tr>
              <th>Integrations with Errors</th>
              <td>${integrationsData.integrationsWithErrors}</td>
            </tr>
          </tbody>
        </table>
        ${integrationsHTML}
      </div>
    `;
  },
  
  processData: function(rawData) {
    if (!rawData) {
      return {
        totalIntegrations: 'Not Available',
        activeIntegrations: 'Not Available',
        configuredIntegrations: 'Not Available',
        integrationsWithErrors: 'Not Available',
        integrations: []
      };
    }
    
    // Extract the main summary data
    let totalIntegrations = rawData['Total Integrations Found'] || 'Not Available';
    let activeIntegrations = rawData['Active Integrations'] || 'Not Available';
    let configuredIntegrations = rawData['Configured Integrations'] || 'Not Available';
    let integrationsWithErrors = rawData['Integrations with Errors'] || 'Not Available';
    
    // Process only the Integration Details array for individual integrations
    const integrations = [];
    if (rawData['Integration Details'] && Array.isArray(rawData['Integration Details'])) {
      rawData['Integration Details'].forEach(integration => {
        integrations.push({
          name: integration.name || 'Unknown Integration',
          status: integration.status || 'Unknown',
          type: 'Integration',
          configured: integration.active ? 'Active' : (integration.status || 'Inactive'),
          details: integration.details || null
        });
      });
    }
    
    return {
      totalIntegrations: totalIntegrations,
      activeIntegrations: activeIntegrations,
      configuredIntegrations: configuredIntegrations,
      integrationsWithErrors: integrationsWithErrors,
      integrations: integrations
    };
  },
  
  hasData: function(data) {
    if (!data) return false;
    const processedData = this.processData(data);
    return processedData.totalIntegrations !== 'Not Available' || 
           processedData.activeIntegrations !== 'Not Available' ||
           processedData.configuredIntegrations !== 'Not Available' ||
           processedData.integrations.length > 0;
  }
};
