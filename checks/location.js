const LOCATION_PATH = '/location';

globalThis.getLocationLinkSelectors = function() {
  return [
    'a[href*="/location"]',
    'a[mat-list-item]:has(.nav-label:contains("Location Hierarchy"))',
    '.nav-label:contains("Location Hierarchy")',
    'span.nav-label:contains("Location Hierarchy")',
    'img[src*="location-hierarchy"]',
    '.nav-icon:has(img[src*="location-hierarchy"])',
    'mat-nav-list a[mat-list-item] .nav-label:contains("Location Hierarchy")'
  ];
}

class LocationChecker {
  constructor(baseDomain) {
    console.log('=== LOCATION CHECKER CONSTRUCTOR ===');
    console.log('LocationChecker constructor called with baseDomain:', baseDomain);
    console.log('Current URL at construction:', window.location.href);
    this.baseDomain = baseDomain;
    this.navigationController = new window.NavigationController(baseDomain);
    console.log('LocationChecker constructor completed');
  }

  async checkLocationHierarchy() {
    try {
      console.log('Starting checkLocationHierarchy method');
      console.log('Current URL at start:', window.location.href);
      
      const currentPath = window.location.pathname;
      const onLocationPage = currentPath.includes(LOCATION_PATH);
      
      console.log('Already on location page?', onLocationPage);
      
      if (!onLocationPage) {
        console.log('Navigating to location hierarchy...');
        globalThis.updateProgressMessage('Navigating to location hierarchy...');
        
        try {
          console.log('About to call navigateToPath...');
          await this.navigationController.navigateToPath(
            LOCATION_PATH,
            { label: 'Location Hierarchy' },
            null,
            globalThis.getLocationLinkSelectors
          );
          console.log('navigateToPath completed successfully');
        } catch (error) {
          console.error('Navigation error:', error);
          throw error;
        }
        
        console.log('Navigation completed, waiting 5 seconds to see final URL...');
        console.log('Current URL immediately after navigation:', window.location.href);
        
        // Wait 5 seconds to see what URL we actually land on
        await window.sleep(1000);
        
        // Now check what URL we ended up on after the wait
        const finalUrl = window.location.href;
        const finalPath = window.location.pathname;
        console.log('After 5 second wait - Final URL:', finalUrl);
        console.log('After 5 second wait - Final path:', finalPath);
        
        if (finalPath.includes('/hierarchy/business')) {
          console.log('=== BETA UI DETECTED AFTER NAVIGATION ===');
          console.log('Navigation resulted in Beta UI (/hierarchy/business), need to toggle it off');
          globalThis.updateProgressMessage('Detected Beta UI mode after navigation - toggling to standard UI...');
          
          // Toggle the beta UI button
          const toggleSuccess = await window.exitBetaUIMode();
          console.log('Beta UI toggle result:', toggleSuccess);
          
          if (!toggleSuccess) {
            console.log('Failed to toggle beta UI button');
            return { 'Number of Locations': 'Error: Could not toggle beta UI button' };
          }
          
          console.log('Beta UI toggled successfully - waiting for page to update...');
          
          // Wait for the page to update after toggle (it updates the URL but doesn't reload)
          let attempts = 0;
          const maxAttempts = 10; // Wait up to 5 seconds
          
          while (attempts < maxAttempts) {
            await window.sleep(500); // Wait 500 milliseconds between checks
            attempts++;
            
            const currentPath = window.location.pathname;
            const currentUrl = window.location.href;
            console.log(`Attempt ${attempts}: Current URL: ${currentUrl}, Path: ${currentPath}`);
            
            if (currentPath.includes('/location')) {
              console.log('SUCCESS: Page updated to /location after beta UI toggle');
              break;
            }
            
            if (attempts === maxAttempts) {
              console.log('WARNING: Page did not update to /location within timeout');
              return { 'Number of Locations': 'Error: Page did not update to /location after beta UI toggle' };
            }
          }
          
          console.log('Successfully toggled beta UI and reached /location page - proceeding with expansion');
          
        } else if (finalPath.includes('/location')) {
          console.log('=== STANDARD UI CONFIRMED AFTER NAVIGATION ===');
          console.log('Successfully navigated to standard UI (/location), ready to proceed');
        } else {
          console.log('Unexpected URL after navigation and wait:', finalPath);
          return { 'Number of Locations': 'Error: Unexpected URL after navigation - ' + finalPath };
        }
        
      } else {
        console.log('Already on location page, checking if it\'s beta UI...');
        
        // Even if we're "on location page", check if it's actually beta UI
        if (currentPath.includes('/hierarchy/business')) {
          console.log('=== ALREADY ON BETA UI ===');
          console.log('We are already on Beta UI (/hierarchy/business), need to toggle it off');
          globalThis.updateProgressMessage('Already on Beta UI - toggling to standard UI...');
          
          // Toggle the beta UI button
          const toggleSuccess = await window.exitBetaUIMode();
          console.log('Beta UI toggle result:', toggleSuccess);
          
          if (!toggleSuccess) {
            console.log('Failed to toggle beta UI button');
            return { 'Number of Locations': 'Error: Could not toggle beta UI button' };
          }
          
          console.log('Beta UI toggled successfully - waiting for page to update...');
          
          // Wait for the page to update after toggle (it updates the URL but doesn't reload)
          let attempts = 0;
          const maxAttempts = 10; // Wait up to 10 seconds
          
          while (attempts < maxAttempts) {
            await window.sleep(1000); // Wait 1 second between checks
            attempts++;
            
            const currentPath = window.location.pathname;
            const currentUrl = window.location.href;
            console.log(`Attempt ${attempts}: Current URL: ${currentUrl}, Path: ${currentPath}`);
            
            if (currentPath.includes('/location')) {
              console.log('SUCCESS: Page updated to /location after beta UI toggle');
              break;
            }
            
            if (attempts === maxAttempts) {
              console.log('WARNING: Page did not update to /location within timeout');
              return { 'Number of Locations': 'Error: Page did not update to /location after beta UI toggle' };
            }
          }
          
          console.log('Successfully toggled beta UI and reached /location page - proceeding with expansion');
          
        } else {
          console.log('Already on standard location page, proceeding with location expansion');
        }
      }

      // At this point we should be on /location - proceed with location expansion
      console.log('=== PROCEEDING WITH LOCATION EXPANSION ===');
      globalThis.updateProgressMessage('Expanding location hierarchy...');

      window.progressManager.updateProgress(window.progressManager.currentStep, 'Waiting for location hierarchy to load...');
      const locationContent = await window.waitForElement('cdk-virtual-scroll-viewport, .location-hierarchy-container', window.TIMEOUTS.LONG);
      
      if (!locationContent) {
        window.progressManager.updateProgress(window.progressManager.currentStep, 'Location hierarchy content not found');
        return { 'Number of Locations': 'Not found (page content missing)' };
      }
      
      await window.sleep(window.TIMEOUTS.SHORT);

      window.progressManager.updateProgress(window.progressManager.currentStep, 'Starting location tree expansion...');
      const expansionResult = await this.expandAllLocationNodes();

      await window.sleep(window.TIMEOUTS.SHORT);

      const locationData = await Promise.all([
        this.extractLocationCount(),
        this.analyzeLocationTypes()
      ]);

      const locationCounts = locationData[0];
      const locationTypes = locationData[1];

      // Log the location hierarchy tree to console
      if (locationTypes.formattedTree) {
        console.log('\n=== Location Hierarchy Tree ===');
        console.log(locationTypes.formattedTree);
        console.log('=== End Location Hierarchy ===\n');
      }

      // Log additional tree analysis details
      if (locationTypes.treeOutput && locationTypes.treeOutput.length > 0) {
        console.log(`Total tree entries: ${locationTypes.treeOutput.length}`);
        console.log(`Location types found: ${Object.keys(locationTypes.typeBreakdown || {}).join(', ')}`);
      }

      const locationResults = {
        'Number of Locations': locationCounts['Locations'] || 'Not found',
        'Number of Access Points': locationCounts['Access Points'] || 'Not found',
        'Number of BLE Beacons': locationCounts['BLE Beacons'] || 'Not found',
        'Number of Cameras': locationCounts['Cameras'] || 'Not found'
      };

      if (locationTypes.total) {
        locationResults['Location Types Analysis'] = `Found ${locationTypes.total} locations`;
      }

      if (locationTypes.typeBreakdown && Object.keys(locationTypes.typeBreakdown).length > 0) {
        Object.entries(locationTypes.typeBreakdown).forEach(([type, count]) => {
          locationResults[`Location Type: ${type}`] = count;
        });
      }

      if (window.progressManager) {
        const finalMessage = `Location analysis complete - found ${locationTypes.total || 0} locations with ${Object.keys(locationTypes.typeBreakdown || {}).length} different types`;
        window.progressManager.updateProgress(window.progressManager.currentStep, finalMessage);
        // Set to completed after showing the final count
        setTimeout(() => {
          window.progressManager.updateProgress(window.progressManager.currentStep, window.PROGRESS_STATUS.COMPLETED);
        }, 1000);
      }

      // Clear auto-resume attempts counter since we successfully completed
      try {
        await chrome.storage.local.remove(['autoResumeAttempts']);
        console.log('Cleared auto-resume attempts counter after successful completion');
      } catch (error) {
        console.log('Error clearing auto-resume attempts:', error);
      }

      return locationResults;

    } catch (error) {
      return {
        'Number of Locations': `Not found (error: ${error.message})`,
        'Number of Access Points': 'Not found',
        'Number of BLE Beacons': 'Not found',
        'Number of Cameras': 'Not found'
      };
    }
  }

  async waitForAndClickBetaToggle() {
    try {
      console.log('=== BETA UI TOGGLE DEBUG START ===');
      console.log('Looking for beta UI toggle on hierarchy page...');
      console.log('Current URL:', window.location.href);
      console.log('Current pathname:', window.location.pathname);
      
      // First, let's see what elements are available on the page
      console.log('=== SCANNING FOR ALL POSSIBLE BETA ELEMENTS ===');
      
      // Look for any elements containing "beta" in their classes, IDs, or text
      const allElements = document.querySelectorAll('*');
      const betaElements = Array.from(allElements).filter(el => {
        const className = el.className ? el.className.toString().toLowerCase() : '';
        const id = el.id ? el.id.toLowerCase() : '';
        const textContent = el.textContent ? el.textContent.toLowerCase() : '';
        return className.includes('beta') || id.includes('beta') || 
               className.includes('switch') || className.includes('toggle') ||
               textContent.includes('beta') || textContent.includes('new ui');
      });
      
      console.log(`Found ${betaElements.length} elements potentially related to beta/switch/toggle:`);
      betaElements.forEach((el, index) => {
        console.log(`${index + 1}. Tag: ${el.tagName}, Class: "${el.className}", ID: "${el.id}", Text: "${el.textContent?.substring(0, 50)}"`);
      });
      
      // Wait for the beta toggle to appear (it may take a moment after page load)
      const maxWaitTime = 15000; // Increased to 15 seconds
      const pollInterval = 1000; // Check every 1 second for better debugging
      const startTime = Date.now();
      
      let attemptCount = 0;
      while (Date.now() - startTime < maxWaitTime) {
        attemptCount++;
        console.log(`=== ATTEMPT ${attemptCount} ===`);
        
        // Try the proven working selector first - specifically target inner switch to DISABLE beta UI
        const betaSwitchContainer = document.querySelector('.beta-switch');
        const innerSwitchElement = betaSwitchContainer ? betaSwitchContainer.querySelector('.innerblock') : null;
        
        console.log('Checking .beta-switch container:', betaSwitchContainer);
        console.log('Checking .innerblock element:', innerSwitchElement);
        
        if (betaSwitchContainer && innerSwitchElement) {
          console.log('Found beta switch container and inner element');
          console.log('Container classes:', Array.from(betaSwitchContainer.classList));
          console.log('Inner element classes:', Array.from(innerSwitchElement.classList));
          console.log('Inner element position/state:', {
            hasRightClass: innerSwitchElement.classList.contains('switch-right'),
            hasLeftClass: innerSwitchElement.classList.contains('left'),
            allClasses: Array.from(innerSwitchElement.classList)
          });
          
          // Check if beta UI is currently enabled (inner switch should be on the right)
          const betaUICurrentlyEnabled = innerSwitchElement.classList.contains('switch-right') || 
                                       !innerSwitchElement.classList.contains('left');
          
          console.log('Beta UI currently enabled?', betaUICurrentlyEnabled);
          
          if (betaUICurrentlyEnabled) {
            console.log('Beta UI is ON - clicking inner switch to DISABLE it...');
            globalThis.updateProgressMessage('Beta UI is ON - clicking inner switch to disable and switch to standard UI...');
            
            try {
              console.log('Clicking inner switch element to disable beta UI...');
              
              // Try multiple click methods to ensure it works
              innerSwitchElement.click();
              innerSwitchElement.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
              innerSwitchElement.dispatchEvent(new Event('mousedown', { bubbles: true, cancelable: true }));
              innerSwitchElement.dispatchEvent(new Event('mouseup', { bubbles: true, cancelable: true }));
              
              console.log('Click completed - waiting for beta UI to disable...');
              
              // Wait for the UI to respond
              await window.sleep(3000);
              
              // Check if the switch moved to the left position (beta UI disabled)
              const afterClickLeft = innerSwitchElement.classList.contains('left');
              const afterClickRight = innerSwitchElement.classList.contains('switch-right');
              
              console.log('After click state:', {
                hasLeftClass: afterClickLeft,
                hasRightClass: afterClickRight,
                allClasses: Array.from(innerSwitchElement.classList)
              });
              console.log('After click - Current URL:', window.location.href);
              console.log('After click - Current pathname:', window.location.pathname);
              
              // Verify that beta UI was actually disabled
              if (afterClickLeft && !afterClickRight) {
                console.log('SUCCESS: Beta UI disabled - switch moved to left position');
                return true;
              } else if (window.location.pathname.includes('/location')) {
                console.log('SUCCESS: URL changed to /location (beta UI disabled)');
                return true;
              } else {
                console.log('WARNING: Click completed but switch state unclear - checking URL...');
                // Give it more time and check URL again
                await window.sleep(2000);
                if (window.location.pathname.includes('/location')) {
                  console.log('SUCCESS: URL eventually changed to /location');
                  return true;
                }
                console.log('FAILED: Switch click did not disable beta UI');
              }
              
            } catch (error) {
              console.error('Error clicking inner switch element:', error);
            }
          } else {
            console.log('Beta UI appears to already be disabled (switch in left position)');
            return true;
          }
        }
        
        // Try beta-switch-box
        const betaSwitchBox = document.querySelector('.beta-switch-box');
        console.log('Checking .beta-switch-box:', betaSwitchBox);
        if (betaSwitchBox) {
          console.log('Found beta switch box:', betaSwitchBox);
          console.log('Beta switch box innerHTML:', betaSwitchBox.innerHTML);
          
          // Try clicking the box itself
          try {
            console.log('Attempting to click beta switch box...');
            betaSwitchBox.click();
            await window.sleep(2000);
            console.log('After box click - Current URL:', window.location.href);
            return true;
          } catch (error) {
            console.error('Error clicking beta switch box:', error);
          }
        }
        
        // Try alternative selectors with more detailed logging
        const alternativeSelectors = [
          '.beta-switch',
          '.beta-toggle', 
          '[data-testid*="beta"]',
          '.ui-toggle',
          'button[class*="beta"]',
          '.switch[class*="beta"]',
          '[class*="switch"]',
          '[class*="toggle"]'
        ];
        
        for (const selector of alternativeSelectors) {
          const toggle = document.querySelector(selector);
          console.log(`Checking selector "${selector}":`, toggle);
          if (toggle) {
            console.log(`Found element with selector "${selector}":`, toggle);
            console.log('Element details:', {
              tagName: toggle.tagName,
              className: toggle.className,
              id: toggle.id,
              textContent: toggle.textContent?.substring(0, 100)
            });
            globalThis.updateProgressMessage(`Found beta UI toggle (${selector}) - clicking to switch to standard UI...`);
            
            try {
              console.log(`Attempting to click element found with "${selector}"...`);
              toggle.click();
              await window.sleep(2000);
              console.log('After alternative click - Current URL:', window.location.href);
              return true;
            } catch (error) {
              console.error(`Error clicking toggle with selector "${selector}":`, error);
            }
          }
        }
        
        console.log(`Attempt ${attemptCount} complete - no working toggle found, waiting ${pollInterval}ms...`);
        globalThis.updateProgressMessage(`Looking for beta UI toggle... (attempt ${attemptCount})`);
        
        // Wait before next poll
        await window.sleep(pollInterval);
      }
      
      console.error('=== BETA UI TOGGLE DEBUG END - FAILED ===');
      console.error('Beta UI toggle not found within timeout period');
      console.log('Final page state:');
      console.log('- URL:', window.location.href);
      console.log('- Available beta-related elements:', betaElements.length);
      
      return false;
      
    } catch (error) {
      console.error('Error waiting for and clicking beta toggle:', error);
      return false;
    }
  }

  async expandAllLocationNodes() {
    try {
      let totalClicked = 0;
      
      // Comprehensive tracking of all elements seen during expansion
      const elementTracker = new Map(); // Map<elementId, elementInfo>
      const iterationLog = []; // Track what we see in each iteration

      const trackElement = (block, iterationNumber) => {
        const id = block.id;
        const name = block.querySelector('.location-name')?.textContent?.trim() || 'Unknown';
        const levelMatch = block.className.match(/location-level-(\d+)/);
        const level = levelMatch ? parseInt(levelMatch[1]) : 0;
        const collapsed = block.classList.contains('location-collapsed');
        
        // Determine location type - improved detection
        let locationType = 'Unknown';
        if (level === 0) {
          locationType = 'Root';
        } else {
          // First try to get type from the class attribute
          const typeClass = Array.from(block.classList).find(cls => cls.startsWith('type-'));
          if (typeClass) {
            const typeFromClass = typeClass.replace('type-', '');
            const typeMap = {
              'group': 'Group',
              'network': 'Network', 
              'campus': 'Campus',
              'building': 'Building',
              'floor': 'Floor',
              'zone': 'Zone',
              'area': 'Area',
              'wlc': 'WLC',
              'coverage': 'Coverage',
              'mse': 'MSE'
            };
            locationType = typeMap[typeFromClass] || typeFromClass.charAt(0).toUpperCase() + typeFromClass.slice(1);
          } else {
            // Fallback to icon detection
            const typeIcon = block.querySelector('.loc-type-icon');
            if (typeIcon) {
              const style = window.getComputedStyle(typeIcon);
              const backgroundImage = style.backgroundImage;
              const imageMatch = backgroundImage.match(/\/([^/]+?)(?:_icon)?\.svg/);
              
              if (imageMatch) {
                const iconType = imageMatch[1].toLowerCase();
                const typeMap = {
                  'campus': 'Campus',
                  'building': 'Building',
                  'floor': 'Floor',
                  'zone': 'Zone',
                  'area': 'Area',
                  'wlc': 'WLC',
                  'coverage': 'Coverage'
                };
                locationType = typeMap[iconType] || iconType.charAt(0).toUpperCase() + iconType.slice(1);
              } else {
                locationType = level === 1 ? 'Floor' : 'Area';
              }
            } else {
              locationType = level === 1 ? 'Floor' : 'Area';
            }
          }
        }

        // Find parent relationship using spacers - improved logic
        let parentId = null;
        const spacers = block.querySelectorAll('.spacer-child');
        if (spacers.length > 1) {
          // The parent is the second-to-last spacer (last spacer is self)
          const parentSpacer = spacers[spacers.length - 2];
          if (parentSpacer && parentSpacer.id && parentSpacer.id.startsWith('spacer-')) {
            parentId = parentSpacer.id.replace('spacer-', '');
          }
        } else if (spacers.length === 1) {
          // Only one spacer means this element has the root as parent
          // Check if the single spacer represents the root
          const singleSpacer = spacers[0];
          if (singleSpacer && singleSpacer.id && singleSpacer.id.startsWith('spacer-')) {
            const spacerId = singleSpacer.id.replace('spacer-', '');
            // If it's not the same as this element's ID, it's the parent
            if (spacerId !== id) {
              parentId = spacerId;
            }
          }
        }

        const elementInfo = {
          id,
          name,
          level,
          locationType,
          parentId,
          collapsed,
          firstSeenIteration: elementTracker.has(id) ? elementTracker.get(id).firstSeenIteration : iterationNumber,
          lastSeenIteration: iterationNumber,
          domPosition: Array.from(document.querySelectorAll('.location-block')).indexOf(block)
        };

        elementTracker.set(id, elementInfo);
        return elementInfo;
      };

      window.progressManager.updateProgress(window.progressManager.currentStep, 'Waiting for location tree to initialize...');
      
      // Use the specific viewport ID from the working version
      const viewport = document.getElementById('loc-srol-vewprt');
      if (!viewport) {
        console.error('CDK Virtual Scroll Viewport with ID "loc-srol-vewprt" not found.');
        window.progressManager.updateProgress(window.progressManager.currentStep, 'Virtual scroll viewport not found');
        return { success: false, total: 0 };
      }

      // Look for the true root element - level 0 elements
      const checkForRootElement = () => {
        // Look for level 0 elements anywhere in the page
        const level0Elements = document.querySelectorAll('.location-block.location-level-0, [class*="location-level-0"]');
        
        console.log(`Found ${level0Elements.length} level-0 elements`);
        
        return { level0Elements };
      };
      
      const rootCheck = checkForRootElement();

      const firstRow = await window.waitForElement('lib-location-row-v2, .location-row', window.TIMEOUTS.LONG);
      if (!firstRow) {
        window.progressManager.updateProgress(window.progressManager.currentStep, 'No location rows found');
        return { success: false, total: 0 };
      }

      // Configuration from working version
      const clickDelay = 50;   // Small delay between individual clicks to prevent race conditions
      const maxWaitTime = 2000; // Max time to wait for a single expansion or scroll to complete
      const pollInterval = 50;  // How often to check for DOM changes

      let lastKnownCollapsedCount = -1; // To detect if progress is being made

      /**
       * Waits for a specific DOM condition to be met.
       * @param {function} conditionFn - A function that returns true when the condition is met.
       * @param {number} maxWait - Maximum time to wait in milliseconds.
       * @param {number} interval - Polling interval in milliseconds.
       * @returns {Promise<boolean>} True if condition met within maxWait, false otherwise.
       */
      async function waitForCondition(conditionFn, maxWait, interval) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          if (conditionFn()) {
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, interval));
        }
        return false;
      }

      /**
       * Waits for the scroll height of an element to stabilize.
       * Useful for virtualized lists that dynamically load content on scroll.
       * @param {HTMLElement} element - The scrollable DOM element.
       * @param {number} maxWait - Maximum time to wait in milliseconds.
       * @param {number} interval - Polling interval in milliseconds.
       * @returns {Promise<boolean>} True if scroll height stabilized within maxWait, false otherwise.
       */
      async function waitForScrollToSettle(element, maxWait, interval) {
        let lastScrollHeight = element.scrollHeight;
        const startTime = Date.now();
        let stableCount = 0;
        const requiredStableChecks = 3; // How many consecutive checks with no change to consider stable

        while (Date.now() - startTime < maxWait) {
          await new Promise(resolve => setTimeout(resolve, interval));
          const currentScrollHeight = element.scrollHeight;
          if (currentScrollHeight === lastScrollHeight) {
            stableCount++;
            if (stableCount >= requiredStableChecks) {
              console.log(`Scroll height stabilized at ${currentScrollHeight}.`);
              return true;
            }
          } else {
            lastScrollHeight = currentScrollHeight;
            stableCount = 0; // Reset if it changed
          }
        }
        console.warn(`Scroll height did not stabilize within ${maxWait}ms.`);
        return false;
      }

      /**
       * Continuously finds and clicks all currently visible collapsed expander icons
       * until no more can be expanded in the current view.
       * This function will perform multiple internal passes over the visible DOM.
       * @returns {number} The total number of elements successfully expanded in this call.
       */
      async function expandAllVisibleElementsInCurrentView(iterationNumber) {
        let successfulExpansionsInThisCall = 0;
        let didExpandInInnerLoop = true; // Flag to control inner loop, true to start

        // Track all visible elements in this iteration - do this AFTER expansion logic
        const trackCurrentElements = () => {
          const currentIterationElements = [];
          const allBlocksThisIteration = Array.from(viewport.querySelectorAll('.location-block'));
          
          // Also look for any level-0 elements that might not be tracked yet
          const level0Elements = Array.from(document.querySelectorAll('.location-block.location-level-0'));
          const allElementsThisIteration = [...allBlocksThisIteration, ...level0Elements];
          
          // Remove duplicates
          const uniqueElements = Array.from(new Set(allElementsThisIteration));
          
          uniqueElements.forEach(block => {
            if (block.id) { // Only track elements with IDs
              const elementInfo = trackElement(block, iterationNumber);
              currentIterationElements.push(elementInfo);
            }
          });

          iterationLog.push({
            iteration: iterationNumber,
            totalElementsVisible: currentIterationElements.length,
            elements: currentIterationElements.map(e => ({ id: e.id, name: e.name, level: e.level, collapsed: e.collapsed }))
          });

          console.log(`Iteration ${iterationNumber}: Tracking ${currentIterationElements.length} elements`);
        };

        // Keep looping as long as we are making progress in expanding visible elements
        // This ensures multiple passes over the current view.
        while (didExpandInInnerLoop) {
          didExpandInInnerLoop = false; // Assume no expansion in this inner pass until proven otherwise

          // Re-query all collapsed expander icons in the current viewport for each inner pass.
          // This is the "rescan the current view" part.
          const expanderIcons = Array.from(viewport.querySelectorAll('.location-block.location-collapsed > .location-slab > .location-row > .location-expander-icon'));

          if (expanderIcons.length === 0) {
            console.log('No collapsed elements found in the current view for this inner pass.');
            break; // No more collapsed items in this view, exit inner loop
          }

          console.log(`Found ${expanderIcons.length} collapsed elements in the current view. Attempting to expand...`);
          globalThis.updateProgressMessage(`Scanning ${expanderIcons.length} collapsed elements - ${totalClicked} items found so far`);

          // Iterate through them and try to expand
          for (const toggle of expanderIcons) {
            const parentBlock = toggle.closest('.location-block');

            // Double-check if the element is still collapsed before clicking
            if (parentBlock && parentBlock.classList.contains('location-collapsed')) {
              const nodeName = parentBlock.querySelector('.location-name')?.textContent || 'unknown';
              const initialChildrenCount = parentBlock.querySelectorAll(':scope > .cdk-virtual-scroll-content-wrapper > lib-location-row-v2').length;

              toggle.click();
              await new Promise(resolve => setTimeout(resolve, clickDelay)); // Small delay after click

              const expanded = await waitForCondition(() => {
                const isNoLongerCollapsed = !parentBlock.classList.contains('location-collapsed');
                const currentChildrenCount = parentBlock.querySelectorAll(':scope > .cdk-virtual-scroll-content-wrapper > lib-location-row-v2').length;
                const newChildrenAppeared = currentChildrenCount > initialChildrenCount;
                return isNoLongerCollapsed || newChildrenAppeared;
              }, maxWaitTime, pollInterval);

              if (expanded) {
                successfulExpansionsInThisCall++;
                totalClicked++;
                didExpandInInnerLoop = true; // Mark that we made progress in this inner pass
                console.log(`Expanded node: ${nodeName}`);
                globalThis.updateProgressMessage(`Expanded: ${nodeName} (${totalClicked} total found)`);
                // After a successful expansion, break from this inner for-loop
                // and re-start the while-loop to re-query all collapsed elements.
                // This ensures we always process the most up-to-date set of visible elements
                // from the top of the list.
                break; // Important: Restart the inner while loop to re-scan from top
              } else {
                console.warn(`Failed to expand node: ${nodeName} within timeout.`);
                globalThis.updateProgressMessage(`Failed to expand node: ${nodeName}`);
              }
            }
          }
        }
        
        // Track elements AFTER expansion is complete for this iteration
        trackCurrentElements();
        
        return successfulExpansionsInThisCall;
      }

      /**
       * Scrolls the viewport to its maximum scroll position and waits for the content to settle.
       * @param {HTMLElement} element - The scrollable DOM element.
       * @returns {boolean} True if the element scrolled down and settled, false otherwise.
       */
      async function scrollToBottomAndSettle(element) {
        const initialScrollTop = element.scrollTop;
        element.scrollTop = element.scrollHeight; // Scroll to the very bottom

        // Minimal initial delay to allow the scroll event to register
        await new Promise(resolve => setTimeout(resolve, 50));

        // Wait for the virtual scroll content to stabilize after scrolling
        const settled = await waitForScrollToSettle(element, maxWaitTime, pollInterval);

        return element.scrollTop > initialScrollTop && settled; // Check if scrolling actually occurred AND settled
      }

      // Main expansion loop
      let iteration = 0;
      let madeProgressInOverallIteration = true; // Flag for the outer loop
      const maxIterations = 500; // Safety limit to prevent infinite loops

      window.progressManager.updateProgress(window.progressManager.currentStep, 'Starting location tree expansion - 0 items found...');

      while (madeProgressInOverallIteration && iteration < maxIterations) {
        iteration++;
        console.log(`--- Overall Iteration ${iteration} ---`);
        madeProgressInOverallIteration = false; // Assume no progress until proven otherwise

        // Ensure we always track the level-0 root element if it exists
        const level0Root = document.querySelector('.location-block.location-level-0');
        if (level0Root && level0Root.id) {
          trackElement(level0Root, iteration);
        }

        // Phase 1: Expand all currently visible collapsed elements in multiple passes
        const expandedThisPass = await expandAllVisibleElementsInCurrentView(iteration);
        if (expandedThisPass > 0) {
          madeProgressInOverallIteration = true;
          window.progressManager.updateProgress(window.progressManager.currentStep, `Expanding location tree - ${totalClicked} items found...`);
          console.log(`Successfully expanded ${expandedThisPass} elements in this overall iteration.`);
          globalThis.updateProgressMessage(`Expanded ${expandedThisPass} elements in iteration ${iteration}`);
        }

        // Get the count of remaining collapsed elements after expansion attempts
        const currentCollapsedCount = viewport.querySelectorAll('.location-block.location-collapsed > .location-slab > .location-row > .location-expander-icon').length;

        // Phase 2: Check if we need to scroll to reveal more elements
        if (currentCollapsedCount > 0) {
          console.log(`Still ${currentCollapsedCount} collapsed elements remaining. Attempting to scroll.`);
          window.progressManager.updateProgress(window.progressManager.currentStep, `Scanning for more locations - ${totalClicked} items found so far...`);
          globalThis.updateProgressMessage(`${currentCollapsedCount} collapsed elements remaining, scrolling...`);
          const didScrollAndSettle = await scrollToBottomAndSettle(viewport);
          if (didScrollAndSettle) {
            madeProgressInOverallIteration = true; // Scrolling might reveal new elements to expand
            console.log('Scrolled down and content settled to reveal more content.');
          } else {
            console.log('Cannot scroll further or content did not settle. No new content to reveal by scrolling.');
          }
        } else {
          // No collapsed elements found in the current view.
          // Perform a final scroll to ensure nothing is missed due to virtualization.
          console.log('No collapsed elements left in view. Performing a final scroll check.');
          window.progressManager.updateProgress(window.progressManager.currentStep, `Final scan - ${totalClicked} items found...`);
          const didScrollAndSettle = await scrollToBottomAndSettle(viewport);
          if (didScrollAndSettle) {
            madeProgressInOverallIteration = true; // A final scroll might reveal something
            console.log('Performed a final scroll and content settled to ensure all content loaded.');
          } else {
            console.log('Final scroll did not reveal new content or could not scroll further.');
          }
        }

        // Termination condition: If no progress was made in this overall iteration
        // (no expansions and no effective scroll) AND the number of collapsed elements
        // in the DOM hasn't changed from the previous check.
        if (!madeProgressInOverallIteration && currentCollapsedCount === lastKnownCollapsedCount) {
          console.log('No progress made in this overall iteration (no expansions, no effective scroll, no change in collapsed count). Terminating.');
          window.progressManager.updateProgress(window.progressManager.currentStep, `Location expansion complete - ${totalClicked} items found`);
          globalThis.updateProgressMessage('No more progress possible, expansion complete');
          break;
        }
        lastKnownCollapsedCount = currentCollapsedCount;
      }

      // Log comprehensive tracking results
      console.log(`=== EXPANSION TRACKING SUMMARY ===`);
      console.log(`Total iterations: ${iteration}`);
      console.log(`Total unique elements tracked: ${elementTracker.size}`);
      console.log(`Total expansions performed: ${totalClicked}`);
      console.log(`Expansion process complete. Total expander icons clicked: ${totalClicked}`);
      
      if (iteration >= maxIterations) {
        console.warn(`Reached maximum iterations (${maxIterations}). The tree might not be fully expanded.`);
        globalThis.updateProgressMessage(`Reached maximum iterations (${maxIterations}). Tree might not be fully expanded.`);
      }
      
      // Store tracking data for tree building
      globalThis.locationElementTracker = elementTracker;
      globalThis.locationIterationLog = iterationLog;

      const message = `Location tree expanded - found ${totalClicked} locations in ${iteration} iterations`;
      window.progressManager.updateProgress(window.progressManager.currentStep, message);

      // Dispatch the custom event as before
      const event = new CustomEvent('locationTreeExpanded', {
        detail: { nodesExpanded: totalClicked }
      });
      document.dispatchEvent(event);
      
      return { success: true, total: totalClicked };

    } catch (error) {
      const message = `Error expanding location nodes: ${error.message}`;
      window.progressManager.updateProgress(window.progressManager.currentStep, message);
      return { success: false, total: 0 };
    }
  }

  async extractLocationCount() {
    try {
      const locationInfoList = await window.waitForElement('.location-info-list');
      if (!locationInfoList) {
        return {
          'Locations': 'Not found',
          'Access Points': 'Not found',
          'BLE Beacons': 'Not found',
          'Cameras': 'Not found'
        };
      }

      const infoItems = locationInfoList.querySelectorAll('.round-icon');
      const results = {};

      infoItems.forEach(item => {
        const labelSpan = item.querySelector('span');
        if (labelSpan) {
          const text = labelSpan.textContent.trim();
          const [count, ...labelParts] = text.split(' ');
          const label = labelParts.join(' ');
          if (label && !isNaN(count)) {
            results[label] = count;
          }
        }
      });

      return {
        'Locations': results['Locations'] || 'Not found',
        'Access Points': results['Access Points'] || 'Not found',
        'BLE Beacons': results['Ble Beacons'] || 'Not found',
        'Cameras': results['Cameras'] || 'Not found'
      };

    } catch (error) {
      return {
        'Locations': 'Error: ' + error.message,
        'Access Points': 'Not found',
        'BLE Beacons': 'Not found',
        'Cameras': 'Not found'
      };
    }
  }

  async analyzeLocationTypes() {
    try {
      // Use tracked data if available, otherwise fallback to current DOM
      if (globalThis.locationElementTracker && globalThis.locationElementTracker.size > 0) {
        console.log(`Using tracked data from expansion: ${globalThis.locationElementTracker.size} elements`);
        return this.buildTreeFromTrackedData();
      } else {
        console.log('No tracked data available, using current DOM state');
        return this.buildTreeFromCurrentDOM();
      }
    } catch (error) {
      return {
        total: 0,
        typeBreakdown: {},
        treeOutput: [],
        formattedTree: '',
        error: error.message
      };
    }
  }

  buildTreeFromTrackedData() {
    const elementTracker = globalThis.locationElementTracker;
    const iterationLog = globalThis.locationIterationLog;
    
    console.log(`=== BUILDING TREE FROM TRACKED DATA ===`);
    console.log(`Total tracked elements: ${elementTracker?.size || 0}`);
    console.log(`Total iterations logged: ${iterationLog?.length || 0}`);
    
    if (!elementTracker || elementTracker.size === 0) {
      console.log('No tracked elements available');
      return null;
    }
    
    const typeAnalysis = {
      total: 0,
      typeBreakdown: {},
      treeOutput: []
    };

    // Convert tracked elements to array and filter out coverage areas
    const allElements = Array.from(elementTracker.values())
      .filter(element => element.name && !element.name.includes('Coverage Area-'));
    
    console.log(`Processing ${allElements.length} tracked elements (excluding coverage areas)`);

    if (allElements.length === 0) {
      console.log('No valid elements to process after filtering');
      return null;
    }

    // Count coverage areas for each parent
    const coverageAreaCounts = new Map();
    Array.from(elementTracker.values())
      .filter(element => element.name && element.name.includes('Coverage Area-'))
      .forEach(element => {
        if (element.parentId) {
          coverageAreaCounts.set(element.parentId, (coverageAreaCounts.get(element.parentId) || 0) + 1);
        }
      });

    // Build type breakdown - include all levels including root
    allElements.forEach(element => {
      const locationType = element.locationType || 'Unknown';
      typeAnalysis.typeBreakdown[locationType] = (typeAnalysis.typeBreakdown[locationType] || 0) + 1;
      typeAnalysis.total++;
    });

    // Sort by level first, then by name
    allElements.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return (a.name || '').localeCompare(b.name || '');
    });

    // Build tree with proper hierarchy using parent relationships
    const elementMap = new Map();
    const rootElements = [];
    
    // Find the minimum level to identify root elements
    const minLevel = Math.min(...allElements.map(e => e.level));
    console.log(`Minimum level found: ${minLevel}`);
    
    // First pass: create all elements and map them
    allElements.forEach((element) => {
      const treeNode = {
        id: element.id,
        name: element.name,
        level: element.level,
        locationType: element.locationType || 'Unknown',
        parentId: element.parentId,
        children: [],
        coverageCount: coverageAreaCounts.get(element.id) || 0
      };
      elementMap.set(element.id, treeNode);
      
      // If no parent or at minimum level, it's a root element
      if (!element.parentId || element.level === minLevel) {
        rootElements.push(treeNode);
      }
    });
    
    // Second pass: build parent-child relationships
    allElements.forEach((element) => {
      if (element.parentId && elementMap.has(element.parentId)) {
        const parent = elementMap.get(element.parentId);
        const child = elementMap.get(element.id);
        if (parent && child) {
          parent.children.push(child);
          // Remove from root elements if it has a valid parent
          const rootIndex = rootElements.findIndex(r => r.id === element.id);
          if (rootIndex !== -1) {
            rootElements.splice(rootIndex, 1);
          }
        }
      } else if (element.parentId && !elementMap.has(element.parentId)) {
        // Parent not found in our tracked elements, add to root
        const child = elementMap.get(element.id);
        if (child && !rootElements.includes(child)) {
          rootElements.push(child);
        }
      }
    });
    
    // Recursive function to build tree output with proper tree formatting
    const buildTreeOutput = (nodes, depth = 0, isLastAtLevel = [], parentPrefix = '') => {
      const output = [];
      
      nodes.forEach((node, index) => {
        const isLast = index === nodes.length - 1;
        
        // Build prefix for tree visualization like Linux tree command
        let prefix = parentPrefix;
        
        if (depth > 0) {
          if (isLast) {
            prefix += '└── ';
          } else {
            prefix += '├── ';
          }
        }
        
        const coverageInfo = node.coverageCount > 0 ? ` (${node.coverageCount} coverage areas)` : '';
        const treeEntry = `${prefix}${node.name} [${node.locationType}]${coverageInfo}`;
        output.push(treeEntry);
        
        // Add children recursively
        if (node.children.length > 0) {
          // Sort children by name for consistent output
          node.children.sort((a, b) => a.name.localeCompare(b.name));
          
          // Determine the new parent prefix for children
          let newParentPrefix = parentPrefix;
          if (depth > 0) {
            if (isLast) {
              newParentPrefix += '    '; // 4 spaces for last items
            } else {
              newParentPrefix += '│   '; // │ + 3 spaces for continuing items
            }
          }
          
          output.push(...buildTreeOutput(node.children, depth + 1, [], newParentPrefix));
        }
      });
      
      return output;
    };
    
    // Sort root elements by level and name
    rootElements.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
    
    console.log(`Found ${rootElements.length} root elements:`, rootElements.map(r => `"${r.name}" (level ${r.level})`).join(', '));
    
    // Build the final tree output
    typeAnalysis.treeOutput = buildTreeOutput(rootElements);

    if (typeAnalysis.treeOutput.length > 0) {
      typeAnalysis.formattedTree = typeAnalysis.treeOutput.join('\n');
      console.log(`Built complete location tree with ${typeAnalysis.treeOutput.length} entries from tracked data`);
      
      // Log first few entries to verify
      console.log('First 5 tree entries:');
      typeAnalysis.treeOutput.slice(0, 5).forEach(entry => console.log(entry));
      
      // Log iteration summary
      console.log(`=== ITERATION SUMMARY ===`);
      if (iterationLog && iterationLog.length > 0) {
        iterationLog.forEach(log => {
          console.log(`Iteration ${log.iteration}: ${log.totalElementsVisible} elements visible, ${log.elements.filter(e => e.collapsed).length} collapsed`);
        });
      }
    } else {
      console.log('No tree entries were generated from tracked data');
    }

    return typeAnalysis;
  }

  buildTreeFromCurrentDOM() {
    // Fallback to original DOM-based approach
    const locationBlocks = Array.from(document.querySelectorAll('.location-block'));
    console.log(`Analyzing ${locationBlocks.length} location blocks for tree structure`);
    
    // Debug: Log the level information for each block
    console.log('=== DEBUG: Location Block Levels ===');
    locationBlocks.forEach((block, i) => {
      const name = block.querySelector('.location-name')?.textContent?.trim() || 'Unknown';
      const levelMatch = block.className.match(/location-level-(\d+)/);
      const level = levelMatch ? parseInt(levelMatch[1]) : 0;
      const domIndex = Array.from(document.querySelectorAll('.location-block')).indexOf(block);
      console.log(`${i}: Level ${level} - "${name}" (DOM index: ${domIndex})`);
    });
    console.log('=== END DEBUG ===');
    
    const typeAnalysis = {
      total: 0,
      typeBreakdown: {},
      treeOutput: []
    };

    const coverageAreaCounts = new Map();

    locationBlocks.forEach((block) => {
      const name = block.querySelector('.location-name')?.textContent?.trim() || '';
      if (name.includes('Coverage Area-')) {
        const spacers = block.querySelectorAll('.spacer-child');
        const parentSpacer = spacers[spacers.length - 2];
        if (parentSpacer) {
          const parentId = parentSpacer.id.replace('spacer-', '');
          coverageAreaCounts.set(parentId, (coverageAreaCounts.get(parentId) || 0) + 1);
        }
      }
    });

    // Sort location blocks by their DOM order to maintain proper hierarchy
    locationBlocks.sort((a, b) => {
      const aPos = Array.from(document.querySelectorAll('.location-block')).indexOf(a);
      const bPos = Array.from(document.querySelectorAll('.location-block')).indexOf(b);
      return aPos - bPos;
    });

    // Build a clean list of items with their levels, skipping coverage areas
    const treeItems = [];
    locationBlocks.forEach((block) => {
      const name = block.querySelector('.location-name')?.textContent?.trim() || 'Unknown';
      
      // Skip coverage areas from tree display
      if (name.includes('Coverage Area-')) {
        return;
      }

      const levelMatch = block.className.match(/location-level-(\d+)/);
      const level = levelMatch ? parseInt(levelMatch[1]) : 0;

      let locationType = 'Unknown';

      if (level === 0) {
        locationType = 'Root';
      } else {
        const typeIcon = block.querySelector('.loc-type-icon');
        if (typeIcon) {
          const style = window.getComputedStyle(typeIcon);
          const backgroundImage = style.backgroundImage;
          
          const imageMatch = backgroundImage.match(/\/([^/]+?)(?:_icon)?\.svg/);
          
          if (imageMatch) {
            const iconType = imageMatch[1].toLowerCase();
            
            const typeMap = {
              'campus': 'Campus',
              'building': 'Building',
              'floor': 'Floor',
              'zone': 'Zone',
              'area': 'Area',
              'wlc': 'WLC',
              'coverage': 'Coverage'
            };
            
            locationType = typeMap[iconType] || iconType.charAt(0).toUpperCase() + iconType.slice(1);
          } else {
            if (level === 1) {
              locationType = 'Floor';
            } else {
              locationType = 'Area';
            }
          }
        } else {
          // Fallback type detection based on level
          if (level === 1) {
            locationType = 'Floor';
          } else {
            locationType = 'Area';
          }
        }

        typeAnalysis.typeBreakdown[locationType] = (typeAnalysis.typeBreakdown[locationType] || 0) + 1;
        typeAnalysis.total++;
      }

      const coverageCount = coverageAreaCounts.get(block.id) || 0;
      const coverageInfo = coverageCount > 0 ? ` (${coverageCount} coverage areas)` : '';

      treeItems.push({
        name,
        level,
        locationType,
        coverageInfo,
        block
      });
    });

    console.log(`Processing ${treeItems.length} tree items (excluding coverage areas)`);

    // Normalize levels to handle missing intermediate levels
    const levelsFound = [...new Set(treeItems.map(item => item.level))].sort((a, b) => a - b);
    console.log(`Levels found: ${levelsFound.join(', ')}`);
    
    // Create a mapping from actual levels to normalized levels (0, 1, 2, etc.)
    const levelMap = new Map();
    levelsFound.forEach((level, index) => {
      levelMap.set(level, index);
    });
    
    console.log('Level mapping:', Array.from(levelMap.entries()).map(([actual, normalized]) => `${actual}→${normalized}`).join(', '));

    // Build the tree output with proper hierarchy using normalized levels
    treeItems.forEach((item, index) => {
      const { name, level, locationType, coverageInfo } = item;
      const normalizedLevel = levelMap.get(level);

      // Build prefix based on normalized level depth
      let prefix = '';
      for (let i = 0; i < normalizedLevel; i++) {
        // Check if there are more items at this ancestor level coming later
        let hasMoreAtThisLevel = false;
        for (let j = index + 1; j < treeItems.length; j++) {
          const futureNormalizedLevel = levelMap.get(treeItems[j].level);
          if (futureNormalizedLevel <= i) {
            if (futureNormalizedLevel === i) {
              hasMoreAtThisLevel = true;
            }
            break;
          }
        }
        prefix += hasMoreAtThisLevel ? '│   ' : '    ';
      }

      // Determine if this is the last item at its level
      let isLastAtLevel = true;
      for (let j = index + 1; j < treeItems.length; j++) {
        if (treeItems[j].level === level) {
          isLastAtLevel = false;
          break;
        } else if (treeItems[j].level < level) {
          break;
        }
      }

      const connector = isLastAtLevel ? '└── ' : '├── ';
      const treeEntry = `${prefix}${connector}${name} [${locationType}]${coverageInfo}`;
      typeAnalysis.treeOutput.push(treeEntry);
    });

    if (typeAnalysis.treeOutput.length > 0) {
      typeAnalysis.formattedTree = typeAnalysis.treeOutput.join('\n');
      console.log(`Built location tree with ${typeAnalysis.treeOutput.length} entries`);
    } else {
      console.log('No tree entries were generated - tree output is empty');
    }

    return typeAnalysis;
  }
}

globalThis.LocationChecker = LocationChecker;

// Report module for generating location hierarchy section in reports
globalThis.LocationChecker.reportModule = {
  generateHTML: function(data) {
    const locationData = this.processData(data);
    
    let locationTypesHTML = '';
    if (locationData.locationTypes && locationData.locationTypes.length > 0) {
      locationTypesHTML = `
        <div class="subsection">
          <h3 class="subsection-title">Location Types Breakdown</h3>
          <table class="report-table">
            <tbody>
              ${locationData.locationTypes.map(type => `
                <tr>
                  <th>${type.name}</th>
                  <td>${type.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    return `
      <div class="section" id="location-section">
        <h2 class="section-title">Location Hierarchy</h2>
        <table class="report-table">
          <tbody>
            <tr>
              <th>Total Locations</th>
              <td>${locationData.totalLocations}</td>
            </tr>
            <tr>
              <th>Access Points</th>
              <td>${locationData.accessPoints}</td>
            </tr>
            <tr>
              <th>BLE Beacons</th>
              <td>${locationData.bleBeacons}</td>
            </tr>
            <tr>
              <th>Cameras</th>
              <td>${locationData.cameras}</td>
            </tr>
          </tbody>
        </table>
        ${locationTypesHTML}
      </div>
    `;
  },
  
  processData: function(rawData) {
    if (!rawData) {
      return {
        totalLocations: 'Not Available',
        accessPoints: 'Not Available',
        bleBeacons: 'Not Available',
        cameras: 'Not Available',
        locationTypes: []
      };
    }
    
    // Extract the specific data fields that are actually collected
    const locationTypes = [];
    
    // Look for location type breakdown data
    Object.keys(rawData).forEach(key => {
      if (key.startsWith('Location Type: ')) {
        const typeName = key.replace('Location Type: ', '');
        locationTypes.push({
          name: typeName,
          count: rawData[key]
        });
      }
    });
    
    return {
      totalLocations: rawData['Number of Locations'] || 'Not Available',
      accessPoints: rawData['Number of Access Points'] || 'Not Available',
      bleBeacons: rawData['Number of BLE Beacons'] || 'Not Available',
      cameras: rawData['Number of Cameras'] || 'Not Available',
      locationTypes: locationTypes
    };
  },
  
  hasData: function(data) {
    if (!data) return false;
    const processedData = this.processData(data);
    return processedData.totalLocations !== 'Not Available' || 
           processedData.accessPoints !== 'Not Available' ||
           processedData.bleBeacons !== 'Not Available' ||
           processedData.cameras !== 'Not Available';
  }
};
