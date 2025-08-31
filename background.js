// --- Privileged cookie retrieval utility ---
function fetchSysTokenForActiveTab() {
  console.log('[background] fetchSysTokenForActiveTab called');
  return new Promise((resolve, reject) => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.warn('[background] No active tab found for sys-token retrieval');
        reject(new Error('No active tab found'));
        return;
      }
      const url = new URL(tab.url);
      const domain = url.hostname;
      chrome.cookies.get({url: url.origin, name: 'sys-token'}, cookie => {
        if (cookie && cookie.value) {
          console.log(`[background] sys-token cookie found for domain ${domain}`);
          resolve(cookie.value);
        } else {
          console.warn(`[background] sys-token cookie not found for domain: ${domain}`);
          reject(new Error('sys-token cookie not found for domain: ' + domain));
        }
      });
    });
  });
}


// --- StorageManager: Handles extension storage operations ---
// StorageManager now only handles storing and retrieving the final report data
class StorageManager {
  async saveReportData(reportData) {
    console.log('[background] Saving report data to storage');
    await chrome.storage.local.set({ reportData });
    console.log('[background] Report data saved');
  }

  async getReportData() {
    console.log('[background] Retrieving report data from storage');
    const result = await chrome.storage.local.get(['reportData']);
    if (result.reportData) {
      console.log('[background] Report data found');
    } else {
      console.log('[background] No report data found');
    }
    return result.reportData || null;
  }

  async clearReportData() {
    console.log('[background] Clearing report data from storage');
    await chrome.storage.local.remove(['reportData']);
    console.log('[background] Report data cleared');
  }
}

// --- Message Handlers: Handles extension messages ---
class MessageHandlers {
  constructor() {
    this.storageManager = new StorageManager();
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // keep channel open for async
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      console.log(`[background] Message received: ${message.type}`);
  switch (message.type) {
        case 'get_account_info': {
          console.log('[background] Relaying get_account_info to dnaspaces.io tab');
          chrome.tabs.query({ url: '*://*.dnaspaces.io/*' }, (tabs) => {
            if (tabs && tabs.length > 0) {
              const targetTabId = tabs[0].id;
              chrome.tabs.sendMessage(targetTabId, { type: 'get_account_info' }, (response) => {
                sendResponse(response);
              });
            } else {
              sendResponse({ customerName: null, tenantId: null });
            }
          });
          return true;
        }
        case 'start_collection': {
          console.log('[background] Relaying start_collection to content script');
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs || tabs.length === 0) {
              console.warn('[background] No active tab found for start_collection');
              sendResponse({ success: false, error: 'No active tab found' });
              return;
            }
            const tabId = tabs[0].id;
            if (!tabId) {
              console.warn('[background] Active tab has no id');
              sendResponse({ success: false, error: 'Active tab has no id' });
              return;
            }
            chrome.tabs.sendMessage(tabId, { type: 'start_collection' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('[background] Error sending start_collection to content script:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
              }
              console.log('[background] start_collection relayed, response:', response);
              sendResponse(response || { success: true, message: 'start_collection relayed to content script' });
            });
          });
          return true;
        }
        case 'get_sys_token': {
          console.log('[background] Fetching sys-token for active tab');
          try {
            const token = await fetchSysTokenForActiveTab();
            console.log('[background] sys-token retrieved:', token);
            sendResponse({ success: true, sysToken: token });
          } catch (err) {
            console.warn('[background] Failed to retrieve sys-token:', err.message);
            sendResponse({ success: false, error: err.message });
          }
          break;
        }
        case 'save_report':
          console.log('[background] Saving report data via message');
          await this.storageManager.saveReportData(message.reportData);
          sendResponse({ success: true });
          break;
        case 'get_report': {
          console.log('[background] Getting report data via message');
          const reportData = await this.storageManager.getReportData();
          sendResponse({ success: true, reportData });
          break;
        }
        case 'clear_report':
          console.log('[background] Clearing report data via message');
          await this.storageManager.clearReportData();
          sendResponse({ success: true });
          break;
        case 'open_report_tab':
          console.log('[background] Opening report tab');
          const tab = await chrome.tabs.create({
            url: chrome.runtime.getURL('report.html'),
            active: message.active !== false
          });
          console.log('[background] Report tab opened, tabId:', tab.id);
          sendResponse({ success: true, tabId: tab.id });
          break;
        case 'REPORT_COMPLETE':
        case 'report_complete': {
          console.log('[background] REPORT_COMPLETE received. Report data:', message.reportData);
          // Set progress status to completed in storage
          chrome.storage.local.set({ progress: { status: 'completed' } }, () => {
            sendResponse({ success: true });
          });
          break;
        }
        // Add more message types as needed
        default:
          console.warn(`[background] Unknown message type: ${message.type}`);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
}

// --- Privileged APIs and event handlers (Manifest V3 service worker) ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Handle tab updates if needed
});

// Add any other privileged event handlers here

// Clear all stored data on extension refresh/install except enabledChecks
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['enabledChecks'], (items) => {
    const enabledChecks = items.enabledChecks;
    chrome.storage.local.clear(() => {
      if (enabledChecks !== undefined) {
        chrome.storage.local.set({ enabledChecks }, () => {
          console.log('[background] Storage cleared on install/update, enabledChecks persisted');
        });
      } else {
        console.log('[background] Storage cleared on install/update, no enabledChecks found to persist');
      }
    });
  });
});

// Initialize message handlers
const messageHandlers = new MessageHandlers();

console.log('Spaces OS Ready Report v2 background script loaded (privileged APIs, storage, and messaging)');
