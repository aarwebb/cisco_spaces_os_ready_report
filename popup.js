// Sync enabledChecks in storage with REPORT_CHECKS config
async function syncEnabledChecksWithConfig() {
    const result = await chrome.storage.local.get(['enabledChecks']);
    const enabledChecks = result.enabledChecks || {};
    let updated = false;
    const added = [];
    const removed = [];
    if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
        globalThis.REPORT_CHECKS.forEach(check => {
            if (!(check.key in enabledChecks)) {
                enabledChecks[check.key] = true; // default for new checks
                added.push(check.key);
                updated = true;
            }
        });
        // Remove stale keys
        Object.keys(enabledChecks).forEach(key => {
            if (!globalThis.REPORT_CHECKS.find(c => c.key === key)) {
                delete enabledChecks[key];
                removed.push(key);
                updated = true;
            }
        });
    }
    if (updated) {
        await chrome.storage.local.set({ enabledChecks });
        console.log('[popup] syncEnabledChecksWithConfig ran. Added:', added, 'Removed:', removed, 'Final enabledChecks:', enabledChecks);
    } else {
        console.log('[popup] syncEnabledChecksWithConfig ran. No changes needed.');
    }
}
// Listen for error messages from background.js and display them in the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'error' && message.error) {
        const messageElement = document.getElementById('message');
        if (messageElement) {
            messageElement.textContent = message.error;
            messageElement.className = 'message error';
            messageElement.style.display = 'block';
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 4000);
        }
    }
    if (message.type === 'report_complete') {
        if (window.controller && typeof window.controller.updateUI === 'function') {
            window.controller.updateUI();
        }
        // Add flashing style to View Report button
        const viewReportBtn = document.getElementById('cisco-view-report');
        if (viewReportBtn) {
        viewReportBtn.classList.add('attention');
        // Set a flag so we only remove after click
        window._viewReportFlashing = true;
        }
    }
});
class UIController {
    constructor() {
        this.isGenerating = false;
    }

    async getStoredProgress() {
        try {
            if (!globalThis.STORAGE_KEYS || !globalThis.STORAGE_KEYS.PROGRESS) {
                this.showError("Extension error: STORAGE_KEYS.PROGRESS is not defined. Please reload the popup or reinstall the extension.");
                throw new Error("STORAGE_KEYS.PROGRESS is not defined");
            }
            const result = await chrome.storage.local.get([globalThis.STORAGE_KEYS.PROGRESS]);
            return result[globalThis.STORAGE_KEYS.PROGRESS] || null;
        } catch (error) {
            console.error("Error getting stored progress:", error);
            return null;
        }
    }

    async initializeEnabledChecks() {
        try {
            const result = await chrome.storage.local.get(['enabledChecks']);
            const storedChecks = result.enabledChecks || {};
            if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
                globalThis.REPORT_CHECKS.forEach(check => {
                    if (storedChecks.hasOwnProperty(check.key)) {
                        check.enabled = storedChecks[check.key];
                    }
                });
            }
            const debugToggle = document.getElementById("debugToggle");
            if (debugToggle) {
                this.renderEnabledChecks(debugToggle.checked);
            }
        } catch (error) {
            console.error('Error initializing enabled checks:', error);
        }
    }

    renderEnabledChecks(show) {
        const container = document.getElementById("enabledChecksContainer");
        if (!container) return;
        if (show && globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
            container.style.display = "block";
            const listContainer = document.getElementById("enabledChecksList");
            if (!listContainer) return;
            listContainer.innerHTML = "";
            const userConfigurableChecks = globalThis.REPORT_CHECKS.filter(check => check.key !== 'report');
            userConfigurableChecks.forEach(check => {
                const checkItem = document.createElement("div");
                checkItem.className = "check-item";
                const label = document.createElement("label");
                label.className = "check-label";
                label.textContent = check.name;
                label.htmlFor = `check-${check.key}`;
                const toggleContainer = document.createElement("label");
                toggleContainer.className = "check-toggle";
                const toggleInput = document.createElement("input");
                toggleInput.type = "checkbox";
                toggleInput.id = `check-${check.key}`;
                toggleInput.checked = check.enabled || false;
                const toggleSlider = document.createElement("span");
                toggleSlider.className = "check-toggle-slider";
                toggleContainer.appendChild(toggleInput);
                toggleContainer.appendChild(toggleSlider);
                checkItem.appendChild(label);
                checkItem.appendChild(toggleContainer);
                listContainer.appendChild(checkItem);
                toggleInput.addEventListener("change", (e) => {
                    this.handleCheckToggle(check.key, e.target.checked);
                });
            });
        } else {
            container.style.display = "none";
            const debugToggle = document.getElementById("debugToggle");
            if (debugToggle && !debugToggle.checked) {
                this.resizePopup(false);
            }
        }
    }

    async handleCheckToggle(checkKey, isEnabled) {
        try {
            if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
                const check = globalThis.REPORT_CHECKS.find(c => c.key === checkKey);
                if (check) {
                    check.enabled = isEnabled;
                }
            }
            const result = await chrome.storage.local.get(['enabledChecks']);
            const enabledChecks = result.enabledChecks || {};
            enabledChecks[checkKey] = isEnabled;
            await chrome.storage.local.set({ enabledChecks });
            console.log(`Check '${checkKey}' ${isEnabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error handling check toggle:', error);
        }
    }

    resizePopup(expandForDebug) {
        const popupContainer = document.querySelector('.popup-container');
        if (!popupContainer) return;
        // Remove minHeight logic to allow auto height
        popupContainer.style.minHeight = '';
        popupContainer.style.transition = '';
        document.body.style.minHeight = '';
    }

    updateGenerateButton(isGenerating) {
        const generateBtn = document.getElementById("generateReport");
        if (!generateBtn) return;
        generateBtn.disabled = isGenerating;
        generateBtn.textContent = isGenerating ? "Generating Report..." : "Generate Report";
        if (isGenerating) {
            generateBtn.classList.add("generating");
        } else {
            generateBtn.classList.remove("generating");
        }
    }

    showError(message) {
        const messageElement = document.getElementById("message");
        if (!messageElement) return;
        messageElement.textContent = message;
        messageElement.className = "message error";
        messageElement.style.display = "block";
        setTimeout(() => {
            messageElement.style.display = "none";
        }, 3000);
    }

    async handleGenerateReport() {
        console.log('[popup] Debug: handleGenerateReport called');
        try {
            if (!globalThis.STORAGE_KEYS || !globalThis.STORAGE_KEYS.PROGRESS) {
                this.showError("Extension error: STORAGE_KEYS.PROGRESS is not defined. Please reload the popup or reinstall the extension.");
                throw new Error("STORAGE_KEYS.PROGRESS is not defined");
            }
            const currentPage = await this.checkCurrentPage();
            if (!currentPage.isSpacesDomain) {
                this.showNavigationError(currentPage);
                return;
            }
            this.isGenerating = true;
            this.updateGenerateButton(true);
            if (!globalThis.MESSAGE_TYPES || !globalThis.MESSAGE_TYPES.START_COLLECTION) {
                this.showError("Extension error: MESSAGE_TYPES.START_COLLECTION is not defined. Please reload the popup or reinstall the extension.");
                throw new Error("MESSAGE_TYPES.START_COLLECTION is not defined");
            }
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('[popup] Debug: Active tab for sendMessage:', tab);
            if (!tab || !tab.id) {
                throw new Error("No active tab found to send start_collection message");
            }
            console.log('[popup] Debug: Sending start_collection to tab', tab.id, 'with message:', { type: globalThis.MESSAGE_TYPES.START_COLLECTION });
            chrome.tabs.sendMessage(tab.id, { type: globalThis.MESSAGE_TYPES.START_COLLECTION }, (response) => {
                console.log('[popup] Debug: Response from content script:', response);
                if (!response || !response.success) {
                    this.showError(response?.error || "Failed to start report generation");
                    this.isGenerating = false;
                    this.updateGenerateButton(false);
                }
                // Do NOT close the popup window
            });
            // Do NOT close the popup window
        } catch (error) {
            this.showError(`Error: ${error.message}`);
            this.isGenerating = false;
            this.updateGenerateButton(false);
        }
    }

    async checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url) {
                return { isHome: false, url: "unknown", error: "No active tab found" };
            }
            const url = new URL(tab.url);
            const isSpacesDomain = url.hostname.includes("dnaspaces");
            if (!isSpacesDomain) {
                return {
                    isHome: false,
                    isSpacesDomain: false,
                    url: tab.url,
                    pathname: url.pathname,
                    hostname: url.hostname,
                    error: "Not on a Cisco Spaces domain",
                };
            }
            const isHomePage = url.pathname === "/home" || url.pathname === "/";
            return {
                isHome: isHomePage,
                isSpacesDomain: isSpacesDomain,
                url: tab.url,
                pathname: url.pathname,
                hostname: url.hostname,
            };
        } catch (error) {
            return { isHome: false, url: "error", error: error.message };
        }
    }

    showNavigationError(currentPage) {
        let message = "";
        if (currentPage.error) {
            if (currentPage.error.includes("Cisco Spaces domain")) {
                message = "Please navigate to a Cisco Spaces page first.";
            } else {
                message = "Unable to detect current page. Please ensure you are on a Cisco Spaces page.";
            }
        } else {
            message = "Please navigate to the Home page first to generate a report.";
        }
        const errorContainer = document.getElementById("errorContainer");
        if (errorContainer) {
            errorContainer.innerHTML = `<div><strong>Navigation Required</strong><br>${message}</div>`;
            errorContainer.style.display = "block";
        }
    }

    hideError() {
        const errorContainer = document.getElementById("errorContainer");
        if (errorContainer) {
            errorContainer.style.display = "none";
            errorContainer.innerHTML = "";
        }
    }

    async handleViewReport() {
        try {
            const response = await chrome.runtime.sendMessage({ type: "open_report_tab", active: true });
            if (!response || !response.success) {
                throw new Error(response?.error || "Failed to open report");
            }
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        }
    }

    async handleDebugToggle(isEnabled) {
        try {
            await chrome.storage.local.set({ debugMode: isEnabled });
            this.applyDebugMode(isEnabled);
        } catch (error) {
            console.error("Error handling debug toggle:", error);
        }
    }

    applyDebugMode(isEnabled) {
        this.renderEnabledChecks(isEnabled);
    }

    async updateUI() {
        try {
            const progress = await this.getStoredProgress();
            const isInProgress = progress && progress.status === "in_progress";
            const isComplete = progress && progress.status === "completed";
            this.updateGenerateButton(isInProgress);

            // If report is complete, reset button style and text
            if (isComplete) {
                const generateBtn = document.getElementById("generateReport");
                if (generateBtn) {
                    generateBtn.classList.remove("generating");
                    generateBtn.textContent = "Generate Report";
                    generateBtn.disabled = false;
                }
            }

            let viewReportBtn = document.getElementById("cisco-view-report");
            if (viewReportBtn) {
                const status = progress && progress.status ? progress.status : "";
                const isReportComplete = status === "completed" || status === "Complete";
                viewReportBtn.disabled = !isReportComplete;
                viewReportBtn.classList.toggle("active", isReportComplete);
                viewReportBtn.classList.toggle("inactive", !isReportComplete);
                viewReportBtn.style.background = isReportComplete ? "#28a745" : "#b8d8e8";
                viewReportBtn.style.cursor = isReportComplete ? "pointer" : "not-allowed";
                viewReportBtn.style.color = "#fff";
            }
        } catch (error) {
            console.error("Error updating popup UI:", error);
        }
    }
}

function setProgressCircle(percent) {
    const progressContainer = document.querySelector('.progress-container');
    const fgCircle = document.querySelector('.circular-progress .fg');
    const text = document.querySelector('.circular-progress .progress-text');
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    if (fgCircle) {
        fgCircle.setAttribute('stroke-dasharray', circumference);
        fgCircle.setAttribute('stroke-dashoffset', circumference - (percent / 100) * circumference);
    }
    if (text) {
        text.textContent = `${percent}%`;
    }
    if (progressContainer) {
        progressContainer.style.display = 'flex';
    }
}

window.UIController = UIController;

document.addEventListener('DOMContentLoaded', () => {
    const controller = new UIController();
    window.controller = controller;
    syncEnabledChecksWithConfig().then(() => {
        controller.initializeEnabledChecks();
    });
    controller.updateUI();
    // Hide progress bar on initial load
    const progressContainer = document.querySelector('.progress-container');
    if (progressContainer) progressContainer.style.display = 'none';

    // Show progress circle and trigger report generation on generate
    const generateBtn = document.getElementById('generateReport');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            if (progressContainer) progressContainer.style.display = 'flex';
            setProgressCircle(0);
            controller.handleGenerateReport();
        });
    }

    // Hide progress circle on view report
    const viewReportBtn = document.getElementById('cisco-view-report');
    if (viewReportBtn) {
        viewReportBtn.addEventListener('click', () => {
            console.log('[popup] Debug: View Report clicked');
            setProgressCircle(0);
            if (window._viewReportFlashing) {
                viewReportBtn.classList.remove('attention');
                window._viewReportFlashing = false;
            }
            controller.handleViewReport();
        });
    }

    // Wrap progress change listener with debug
    chrome.storage.onChanged.addListener((changes, areaName) => {
        console.log('[popup] Debug: chrome.storage.onChanged fired', changes, areaName);
        if (areaName === 'local' && changes['progress']) {
            const progress = changes['progress'].newValue;
            console.log('[popup] Debug: progress changed:', progress);
            if (progress && typeof progress.completedCalls === 'number' && typeof progress.totalCalls === 'number') {
                const percent = Math.round((progress.completedCalls / progress.totalCalls) * 100);
                setProgressCircle(percent);
            }
        }
    });

    const debugToggle = document.getElementById('debugToggle');
    if (debugToggle) {
        debugToggle.addEventListener('change', (e) => {
            controller.handleDebugToggle(e.target.checked);
        });
        // Ensure enabled checks are hidden/shown on initial load
        controller.renderEnabledChecks(debugToggle.checked);
    }
});