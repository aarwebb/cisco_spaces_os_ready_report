importScripts('constants.js');
importScripts('checks/config.js');

class StorageManager {
  async updateProgress(progressData) {
    try {
      if (!globalThis.STORAGE_KEYS || !globalThis.STORAGE_KEYS.PROGRESS) {
        console.error('Extension error: STORAGE_KEYS.PROGRESS is not defined. Please reload the extension or check constants.js.');
        return;
      }
      const currentProgress = await this.getProgress();
      
      const updatedProgress = {
        ...currentProgress,
        lastUpdated: Date.now(),
        currentStep: progressData.step,
        status: progressData.status,
        details: progressData.details,
        steps: {
          ...currentProgress.steps,
          [progressData.step]: {
            status: progressData.status,
            details: progressData.details,
            timestamp: progressData.timestamp || Date.now()
          }
        }
      };

      await chrome.storage.local.set({
        [globalThis.STORAGE_KEYS.PROGRESS]: updatedProgress
      });

    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  }

  async getProgress() {
    try {
      if (!globalThis.STORAGE_KEYS || !globalThis.STORAGE_KEYS.PROGRESS) {
        console.error('Extension error: STORAGE_KEYS.PROGRESS is not defined. Please reload the extension or check constants.js.');
        return this.getDefaultProgress();
      }
      const result = await chrome.storage.local.get([globalThis.STORAGE_KEYS.PROGRESS]);
      return result[globalThis.STORAGE_KEYS.PROGRESS] || this.getDefaultProgress();
    } catch (error) {
      console.error('Error getting progress:', error);
      return this.getDefaultProgress();
    }
  }

  async clearProgress() {
    try {
      if (!globalThis.STORAGE_KEYS || !globalThis.STORAGE_KEYS.PROGRESS) {
        console.error('Extension error: STORAGE_KEYS.PROGRESS is not defined. Please reload the extension or check constants.js.');
        return;
      }
      await chrome.storage.local.remove([
        globalThis.STORAGE_KEYS.PROGRESS,
        globalThis.STORAGE_KEYS.REPORT_DATA,
        globalThis.STORAGE_KEYS.CURRENT_STEP
      ]);
    } catch (error) {
      console.error('Error clearing progress:', error);
      throw error;
    }
  }

  async storeReportData(reportData) {
    try {
      await chrome.storage.local.set({
        [globalThis.STORAGE_KEYS.REPORT_DATA]: {
          ...reportData,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error storing report data:', error);
      throw error;
    }
  }

  async getReportData() {
    try {
      const result = await chrome.storage.local.get([globalThis.STORAGE_KEYS.REPORT_DATA]);
      return result[globalThis.STORAGE_KEYS.REPORT_DATA] || null;
    } catch (error) {
      console.error('Error getting report data:', error);
      return null;
    }
  }

  async setCurrentStep(step) {
    try {
      await chrome.storage.local.set({
        [globalThis.STORAGE_KEYS.CURRENT_STEP]: step
      });
    } catch (error) {
      console.error('Error setting current step:', error);
      throw error;
    }
  }

  async getCurrentStep() {
    try {
      const result = await chrome.storage.local.get([globalThis.STORAGE_KEYS.CURRENT_STEP]);
      return result[globalThis.STORAGE_KEYS.CURRENT_STEP] || null;
    } catch (error) {
      console.error('Error getting current step:', error);
      return null;
    }
  }

  getDefaultProgress() {
    return {
      lastUpdated: null,
      currentStep: null,
      status: 'idle',
      details: '',
      steps: {}
    };
  }

  onStorageChanged(callback) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        callback(changes);
      }
    });
  }
}

globalThis.StorageManager = StorageManager;

// Function to load and apply user's enabled checks configuration
async function loadEnabledChecksConfiguration() {
  try {
    const result = await chrome.storage.local.get(['enabledChecks']);
    const storedChecks = result.enabledChecks || {};
    
    if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
      globalThis.REPORT_CHECKS.forEach(check => {
        if (storedChecks.hasOwnProperty(check.key)) {
          check.enabled = storedChecks[check.key];
        }
        // If no stored state, keep the default enabled state from config
      });
      console.log('Enabled checks configuration loaded:', 
        globalThis.REPORT_CHECKS.filter(c => c.enabled).map(c => c.name));
    }
  } catch (error) {
    console.error('Error loading enabled checks configuration:', error);
  }
}

globalThis.MessageHandlers = class MessageHandlers {
  constructor() {
    this.storageManager = new StorageManager();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'start_collection':
          await this.handleGenerateReport(message, sender, sendResponse);
          break;

        case 'navigate_to_page':
          await this.handleNavigateToPage(message, sender, sendResponse);
          break;

        case 'reset_collection':
          await this.handleClearProgress(message, sender, sendResponse);
          break;

        case 'update_progress':
          await this.handleUpdateProgress(message, sender, sendResponse);
          break;

        case 'update_instructions':
          await this.handleUpdateProgressMessage(message, sender, sendResponse);
          break;

        case 'report_complete':
          await this.handleReportComplete(message, sender, sendResponse);
          break;

        case 'open_report_tab':
          await this.handleOpenReportTab(message, sender, sendResponse);
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGenerateReport(message, sender, sendResponse) {
    try {
      await this.storageManager.clearProgress();
      
      // Load user's enabled checks configuration before starting
      await loadEnabledChecksConfiguration();

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }

      if (!tab.url || !tab.url.includes('dnaspaces')) {
        throw new Error('Please navigate to a Cisco Spaces page first');
      }

      let response;
      try {
        response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, {
            type: 'start_collection'
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Message timeout')), 5000)
          )
        ]);
        
      } catch (connectionError) {
        let isLoaded = false;
        try {
          const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                hasAutomation: window.osReadyAutomation !== undefined,
                hasMessageTypes: window.MESSAGE_TYPES !== undefined,
                hasOSReadyAutomation: window.OSReadyAutomation !== undefined
              };
            }
          });
          
          const checkResult = result[0]?.result;
          isLoaded = checkResult?.hasAutomation === true;
        } catch (e) {
          console.error('Failed to check if content script is loaded:', e);
        }
        
        if (!isLoaded) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: [
                'checks/config.js',
                'utils.js', 
                'progress.js',
                'navigation.js',
                'checks/account.js',
                'checks/location.js',
                'checks/wireless.js',
                'checks/connectors.js',
                'checks/integrations.js',
              ]
            });
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            let verificationAttempts = 0;
            let verifyResult;
            
            while (verificationAttempts < 3) {
              try {
                verifyResult = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: () => {
                    return {
                      hasAutomation: window.osReadyAutomation !== undefined,
                      hasMessageTypes: window.MESSAGE_TYPES !== undefined,
                      messageType: window.MESSAGE_TYPES?.START_COLLECTION,
                      automationType: typeof window.osReadyAutomation,
                      isFunction: typeof window.osReadyAutomation?.startCollection === 'function'
                    };
                  }
                });
                
                if (verifyResult[0]?.result?.hasAutomation && verifyResult[0]?.result?.isFunction) {
                  break;
                }
                
                verificationAttempts++;
                if (verificationAttempts < 3) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              } catch (e) {
                console.error('Verification attempt failed:', e);
                verificationAttempts++;
                if (verificationAttempts < 3) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            }
            
            if (!verifyResult[0]?.result?.hasAutomation || !verifyResult[0]?.result?.isFunction) {
              throw new Error('Content script injection failed - automation object not properly initialized');
            }
          } catch (injectionError) {
            console.error('Failed to inject content script:', injectionError);
            throw new Error('Failed to initialize content script. Please refresh the page and try again.');
          }
        }
        
        try {
          response = await chrome.tabs.sendMessage(tab.id, {
            type: 'start_collection'
          });
          
        } catch (retryError) {
          console.error('Failed to send message after injection:', retryError);
          
          try {
            const directResponse = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                return new Promise((resolve) => {
                  const checkAndStart = () => {
                    if (window.osReadyAutomation && typeof window.osReadyAutomation.startCollection === 'function') {
                      window.osReadyAutomation.startCollection()
                        .then(() => {
                          resolve({ success: true, message: 'Collection started successfully' });
                          resolve({ success: true, method: 'direct_execution' });
                        })
                        .catch(error => {
                          console.error('Collection failed:', error);
                          resolve({ success: false, error: error.message });
                        });
                    } else if (window.OSReadyAutomation) {
                      try {
                        window.osReadyAutomation = new window.OSReadyAutomation();
                        setTimeout(checkAndStart, 100);
                      } catch (e) {
                        console.error('Failed to create automation instance:', e);
                        resolve({ success: false, error: 'Failed to create automation instance: ' + e.message });
                      }
                    } else {
                      console.error('Neither osReadyAutomation nor OSReadyAutomation available');
                      resolve({ success: false, error: 'Automation classes not available for direct execution' });
                    }
                  };
                  
                  checkAndStart();
                });
              }
            });
            
            response = directResponse[0]?.result;
            if (!response?.success) {
              throw new Error(response?.error || 'Direct execution failed');
            }
            
          } catch (directError) {
            console.error('Content script not responding. Please refresh the page and try again.', directError);
            throw new Error('Content script not responding. Please refresh the page and try again.');
          }
        }
      }

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to start automation in content script');
      }

      sendResponse({ success: true, message: 'Report generation started' });
    } catch (error) {
      console.error('Error generating report:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleNavigateToPage(message, sender, sendResponse) {
    try {
      const { url } = message;
      
      if (!url) {
        throw new Error('URL is required for navigation');
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }

      await chrome.tabs.update(tab.id, { url });

      sendResponse({ success: true, message: 'Navigation initiated' });
    } catch (error) {
      console.error('Error navigating to page:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleClearProgress(message, sender, sendResponse) {
    try {
      await this.storageManager.clearProgress();
      sendResponse({ success: true, message: 'Progress cleared' });
    } catch (error) {
      console.error('Error clearing progress:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleUpdateProgress(message, sender, sendResponse) {
    try {
      const { step, status, details } = message;
      
      await this.storageManager.updateProgress({
        step,
        status,
        details,
        timestamp: Date.now()
      });

      sendResponse({ success: true, message: 'Progress updated' });
    } catch (error) {
      console.error('Error updating progress:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleUpdateProgressMessage(message, sender, sendResponse) {
    try {
      const { text } = message;
      
      await chrome.storage.local.set({ 
        [globalThis.STORAGE_KEYS.CURRENT_INSTRUCTION]: text 
      });

      sendResponse({ success: true, message: 'Progress message updated' });
    } catch (error) {
      console.error('Error updating progress message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleReportComplete(message, sender, sendResponse) {
    try {
      const currentProgress = await this.storageManager.getProgress();
      const now = Date.now();
      const updatedSteps = { ...currentProgress.steps };
      
      // Use REPORT_CHECKS with enabled filtering
      const enabledChecks = globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled) : [];
      
      if (enabledChecks.length > 0) {
        for (const check of enabledChecks) {
          updatedSteps[check.name] = {
            ...(updatedSteps[check.name] || {}),
            status: 'completed',
            details: 'Report generated',
            timestamp: now
          };
        }
      }
      
      const lastStep = enabledChecks.length > 0 ? enabledChecks[enabledChecks.length - 1].name : 'Generate Report';
      const updatedProgress = {
        ...currentProgress,
        status: 'completed',
        lastUpdated: now,
        currentStep: lastStep,
        details: 'Report generated',
        steps: updatedSteps
      };
      await chrome.storage.local.set({
        [globalThis.STORAGE_KEYS.PROGRESS]: updatedProgress
      });
      sendResponse({ success: true, message: 'Report complete' });
    } catch (error) {
      console.error('Error handling report completion:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleOpenReportTab(message, sender, sendResponse) {
    try {
      const reportUrl = chrome.runtime.getURL('report.html');
      await chrome.tabs.create({ 
        url: reportUrl, 
        active: message.active !== false
      });

      sendResponse({ success: true, message: 'Report tab opened' });
    } catch (error) {
      console.error('Error opening report tab:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

if (globalThis.MessageHandlers) {
  const messageHandlers = new globalThis.MessageHandlers();
  messageHandlers.init();
}

