const WIRELESS_NETWORK_PATH = '/setup/wirelessnetwork';

globalThis.getWirelessLinkSelectors = function() {
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

class WirelessChecker {
  constructor(baseDomain) {
    this.baseDomain = baseDomain;
    this.navigationController = new window.NavigationController(baseDomain);
  }

  async checkWirelessNetworks() {
    try {
      console.log('=== WIRELESS NETWORKS CHECKER START ===');
      console.log('Current URL:', window.location.href);
      
      const onWirelessPage = window.location.pathname.includes(WIRELESS_NETWORK_PATH);
      console.log('Already on wireless page?', onWirelessPage);

      if (!onWirelessPage) {
        console.log('Navigating to wireless networks page...');
        globalThis.updateProgressMessage('Navigating to wireless networks setup...');
        
        try {
          await this.navigationController.navigateToPath(
            WIRELESS_NETWORK_PATH,
            { 
              label: 'Wireless Networks',
              section: 'Setup'
            },
            null,
            globalThis.getWirelessLinkSelectors
          );
          console.log('Navigation to wireless page completed');
        } catch (error) {
          console.error('Navigation to wireless page failed:', error);
          return {
            'Wireless Setup': 'Error: Could not navigate to wireless setup page'
          };
        }
      }

      console.log('Waiting for page content to load...');
      globalThis.updateProgressMessage('Loading wireless setup configuration...');
      
      const pageReady = await window.waitForElement('.setup-container, .wireless-networks, .step_content, accordion', window.TIMEOUTS.LONG);
      
      if (!pageReady) {
        console.log('Page content not found');
        return {
          'Wireless Setup': 'Error: Page content not found'
        };
      }
      
      console.log('Page loaded, extracting connector information...');
      globalThis.updateProgressMessage('Extracting wireless connector information...');
      
      const connectorData = await this.extractConnectorInformation();
      
      console.log('Connector information extraction completed');
      globalThis.updateProgressMessage('Processing wireless results...');
      
      // Format the results for the report
      const results = {};
      
      // Add summary based on extraction results
      const connectorCount = Object.keys(connectorData).length;
      const errorCount = Object.values(connectorData).filter(data => data.error).length;
      const successCount = connectorCount - errorCount;
      
      if (connectorCount === 0) {
        results['Wireless Setup'] = 'No connectors found on this system';
      } else {
        results['Wireless Setup'] = `${successCount} of ${connectorCount} connector${connectorCount > 1 ? 's' : ''} processed successfully`;
      }
      
      Object.entries(connectorData).forEach(([connectorType, data]) => {
        if (data.error) {
          results[`${connectorType} Status`] = `Error: ${data.error}`;
        } else {
          Object.entries(data).forEach(([key, value]) => {
            results[`${connectorType} - ${key}`] = value;
          });
        }
      });
      
      console.log('=== WIRELESS NETWORKS CHECKER COMPLETE ===');
      console.log('Final results:', results);
      
      // Small delay to ensure all UI updates are processed
      await window.sleep(500);
      
      return results;

    } catch (error) {
      console.error('Error in wireless networks checker:', error);
      return {
        'Wireless Setup': `Error: ${error.message}`
      };
    }
  }

  async extractConnectorInformation() {
    console.log('=== EXTRACTING CONNECTOR INFORMATION ===');
    
    const connectorData = {};
    
    // Find all accordion toggle elements
    const accordionToggles = document.querySelectorAll('accordion-toggle');
    console.log(`Found ${accordionToggles.length} connector boxes`);
    
    if (accordionToggles.length === 0) {
      console.log('No accordion toggles found, checking for alternative selectors...');
      return { 'No Connectors': { error: 'No connector boxes found on page' } };
    }
    
    for (let i = 0; i < accordionToggles.length; i++) {
      const toggle = accordionToggles[i];
      const headerText = toggle.querySelector('.tile_header')?.textContent?.trim() || `Box ${i + 1}`;
      
      console.log(`\n=== PROCESSING: ${headerText} (${i + 1}/${accordionToggles.length}) ===`);
      globalThis.updateProgressMessage(`Processing connector ${i + 1}/${accordionToggles.length}: ${headerText}...`);
      
      try {
        // Check if this accordion is already expanded
        const parentGroup = toggle.closest('accordion-group');
        let expandedPanel = parentGroup?.querySelector('.panel-collapse.in, .panel-collapse.show, .collapse.in, .collapse.show');
        
        if (!expandedPanel) {
          // Not expanded, so click to expand this box (will close others)
          console.log(`Expanding: ${headerText}`);
          toggle.click();
          
          // Wait for content to load
          await window.sleep(1500);
          
          // Re-find the expanded content panel after clicking
          expandedPanel = parentGroup?.querySelector('.panel-collapse.in, .panel-collapse.show, .collapse.in, .collapse.show');
        } else {
          console.log(`${headerText} is already expanded, skipping click`);
        }
        
        if (!expandedPanel) {
          console.log(`❌ No expanded content found for: ${headerText}`);
          connectorData[headerText] = { error: 'Content panel not found' };
          continue;
        }
        
        console.log(`✅ Found expanded content for: ${headerText}`);
        globalThis.updateProgressMessage(`Extracting data from ${headerText}...`);
        
        // Determine the connector label for output
        let connectorLabel = headerText; // Default to original header text
        
        if (headerText.includes('AireOS') || headerText.includes('Catalyst 9800')) {
          connectorLabel = 'Direct Connect';
        } else if (headerText.includes('Spaces Connector')) {
          connectorLabel = 'Spaces Connector';
        } else if (headerText.includes('CMX')) {
          connectorLabel = 'CMX Tethering';
        } else if (headerText.includes('Meraki')) {
          connectorLabel = 'Meraki';
        }
        
        // Extract data based on connector type
        let extractedData = {};
        
        if (headerText.includes('AireOS') || headerText.includes('Catalyst 9800')) {
          extractedData = this.extractAireOSData(expandedPanel);
        } else if (headerText.includes('Spaces Connector')) {
          extractedData = this.extractSpacesConnectorData(expandedPanel);
        } else if (headerText.includes('CMX')) {
          extractedData = this.extractCMXData(expandedPanel);
        } else if (headerText.includes('Meraki')) {
          extractedData = this.extractMerakiData(expandedPanel);
        } else {
          extractedData = this.extractGenericData(expandedPanel);
        }
        
        connectorData[connectorLabel] = extractedData;
        
        console.log(`✅ Extracted data for ${connectorLabel}:`, extractedData);
        globalThis.updateProgressMessage(`Completed processing ${connectorLabel}`);
        
      } catch (error) {
        console.error(`❌ Error processing ${headerText}:`, error);
        
        // Determine the connector label for error output
        let connectorLabel = headerText;
        if (headerText.includes('AireOS') || headerText.includes('Catalyst 9800')) {
          connectorLabel = 'Direct Connect';
        } else if (headerText.includes('Spaces Connector')) {
          connectorLabel = 'Spaces Connector';
        } else if (headerText.includes('CMX')) {
          connectorLabel = 'CMX Tethering';
        } else if (headerText.includes('Meraki')) {
          connectorLabel = 'Meraki';
        }
        
        connectorData[connectorLabel] = { error: error.message };
        globalThis.updateProgressMessage(`Error processing ${connectorLabel}: ${error.message}`);
      }
    }
    
    console.log('\n=== EXTRACTION COMPLETE ===');
    console.log('Final connector data:', connectorData);
    globalThis.updateProgressMessage('Wireless configuration analysis complete');
    
    return connectorData;
  }

  extractAireOSData(panel) {
    const data = {};
    
    // Step 2 - Total controllers
    const totalControllers = panel.querySelector('.box-info .count')?.textContent?.trim();
    if (totalControllers) {
      data['Total Controllers'] = totalControllers;
    }
    
    // Step 3 - Buildings and floors imported
    const boxInfos = panel.querySelectorAll('.box-info');
    boxInfos.forEach(info => {
      const count = info.querySelector('.count')?.textContent?.trim();
      const helper = info.querySelector('.helperText')?.textContent?.trim();
      
      if (count && helper) {
        if (helper.includes('buildings')) {
          data['Buildings Imported'] = count;
        } else if (helper.includes('floors')) {
          data['Floors Imported'] = count;
        }
      }
    });
    
    // Step 4 - Controllers in location hierarchy
    const hierarchyInfo = Array.from(panel.querySelectorAll('.box-info')).find(info => 
      info.querySelector('.helperText')?.textContent?.includes('location hierarchy')
    );
    if (hierarchyInfo) {
      const count = hierarchyInfo.querySelector('.count')?.textContent?.trim();
      data['Controllers in Location Hierarchy'] = count;
    }
    
    return data;
  }

  extractSpacesConnectorData(panel) {
    const data = {};
    
    // Step 2 - Active connectors (format: "2 / 16")
    const connectorInfo = Array.from(panel.querySelectorAll('.box-info')).find(info => 
      info.querySelector('.helperText')?.textContent?.includes('connector(s) active')
    );
    if (connectorInfo) {
      const count = connectorInfo.querySelector('.count')?.textContent?.trim();
      data['Active Connectors'] = count;
    }
    
    // Step 3 - Active controllers (format: "1 / 2")
    const controllerInfo = Array.from(panel.querySelectorAll('.box-info')).find(info => 
      info.querySelector('.helperText')?.textContent?.includes('controller(s) active')
    );
    if (controllerInfo) {
      const count = controllerInfo.querySelector('.count')?.textContent?.trim();
      data['Active Controllers'] = count;
    }
    
    // Step 4 - Buildings and floors imported
    const boxInfos = panel.querySelectorAll('.box-info');
    boxInfos.forEach(info => {
      const count = info.querySelector('.count')?.textContent?.trim();
      const helper = info.querySelector('.helperText')?.textContent?.trim();
      
      if (count && helper) {
        if (helper.includes('buildings')) {
          data['Buildings Imported'] = count;
        } else if (helper.includes('floors')) {
          data['Floors Imported'] = count;
        }
      }
    });
    
    // Step 5 - Controllers in location hierarchy
    const hierarchyInfo = Array.from(panel.querySelectorAll('.box-info')).find(info => 
      info.querySelector('.helperText')?.textContent?.includes('location hierarchy')
    );
    if (hierarchyInfo) {
      const count = hierarchyInfo.querySelector('.count')?.textContent?.trim();
      data['Controllers in Location Hierarchy'] = count;
    }
    
    return data;
  }

  extractCMXData(panel) {
    const data = {};
    
    // Step 2 - Tokens added
    const tokenInfo = Array.from(panel.querySelectorAll('.box-info')).find(info => 
      info.querySelector('.helperText')?.textContent?.includes('token(s) added')
    );
    if (tokenInfo) {
      const count = tokenInfo.querySelector('.count')?.textContent?.trim();
      data['Tokens Added'] = count;
    }
    
    // Step 3 - Campuses in location hierarchy
    const campusInfo = Array.from(panel.querySelectorAll('.box-info')).find(info => 
      info.querySelector('.helperText')?.textContent?.includes('Campus(es) imported')
    );
    if (campusInfo) {
      const count = campusInfo.querySelector('.count')?.textContent?.trim();
      data['Campuses in Location Hierarchy'] = count;
    }
    
    return data;
  }

  extractMerakiData(panel) {
    const data = {};
    
    // Step 1 - Meraki synchronization status
    const syncStatus = panel.querySelector('.meraki-status')?.textContent?.trim();
    if (syncStatus) {
      data['Meraki Synchronization'] = syncStatus;
    }
    
    // Other logins syncing count
    const syncCountText = panel.querySelector('.sync-count')?.textContent?.trim();
    if (syncCountText) {
      const match = syncCountText.match(/(\d+)\s+other/);
      if (match) {
        data['Other Logins Syncing'] = match[1];
      }
    }
    
    // Your login connection status
    const loginStatus = panel.querySelector('.merakiUserAccount-error')?.textContent?.trim();
    if (loginStatus) {
      data['Your Login Status'] = loginStatus.includes('not connected') ? 'Not Connected' : 'Connected';
    }
    
    // Step 2 - Networks configured
    const networksConfigured = Array.from(panel.querySelectorAll('.count')).find(count => 
      count.parentElement?.textContent?.includes('networks configured')
    );
    if (networksConfigured) {
      data['Networks Configured'] = networksConfigured.textContent?.trim();
    }
    
    // Step 3 - Networks imported
    const networksImported = Array.from(panel.querySelectorAll('.box-info')).find(info => 
      info.querySelector('.helperText')?.textContent?.includes('networks imported')
    );
    if (networksImported) {
      const count = networksImported.querySelector('.count')?.textContent?.trim();
      data['Networks Imported'] = count;
    }
    
    return data;
  }

  extractGenericData(panel) {
    const data = {};
    
    // Extract any box-info elements with counts and helper text
    const boxInfos = panel.querySelectorAll('.box-info');
    boxInfos.forEach((info, index) => {
      const count = info.querySelector('.count')?.textContent?.trim();
      const helper = info.querySelector('.helperText')?.textContent?.trim();
      
      if (count && helper) {
        data[helper] = count;
      } else if (count) {
        data[`Count ${index + 1}`] = count;
      }
    });
    
    // If no box-info found, look for any elements with 'count' class
    if (Object.keys(data).length === 0) {
      const counts = panel.querySelectorAll('.count');
      counts.forEach((count, index) => {
        const text = count.textContent?.trim();
        if (text) {
          data[`Value ${index + 1}`] = text;
        }
      });
    }
    
    return data;
  }
}

globalThis.WirelessChecker = WirelessChecker;

// Report module for generating wireless networks section in reports
globalThis.WirelessChecker.reportModule = {
  generateHTML: function(data) {
    const wirelessData = this.processData(data);
    
    let connectorsHTML = '';
    if (wirelessData.connectorTypes && wirelessData.connectorTypes.length > 0) {
      connectorsHTML = wirelessData.connectorTypes.map(connectorType => `
        <div class="subsection">
          <h3 class="subsection-title">${connectorType.name}</h3>
          <table class="report-table">
            <tbody>
              ${connectorType.details.map(detail => `
                <tr>
                  <th>${detail.key}</th>
                  <td>${detail.value}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('');
    }
    
    return `
      <div class="section" id="wireless-section">
        <h2 class="section-title">Wireless Infrastructure</h2>
        <div class="subsection">
          <h3 class="subsection-title">Setup Status</h3>
          <table class="report-table">
            <tbody>
              <tr>
                <th>Wireless Setup</th>
                <td>${wirelessData.setupStatus}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${connectorsHTML}
      </div>
    `;
  },
  
  processData: function(rawData) {
    if (!rawData) {
      return {
        setupStatus: 'Not Available',
        connectorTypes: []
      };
    }
    
    const connectorTypes = [];
    let setupStatus = rawData['Wireless Setup'] || 'Not Available';
    
    // Known connector types from the original system
    const knownConnectors = ['Direct Connect', 'Spaces Connector', 'CMX Tethering', 'Meraki'];
    
    knownConnectors.forEach(connectorName => {
      const connectorData = [];
      
      // Find all keys related to this connector
      Object.keys(rawData).forEach(key => {
        if (key.startsWith(`${connectorName} - `)) {
          const displayKey = key.replace(`${connectorName} - `, '');
          connectorData.push({
            key: displayKey,
            value: rawData[key]
          });
        }
      });
      
      // Add connector type if it has data
      if (connectorData.length > 0) {
        connectorTypes.push({
          name: connectorName,
          details: connectorData
        });
      }
    });
    
    return {
      setupStatus: setupStatus,
      connectorTypes: connectorTypes
    };
  },
  
  hasData: function(data) {
    if (!data) return false;
    const processedData = this.processData(data);
    return processedData.setupStatus !== 'Not Available' || 
           processedData.connectorTypes.length > 0;
  }
};
