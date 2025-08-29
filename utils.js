globalThis.camelCase = function(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
};

globalThis.sanitizeFilenamePart = function(str) {
  return (str || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

globalThis.updateProgressMessage = function updateProgressMessage(text) {
  if (window.progressManager) {
    // Only update the status text, don't change the step status
    const statusDiv = document.getElementById('cisco-status');
    if (statusDiv) {
      statusDiv.innerHTML = text;
    }
  }
};

window.clearProgress = function clearProgress() {
  chrome.runtime.sendMessage({ type: 'reset_collection' });
};
window.isDebugMode = async function isDebugMode() {
  try {
    const result = await chrome.storage.local.get(['debugMode']);
    return !!result.debugMode;
  } catch (e) {
    return false;
  }
}

window.setupPageObserver = function setupPageObserver() {
    let mutationTimeout = null;
    
    const observer = new MutationObserver((mutations) => {
        const relevantMutations = mutations.filter(mutation => {
            return Array.from(mutation.target.classList || []).some(cls => 
                cls.includes('location-') || 
                cls.includes('cdk-virtual-scroll') ||
                cls.includes('beta-switch')
            );
        });

        if (relevantMutations.length === 0) {
            return;
        }

        if (mutationTimeout) {
            return;
        }

        mutationTimeout = setTimeout(() => {
            mutationTimeout = null;
        }, 1000);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });

    return observer;
};

window.setupStateCleanup = function setupStateCleanup() {
    return setInterval(() => {
        if (window.navigationController?.isNavigating && 
            window.navigationController.navigationTimeout &&
            Date.now() - window.navigationController.navigationTimeout > 5000) {
            window.navigationController.isNavigating = false;
            window.navigationController.navigationTimeout = null;
        }
    }, 5000);
};

window.sleep = function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

window.getAccountDomain = function getAccountDomain() {
  const hostname = window.location.hostname;
  const DOMAINS = globalThis.DOMAINS || {};
  if (DOMAINS.EU && hostname.includes(DOMAINS.EU)) return DOMAINS.EU;
  if (DOMAINS.IO && hostname.includes(DOMAINS.IO)) return DOMAINS.IO;
  if (DOMAINS.SG && hostname.includes(DOMAINS.SG)) return DOMAINS.SG;
  return hostname;
}

window.generateTimestamp = function generateTimestamp() {
  return new Date().toLocaleString();
}

window.isCurrentPath = function isCurrentPath(path) {
  return window.location.pathname.endsWith(path);
}

window.buildUrl = function buildUrl(baseDomain, path) {
  return `https://${baseDomain}${path}`;
}

window.waitForElement = function waitForElement(selector, timeout = window.TIMEOUTS.ELEMENT_WAIT) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id']
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

window.waitForUrl = function waitForUrl(url, timeout = window.TIMEOUTS.URL_WAIT) {
  return new Promise((resolve, reject) => {
    const interval = 200;
    let elapsed = 0;
    const check = () => {
      if (window.location.href === url) return resolve();
      elapsed += interval;
      if (elapsed >= timeout) {
        return reject(new Error(`Timeout waiting for navigation to ${url}`));
      }
      setTimeout(check, interval);
    };
    check();
  });
}

window.waitForUrlPath = function waitForUrlPath(path, timeout = window.TIMEOUTS.URL_WAIT) {
  return new Promise((resolve, reject) => {
    const interval = 200;
    let elapsed = 0;
    const check = () => {
      if (window.location.pathname.includes(path) || window.location.href.includes(path)) {
        return resolve();
      }
      elapsed += interval;
      if (elapsed >= timeout) {
        return reject(new Error(`Timeout waiting for URL to contain ${path}. Current URL: ${window.location.href}`));
      }
      setTimeout(check, interval);
    };
    check();
  });
}

window.clickElement = function clickElement(element) {
  const ngZone = window['Zone'] && window['Zone']['current'];
  if (ngZone) {
    ngZone.run(() => {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(clickEvent);
    });
  } else {
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(clickEvent);
  }
}

window.waitForElementAndClick = async function waitForElementAndClick(selector, timeout = window.TIMEOUTS.ELEMENT_WAIT) {
  try {
    const element = await window.waitForElement(selector, timeout);
    window.clickElement(element);
    return element;
  } catch (e) {
    throw new Error(`Failed to find and click element: ${selector}`);
  }
}

window.hoverElement = function hoverElement(element) {
  const hoverEvent = new MouseEvent('mouseenter', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(hoverEvent);
}

window.findElementByText = function findElementByText(selector, text) {
  const elements = Array.from(document.querySelectorAll(selector));
  return elements.find(el => el.textContent.trim() === text) || null;
}

window.findElementByPartialText = function findElementByPartialText(selector, text) {
  const elements = Array.from(document.querySelectorAll(selector));
  return elements.find(el => el.textContent.trim().includes(text)) || null;
}

window.waitForElementWithText = function waitForElementWithText(selector, text, timeout = window.TIMEOUTS.ELEMENT_WAIT) {
  return new Promise((resolve) => {
    const findElement = () => {
      const elements = Array.from(document.querySelectorAll(selector));
      return elements.find(el => el.textContent.trim() === text);
    };

    const existingElement = findElement();
    if (existingElement) {
      return resolve(existingElement);
    }

    const observer = new MutationObserver(() => {
      const element = findElement();
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Beta UI Detection and Exit Functions
window.detectBetaUI = function detectBetaUI() {
  try {
    console.log('Checking for beta UI state...');
    
    // Method 1: Check URL path - most reliable indicator
    const currentPath = window.location.pathname;
    console.log('Current URL path:', currentPath);
    
    // Beta UI uses /hierarchy/business, standard UI uses /location
    if (currentPath.includes('/hierarchy/business') || currentPath.includes('/hierarchy/')) {
      console.log('Beta UI detected via URL path: /hierarchy/business or /hierarchy/');
      return true;
    }
    
    if (currentPath.includes('/location') && !currentPath.includes('/hierarchy/')) {
      console.log('Standard UI detected via URL path: /location');
      return false;
    }
    
    // Method 2: Check for specific beta UI switch with precise class detection
    const betaSwitchBox = document.querySelector('.beta-switch-box');
    if (betaSwitchBox) {
      console.log('Beta switch box found:', betaSwitchBox);
      const innerBlock = betaSwitchBox.querySelector('.innerblock');
      if (innerBlock) {
        const hasRightPosition = innerBlock.classList.contains('switch-right');
        const hasLeftPosition = innerBlock.classList.contains('left');
        
        console.log('Beta switch found:', { 
          hasRightPosition, 
          hasLeftPosition, 
          classes: Array.from(innerBlock.classList) 
        });
        
        if (hasRightPosition) {
          console.log('Beta UI detected - switch is in RIGHT position (Beta UI ON)');
          return true;
        } else if (hasLeftPosition) {
          console.log('Beta UI NOT detected - switch is in LEFT position (Beta UI OFF)');
          return false;
        } else {
          console.log('Beta switch found but position unclear:', Array.from(innerBlock.classList));
          // If position is unclear but switch exists, assume beta UI is on
          return true;
        }
      }
      
      // Fallback: check for switchon class on outerblock
      const outerBlock = betaSwitchBox.querySelector('.outerblock');
      if (outerBlock) {
        const isOn = outerBlock.classList.contains('switchon');
        console.log('Beta UI state via outerblock switchon:', isOn);
        return isOn;
      }
    } else {
      console.log('No .beta-switch-box found in DOM');
    }

    // Method 3: Check for generic beta UI toggle elements in active state
    const betaToggle = document.querySelector('.beta-switch, .beta-toggle, [data-testid*="beta"], [class*="beta-ui"]');
    if (betaToggle) {
      console.log('Beta toggle element found:', betaToggle);
      // Check if it's in an "on" state
      const isActive = betaToggle.classList.contains('active') || 
                      betaToggle.classList.contains('on') || 
                      betaToggle.classList.contains('enabled') ||
                      betaToggle.querySelector('.switchon') ||
                      betaToggle.querySelector('.switch-right');
      
      if (isActive) {
        console.log('Beta UI detected via toggle element in active state:', betaToggle);
        return true;
      }
    }

    // Method 4: Check for beta UI checkbox or switch
    const betaCheckbox = document.querySelector('input[type="checkbox"][id*="beta"], input[type="checkbox"][name*="beta"]');
    if (betaCheckbox) {
      console.log('Beta checkbox found:', betaCheckbox, 'checked:', betaCheckbox.checked);
      if (betaCheckbox.checked) {
        console.log('Beta UI detected via checked checkbox:', betaCheckbox);
        return true;
      }
    }

    console.log('No beta UI detected - appears to be in standard UI mode');
    return false;
  } catch (error) {
    console.error('Error detecting beta UI:', error);
    return false;
  }
}

window.exitBetaUIMode = async function exitBetaUIMode() {
  console.log('=== BETA UI TOGGLE CLICK START ===');
  console.log('Attempting to find and click beta UI toggle...');
  
  try {
    // Find the beta switch container
    const betaSwitch = document.querySelector('.beta-switch');
    if (!betaSwitch) {
      console.log('Beta switch container (.beta-switch) not found');
      return false;
    }
    
    // Find the inner block element (the actual clickable toggle)
    const innerBlock = betaSwitch.querySelector('.innerblock');
    if (!innerBlock) {
      console.log('Inner block element (.innerblock) not found');
      return false;
    }
    
    // Check current state before clicking
    const isCurrentlyOn = innerBlock.classList.contains('switch-right');
    const isCurrentlyOff = innerBlock.classList.contains('left');
    const allClasses = Array.from(innerBlock.classList);
    
    console.log('Current beta UI state:', {
      isOn: isCurrentlyOn,
      isOff: isCurrentlyOff,
      classes: allClasses,
      classString: innerBlock.className
    });
    
    if (isCurrentlyOff) {
      console.log('Beta UI is already OFF (innerblock has "left" class), no need to click');
      return true;
    }
    
    // Click the inner block to toggle from ON to OFF
    console.log('Clicking inner block to turn OFF beta UI...');
    innerBlock.click();
    
    // Wait for the toggle to respond
    await window.sleep(1000);
    
    // Verify the toggle switched to OFF state
    const isNowOff = innerBlock.classList.contains('left');
    const isStillOn = innerBlock.classList.contains('switch-right');
    const newClasses = Array.from(innerBlock.classList);
    
    console.log('After click - beta UI state:', {
      isOff: isNowOff,
      isStillOn: isStillOn,
      classes: newClasses,
      classString: innerBlock.className
    });
    
    // Be more lenient - if the classes changed at all, consider it a success
    const classesChanged = allClasses.join(',') !== newClasses.join(',');
    console.log('Classes changed:', classesChanged);
    
    if (isNowOff || (!isStillOn && classesChanged)) {
      console.log('Successfully turned OFF beta UI toggle (classes changed or left class detected)');
      return true;
    } else {
      console.log('Toggle did not switch to OFF state as expected');
      return false;
    }
    
  } catch (error) {
    console.error('Error clicking beta UI toggle:', error);
    return false;
  }
}

window.verifyBetaUIExit = async function verifyBetaUIExit(maxAttempts = 3) {
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Verifying beta UI exit, attempt ${attempt}/${maxAttempts}`);
      
      await window.sleep(window.TIMEOUTS.SHORT);
      
      const stillInBeta = window.detectBetaUI();
      if (!stillInBeta) {
        console.log('Successfully exited beta UI mode');
        return true;
      }
      
      console.log(`Still in beta UI mode, attempt ${attempt} failed`);
      
      if (attempt < maxAttempts) {
        // Try alternative exit methods on subsequent attempts
        console.log('Trying alternative exit method...');
        await window.exitBetaUIMode();
      }
    }
    
    console.warn(`Failed to exit beta UI mode after ${maxAttempts} attempts`);
    return false;
  } catch (error) {
    console.error('Error verifying beta UI exit:', error);
    return false;
  }
}

window.ensureStandardUI = async function ensureStandardUI() {
  try {
    console.log('Checking if we need to exit beta UI mode...');
    
    const inBetaMode = window.detectBetaUI();
    
    if (!inBetaMode) {
      console.log('Already in standard UI mode');
      return false; // No action needed
    }
    
    console.log('Beta UI detected, attempting to switch to standard UI...');
    
    const exitSuccess = await window.exitBetaUIMode();
    
    if (!exitSuccess) {
      console.warn('Failed to exit beta UI mode');
      return false;
    }
    
    const verificationSuccess = await window.verifyBetaUIExit();
    
    if (verificationSuccess) {
      console.log('Successfully switched to standard UI mode');
      return true; // Action was taken and successful
    } else {
      console.warn('Could not verify successful exit from beta UI mode');
      return false;
    }
  } catch (error) {
    console.error('Error ensuring standard UI mode:', error);
    return false;
  }
}
