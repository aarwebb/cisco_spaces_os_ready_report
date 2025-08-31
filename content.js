// Utility: generateTimestamp
function generateTimestamp() {
    return new Date().toLocaleString();
}
function initializeContent() {
    console.log('[content] Initializing content script');
    window.spacesExtensionContentLoaded = true;
    window.addEventListener('unload', () => {
        console.log('[content] Content script unloaded, cleanup complete');
    });

    // Removed the first chrome.runtime.onMessage.addListener block to prevent duplicate execution of start_collection
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
    let totalProgressUnits = 0;
    let completedProgressUnits = 0;

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

        // --- Calculate total progress units ---
        // Estimate: 1 unit per endpoint per check, plus any extra steps (location processor, etc.)
        for (const step of stepConfigs) {
            // Use endpoints array from each checker if available
            let unitsForStep = 1;
            if (globalThis[step.checkerClass] && typeof globalThis[step.checkerClass].getProgressUnitEstimate === 'function') {
                unitsForStep = await globalThis[step.checkerClass].getProgressUnitEstimate();
            } else {
                // Fallback: try to infer from known endpoints
                if (step.checkerClass === 'AccountChecker') unitsForStep = 4;
                else if (step.checkerClass === 'LocationChecker') unitsForStep = 4;
                else if (step.checkerClass === 'WirelessChecker') unitsForStep = 2;
                else if (step.checkerClass === 'ConnectorChecker') unitsForStep = 1;
                else if (step.checkerClass === 'IntegrationsChecker') unitsForStep = 4;
                else if (step.checkerClass === 'IoTChecker') unitsForStep = 4;
                else if (step.checkerClass === 'RightNowChecker') unitsForStep = 2;
            }
            totalProgressUnits += unitsForStep;
        }
        console.log(`[progress] Total progress units estimated: ${totalProgressUnits}`);
        await chrome.storage.local.set({ [window.STORAGE_KEYS.PROGRESS]: { status: "in_progress", totalProgressUnits, completedProgressUnits: 0 } });

        // Always initialize reportData as a fresh object to avoid stale data
        let reportData = {
            'Report Generated': generateTimestamp(),
            'Domain': domain
        };

        // Run each check, then run analysis, then store both in reportData
        for (let i = 0; i < stepConfigs.length; i++) {
            const checkerClass = stepConfigs[i].checkerClass;
            const method = stepConfigs[i].method;
            const checkKey = globalThis.REPORT_CHECKS.find(c => c.checker === checkerClass)?.key;
            if (!checkerClass || !method || !checkKey) {
                console.warn(`[content] Step config missing checkerClass, method, or key at index ${i}`);
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
            // Progress callback for this check
            function incrementProgress(units = 1) {
                completedProgressUnits += units;
                chrome.storage.local.set({ [window.STORAGE_KEYS.PROGRESS]: { status: "in_progress", totalProgressUnits, completedProgressUnits } });
                console.log(`[progress] Completed progress units: ${completedProgressUnits}/${totalProgressUnits}`);
            }
            try {
                result = await checkerInstance[method]({ onProgress: incrementProgress });
                console.log(`[content] Checker '${checkerClass}.${method}' succeeded:`, result);
            } catch (e) {
                console.warn(`[content] Checker '${checkerClass}.${method}' failed:`, e);
                reportData.errors = reportData.errors || [];
                reportData.errors.push(`Execution error: ${stepConfigs[i].name}: ${e.message}`);
                result = null;
            }
            if (result !== null && typeof result === 'object') {
                // Store check result under its key
                reportData[checkKey] = result[checkKey] || result;
                // Run analysis if available
                if (window.AnalysisModules && typeof window.AnalysisModules[checkKey] === 'function') {
                    // Always use result[checkKey].parsedData if available, else result[checkKey], else result
                    let parsed;
                    if (result[checkKey] && result[checkKey].parsedData) {
                        parsed = result[checkKey].parsedData;
                    } else if (result[checkKey]) {
                        parsed = result[checkKey];
                    } else if (result.parsedData) {
                        parsed = result.parsedData;
                    } else {
                        parsed = result;
                    }
                    const analysisResult = window.AnalysisModules[checkKey](parsed);
                    reportData[`${checkKey}_analysis`] = analysisResult;
                    console.log(`[content] Analysis for '${checkKey}':`, analysisResult);
                }
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
            [window.STORAGE_KEYS.PROGRESS]: { status: "completed", totalProgressUnits, completedProgressUnits: totalProgressUnits }
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
    } else if (message.type === 'get_account_info') {
        // Return customerName and tenantId from sessionStorage
        const customerName = window.sessionStorage.getItem('customerName');
        const tenantId = window.sessionStorage.getItem('tenantId');
        sendResponse({ customerName, tenantId });
        return true;
    } else if (message.type === 'save_report') {
        chrome.runtime.sendMessage({ type: 'save_report', reportData: message.reportData }, (response) => {
            sendResponse(response);
        });
        return true;
    } else if (message.type === 'get_report') {
        chrome.runtime.sendMessage({ type: 'get_report' }, (response) => {
            sendResponse(response);
        });
        return true;
    } else if (message.type === 'clear_report') {
        chrome.runtime.sendMessage({ type: 'clear_report' }, (response) => {
            sendResponse(response);
        });
        return true;
    } else if (message.type === 'open_report_tab') {
        chrome.runtime.sendMessage({ type: 'open_report_tab', active: message.active }, (response) => {
            sendResponse(response);
        });
        return true;
    }
});
