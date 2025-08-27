class ProgressManager {
    constructor() {
        if (window.progressManager) {
            window.progressManager.cleanup();
        }
        
        this.currentStep = 0;
        // Use REPORT_CHECKS configuration to determine total steps
        this.totalSteps = globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled).length : 0;
        this.isRunning = false;
        this.progressData = {};
        this.stepStatuses = new Array(this.totalSteps).fill(window.PROGRESS_STATUS.PENDING);
        this.lastStorageUpdate = 0;

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes[globalThis.STORAGE_KEYS.PROGRESS]) {
                const now = Date.now();
                if (now - this.lastStorageUpdate < 100) {
                    return;
                }

                const newProgress = changes[globalThis.STORAGE_KEYS.PROGRESS].newValue;
                if (newProgress) {
                    this.currentStep = newProgress.step || 0;
                    this.totalSteps = newProgress.total || (globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.filter(c => c.enabled).length : 0);
                    if (newProgress.stepStatuses) {
                        this.stepStatuses = newProgress.stepStatuses;
                    }
                    
                    this._updateUI(newProgress.status || window.PROGRESS_STATUS.PENDING);
                    
                    if (newProgress.status === window.PROGRESS_STATUS.COMPLETED && 
                        this.currentStep === this.totalSteps) {
                        this.setComplete();
                    }
                }
            }
        });
    }

    init() {
        try {
            this.createProgressUI();
            this.createResultsUI();
        } catch (error) {
            throw error;
        }
    }

    createProgressUI() {
        if (document.getElementById('cisco-progress-container')) {
            return;
        }

        // Inject CSS styles if not already present
        if (!document.getElementById('cisco-progress-styles')) {
            const style = document.createElement('style');
            style.id = 'cisco-progress-styles';
            style.textContent = `
                .cisco-progress-container {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 999999;
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .cisco-progress-box {
                    width: 400px;
                    background: white;
                    border: 2px solid #0073B7;
                    border-radius: 8px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
                    padding: 20px;
                    pointer-events: auto;
                    font-family: 'CiscoSans', 'Helvetica Neue', Arial, sans-serif;
                    font-size: 14px;
                    max-height: 80vh;
                    overflow-y: auto;
                    position: relative;
                }
                .cisco-progress-header {
                    margin-bottom: 10px;
                    color: #0073B7;
                    font-size: 16px;
                    position: relative;
                    font-weight: bold;
                    cursor: move;
                    user-select: none;
                    padding: 5px;
                    margin: -5px -5px 10px -5px;
                    border-radius: 4px;
                }
                .cisco-progress-header:hover {
                    background-color: rgba(0, 115, 183, 0.1);
                }
                .cisco-progress-close {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    width: 20px;
                    height: 20px;
                    border: none;
                    background: transparent;
                    color: #6c757d;
                    cursor: pointer;
                    font-size: 18px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                }
                .cisco-progress-close:hover {
                    color: #495057;
                }
                .cisco-progress-bar-container {
                    box-sizing: content-box;
                    height: 15px;
                    position: relative;
                    margin: 15px 0 20px 0;
                    background: transparent;
                    border-radius: 20px;
                    padding: 0;
                    border: 2px solid #555;
                    overflow: hidden;
                }
                .cisco-progress-bar {
                    display: block;
                    height: 100%;
                    width: 0%;
                    border-radius: 18px;
                    background-color: #0073B7;
                    background-image: linear-gradient(center bottom, #0073B7 37%, #4A9EE7 69%);
                    box-shadow: inset 0 2px 9px rgba(255, 255, 255, 0.3), 
                                inset 0 -2px 6px rgba(0, 0, 0, 0.4);
                    position: relative;
                    overflow: hidden;
                    transition: width 0.8s ease;
                }
                .cisco-progress-bar:after {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    right: 0;
                    background-image: linear-gradient(
                        -45deg,
                        rgba(255, 255, 255, 0.2) 25%,
                        transparent 25%,
                        transparent 50%,
                        rgba(255, 255, 255, 0.2) 50%,
                        rgba(255, 255, 255, 0.2) 75%,
                        transparent 75%,
                        transparent
                    );
                    z-index: 1;
                    background-size: 50px 50px;
                    animation: moveStripes 2s linear infinite;
                    border-top-right-radius: 6px;
                    border-bottom-right-radius: 6px;
                    border-top-left-radius: 15px;
                    border-bottom-left-radius: 15px;
                    overflow: hidden;
                }
                @keyframes moveStripes {
                    0% {
                        background-position: 0 0;
                    }
                    100% {
                        background-position: 50px 50px;
                    }
                }
                .cisco-progress-bar.complete {
                    background-color: #4CAF50;
                    background-image: linear-gradient(center bottom, #4CAF50 37%, #66BB6A 69%);
                }
                .cisco-progress-bar.complete:after {
                    display: none;
                }
                .cisco-progress-bar.complete.full-width {
                    border-radius: 18px;
                }
                .cisco-progress-bar.complete.full-width:after {
                    border-radius: 18px;
                }
                .cisco-progress-bar.error {
                    background-color: #F44336;
                    background-image: linear-gradient(center bottom, #F44336 37%, #E57373 69%);
                }
                .cisco-progress-bar.warning {
                    background-color: #FF9800;
                    background-image: linear-gradient(center bottom, #FF9800 37%, #FFB74D 69%);
                }
                .cisco-progress-bar.active {
                    animation: pulse 1.5s ease-in-out infinite alternate;
                }
                @keyframes pulse {
                    0% {
                        box-shadow: inset 0 2px 9px rgba(255, 255, 255, 0.3), 
                                    inset 0 -2px 6px rgba(0, 0, 0, 0.4);
                    }
                    100% {
                        box-shadow: inset 0 2px 9px rgba(255, 255, 255, 0.5), 
                                    inset 0 -2px 6px rgba(0, 0, 0, 0.6),
                                    0 0 10px rgba(0, 115, 183, 0.3);
                    }
                }
                .cisco-progress-status {
                    margin-bottom: 10px;
                    color: #333;
                }
                .cisco-progress-steps {
                    font-size: 12px;
                    color: #666;
                }
                .cisco-progress-controls {
                    margin-top: 10px;
                    text-align: center;
                }
                .cisco-view-report-btn {
                    width: 100%;
                    padding: 12px 0;
                    background: #b8d8e8;
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    cursor: not-allowed;
                    font-size: 16px;
                    font-weight: 600;
                    margin-top: 16px;
                    transition: background 0.2s, cursor 0.2s;
                }
                .cisco-view-report-btn:not(:disabled) {
                    background: #4CAF50;
                    cursor: pointer;
                }
                .cisco-view-report-btn:not(:disabled):hover {
                    background: #45a049;
                }
            `;
            document.head.appendChild(style);
        }

        // Create progress container with proper CSS classes
        const progressContainer = document.createElement('div');
        progressContainer.id = 'cisco-progress-container';
        progressContainer.className = 'cisco-progress-container';
        
        const progressBox = document.createElement('div');
        progressBox.id = 'cisco-progress-box';
        progressBox.className = 'cisco-progress-box';

        const header = document.createElement('div');
        header.className = 'cisco-progress-header';
        
        const title = document.createElement('span');
        title.innerHTML = '<strong>Cisco Spaces OS Ready Report</strong>';
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.title = 'Close';
        closeButton.className = 'cisco-progress-close';
        closeButton.onclick = () => this.closeProgressUI();
        
        header.appendChild(title);
        header.appendChild(closeButton);

        // Add drag functionality
        this.makeDraggable(progressBox, header);

        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'cisco-progress-bar-container';

        const progressBar = document.createElement('div');
        progressBar.id = 'cisco-progress-bar';
        progressBar.className = 'cisco-progress-bar';

        const statusDiv = document.createElement('div');
        statusDiv.id = 'cisco-status';
        statusDiv.innerHTML = 'Ready to start';
        statusDiv.className = 'cisco-progress-status';

        const stepsContainer = document.createElement('div');
        stepsContainer.id = 'cisco-steps';
        stepsContainer.className = 'cisco-progress-steps';

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'cisco-progress-controls';

        this._viewReportBtn = document.createElement('button');
        this._viewReportBtn.id = 'cisco-view-report';
        this._viewReportBtn.innerHTML = 'View Report';
        this._viewReportBtn.disabled = true;
        this._viewReportBtn.className = 'cisco-view-report-btn';
        this._viewReportBtn.onclick = () => {
            if (!this._viewReportBtn.disabled) {
                this.closeProgressUI();
                setTimeout(() => window.open(chrome.runtime.getURL('report.html')), 100);
            }
        };

        progressBarContainer.appendChild(progressBar);
        controlsDiv.appendChild(this._viewReportBtn);
        progressBox.appendChild(header);
        progressBox.appendChild(progressBarContainer);
        progressBox.appendChild(statusDiv);
        progressBox.appendChild(stepsContainer);
        progressBox.appendChild(controlsDiv);
        
        progressContainer.appendChild(progressBox);
        document.body.appendChild(progressContainer);

        this.updateStepsList();
    }

    makeDraggable(element, handle) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;
        let isInitialized = false;

        // Initialize position based on current CSS positioning
        const initializePosition = () => {
            const rect = element.getBoundingClientRect();
            
            // Calculate the actual position accounting for the centering transform
            xOffset = rect.left;
            yOffset = rect.top;
            currentX = xOffset;
            currentY = yOffset;
            
            // Remove the centering transform and switch to absolute positioning
            element.style.position = 'fixed';
            element.style.top = '0';
            element.style.left = '0';
            element.style.right = 'auto';
            element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            
            isInitialized = true;
        };

        handle.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            if (e.target === handle || handle.contains(e.target)) {
                // Initialize position on first drag
                if (!isInitialized) {
                    initializePosition();
                }
                
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                isDragging = true;
                
                // Add visual feedback
                element.style.cursor = 'move';
                element.style.zIndex = '1000000';
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                // Constrain to viewport
                const rect = element.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));

                element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        }

        function dragEnd(e) {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                
                // Remove visual feedback
                element.style.cursor = '';
                element.style.zIndex = '999999';
            }
        }
    }

    createResultsUI() {
        if (document.getElementById('cisco-results-container')) return;

        // Inject results CSS styles if not already present
        if (!document.getElementById('cisco-results-styles')) {
            const style = document.createElement('style');
            style.id = 'cisco-results-styles';
            style.textContent = `
                .cisco-results-container {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    width: 350px;
                    background: white;
                    border: 2px solid #4CAF50;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    padding: 10px;
                    z-index: 10000;
                    font-family: 'CiscoSans', 'Helvetica Neue', Arial, sans-serif;
                    font-size: 14px;
                    display: block;
                    transition: height 0.3s ease;
                }
                .cisco-results-container.minimized {
                    height: 45px;
                    overflow: hidden;
                }
                .cisco-results-container.expanded {
                    height: 400px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .cisco-results-header {
                    margin-bottom: 8px;
                    color: #4CAF50;
                    font-size: 16px;
                    background: white;
                    z-index: 1;
                    font-weight: bold;
                    user-select: none;
                    padding: 2px;
                    margin: -2px -2px 8px -2px;
                    border-radius: 4px;
                    flex-shrink: 0;
                }
                .cisco-results-content {
                    font-size: 12px;
                    color: #333;
                    padding: 5px 0;
                    overflow-y: auto;
                    flex: 1;
                    min-height: 0;
                    max-height: calc(400px - 60px);
                }
                .cisco-results-controls {
                    margin-top: 8px;
                    text-align: center;
                }
                .cisco-expand-btn {
                    position: absolute;
                    top: 2px;
                    right: 25px;
                    width: 22px;
                    height: 22px;
                    border: none;
                    background: transparent;
                    color: #4CAF50;
                    font-size: 16px;
                    cursor: pointer;
                    border-radius: 3px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    padding: 0;
                }
                .cisco-expand-btn:hover {
                    background: rgba(76, 175, 80, 0.1);
                }
                .cisco-expand-btn svg {
                    width: 18px;
                    height: 18px;
                    fill: #4CAF50;
                    stroke: #4CAF50;
                    stroke-width: 2;
                }
                .cisco-toggle-btn {
                    padding: 5px 10px;
                    margin-right: 5px;
                    background: #f0f0f0;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: 'CiscoSans', 'Helvetica Neue', Arial, sans-serif;
                }
                .cisco-toggle-btn:hover {
                    background: #e0e0e0;
                }
                .cisco-step {
                    margin: 2px 0;
                    color: #333;
                }
                .cisco-results-item {
                    margin-bottom: 15px;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 4px;
                }
                .cisco-results-item-title {
                    color: #0073B7;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
        }

        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'cisco-results-container';
        resultsContainer.className = 'cisco-results-container minimized';

        const header = document.createElement('div');
        header.className = 'cisco-results-header';
        
        const title = document.createElement('span');
        title.innerHTML = '<strong>Collection Results</strong>';
        
        const expandButton = document.createElement('button');
        expandButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 14l5-5 5 5" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        expandButton.title = 'Expand';
        expandButton.className = 'cisco-expand-btn';
        expandButton.onclick = () => this.toggleResultsExpansion();
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.title = 'Close';
        closeButton.className = 'cisco-progress-close';
        closeButton.onclick = () => this.closeResultsUI();
        
        header.appendChild(title);
        header.appendChild(expandButton);
        header.appendChild(closeButton);

        const resultsDiv = document.createElement('div');
        resultsDiv.id = 'cisco-results-content';
        resultsDiv.className = 'cisco-results-content';

        resultsContainer.appendChild(header);
        resultsContainer.appendChild(resultsDiv);
        document.body.appendChild(resultsContainer);
    }

    _updateUI(status) {
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }
        
        this._updateTimeout = setTimeout(() => {
            const completedSteps = this.stepStatuses.filter(s => s === window.PROGRESS_STATUS.COMPLETED).length;
            const percentage = Math.round((completedSteps / this.totalSteps) * 100);
            
            const progressBar = document.getElementById('cisco-progress-bar');
            const statusDiv = document.getElementById('cisco-status');
            
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }
            if (statusDiv && statusDiv.parentElement) {
                statusDiv.innerHTML = typeof status === 'string' ? status : 'In Progress';
            }
            
            const stepsDiv = document.getElementById('cisco-steps');
            if (stepsDiv && stepsDiv.parentElement) {
                this.updateStepsList(status);
            }
            
            this._updateTimeout = null;
        }, 100);
    }

    updateProgress(step, status) {
        if (step < 0 || step > this.totalSteps) {
            return;
        }

        this.currentStep = step;
        
        if (step > 0) {
            let normalizedStatus = status;
            if (status === 'completed' || status === 'Complete') {
                normalizedStatus = window.PROGRESS_STATUS.COMPLETED;
            } else if (status === 'in_progress' || status === 'In Progress') {
                normalizedStatus = window.PROGRESS_STATUS.IN_PROGRESS;
            }
            
            this.stepStatuses[step - 1] = normalizedStatus;
            
            // Force immediate UI update for in-progress state to ensure visibility
            if (normalizedStatus === window.PROGRESS_STATUS.IN_PROGRESS) {
                this.updateStepsList();
                // Small delay to ensure in-progress state is visible
                setTimeout(() => {
                    this.updateStepsList();
                }, 100);
            }
            
            if (normalizedStatus === window.PROGRESS_STATUS.COMPLETED) {
                for (let i = 0; i < step - 1; i++) {
                    this.stepStatuses[i] = window.PROGRESS_STATUS.COMPLETED;
                }
            }
        }
        
        const completedSteps = this.stepStatuses.filter(s => s === window.PROGRESS_STATUS.COMPLETED).length;
        const percentage = Math.round((completedSteps / this.totalSteps) * 100);
        
        const progressBar = document.getElementById('cisco-progress-bar');
        const statusDiv = document.getElementById('cisco-status');
        
        if (progressBar) {
            // Remove any existing state classes
            progressBar.classList.remove('complete', 'error', 'warning', 'active', 'full-width');
            
            // Add appropriate state class based on status and percentage
            if (percentage === 100) {
                progressBar.classList.add('complete', 'full-width');
            } else if (status && status.toLowerCase().includes('error')) {
                progressBar.classList.add('error');
            } else if (status && status.toLowerCase().includes('warning')) {
                progressBar.classList.add('warning');
            } else if (percentage > 0 && percentage < 100) {
                // Add active pulse effect during progress
                progressBar.classList.add('active');
            }
            
            // Animate the progress bar width
            progressBar.style.width = `${percentage}%`;
            
            // Add a subtle bounce effect when reaching milestones
            if (percentage > 0 && percentage % 25 === 0) {
                progressBar.style.transform = 'scaleY(1.1)';
                setTimeout(() => {
                    progressBar.style.transform = 'scaleY(1)';
                    progressBar.style.transition = 'width 0.8s ease, transform 0.2s ease';
                }, 150);
            }
        }
        if (statusDiv) {
            statusDiv.innerHTML = typeof status === 'string' ? status : 'In Progress';
        }
        
        this.lastStorageUpdate = Date.now();
        chrome.storage.local.set({
            [window.STORAGE_KEYS.PROGRESS]: {
                status: status,
                step: step,
                total: this.totalSteps,
                stepStatuses: this.stepStatuses
            }
        });
        
        this._updateUI(status);
    }

    updateStepsList(currentStatus) {
        const now = Date.now();
        if (this._lastStepsUpdate && now - this._lastStepsUpdate < 200) {
            return;
        }
        this._lastStepsUpdate = now;
        
        const stepsDiv = document.getElementById('cisco-steps');
        if (!stepsDiv || !stepsDiv.parentElement) return;
        if (!globalThis.REPORT_CHECKS || !Array.isArray(globalThis.REPORT_CHECKS)) return;

        const enabledChecks = globalThis.REPORT_CHECKS.filter(c => c.enabled);
        this._lastStatusCache = this._lastStatusCache || new Map();
        
        const stepsHtml = enabledChecks.map((check, index) => {
            let statusIcon;
            const stepStatus = this.stepStatuses[index];
            const cacheKey = `step-${index}`;
            
            // More precise emoji logic
            if (stepStatus === window.PROGRESS_STATUS.COMPLETED) {
                // Step is definitively completed
                statusIcon = '✅';
            } else if (index + 1 === this.currentStep) {
                // Current step being processed
                if (currentStatus === window.PROGRESS_STATUS.COMPLETED) {
                    // Current step just completed
                    statusIcon = '✅';
                    this._lastStatusCache.set(cacheKey, statusIcon);
                } else {
                    // Current step in progress
                    statusIcon = '🔄';
                    this._lastStatusCache.set(cacheKey, statusIcon);
                }
            } else if (index + 1 < this.currentStep) {
                // Past steps - check if they have data (truly completed)
                statusIcon = this.progressData[check.name] ? '✅' : '❌';
            } else {
                // Future steps - waiting
                statusIcon = '⏳';
            }
            
            return `<div class="cisco-step">${statusIcon} ${check.name}</div>`;
        }).join('');
        
        stepsDiv.innerHTML = stepsHtml;
    }

    updateResults(stepName, data) {
        this.progressData[stepName] = data;
        this.displayResults();
        this.showResults();
    }

    displayResults() {
        const resultsDiv = document.getElementById('cisco-results-content');
        if (!resultsDiv) return;
        
        let html = '';
        Object.entries(this.progressData).forEach(([stepName, data]) => {
            html += `<div class="cisco-results-item">`;
            html += `<strong class="cisco-results-item-title">${stepName}</strong><br>`;
            
            if (typeof data === 'object' && data !== null) {
                Object.entries(data).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        html += `<strong>${key}:</strong> ${value.length} items<br>`;
                        value.forEach((item, idx) => {
                            if (idx < 3) {
                                html += `&nbsp;&nbsp;• ${typeof item === 'object' ? JSON.stringify(item) : item}<br>`;
                            } else if (idx === 3 && value.length > 3) {
                                html += `&nbsp;&nbsp;... and ${value.length - 3} more<br>`;
                            }
                        });
                    } else {
                        html += `<strong>${key}:</strong> ${value}<br>`;
                    }
                });
            } else {
                html += `${data}<br>`;
            }
            html += `</div>`;
        });
        
        resultsDiv.innerHTML = html;
    }

    setError(message) {
        const statusDiv = document.getElementById('cisco-status');
        if (statusDiv) {
            let html = `❌ Error: ${message}`;
            statusDiv.style.color = '#dc3545';
            if (message && (message.toLowerCase().includes('navigation failed repeatedly') || message.toLowerCase().includes('navigation failsafe') || message.toLowerCase().includes('redirected to home'))) {
                html += `<br><button id="reset-navigation-lock" style="margin-top:10px;padding:6px 12px;background:#0073B7;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-family:'CiscoSans','Helvetica Neue',Arial,sans-serif;">Reset Navigation Lock</button>`;
            }
            statusDiv.innerHTML = html;
            const resetBtn = document.getElementById('reset-navigation-lock');
            if (resetBtn) {
                resetBtn.onclick = async () => {
                    await chrome.storage.local.set({ navigationLocked: false });
                    await chrome.storage.local.set({ navigationFailCount: 0 });
                    window.navigationLocked = false;
                    if (window.resetNavigationFailCount) {
                        window.resetNavigationFailCount();
                    }
                    statusDiv.innerHTML = '<span style="color: #4CAF50; font-weight: bold;">Navigation lock reset. You may now retry automation.</span>';
                    statusDiv.style.color = '#4CAF50';
                };
            }
        }
    }

    setComplete() {
        const statusDiv = document.getElementById('cisco-status');
        if (statusDiv) {
            statusDiv.innerHTML = '✅ Collection Complete!';
            statusDiv.style.color = '#4CAF50';
        }
        
        // Update progress bar to complete state
        const progressBar = document.getElementById('cisco-progress-bar');
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.classList.remove('active', 'error', 'warning');
            progressBar.classList.add('complete', 'full-width');
            
            // Add celebration animation
            setTimeout(() => {
                progressBar.style.transform = 'scaleY(1.2)';
                setTimeout(() => {
                    progressBar.style.transform = 'scaleY(1)';
                }, 300);
            }, 200);
        }
        
        const viewReportBtn = document.getElementById('cisco-view-report');
        if (viewReportBtn) {
            viewReportBtn.disabled = false;
            // The CSS class will handle the styling automatically
            viewReportBtn.onclick = null;
            viewReportBtn.onclick = async () => {
                if (viewReportBtn.disabled) return;
                try {
                    await chrome.runtime.sendMessage({
                        type: 'open_report_tab',
                        active: true
                    });
                } catch (e) {}
                this.closeProgressUI();
            };
        }
        this.updateProgress(this.totalSteps, 'Complete');
        this.showResults();
    }

    startReportGeneration() {
        // Start the report generation step
        const reportStep = globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.find(c => c.key === 'report') : null;
        const stepName = reportStep ? reportStep.name : 'Generate OS Ready Report';
        
        this.updateProgress(this.totalSteps, 'In Progress');
        this.stepStatuses[this.totalSteps - 1] = window.PROGRESS_STATUS.IN_PROGRESS;
        this.updateStepsList();
    }

    completeReportGeneration() {
        // Complete the report generation step
        const reportStep = globalThis.REPORT_CHECKS ? globalThis.REPORT_CHECKS.find(c => c.key === 'report') : null;
        const stepName = reportStep ? reportStep.name : 'Generate OS Ready Report';
        
        this.stepStatuses[this.totalSteps - 1] = window.PROGRESS_STATUS.COMPLETED;
        this.progressData[stepName] = { generated: true, timestamp: new Date().toISOString() };
        this.updateProgress(this.totalSteps, window.PROGRESS_STATUS.COMPLETED);
        this.updateStepsList();
    }

    toggleProgress() {
        const container = document.getElementById('cisco-progress-container');
        const button = document.getElementById('cisco-toggle-progress');
        
        if (container.style.display === 'none') {
            container.style.display = 'flex';
            if (button) button.innerHTML = 'Hide Progress';
        } else {
            container.style.display = 'none';
            if (button) button.innerHTML = 'Show Progress';
        }
    }

    toggleResults() {
        const container = document.getElementById('cisco-results-container');
        
        if (container.style.display === 'none') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }

    toggleResultsExpansion() {
        const container = document.getElementById('cisco-results-container');
        const expandButton = container.querySelector('.cisco-expand-btn');
        
        if (container.classList.contains('minimized')) {
            // Expand
            container.classList.remove('minimized');
            container.classList.add('expanded');
            expandButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M17 10l-5 5-5-5" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            expandButton.title = 'Minimize';
        } else {
            // Minimize
            container.classList.remove('expanded');
            container.classList.add('minimized');
            expandButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 14l5-5 5 5" stroke="#4CAF50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            expandButton.title = 'Expand';
        }
    }

    async showResults() {
        const container = document.getElementById('cisco-results-container');
        if (!container) return;

        // Always show the results container (it's now always visible)
        container.style.display = 'block';
        
        // Start in minimized state
        if (!container.classList.contains('minimized') && !container.classList.contains('expanded')) {
            container.classList.add('minimized');
        }
    }

    closeProgressUI() {
        const container = document.getElementById('cisco-progress-container');
        if (container) {
            container.remove();
        }
        // Also close the results window for coordinated UI behavior
        this.closeResultsUI();
    }

    closeResultsUI() {
        const container = document.getElementById('cisco-results-container');
        if (container) {
            container.remove();
        }
    }

    cleanup() {
        const containers = ['cisco-progress-container', 'cisco-results-container'];
        containers.forEach(id => {
            const elements = document.querySelectorAll(`#${id}`);
            elements.forEach(element => element.remove());
        });
        
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
            this._updateTimeout = null;
        }
        if (this._stepsUpdateTimeout) {
            clearTimeout(this._stepsUpdateTimeout);
            this._stepsUpdateTimeout = null;
        }
    }
}
window.ProgressManager = ProgressManager;
