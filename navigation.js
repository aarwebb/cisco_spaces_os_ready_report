class NavigationController {
  static MAX_NAVIGATION_FAILS = 2;
  static STORAGE_KEY_FAILCOUNT = 'navigationFailCount';

  constructor(baseDomain = null) {
    this.baseDomain = baseDomain;
  }

  static async getFailCount() {
    return new Promise(resolve => {
      chrome.storage.local.get([NavigationController.STORAGE_KEY_FAILCOUNT], result => {
        resolve(result[NavigationController.STORAGE_KEY_FAILCOUNT] || 0);
      });
    });
  }

  static async setFailCount(count) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [NavigationController.STORAGE_KEY_FAILCOUNT]: count }, () => {
        resolve();
      });
    });
  }

  async navigateToPath(path, stepName = null, waitForElement = null, linkSelectors = null) {
    try {
      const url = window.buildUrl(this.baseDomain || window.getAccountDomain(), path);
      
      if (stepName) {
        const statusMsg = typeof stepName === 'string' ? `Navigating to ${stepName}...` : 'Navigating...';
        window.progressManager.updateProgress(
          window.progressManager.currentStep,
          statusMsg
        );
      }

      let failCount = await NavigationController.getFailCount();
      
      if (failCount >= NavigationController.MAX_NAVIGATION_FAILS) {
        window.progressManager.setError('Navigation failed repeatedly or redirected to Home. Automation stopped.');
        throw new Error('Navigation failsafe triggered: Too many navigation failures or redirects to Home.');
      }

      if (window.location.pathname === '/' && path !== '/') {
        failCount++;
        await NavigationController.setFailCount(failCount);
        window.progressManager.setError('Redirected to Home page during navigation.');
        throw new Error('Navigation failsafe triggered: Redirected to Home page.');
      }

      if (window.location.href === url) {
        await NavigationController.setFailCount(0);
      } else {
        const navigationSuccess = await this.tryLinkNavigation(path, stepName, waitForElement, linkSelectors);
        
        if (!navigationSuccess) {
          await chrome.storage.local.set({
            [window.STORAGE_KEYS.CURRENT_STEP]: window.progressManager.currentStep,
            allowAutoResume: true
          });
          failCount++;
          await NavigationController.setFailCount(failCount);
          console.log(`Falling back to direct navigation: ${url}.`);
          window.location.href = url;
          await window.waitForUrl(url);
        } else {
          await NavigationController.setFailCount(0);
        }
      }

      if (waitForElement) {
        try {
          await window.waitForElement(waitForElement, window.TIMEOUTS.ELEMENT_WAIT);
        } catch (e) {}
      }

      await this.waitForPageReady(path);
      return true; // Explicitly return true on successful navigation
    } catch (error) {
      try {
        let failCount = await NavigationController.getFailCount();
        failCount++;
        await NavigationController.setFailCount(failCount);
        if (failCount >= NavigationController.MAX_NAVIGATION_FAILS) {
          chrome.storage.local.set({ navigationLocked: true });
        }
      } catch (failError) {}
      throw error;
    }
  }

  async tryLinkNavigation(path, navConfig = null, waitForElement = null, linkSelectors = null) {
    try {
      if (navConfig && navConfig.label) {
        const standardResult = await this.tryStandardNavigation(
          navConfig.label, 
          path,
          navConfig.section
        );
        if (standardResult) {
          return true;
        }
      }

      if (linkSelectors) {
        const selectors = typeof linkSelectors === 'function' ? linkSelectors() : linkSelectors;
        if (selectors && selectors.length > 0) {
          for (const selector of selectors) {
            let elements = [];
            
            if (selector.includes(':contains(')) {
              const text = selector.match(/:contains\("([^\"]+)"\)/)?.[1];
              const baseSelector = selector.split(':contains(')[0] || 'a';
              if (text) {
                elements = Array.from(document.querySelectorAll(baseSelector)).filter(el =>
                  el.textContent.trim().toLowerCase().includes(text.toLowerCase())
                );
              }
            } else {
              elements = Array.from(document.querySelectorAll(selector));
            }

            if (elements.length > 0) {
              for (const element of elements) {
                if (element.offsetParent !== null) {
                  let clickTarget = element;
                  
                  // Only use closest 'a' tag for non-anchor elements, avoid header-profile auto-clicking
                  if (element.tagName !== 'A' && element.closest('a')) {
                    clickTarget = element.closest('a');
                  }
                  
                  clickTarget.click();
                  await window.sleep(window.TIMEOUTS.SHORT);
                  
                  if (window.location.pathname.includes(path.replace('/', ''))) {
                    return true;
                  }
                }
              }
            }
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async tryStandardNavigation(labelText, path, section = null) {
    if (section) {
      const sectionItem = window.findElementByText(window.SELECTORS.NAV_LABEL, section);
      if (sectionItem) {
        const sectionLink = sectionItem.closest('a');
        if (sectionLink) {
          window.clickElement(sectionLink);
          await window.sleep(window.TIMEOUTS.SHORT);
        }
      }
    }

    const menuItem = window.findElementByText(window.SELECTORS.NAV_LABEL, labelText);
    if (menuItem) {
      const link = menuItem.closest('a');
      if (link && link.offsetParent !== null) {
        window.clickElement(link);
        await window.sleep(window.TIMEOUTS.SHORT);
        if (window.location.pathname.includes(path.replace('/', ''))) {
          return true;
        }
      }
    }
    return false;
  }

  async waitForPageReady(path = null) {
    let attempts = 0;
    const maxAttempts = 5;
    const loadingIndicators = ['mat-progress-spinner', '.loading-indicator', '.spinner'];

    while (attempts < maxAttempts) {
      let isLoading = false;
      for (const indicator of loadingIndicators) {
        const loadingEl = document.querySelector(indicator);
        if (loadingEl && loadingEl.offsetParent !== null) {
          isLoading = true;
          break;
        }
      }
      
      if (!isLoading) {
        break;
      }

      attempts++;
      await window.sleep(200);
    }

    return true;
  }
}

window.NavigationController = NavigationController;
if (!window.navigationController) {
  window.navigationController = new NavigationController();
}
