// ==UserScript==
// @name         Cursor Usage Event Counter & Auto Rows (v0.13 - All Models)
// @namespace    http://tampermonkey.net/
// @version      0.13
// @description  Counts successful & errored events for all models, sets rows to 500 on Cursor's usage page, and shows notifications.
// @author       Fahad
// @match        https://www.cursor.com/dashboard?tab=usage
// @match        *://*/*dashboard*tab=usage*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Usage Counter] Script starting (v0.13 - All Models)...');

    const ERRORED_KIND_TEXT = "Errored, Not Charged";
    const DISPLAY_ELEMENT_ID = 'userscript-usage-counter';
    const NOTIFICATION_ELEMENT_ID = 'userscript-row-notification';
    const TARGET_ROWS_PER_PAGE_VALUE = "500";
    let rowsPerPageSetAttempted = false;

    function createOrUpdateDisplay(modelCounts) {
        console.log('[Usage Counter] createOrUpdateDisplay called with modelCounts:', modelCounts);
        let display = document.getElementById(DISPLAY_ELEMENT_ID);
        if (!document.body) { // Guard against body not being ready
            console.error("[Usage Counter] Document body not found in createOrUpdateDisplay. Aborting display update.");
            return null;
        }
        if (!display) {
            console.log('[Usage Counter] Creating display element.');
            display = document.createElement('div');
            display.id = DISPLAY_ELEMENT_ID;
            display.style.position = 'fixed';
            display.style.top = '120px';
            display.style.right = '20px';
            display.style.padding = '10px 15px';
            display.style.backgroundColor = 'rgba(50, 50, 50, 0.9)';
            display.style.color = '#e0e0e0';
            display.style.border = '1px solid #777';
            display.style.borderRadius = '5px';
            display.style.zIndex = '10001';
            display.style.fontSize = '14px';
            display.style.fontFamily = 'Arial, sans-serif';
            display.style.lineHeight = '1.6';
            display.style.maxHeight = '70vh';
            display.style.overflowY = 'auto';
            try {
                document.body.appendChild(display);
                console.log('[Usage Counter] Display element appended to body.');
            } catch (e) {
                console.error('[Usage Counter] Error appending display element to body:', e);
                return null;
            }
        }

        let htmlContent = '<h3 style="margin-top:0;margin-bottom:10px;border-bottom:1px solid #555;padding-bottom:5px;">Usage Counts</h3>';
        
        // Calculate totals
        let totalSuccessful = 0;
        let totalErrored = 0;
        
        // Sort models alphabetically
        const sortedModels = Object.keys(modelCounts).sort();
        
        sortedModels.forEach(model => {
            const counts = modelCounts[model];
            totalSuccessful += counts.successful;
            totalErrored += counts.errored;
            const modelTotal = counts.successful + counts.errored;
            
            htmlContent += `<div style="margin-bottom:8px;padding-bottom:5px;border-bottom:1px dotted #444;">
                <strong>${model}</strong><br>
                <span style="color:#7fff7f">Successful: ${counts.successful}</span><br>
                <span style="color:#ff7f7f">Errored: ${counts.errored}</span><br>
                <span>Total: ${modelTotal}</span>
            </div>`;
        });
        
        // Add overall totals at the bottom
        const overallTotal = totalSuccessful + totalErrored;
        htmlContent += `<div style="margin-top:10px;padding-top:5px;border-top:2px solid #555;">
            <strong>OVERALL TOTALS</strong><br>
            <span style="color:#7fff7f">Successful: ${totalSuccessful}</span><br>
            <span style="color:#ff7f7f">Errored: ${totalErrored}</span><br>
            <span>Total: ${overallTotal}</span>
        </div>`;
        
        display.innerHTML = htmlContent;
        return display;
    }

    function showTemporaryNotification(message) {
        if (!document.body) {
            console.error("[Usage Counter] Document body not found in showTemporaryNotification. Aborting notification.");
            return;
        }
        
        let notification = document.getElementById(NOTIFICATION_ELEMENT_ID);
        if (!notification) {
            notification = document.createElement('div');
            notification.id = NOTIFICATION_ELEMENT_ID;
            notification.style.position = 'fixed';
            notification.style.top = '70px';
            notification.style.right = '20px';
            notification.style.padding = '10px 15px';
            notification.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
            notification.style.color = 'white';
            notification.style.border = '1px solid #28a745';
            notification.style.borderRadius = '5px';
            notification.style.zIndex = '10002';
            notification.style.fontSize = '14px';
            notification.style.fontFamily = 'Arial, sans-serif';
            notification.style.transition = 'opacity 0.5s ease-in-out';
            notification.style.opacity = '0';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.display = 'block';
        
        // Fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);
        
        // Fade out and hide after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 500);
        }, 3000);
        
        console.log('[Usage Counter] Notification shown:', message);
    }

    function isLikelyUsagePage() {
        // Check URL first - most reliable method
        if (typeof window !== 'undefined' && window.location && window.location.href) {
            if (window.location.href.includes("cursor.com/dashboard") && 
                (window.location.search.includes("tab=usage") || 
                 window.location.pathname.includes("/usage"))) {
                console.log('[Usage Counter] isLikelyUsagePage: true (URL match).');
                return true;
            }
        }
        
        // Content-based checks as fallback
        try {
            // Check for table headers or content that would indicate usage page
            const usageIndicators = [
                'table:has(th:contains("Date"))',
                'table:has(th:contains("Kind"))',
                'table:has(th:contains("Model"))',
                'div:contains("Usage")',
                'h1:contains("Usage")',
                'div:contains("API Calls")'
            ];
            
            for (const selector of usageIndicators) {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements && elements.length > 0) {
                        console.log(`[Usage Counter] isLikelyUsagePage: true (found ${elements.length} elements matching "${selector}").`);
                        return true;
                    }
                } catch (selectorError) {
                    // Some browsers might not support complex selectors
                    console.log(`[Usage Counter] Selector error for "${selector}":`, selectorError);
                }
            }
            
            // Look for model-related text on the page
            const textNodes = document.querySelectorAll('body *');
            for (const node of textNodes) {
                if (node.textContent && (
                    node.textContent.includes("claude") || 
                    node.textContent.includes("gpt") ||
                    node.textContent.includes("llama") ||
                    node.textContent.includes("gemini"))) {
                    console.log('[Usage Counter] isLikelyUsagePage: true (found model name in page content).');
                    return true;
                }
            }
        } catch (e) {
            console.error('[Usage Counter] Error in content-based page detection:', e);
        }
        
        console.log('[Usage Counter] isLikelyUsagePage: false (no indicators found).');
        return false;
    }

    function autoSetRowsPerPage() {
        try {
            console.log('[Usage Counter] Attempting to set rows per page to', TARGET_ROWS_PER_PAGE_VALUE, 'using <select> logic.');
            const selectElementSelector = 'select.bg-transparent.border.border-brand-borders.dark\\:border-brand-neutrals-800.rounded.text-xs.px-2.py-1';
            let selectElement = document.querySelector(selectElementSelector);

            if (!selectElement) {
                // Try fallback selectors
                const fallbackSelectors = [
                    'select[aria-label="Rows per page"]',
                    'select.text-xs',
                    'select[class*="text-xs"]',
                    'select'
                ];
                
                for (const selector of fallbackSelectors) {
                    selectElement = document.querySelector(selector);
                    if (selectElement) {
                        console.log(`[Usage Counter] Found rows per page <select> using fallback selector: ${selector}`);
                        break;
                    }
                }
            }

            if (!selectElement) {
                console.log('[Usage Counter] Rows per page <select> element not found even with fallback.');
                return Promise.resolve(false);
            }
            
            if (selectElement.value === TARGET_ROWS_PER_PAGE_VALUE) {
                console.log(`[Usage Counter] Rows per page already set to ${TARGET_ROWS_PER_PAGE_VALUE}.`);
                showTemporaryNotification(`Rows per page already set to ${TARGET_ROWS_PER_PAGE_VALUE}`);
                return Promise.resolve(true);
            }
            
            const targetOption = Array.from(selectElement.options).find(option => option.value === TARGET_ROWS_PER_PAGE_VALUE);
            if (!targetOption) {
                console.log(`[Usage Counter] Option for ${TARGET_ROWS_PER_PAGE_VALUE} rows not found in select element.`);
                return Promise.resolve(false);
            }
            
            selectElement.value = TARGET_ROWS_PER_PAGE_VALUE;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            selectElement.dispatchEvent(new Event('input', { bubbles: true }));
            showTemporaryNotification(`Rows per page set to ${TARGET_ROWS_PER_PAGE_VALUE}!`);
            return new Promise(resolve => setTimeout(() => resolve(true), 300));
        } catch (e) {
            console.error("[Usage Counter] CRITICAL ERROR in autoSetRowsPerPage:", e);
            return Promise.resolve(false); // Resolve false on error
        }
    }

    function performCount() {
        console.log('[Usage Counter] Performing actual event count (All Models v0.13).');
        // Initialize an object to store counts for each model
        let modelCounts = {};

        try {
            // Find all table rows or elements that might contain usage data
            const tableRows = document.querySelectorAll('tr, div[role="row"]');
            console.log(`[Usage Counter] Found ${tableRows.length} potential table rows.`);
            
            if (tableRows.length === 0) {
                // Try a more generic approach to find potential model cells
                const allPossibleElements = document.querySelectorAll('body *');
                const potentialModelCells = Array.from(allPossibleElements).filter(el => {
                    if (!el || !el.textContent) return false;
                    const text = el.textContent.trim();
                    // Pattern matching for common model names
                    return (
                        text.includes("claude") || 
                        text.includes("gpt") || 
                        text.includes("llama") ||
                        text.includes("gemini") ||
                        text.includes("mistral") ||
                        text.includes("anthropic")
                    );
                });
                
                console.log(`[Usage Counter] No table rows found. Found ${potentialModelCells.length} potential model cells via text content search.`);
                
                // Process each potential model cell
                potentialModelCells.forEach((modelCell, index) => {
                    try {
                        if (!modelCell.textContent) return;
                        
                        const modelName = modelCell.textContent.trim();
                        let kindText = "";
                        
                        // Look for kind information in parent elements or siblings
                        const parentElement = modelCell.parentElement;
                        if (parentElement) {
                            const allCellsInRow = parentElement.querySelectorAll('*');
                            for (const cell of allCellsInRow) {
                                if (cell.textContent && cell.textContent.trim() === ERRORED_KIND_TEXT) {
                                    kindText = ERRORED_KIND_TEXT;
                                    break;
                                }
                            }
                        }
                        
                        // Initialize model entry if not exists
                        if (!modelCounts[modelName]) {
                            modelCounts[modelName] = { successful: 0, errored: 0 };
                        }
                        
                        // Count based on kind
                        if (kindText === ERRORED_KIND_TEXT) {
                            modelCounts[modelName].errored++;
                        } else {
                            modelCounts[modelName].successful++;
                        }
                    } catch (e) {
                        console.error(`[Usage Counter] Error processing potential model cell ${index}:`, e);
                    }
                });
            } else {
                // Process each table row
                tableRows.forEach((row, index) => {
                    try {
                        // Skip header rows (they usually have th elements)
                        if (row.querySelector('th')) {
                            return;
                        }
                        
                        // Get all cells in the row
                        const cells = row.querySelectorAll('td, div[role="cell"]');
                        if (!cells || cells.length < 3) return;
                        
                        let modelName = "";
                        let kindText = "";
                        
                        // Try to identify model and kind cells
                        // In most tables: Date | Kind | Model | ...
                        for (let i = 0; i < cells.length; i++) {
                            const cell = cells[i];
                            if (!cell || !cell.textContent) continue;
                            
                            const cellText = cell.textContent.trim();
                            
                            // Look for model name patterns
                            if (cellText.includes("claude") || 
                                cellText.includes("gpt") || 
                                cellText.includes("llama") || 
                                cellText.includes("gemini") ||
                                cellText.includes("mistral")) {
                                modelName = cellText;
                            }
                            
                            // Check if this is a kind cell with error status
                            if (cellText === ERRORED_KIND_TEXT) {
                                kindText = ERRORED_KIND_TEXT;
                            }
                        }
                        
                        if (modelName) {
                            // Initialize model entry if not exists
                            if (!modelCounts[modelName]) {
                                modelCounts[modelName] = { successful: 0, errored: 0 };
                            }
                            
                            // Count based on kind
                            if (kindText === ERRORED_KIND_TEXT) {
                                modelCounts[modelName].errored++;
                            } else {
                                modelCounts[modelName].successful++;
                            }
                        }
                    } catch (e) {
                        console.error(`[Usage Counter] Error processing table row ${index}:`, e);
                    }
                });
            }
        } catch (e) {
            console.error("[Usage Counter] CRITICAL ERROR in performCount's main try block:", e);
            // In case of a major error, try to display something to indicate script ran but failed counting
            createOrUpdateDisplay({ "ERROR": { successful: -1, errored: -1 } });
            return; // Stop further processing in performCount
        }
        
        // If no models were found, show error message
        if (Object.keys(modelCounts).length === 0) {
            modelCounts["No Models Found"] = { successful: 0, errored: 0 };
        }
        
        console.log('[Usage Counter] Final model counts:', modelCounts);
        
        try {
            const display = createOrUpdateDisplay(modelCounts);
            if (display) {
                display.style.display = 'block';
            } else {
                console.error("[Usage Counter] createOrUpdateDisplay returned null after counts. Display not shown.");
            }
        } catch (e) {
            console.error("[Usage Counter] Error calling createOrUpdateDisplay or setting display to block (after counts):", e);
        }
    }

    function countEvents() {
        console.log('[Usage Counter] countEvents called.');
        try {
            if (!isLikelyUsagePage()) {
                console.log('[Usage Counter] Not on usage page, hiding display if it exists.');
                const display = document.getElementById(DISPLAY_ELEMENT_ID);
                if (display) {
                    display.style.display = 'none';
                }
                return;
            }
            
            if (!rowsPerPageSetAttempted) {
                autoSetRowsPerPage().then(success => {
                    rowsPerPageSetAttempted = true;
                    console.log("[Usage Counter] autoSetRowsPerPage promise resolved. Success:", success);
                    setTimeout(() => { 
                        try { 
                            performCount(); 
                        } catch(e) { 
                            console.error("Error in performCount from timeout:", e); 
                            createOrUpdateDisplay({ "ERROR": { successful: -1, errored: -1 } });
                        }
                    }, success ? 500 : 0);
                }).catch(err => {
                    console.error("[Usage Counter] Error in autoSetRowsPerPage promise:", err);
                    rowsPerPageSetAttempted = true;
                    try { 
                        performCount(); 
                    } catch(e) { 
                        console.error("Error in performCount from catch:", e); 
                        createOrUpdateDisplay({ "ERROR": { successful: -1, errored: -1 } });
                    }
                });
            } else {
                try { 
                    performCount(); 
                } catch(e) { 
                    console.error("Error in performCount (direct call):", e); 
                    createOrUpdateDisplay({ "ERROR": { successful: -1, errored: -1 } });
                }
            }
        } catch (e) {
            console.error("[Usage Counter] CRITICAL ERROR in countEvents function:", e);
            try { 
                createOrUpdateDisplay({ "ERROR": { successful: -1, errored: -1 } }); 
            } catch (e2) { 
                console.error("Error trying to show error display:", e2); 
            }
        }
    }

    // Initial run and interval
    try {
        console.log("[Usage Counter] Setting up initial timers.");
        setTimeout(() => {
            console.log('[Usage Counter] Initial countEvents timeout triggered.');
            countEvents();
        }, 2000); // Slightly longer initial delay

        setInterval(() => {
            console.log('[Usage Counter] Interval countEvents triggered.');
            countEvents();
        }, 6000); // Slightly longer interval
    } catch (e) {
        console.error("[Usage Counter] CRITICAL ERROR setting up initial timers:", e);
    }

    console.log('[Usage Counter] Script loaded and initial timers set (v0.13 - All Models).');
})();