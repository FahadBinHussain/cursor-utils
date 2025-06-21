// ==UserScript==
// @name         Cursor Usage Event Counter & Auto Rows (v0.12 - Ultra Robust)
// @namespace    http://tampermonkey.net/
// @version      0.12
// @description  Counts successful & errored events, sets rows to 500 on Cursor's usage page, and shows notifications.
// @author       Fahad
// @match        https://www.cursor.com/dashboard?tab=usage
// @match        *://*/*dashboard*tab=usage*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Usage Counter] Script starting (v0.12 - Ultra Robust)...');

    const MODEL_TEXT_TO_COUNT = "claude-3.7-sonnet";
    const ERRORED_KIND_TEXT = "Errored, Not Charged";
    const DISPLAY_ELEMENT_ID = 'userscript-usage-counter';
    const NOTIFICATION_ELEMENT_ID = 'userscript-row-notification';
    const TARGET_ROWS_PER_PAGE_VALUE = "500";
    let rowsPerPageSetAttempted = false;

    function createOrUpdateDisplay(successfulCount, erroredCount) {
        console.log('[Usage Counter] createOrUpdateDisplay called with successful:', successfulCount, 'errored:', erroredCount);
        let display = document.getElementById(DISPLAY_ELEMENT_ID);
        if (!document.body) { // Guard against body not being ready
            console.error("[Usage Counter] Document body not found in createOrUpdateDisplay. Aborting display update.");
            return null;
        }
        if (!display) {
            console.log('[Usage Counter] Creating display element.');
            display = document.createElement('div');
            display.id = DISPLAY_ELEMENT_ID;
            // ... (styling remains the same)
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
            try {
                document.body.appendChild(display);
                console.log('[Usage Counter] Display element appended to body.');
            } catch (e) {
                console.error('[Usage Counter] Error appending display element to body:', e);
                return null;
            }
        }
        const totalCount = successfulCount + erroredCount;
        display.innerHTML = `Model: ${MODEL_TEXT_TO_COUNT}<br>Successful: ${successfulCount}<br>Errored: ${erroredCount}<br>Total: ${totalCount}`;
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
            
            // Look for model name on the page
            const textNodes = document.querySelectorAll('body *');
            for (const node of textNodes) {
                if (node.textContent && node.textContent.includes(MODEL_TEXT_TO_COUNT)) {
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
        console.log('[Usage Counter] Performing actual event count (differentiated v0.11 - Ultra Robust).');
        let successfulModelEvents = 0;
        let erroredModelEvents = 0;

        try {
            const allPossibleElements = document.querySelectorAll('body *');
            if (!allPossibleElements || allPossibleElements.length === 0) {
                console.warn("[Usage Counter] No elements found under body * for model cell search.");
                createOrUpdateDisplay(0, 0); // Show 0 if no elements
                return;
            }

            const modelCells = Array.from(allPossibleElements)
                .filter(el => el && el.children && typeof el.children.length === 'number' && el.children.length === 0 &&
                               el.textContent && el.textContent.trim() === MODEL_TEXT_TO_COUNT);

            console.log(`[Usage Counter] Found ${modelCells.length} potential model cells with text "${MODEL_TEXT_TO_COUNT}".`);

            modelCells.forEach((modelCell, index) => {
                console.log(`[Usage Counter] Processing model cell ${index + 1}:`, modelCell ? modelCell.outerHTML.substring(0, 100) + "..." : "NULL modelCell");
                if (!modelCell) {
                    console.error(`[Usage Counter] Row ${index + 1}: modelCell is unexpectedly null or undefined. Skipping.`);
                    return;
                }

                let kindText = "";

                // Attempt 1: Sibling Navigation
                try {
                    const maxModeCell = modelCell.previousElementSibling;
                    if (maxModeCell) {
                        const potentialKindCell = maxModeCell.previousElementSibling;
                        if (potentialKindCell) {
                            if (potentialKindCell.textContent) {
                                kindText = potentialKindCell.textContent.trim();
                                console.log(`[Usage Counter] Row ${index + 1} (Sibling Nav): Found Kind cell. Text: "${kindText}"`);
                            } else {
                                console.log(`[Usage Counter] Row ${index + 1} (Sibling Nav): Kind cell found (sibling) but textContent is empty/null.`);
                            }
                        } else {
                            console.log(`[Usage Counter] Row ${index + 1} (Sibling Nav): MaxMode cell found, but its previous sibling (expected Kind) is null.`);
                        }
                    } else {
                        console.log(`[Usage Counter] Row ${index + 1} (Sibling Nav): Model cell's previous sibling (expected MaxMode) is null.`);
                    }
                } catch (e) {
                    console.error(`[Usage Counter] Row ${index + 1} (Sibling Nav): Error during sibling navigation:`, e, modelCell.outerHTML);
                    kindText = ""; // Ensure reset
                }

                // Attempt 2 (Fallback): Parent-Child Index
                if (!kindText) {
                    console.log(`[Usage Counter] Row ${index + 1}: Sibling navigation for Kind failed or yielded no text. Trying parent-child index fallback.`);
                    try {
                        const parentCell = modelCell.parentElement; // Assumed <td> or cell div
                        if (parentCell) {
                            const rowElement = parentCell.parentElement; // Assumed <tr> or row div
                            if (rowElement && rowElement.children && typeof rowElement.children.length === 'number' && rowElement.children.length > 2) {
                                const potentialKindCellByParent = rowElement.children[2]; // Kind is index 2
                                if (potentialKindCellByParent) {
                                    if (potentialKindCellByParent.textContent) {
                                        kindText = potentialKindCellByParent.textContent.trim();
                                        console.log(`[Usage Counter] Row ${index + 1} (Parent-Child Index): Found Kind cell. Text: "${kindText}"`);
                                    } else {
                                        console.log(`[Usage Counter] Row ${index + 1} (Parent-Child Index): Kind cell (children[2]) found but textContent is empty/null.`);
                                    }
                                } else {
                                    console.log(`[Usage Counter] Row ${index + 1} (Parent-Child Index): Kind cell (children[2]) is null.`);
                                }
                            } else {
                                console.log(`[Usage Counter] Row ${index + 1} (Parent-Child Index): rowElement or its children not suitable. Row:`, rowElement ? rowElement.outerHTML.substring(0,100) : "NULL rowElement");
                            }
                        } else {
                            console.log(`[Usage Counter] Row ${index + 1} (Parent-Child Index): modelCell.parentElement is null.`);
                        }
                    } catch (e) {
                        console.error(`[Usage Counter] Row ${index + 1} (Parent-Child Index): Error during parent-child navigation:`, e, modelCell.outerHTML);
                        kindText = ""; // Ensure reset
                    }
                }

                if (kindText) {
                    if (kindText === ERRORED_KIND_TEXT) {
                        erroredModelEvents++;
                    } else {
                        successfulModelEvents++;
                    }
                } else {
                    successfulModelEvents++;
                    console.warn(`[Usage Counter] Row ${index + 1}: Could NOT determine Kind text. Counting as successful by default. Model:`, modelCell.outerHTML.substring(0,100));
                }
            });
        } catch (e) {
            console.error("[Usage Counter] CRITICAL ERROR in performCount's main try block:", e);
            // In case of a major error, try to display something to indicate script ran but failed counting
            createOrUpdateDisplay(-1, -1); // Indicate error in counts
            return; // Stop further processing in performCount
        }

        console.log('[Usage Counter] Final Differentiated counts - Successful:', successfulModelEvents, 'Errored:', erroredModelEvents);
        try {
            const display = createOrUpdateDisplay(successfulModelEvents, erroredModelEvents);
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
                            createOrUpdateDisplay(-1,-1); 
                        }
                    }, success ? 500 : 0);
                }).catch(err => {
                    console.error("[Usage Counter] Error in autoSetRowsPerPage promise:", err);
                    rowsPerPageSetAttempted = true;
                    try { 
                        performCount(); 
                    } catch(e) { 
                        console.error("Error in performCount from catch:", e); 
                        createOrUpdateDisplay(-1,-1); 
                    }
                });
            } else {
                try { 
                    performCount(); 
                } catch(e) { 
                    console.error("Error in performCount (direct call):", e); 
                    createOrUpdateDisplay(-1,-1); 
                }
            }
        } catch (e) {
            console.error("[Usage Counter] CRITICAL ERROR in countEvents function:", e);
            try { 
                createOrUpdateDisplay(-1, -1); 
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

    console.log('[Usage Counter] Script loaded and initial timers set (v0.12 - Ultra Robust).');
})();