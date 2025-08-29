function initializeContent() {
    console.log('[content] Initializing content script');
    window.spacesExtensionContentLoaded = true;
    window.addEventListener('unload', () => {
        console.log('[content] Content script unloaded, cleanup complete');
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log(`[content] Message received: ${message.type}`);
        if (message.type === 'start_collection') {
            console.log('[content] start_collection triggered');
            start_collection().then(() => {
                console.log('[content] start_collection completed');
                sendResponse({ success: true, message: 'start_collection completed' });
            }).catch((error) => {
                console.warn('[content] start_collection failed:', error);
                sendResponse({ success: false, error: error?.message || 'start_collection failed' });
            });
            return true;
        } else if (message.type === 'save_report') {
            console.log('[content] save_report message received');
            chrome.runtime.sendMessage({ type: 'save_report', reportData: message.reportData }, (response) => {
                console.log('[content] save_report response:', response);
                sendResponse(response);
            });
            return true;
        } else if (message.type === 'get_report') {
            console.log('[content] get_report message received');
            chrome.runtime.sendMessage({ type: 'get_report' }, (response) => {
                console.log('[content] get_report response:', response);
                sendResponse(response);
            });
            return true;
        } else if (message.type === 'clear_report') {
            console.log('[content] clear_report message received');
            chrome.runtime.sendMessage({ type: 'clear_report' }, (response) => {
                console.log('[content] clear_report response:', response);
                sendResponse(response);
            });
            return true;
        } else if (message.type === 'open_report_tab') {
            console.log('[content] open_report_tab message received');
            chrome.runtime.sendMessage({ type: 'open_report_tab', active: message.active }, (response) => {
                console.log('[content] open_report_tab response:', response);
                sendResponse(response);
            });
            return true;
        } else if (message.type === 'get_account_info') {
            const customerName = window.sessionStorage.getItem('customerName');
            const tenantId = window.sessionStorage.getItem('tenantId');
            sendResponse({ customerName, tenantId });
            return true;
        }
        return true; // Ensure this line is still present
    });
}

// Main entry for collection automation, can be triggered by background
async function start_collection() {
    console.log('[content] Orchestrating checks and collecting final report data');
    const reportData = await startAutomation();
    console.log('[content] Report data collected (top-level keys):', Object.keys(reportData));
    console.log('[content] Full report data:', reportData);
    // Send the final report data to background.js for privileged storage
    chrome.runtime.sendMessage({ type: 'save_report', reportData }, (response) => {
        if (response && response.success) {
            console.log('[content] Report data saved successfully');
            // Signal report completion
            chrome.runtime.sendMessage({ type: 'report_complete', reportData });
        } else {
            console.warn('[content] Failed to save report data:', response && response.error);
        }
    });
}


// Removed setupStateCleanup and checkForAutoResume as part of stateless refactor

// --- Helper: Retrieve sys-token from background ---
async function setSysTokenFromBackground() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'get_sys_token' }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('[content] Failed to get sys-token from background:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
            }
            if (response && response.sysToken) {
                window.SYS_TOKEN = response.sysToken;
                console.log('[content] sys-token received and set:', response.sysToken);
                resolve(response.sysToken);
            } else {
                console.warn('[content] No sys-token received from background');
                reject(new Error('No sys-token received'));
            }
        });
    });
}

// --- Orchestration: Main automation runner ---
async function startAutomation() {
    const domain = window.location.hostname;
    const startTime = Date.now();
    let totalCalls = 0;
    let completedCalls = 0;

    try {

        // Ensure required globals are present
        const requiredGlobals = Array.isArray(globalThis.OS_READY_GLOBALS) ? globalThis.OS_READY_GLOBALS : [];
        for (const key of requiredGlobals) {
            if (typeof globalThis[key] === 'undefined') {
                throw new Error(`Required global '${key}' is not defined. Make sure constants.js is loaded first.`);
            }
        }

        // Rebuild steps config if available
        if (globalThis.rebuildStepsConfig) {
            const steps = globalThis.rebuildStepsConfig();
            console.log(`Using ${steps.length} enabled steps: ${steps.map(s => s.id).join(', ')}`);
        }

        // Load enabled checks configuration
        const result = await chrome.storage.local.get(['enabledChecks']);
        const storedChecks = result.enabledChecks || {};
        if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
            globalThis.REPORT_CHECKS.forEach(check => {
                if (storedChecks.hasOwnProperty(check.key)) {
                    check.enabled = storedChecks[check.key];
                }
            });
            console.log('Loaded enabled checks configuration from storage');
        }

        // Filter enabled checks and build step configs
        const enabledChecks = globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled && c.checker) : [];
        console.log(`Found ${enabledChecks.length} enabled checks:`, enabledChecks.map(c => c.name));
        const stepConfigs = enabledChecks.map(check => ({
            name: check.name,
            checkerClass: check.checker,
            method: check.method
        }));

        // --- Calculate total API calls ---
        for (const step of stepConfigs) {
            // Default: 1 call per check
            let callsForStep = 1;
            // Special handling for known multi-endpoint checks
            if (step.checkerClass === 'LocationChecker') {
                // Estimate locationProcessor calls (dynamic, fallback to 10)
                if (globalThis.LocationProcessor && typeof globalThis.LocationProcessor.getLocationCount === 'function') {
                    try {
                        callsForStep = await globalThis.LocationProcessor.getLocationCount();
                    } catch (e) {
                        callsForStep = 10;
                    }
                } else {
                    callsForStep = 10;
                }
                // Add endpoints in LocationChecker.execute()
                callsForStep += 3; // BUILDINGS_LIST, CMX_LOCATIONS_COUNT, MERAKI_LOCATIONS_COUNT
            } else if (step.checkerClass === 'AccountChecker') {
                callsForStep = 4; // ACCOUNT, LICENSE_USAGE, SMART_LICENSE, ADMIN_USERS
            } else if (step.checkerClass === 'WirelessChecker') {
                callsForStep = 2;
            } else if (step.checkerClass === 'ConnectorChecker') {
                callsForStep = 1;
            } else if (step.checkerClass === 'IntegrationsChecker') {
                callsForStep = 3; // DNAC_ACTIVATIONS, WEBEX_AUTH_STATUS, MERAKI_INTEGRATION
                // Calendar endpoint may be added dynamically
                if (globalThis.getTenantInfo) {
                    try {
                        const tenantInfo = await globalThis.getTenantInfo();
                        if (tenantInfo?.tenantId) {
                            callsForStep += 1;
                        }
                    } catch (e) {}
                }
            }
            totalCalls += callsForStep;
        }
        console.log(`[progress] Total API calls estimated: ${totalCalls}`);
        await chrome.storage.local.set({ [window.STORAGE_KEYS.PROGRESS]: { status: "in_progress", totalCalls, completedCalls: 0 } });

        // Restore report data from storage or initialize
        const saved = await chrome.storage.local.get([globalThis.STORAGE_KEYS.REPORT_DATA]);
        let reportData = saved[globalThis.STORAGE_KEYS.REPORT_DATA] || {
            'Report Generated': window.generateTimestamp ? window.generateTimestamp() : new Date().toISOString(),
            'Domain': domain
        };

        // Run each check and flatten results into reportData
        for (let i = 0; i < stepConfigs.length; i++) {
            const checkerClass = stepConfigs[i].checkerClass;
            const method = stepConfigs[i].method;
            if (!checkerClass || !method) {
                console.warn(`[content] Step config missing checkerClass or method at index ${i}`);
                continue;
            }

            let checkerInstance;
            try {
                checkerInstance = new window[checkerClass](domain);
                console.log(`[content] Instantiated checker '${checkerClass}' for step '${stepConfigs[i].name}'`);
            } catch (e) {
                console.warn(`[content] Failed to instantiate checker '${checkerClass}':`, e);
                continue;
            }
            let result;
            if (typeof checkerInstance[method] !== 'function') {
                console.warn(`[content] Checker '${checkerClass}' does not have method '${method}'`);
                continue;
            }
            try {
                result = await checkerInstance[method]();
                completedCalls += (checkerClass === 'LocationChecker') ? (globalThis.LocationProcessor && typeof globalThis.LocationProcessor.getLocationCount === 'function' ? await globalThis.LocationProcessor.getLocationCount() + 3 : 13) : (checkerClass === 'AccountChecker' ? 4 : checkerClass === 'WirelessChecker' ? 2 : checkerClass === 'ConnectorChecker' ? 1 : checkerClass === 'IntegrationsChecker' ? 3 : 1);
                await chrome.storage.local.set({ [window.STORAGE_KEYS.PROGRESS]: { status: "in_progress", totalCalls, completedCalls } });
                console.log(`[progress] Completed API calls: ${completedCalls}/${totalCalls}`);
                console.log(`[content] Checker '${checkerClass}.${method}' succeeded:`, result);
            } catch (e) {
                console.warn(`[content] Checker '${checkerClass}.${method}' failed:`, e);
                reportData.errors = reportData.errors || [];
                reportData.errors.push(`Execution error: ${stepConfigs[i].name}: ${e.message}`);
                result = null;
            }
            if (result !== null && typeof result === 'object') {
                // PATCH: Flatten each check result into reportData
                Object.assign(reportData, result);
            }
        }

        // Finalize report
        const endTime = Date.now();
        const executionTimeMs = endTime - startTime;
        const executionTimeFormatted = typeof formatExecutionTime === 'function'
            ? formatExecutionTime(executionTimeMs)
            : `${executionTimeMs} ms`;
        reportData['Execution Time'] = executionTimeFormatted;
        console.log(`[content] Report finalized. Execution time: ${executionTimeFormatted}`);

        // Store the report data
        await chrome.storage.local.set({
            [window.STORAGE_KEYS.REPORT_DATA]: reportData,
            [window.STORAGE_KEYS.PROGRESS]: { status: "completed", totalCalls, completedCalls: totalCalls }
        });
        console.log('[content] Report data stored in chrome.storage.local');

        // Notify background and UI of completion
        chrome.runtime.sendMessage({
            type: window.MESSAGE_TYPES ? window.MESSAGE_TYPES.REPORT_COMPLETE : 'REPORT_COMPLETE',
            reportData
        });
        console.log('[content] REPORT_COMPLETE message sent to background/UI');

        return reportData;
    } catch (error) {
        console.error('[content] startAutomation encountered an error:', error);
        throw error;
    }
}

// --- Main entry point: Wait for sys-token, then initialize everything ---
(async () => {
    window.osReadyAutomation = { startCollection: startAutomation };
    console.log('[content] Content script entry point, initializing');
    initializeContent();
    console.log('[content] Debug: globalThis.MESSAGE_TYPES:', globalThis.MESSAGE_TYPES);
    console.log('[content] Debug: globalThis.STORAGE_KEYS:', globalThis.STORAGE_KEYS);
    console.log('[content] Debug: typeof chrome:', typeof chrome);
    console.log('[content] Debug: typeof chrome.storage:', typeof chrome?.storage);
    console.log('[content] Debug: typeof chrome.storage.local:', typeof chrome?.storage?.local);

    chrome.storage.local.get([globalThis.STORAGE_KEYS?.PROGRESS], result => {
        console.log('[content] Debug: Initial progress in storage:', result);
    });
})();

// Only fetch sys-token when collection is started
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'start_collection') {
        setSysTokenFromBackground().then(() => {
            start_collection().then(() => {
                sendResponse({ success: true, message: 'start_collection completed' });
            }).catch((error) => {
                sendResponse({ success: false, error: error?.message || 'start_collection failed' });
            });
        }).catch((error) => {
            sendResponse({ success: false, error: error?.message || 'Failed to get sys-token' });
        });
        return true;
    }
});
