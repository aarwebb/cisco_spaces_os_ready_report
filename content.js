async function resetNavigationFailCount() {
    await chrome.storage.local.set({ navigationFailCount: 0 });
    if (window.progressManager) {
        window.progressManager.setError('Navigation fail count has been reset. You may now retry automation.');
    }
}

window.resetNavigationFailCount = resetNavigationFailCount;

async function clearAutomationState() {
    const keysToClear = [
        window.STORAGE_KEYS.CURRENT_STEP,
        window.STORAGE_KEYS.REPORT_DATA,
        window.STORAGE_KEYS.PROGRESS,
        window.STORAGE_KEYS.CURRENT_INSTRUCTION
    ];
    await chrome.storage.local.remove(keysToClear);
}

function formatExecutionTime(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${seconds}s`;
    }
}

async function startAutomation() {
    const startTime = Date.now();
    
    try {
        const [failCount, persistedLock] = await Promise.all([
            NavigationController.getFailCount(),
            new Promise(resolve => {
                chrome.storage.local.get(['navigationLocked'], result => {
                    resolve(result.navigationLocked || false);
                });
            })
        ]);

        if (failCount >= NavigationController.MAX_NAVIGATION_FAILS || persistedLock) {
            chrome.storage.local.set({ navigationLocked: true });
            window.navigationLocked = true;
            if (window.ProgressManager) {
                window.progressManager = new window.ProgressManager();
                window.progressManager.init();
                window.progressManager.setError('Navigation failed repeatedly or redirected to Home. Automation stopped.');
            }
            return;
        }

        const requiredGlobals = Array.isArray(globalThis.OS_READY_GLOBALS) ? globalThis.OS_READY_GLOBALS : [];
        for (const key of requiredGlobals) {
            if (typeof globalThis[key] === 'undefined') {
                throw new Error(`Required global '${key}' is not defined. Make sure constants.js is loaded first.`);
            }
        }

        // Force rebuild of steps configuration to ensure it matches current config
        if (globalThis.rebuildStepsConfig) {
            const steps = globalThis.rebuildStepsConfig();
            console.log(`Using ${steps.length} enabled steps: ${steps.map(s => s.id).join(', ')}`);
        }

        // Load user's enabled checks configuration
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
                console.log('Loaded enabled checks configuration from storage');
            }
        } catch (error) {
            console.error('Error loading enabled checks configuration:', error);
        }

        // Use REPORT_CHECKS configuration and filter by enabled status
        const enabledChecks = globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled && c.checker) : [];
        console.log(`Found ${enabledChecks.length} enabled checks:`, enabledChecks.map(c => c.name));
        
        // Convert REPORT_CHECKS format to stepConfigs format for compatibility
        const stepConfigs = enabledChecks.map(check => ({
            name: check.name,
            checkerClass: check.checker,
            method: check.method
        }));

        const checkerClasses = stepConfigs.map(cfg => cfg.checkerClass).filter(Boolean);
        for (const cls of checkerClasses) {
            if (typeof window[cls] === 'undefined') {
                console.warn(`Checker class '${cls}' is not defined - this check will be skipped`);
                // Don't throw error, just warn since we're filtering based on enabled checks
            }
        }

        const savedStep = await chrome.storage.local.get([globalThis.STORAGE_KEYS.CURRENT_STEP, globalThis.STORAGE_KEYS.REPORT_DATA]);
        const currentStep = savedStep[globalThis.STORAGE_KEYS.CURRENT_STEP];
        let reportData = savedStep[globalThis.STORAGE_KEYS.REPORT_DATA] || {};

        const domain = window.getAccountDomain();

        globalThis.navigationController = new NavigationController(domain);

        window.progressManager = new window.ProgressManager();
        window.progressManager.init();
        
        if (currentStep) {
            for (let i = 1; i < currentStep; i++) {
                window.progressManager.updateResults(stepConfigs[i-1].name, {});
            }
            window.progressManager.updateProgress(currentStep, window.PROGRESS_STATUS.IN_PROGRESS);
            await window.sleep(1000);
        } else {
            window.progressManager.updateProgress(0, window.PROGRESS_STATUS.IN_PROGRESS);
            reportData = {
                'Report Generated': window.generateTimestamp(),
                'Domain': domain
            };
        }

        for (let i = 0; i < stepConfigs.length; i++) {
            const stepNum = i + 1;
            if (currentStep && currentStep > stepNum) {
                continue;
            }
            const stepName = stepConfigs[i].name || `Step ${stepNum}`;

            window.progressManager.updateProgress(stepNum, window.PROGRESS_STATUS.IN_PROGRESS);
            
            // Small delay to ensure in-progress state is visible before starting execution
            await window.sleep(200);
            const checkerClass = stepConfigs[i].checkerClass;
            const method = stepConfigs[i].method;
            if (!checkerClass || !method) {
                continue;
            }
            let checkerInstance;
            try {
                if (checkerClass === 'AccountExtractor') {
                    checkerInstance = new window.AccountExtractor();
                } else {
                    checkerInstance = new window[checkerClass](domain);
                }
            } catch (e) {
                continue;
            }
            let result;
            if (typeof checkerInstance[method] !== 'function') {
                continue;
            }
            try {
                result = await checkerInstance[method]();
            } catch (e) {
                result = null;
            }
            if (result === null) {
                await chrome.storage.local.set({ 
                    [globalThis.STORAGE_KEYS.CURRENT_STEP]: stepNum,
                    [globalThis.STORAGE_KEYS.REPORT_DATA]: reportData,
                    allowAutoResume: true
                });

                return;
            }
            Object.assign(reportData, result);

            if (window.progressManager) {
                window.progressManager.updateResults(stepName, result);
                window.progressManager.updateProgress(stepNum, window.PROGRESS_STATUS.COMPLETED);
            }
        }
        await chrome.storage.local.remove([globalThis.STORAGE_KEYS.CURRENT_STEP, 'allowAutoResume']);

        const endTime = Date.now();
        const executionTimeMs = endTime - startTime;
        const executionTimeFormatted = formatExecutionTime(executionTimeMs);
        
        reportData['Execution Time'] = executionTimeFormatted;
        
        // Start report generation step
        if (window.progressManager && window.progressManager.startReportGeneration) {
            window.progressManager.startReportGeneration();
        }
        
        await chrome.storage.local.set({ 
            [window.STORAGE_KEYS.REPORT_DATA]: reportData,
            [globalThis.STORAGE_KEYS.PROGRESS]: {
                status: window.PROGRESS_STATUS.IN_PROGRESS,
                step: globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled).length : 0,
                total: globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled).length : 0
            }
        });

        // Simulate some processing time for report generation
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Complete report generation step
        if (window.progressManager && window.progressManager.completeReportGeneration) {
            window.progressManager.completeReportGeneration();
        }
        
        await chrome.storage.local.set({ 
            [globalThis.STORAGE_KEYS.PROGRESS]: {
                status: window.PROGRESS_STATUS.COMPLETED,
                step: globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled).length : 0,
                total: globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled).length : 0
            }
        });

        chrome.runtime.sendMessage({ 
            type: window.MESSAGE_TYPES.REPORT_COMPLETE,
            reportData 
        });

    } catch (error) {
        window.progressManager.updateProgress(0, window.PROGRESS_STATUS.ERROR);
        await chrome.storage.local.set({ 
            [globalThis.STORAGE_KEYS.PROGRESS]: {
                status: window.PROGRESS_STATUS.ERROR,
                error: error.message
            }
        });
        await chrome.storage.local.remove(['allowAutoResume']);
        throw error;
    }
}



if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContent);
} else {
    initializeContent();
}

function setupPageObserver() {
    let mutationTimeout = null;
    
    const observer = new MutationObserver((mutations) => {
        const relevantMutations = mutations.filter(mutation => {
            return Array.from(mutation.target.classList || []).some(cls => 
                cls.includes('location-') || 
                cls.includes('cdk-virtual-scroll') ||
                cls.includes('beta-switch')
            );
        });

        if (relevantMutations.length === 0 || mutationTimeout) {
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
}

function setupStateCleanup() {
    return setInterval(() => {
        if (window.navigationController?.isNavigating && 
            window.navigationController.navigationTimeout &&
            Date.now() - window.navigationController.navigationTimeout > 5000) {
            window.navigationController.isNavigating = false;
            window.navigationController.navigationTimeout = null;
        }
    }, 5000);
}

function initializeContent() {
    window.spacesExtensionContentLoaded = true;

    const mutationObserver = setupPageObserver();

    const cleanupInterval = setupStateCleanup();

    Promise.all([
        NavigationController.getFailCount(),
        new Promise(resolve => {
            chrome.storage.local.get(['navigationLocked'], result => {
                resolve(result.navigationLocked || false);
            });
        })
    ]).then(([failCount, persistedLock]) => {
        if (failCount >= NavigationController.MAX_NAVIGATION_FAILS || persistedLock) {
            chrome.storage.local.set({ navigationLocked: true });
            window.navigationLocked = true;
            if (window.ProgressManager) {
                window.progressManager = new window.ProgressManager();
                window.progressManager.init();
                window.progressManager.setError('Navigation failed repeatedly or redirected to Home. Automation stopped.');
            }
            return;
        }
        window.navigationLocked = false;
        checkForAutoResume();
    });

    window.addEventListener('unload', () => {
        if (mutationObserver) mutationObserver.disconnect();
        if (cleanupInterval) clearInterval(cleanupInterval);
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === window.MESSAGE_TYPES?.GENERATE_REPORT || message.type === 'start_collection') {
            const requiredGlobals = Array.isArray(globalThis.OS_READY_GLOBALS) ? globalThis.OS_READY_GLOBALS : [];
            const missingGlobals = requiredGlobals.filter(key => typeof globalThis[key] === 'undefined');
            
            if (missingGlobals.length > 0) {
                sendResponse({ 
                    success: false, 
                    error: `Content script initialization incomplete. Missing: ${missingGlobals.join(', ')}` 
                });
                return true;
            }

            const readinessCheck = {
                hasNavigationController: !!globalThis.navigationController,
                hasProgressManager: !!window.ProgressManager,
                hasMessageTypes: !!window.MESSAGE_TYPES,
                hasStorageKeys: !!window.STORAGE_KEYS
            };

            if (!Object.values(readinessCheck).every(Boolean)) {
                sendResponse({ 
                    success: false, 
                    error: 'Content script not fully initialized. Please refresh the page.' 
                });
                return true;
            }

            const isLocked = window.navigationLocked;
            if (isLocked) {
                if (window.ProgressManager) {
                    window.progressManager = new window.ProgressManager();
                    window.progressManager.init();
                    window.progressManager.setError('Automation blocked: Navigation failsafe triggered.');
                }
                sendResponse({ 
                    success: false, 
                    error: 'Automation blocked: Navigation failsafe triggered.' 
                });
                return true;
            }

            Promise.resolve().then(async () => {
                try {
                    if (message.type === window.MESSAGE_TYPES.GENERATE_REPORT) {
                        await clearAutomationState();
                    }
                    
                    if (window.ProgressManager) {
                        window.progressManager = new window.ProgressManager();
                        window.progressManager.init();
                    }

                    startAutomation();
                } catch (error) {}
            });
            
            sendResponse({ 
                success: true, 
                message: 'Automation started' 
            });
            return true;
        }
        return true;
    });
}

async function checkForAutoResume() {
    try {
        const result = await chrome.storage.local.get([window.STORAGE_KEYS.CURRENT_STEP, 'allowAutoResume']);
        const currentStep = result[window.STORAGE_KEYS.CURRENT_STEP];
        const allowAutoResume = result.allowAutoResume;

        if (currentStep && allowAutoResume) {
            if (window.ProgressManager) {
                window.progressManager = new window.ProgressManager();
                window.progressManager.init();
                window.progressManager.updateProgress(currentStep, window.PROGRESS_STATUS.IN_PROGRESS);
            }
            setTimeout(() => {
                startAutomation();
            }, 2000);
        }
    } catch (error) {}
}
window.osReadyAutomation = { startCollection: startAutomation };
