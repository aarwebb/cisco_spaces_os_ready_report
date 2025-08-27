window.UIController = class UIController {
    constructor() {
        this.isGenerating = false;
    }

    async getStoredProgress() {
        try {
            if (!globalThis.STORAGE_KEYS || !globalThis.STORAGE_KEYS.PROGRESS) {
                this.showError(
                    "Extension error: STORAGE_KEYS.PROGRESS is not defined. Please reload the popup or reinstall the extension."
                );
                throw new Error("STORAGE_KEYS.PROGRESS is not defined");
            }
            const result = await chrome.storage.local.get([
                globalThis.STORAGE_KEYS.PROGRESS,
            ]);
            return result[globalThis.STORAGE_KEYS.PROGRESS] || null;
        } catch (error) {
            console.error("Error getting stored progress:", error);
            return null;
        }
    }

    renderDebugActions(isEnabled) {
        let debugActionsContainer = document.getElementById("debugActionsContainer");
        const debugToggle = document.getElementById("debugToggle");
        if (!debugToggle) return;

        if (isEnabled) {
            if (!debugActionsContainer) {
                debugActionsContainer = document.createElement("div");
                debugActionsContainer.id = "debugActionsContainer";
                debugActionsContainer.style.marginTop = "10px";
                const container =
                    debugToggle.closest("div") || debugToggle.parentNode;
                container.parentNode.insertBefore(
                    debugActionsContainer,
                    container.nextSibling
                );
            }

            debugActionsContainer.innerHTML = "";

            // Create debug section header
            const debugHeader = document.createElement("div");
            debugHeader.innerHTML = "<strong>Debug Actions</strong>";
            debugHeader.style.fontSize = "11px";
            debugHeader.style.marginBottom = "8px";
            debugHeader.style.color = "#666";
            debugActionsContainer.appendChild(debugHeader);

            const buttonContainer = document.createElement("div");
            buttonContainer.style.display = "grid";
            buttonContainer.style.gridTemplateColumns = "1fr 1fr";
            buttonContainer.style.gap = "8px";
            debugActionsContainer.appendChild(buttonContainer);

            const clearDataBtn = document.createElement("button");
            clearDataBtn.textContent = "Clear Progress Data";
            clearDataBtn.title = "Clears all progress tracking and collected data";
            this.styleDebugButton(clearDataBtn);
            clearDataBtn.addEventListener("click", () => this.handleClearProgress());
            buttonContainer.appendChild(clearDataBtn);

            const resetNavBtn = document.createElement("button");
            resetNavBtn.textContent = "Reset Navigation";
            resetNavBtn.title = "Resets navigation locks and failed attempt counters";
            this.styleDebugButton(resetNavBtn);
            resetNavBtn.addEventListener("click", () => this.handleResetNavigationLock());
            buttonContainer.appendChild(resetNavBtn);

            debugActionsContainer.style.display = "flex";
            debugActionsContainer.style.flexDirection = "column";
            debugActionsContainer.style.alignItems = "stretch";
            debugActionsContainer.style.padding = "10px";
            debugActionsContainer.style.backgroundColor = "#f8f9fa";
            debugActionsContainer.style.borderRadius = "4px";
            debugActionsContainer.style.marginTop = "10px";
            debugActionsContainer.style.border = "1px solid #e0e0e0";

            // Trigger popup resize to accommodate debug section
            this.resizePopup(true);
        } else {
            if (debugActionsContainer) {
                debugActionsContainer.remove();
            }
            // Trigger popup resize back to normal
            this.resizePopup(false);
        }
    }

    styleDebugButton(button) {
        button.style.padding = "6px 8px";
        button.style.borderRadius = "3px";
        button.style.border = "1px solid #ccc";
        button.style.backgroundColor = "#fff";
        button.style.cursor = "pointer";
        button.style.fontSize = "10px";
        button.style.fontWeight = "normal";
        button.style.color = "#333";
        button.style.transition = "all 0.2s ease";
        
        button.onmouseover = () => {
            button.style.backgroundColor = "#f0f0f0";
            button.style.borderColor = "#999";
        };
        button.onmouseout = () => {
            button.style.backgroundColor = "#fff";
            button.style.borderColor = "#ccc";
        };
    }

    resizePopup(expandForDebug) {
        const popupContainer = document.querySelector('.popup-container');
        if (!popupContainer) return;

        if (expandForDebug) {
            // Expand popup to accommodate debug section and enabled checks
            // Base height + debug actions + enabled checks section
            popupContainer.style.minHeight = '380px';
            popupContainer.style.transition = 'min-height 0.3s ease';
            document.body.style.minHeight = '380px';
        } else {
            // Resize back to normal
            popupContainer.style.minHeight = '200px';
            popupContainer.style.transition = 'min-height 0.3s ease';
            document.body.style.minHeight = '200px';
        }
    }

    async initializeEnabledChecks() {
        try {
            // Load current enabled checks state from storage
            const result = await chrome.storage.local.get(['enabledChecks']);
            const storedChecks = result.enabledChecks || {};
            
            // Update REPORT_CHECKS with stored state, fallback to default if no stored state
            if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
                globalThis.REPORT_CHECKS.forEach(check => {
                    if (storedChecks.hasOwnProperty(check.key)) {
                        check.enabled = storedChecks[check.key];
                    }
                    // If no stored state, keep the default enabled state from config
                });
            }
            
            // Render the enabled checks based on debug toggle state
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
            // Show and populate the enabled checks
            container.style.display = "block";
            
            const listContainer = document.getElementById("enabledChecksList");
            if (!listContainer) return;
            
            // Clear existing content
            listContainer.innerHTML = "";
            
            // Add toggle for each check (excluding 'report' which should always be enabled)
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
                
                // Add event listener to handle toggle changes
                toggleInput.addEventListener("change", (e) => {
                    this.handleCheckToggle(check.key, e.target.checked);
                });
            });
            
            // Trigger popup resize to accommodate enabled checks section
            // Don't call resize here - let the debug actions handler manage it
        } else {
            // Hide the enabled checks section
            container.style.display = "none";
            // Only resize back to normal if debug is also off
            const debugToggle = document.getElementById("debugToggle");
            if (debugToggle && !debugToggle.checked) {
                this.resizePopup(false);
            }
        }
    }

    async handleCheckToggle(checkKey, isEnabled) {
        try {
            // Update the REPORT_CHECKS array
            if (globalThis.REPORT_CHECKS && Array.isArray(globalThis.REPORT_CHECKS)) {
                const check = globalThis.REPORT_CHECKS.find(c => c.key === checkKey);
                if (check) {
                    check.enabled = isEnabled;
                }
            }
            
            // Save to storage
            const result = await chrome.storage.local.get(['enabledChecks']);
            const enabledChecks = result.enabledChecks || {};
            enabledChecks[checkKey] = isEnabled;
            await chrome.storage.local.set({ enabledChecks });
            
            console.log(`Check '${checkKey}' ${isEnabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error handling check toggle:', error);
        }
    }

    updateGenerateButton(isGenerating) {
        const generateBtn = document.getElementById("generateReport");
        if (!generateBtn) return;

        generateBtn.disabled = isGenerating;
        generateBtn.textContent = isGenerating
            ? "Generating Report..."
            : "Generate Report";
        if (isGenerating) {
            generateBtn.classList.add("generating");
        } else {
            generateBtn.classList.remove("generating");
        }
    }

    updateClearButton(hasProgress) {
        // This button has been removed - function kept for compatibility
        return;
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

    showSuccess(message) {
        const messageElement = document.getElementById("message");
        if (!messageElement) return;
        messageElement.textContent = message;
        messageElement.className = "message success";
        messageElement.style.display = "block";
        setTimeout(() => {
            messageElement.style.display = "none";
        }, 3000);
    }

    async init() {
        await this.setupEventListeners();
        this.updateGenerateButton(false);
        await this.updateUI();
    }

    async setupEventListeners() {
        const generateBtn = document.getElementById("generateReport");
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.classList.remove("generating");
            generateBtn.textContent = "Generate Report";
            generateBtn.addEventListener("click", () => this.handleGenerateReport());
        }

        const viewReportBtn = document.getElementById("cisco-view-report");
        if (viewReportBtn) {
            viewReportBtn.addEventListener("click", () => this.handleViewReport());
        }

        const debugToggle = document.getElementById("debugToggle");
        if (debugToggle) {
            const result = await chrome.storage.local.get(["debugMode"]);
            debugToggle.checked = result.debugMode || false;
            this.applyDebugMode(debugToggle.checked);
            this.renderDebugActions(debugToggle.checked);
            debugToggle.addEventListener("change", (e) => {
                this.handleDebugToggle(e.target.checked);
                this.renderDebugActions(e.target.checked);
                this.renderEnabledChecks(e.target.checked);
            });
        }

        // Initialize enabled checks display
        this.initializeEnabledChecks();

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === "local") {
                this.updateUI();
            }
        });
    }

    async handleGenerateReport() {
        if (this.isGenerating) {
            return;
        }

        if (!globalThis.STORAGE_KEYS || !globalThis.STORAGE_KEYS.PROGRESS) {
            this.showError(
                "Extension error: STORAGE_KEYS.PROGRESS is not defined. Please reload the popup or reinstall the extension."
            );
            return;
        }

        try {
            const currentPage = await this.checkCurrentPage();

            if (!currentPage.isSpacesDomain) {
                this.showNavigationError(currentPage);
                return;
            }

            this.isGenerating = true;
            this.updateGenerateButton(true);

            if (
                !globalThis.MESSAGE_TYPES ||
                !globalThis.MESSAGE_TYPES.START_COLLECTION
            ) {
                this.showError(
                    "Extension error: MESSAGE_TYPES.START_COLLECTION is not defined. Please reload the popup or reinstall the extension."
                );
                throw new Error("MESSAGE_TYPES.START_COLLECTION is not defined");
            }

            const response = await chrome.runtime.sendMessage({
                type: globalThis.MESSAGE_TYPES.START_COLLECTION,
            });

            if (!response || !response.success) {
                throw new Error(response?.error || "Failed to start report generation");
            }

            window.close();
        } catch (error) {
            this.showError(`Error: ${error.message}`);
            this.isGenerating = false;
            this.updateGenerateButton(false);
        }
    }

    async checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });

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
            return {
                isHome: false,
                url: "error",
                error: error.message,
            };
        }
    }

    showNavigationError(currentPage) {
        let message = "";

        if (currentPage.error) {
            if (currentPage.error.includes("Cisco Spaces domain")) {
                message = "Please navigate to a Cisco Spaces page first.";
            } else {
                message =
                    "Unable to detect current page. Please ensure you are on a Cisco Spaces page.";
            }
        } else {
            message = "Please navigate to the Home page first to generate a report.";
        }

        const errorContainer = document.getElementById("errorContainer");
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div>
                    <strong>Navigation Required</strong><br>
                    ${message}
                </div>
            `;
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

    async handleClearProgress() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: globalThis.MESSAGE_TYPES.RESET_COLLECTION,
            });

            if (!response.success) {
                throw new Error(response.error || "Failed to clear progress");
            }

            await this.updateUI();
            this.showSuccess("Progress cleared successfully");
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        }
    }

    async handleViewReport() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: "open_report_tab",
                active: true,
            });

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
        this.renderDebugActions(isEnabled);
        this.renderEnabledChecks(isEnabled);
    }

    async handleResetNavigationLock() {
        try {
            await chrome.storage.local.set({
                navigationLocked: false,
                navigationFailCount: 0,
                lastNavigationAttempt: null,
            });

            await chrome.runtime.sendMessage({
                type: "reset_navigation_state",
                payload: {
                    clearLock: true,
                },
            });

            this.showSuccess("Navigation lock reset successfully");
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        }
    }

    async updateUI() {
        try {
            const progress = await this.getStoredProgress();

            const isInProgress = progress && progress.status === "in_progress";
            const isComplete = progress && progress.status === "completed";

            this.updateGenerateButton(isInProgress);
            this.updateClearButton(
                progress && Object.keys(progress.steps || {}).length > 0
            );

            let viewReportBtn = document.getElementById("cisco-view-report");
            if (viewReportBtn) {
                const status = progress && progress.status ? progress.status : "";
                const isReportComplete =
                    status === "completed" || status === "Complete";
                viewReportBtn.disabled = !isReportComplete;
                viewReportBtn.classList.toggle("active", isReportComplete);
                viewReportBtn.classList.toggle("inactive", !isReportComplete);
                viewReportBtn.style.background = isReportComplete
                    ? "#28a745"
                    : "#b8d8e8";
                viewReportBtn.style.cursor = isReportComplete
                    ? "pointer"
                    : "not-allowed";
                viewReportBtn.style.color = "#fff";
            }
        } catch (error) {
            console.error("Error updating popup UI:", error);
        }
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    if (window.UIController) {
        const uiController = new window.UIController();
        await uiController.init();
    }
});