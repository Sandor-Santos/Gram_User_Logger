import { compareLogs } from './Log_Comparer.js';

console.log('Save Followers Popup');

await chrome.storage.local.get(['followerLimit'], (result) => {
    if (result.followerLimit < 1) {
        result.followerLimit = 3000;
    }
    document.getElementById('log-limit').value = result.followerLimit || 3000;

});

instantiateLogEntries();

/**
 * Function to refresh popup size;
 */
function refreshPopupSize() {
    let popupBody = document.getElementById('popup-html');
    popupBody.style.maxHeight = '0px';

    console.log('Popup size refreshed');
}

/**
 * 
 * @returns {Promise<number>} - The follower limit from storage or a default value
 */
async function getFollowerLimit() {
    const result = await chrome.storage.local.get(['followerLimit']);
    return result.followerLimit || 3000;
}

/**
 * Updates and displays the list of saved logs in the popup.
 * Handles the display of log entries and attaches click listeners.
 * Shows loading state and error messages when appropriate.
 * @async
 * @returns {void}
 */
async function instantiateLogEntries() {
    console.log("Getting logs...");
    const logsContainer = document.getElementById('logs-container');
    logsContainer.innerHTML = 'Loading Logs...';

    // Add flash effect to update logs button
    let updateLogsButton = document.getElementById('update_logs');
    updateLogsButton.classList.add('update-logs-flash-success');
    setTimeout(() => {
        updateLogsButton.classList.remove('update-logs-flash-success');
    }, 450);
    
    try {
        const result = await chrome.storage.local.get(['Logs']);
        const logs = result.Logs || {};
        
        if (Object.keys(logs).length === 0) {
            logsContainer.innerHTML = '<div class="log-entry">No logs found</div>';
            return;
        }

        console.log('Logs:', logs);

        const logsHtml = Object.keys(logs).map(filename => 
            `<div class="log-entry" data-filename="${filename}">${filename}</div>`
        ).join('');

        logsContainer.innerHTML = logsHtml;

        // Add click handlers to log entries
        const logEntries = logsContainer.querySelectorAll('.log-entry');
        const detailsContainer = document.getElementById('selected-log-details');
        const logContent = document.getElementById('log-content');

        logEntries.forEach(entry => {
            entry.addEventListener('click', async () => {

                // Highlight the selected log entry
                if(!entry.classList.contains('comparable')) {
                    // Reset styles for all other log entries
                    logEntries.forEach(e => {
                        e.style.backgroundColor = ''; // Reset background color
                        e.style.color = ''; // Reset text color
                    });
                    // Highlight the selected log entry
                    entry.style.backgroundColor = '#888'; // Set darker background for selected log
                    entry.style.color = '#fff'; // Optional: Set text color for better contrast
                }

                const filename = entry.dataset.filename;
                const logData = logs[filename];
                

                // Check if we're in compare mode
                if (logsContainer.dataset.compareMode === 'true') {
                    const currentLogName = document.getElementById('selected-log-details-header').textContent.replace('Log Details: ', '');
                    
                    if (filename === currentLogName) {
                        return; // Don't compare with self
                    }

                    // Perform comparison
                    const baseLog = logs[currentLogName];
                    const compareLog = logs[filename];
                    const comparisonResults = compareLogs(baseLog, compareLog);

                    // Display results
                    document.getElementById('comparison-results').style.display = 'block';
                    document.getElementById('comparison-content').textContent = comparisonResults;

                    // Reset compare mode
                    const compareButton = document.getElementById('compare-logs-button');
                    compareButton.classList.remove('comparing');
                    compareButton.textContent = 'Compare with...';
                    
                    // Add flash effect
                    console.log('Comparison successful');
                    compareButton.classList.add('compare-flash-success');
                    setTimeout(() => {
                        compareButton.classList.remove('compare-flash-success');
                    }, 1000);
                    
                    logsContainer.dataset.compareMode = 'false';

                    // Remove visual indicators
                    logEntries.forEach(e => e.classList.remove('comparable'));
                    
                    return;
                }

                // Normal log selection behavior
                document.getElementById('selected-log-details-header').textContent = 'Log Details: ' + filename;
                logContent.textContent = JSON.stringify(logData, null, 2);
                detailsContainer.style.display = 'block';
                
                logEntries.forEach(e => e.classList.remove('active'));
                entry.classList.add('active');
            });
        });

    } catch (err) {
        console.log('Error loading logs:', err);
        logsContainer.innerHTML = '<div class="log-entry">Error loading logs</div>';
    }
}

/**
 * Event listener for the Save Current User button.
 * Saves the followers of the current Instagram user if on an Instagram page.
 * Shows error message if not on Instagram, updates UI during save process.
 */
document.getElementById('save_button').addEventListener('click', async () => {
    const button = document.getElementById('save_button');
    const originalText = button.textContent;

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let currentPageURL = tab.url;
    
    if(!currentPageURL.includes("instagram.com/") 
        || currentPageURL.includes("/direct/")
        || currentPageURL.includes("/explore/")
        || currentPageURL.includes("/reels/")
        || currentPageURL.includes("/stories/")
        || currentPageURL.includes("/p/")) {
        // Show error message
        let error_label = document.getElementById("error_message");
        error_label.textContent = "Please open an Instagram Profile page.";
        error_label.hidden = false;

        console.log("This is not an Instagram page.");
        return null;
    }
    
    try {
        button.textContent = 'Saving...';
        button.disabled = true; // Optional: disable button while saving

        console.log(' + BUTTON: Fetching followers...');
        const followersData = await getFollowersLog();

        if(!followersData) {
            console.log(' + BUTTON: No followers data found');
            return;
        }

        const savedTitle = await saveToStorage(followersData);
        console.log(' + BUTTON: Saved to storage:', savedTitle);

        if(!savedTitle) {
            console.log(' + BUTTON: Saved Title not found');
            return;
        }

        // Add flash effect
        button.classList.add('save-followers-flash-success');
        setTimeout(() => {
            compareButton.classList.remove('save-followers-flash-success');
        }, 1000);

        console.log(` + BUTTON: Saved as "${savedTitle}"`);
    } 
    catch (err) {
        console.log(' + BUTTON: Error saving followers:');
    } 
    finally {
        button.textContent = originalText;
        button.disabled = false; // Re-enable button
    }

    instantiateLogEntries();
    
    console.log(" + BUTTON: Done.");
});

/**
 * Event listener for the Update Logs button.
 * Refreshes the display of saved logs in the popup.
 */
document.getElementById('update_logs').addEventListener('click', async () => {
    instantiateLogEntries();
});

/**
 * Event listener for the Clear Logs button.
 * Implements a two-step confirmation process before clearing all logs.
 * Shows confirmation message and requires second click within 3 seconds.
 */
document.getElementById('clear_ALL_logs').addEventListener('click', async function() {
    const button = this;
    
    if (!button.classList.contains('confirm')) {
        // First click - show confirmation
        button.textContent = 'Are you sure? Click again to confirm';
        button.classList.add('confirm');
        
        // Reset after 3 seconds if not clicked
        setTimeout(() => {
            if (button.classList.contains('confirm')) {
                button.textContent = 'Clear Logs';
                button.classList.remove('confirm');
            }
        }, 3000);
        
        return;
    }
    
    // Second click - proceed with clearing
    try {
        await chrome.storage.local.remove(['Logs']);
        console.log('Logs cleared successfully');
        
        // Reset button state
        button.textContent = 'Logs Cleared!';
        button.classList.remove('confirm');
        
        // Update the logs display
        await instantiateLogEntries();
        
        // Reset button text after 2 seconds
        setTimeout(() => {
            button.textContent = 'Clear Logs';
        }, 2000);
        
    } catch (err) {
        console.log('Error clearing logs:', err);
        button.textContent = 'Error clearing logs';
        button.classList.remove('confirm');
    }
});

/**
 * Event listener for the Settings button.
 * Toggles between main view and settings view.
 * Updates button text and visibility of views accordingly.
 */
document.getElementById('settings-button').addEventListener('click', async () => {
    const main_view = document.getElementById('main-view');
    const settings_view = document.getElementById('settings-view');
    const settings_button = document.getElementById('settings-button');

    refreshPopupSize();

    if(main_view.style.display === 'none') { // Open main page
        settings_button.textContent = 'Settings';

        main_view.style.display = 'block';
        settings_view.style.display = 'none';
        return;
    }
    if(settings_view.style.display === 'none') { // Open settings page
        settings_button.textContent = 'Back';

        main_view.style.display = 'none';
        settings_view.style.display = 'block';
        return;
    }

    const result = await chrome.storage.local.get(['followerLimit']);
    if(result.followerLimit < 1) result.followerLimit = 3000;

    document.getElementById('log-limit').value = result.followerLimit;
});

// Auto-save when limit changes
document.getElementById('log-limit').addEventListener('change', async (e) => {
    const limit = parseInt(e.target.value);
    if (limit >= 49) {
        await chrome.storage.local.set({ followerLimit: limit });
        console.log('Follower limit updated to:', limit);
    }
    else {
        console.log('Invalid follower limit:', limit);
        await chrome.storage.local.set({ followerLimit: 50 });
        document.getElementById('log-limit').value = 50;
    }
});

/**
 * Event listener for the Export Logs button.
 * Exports all saved logs as a JSON file with current date in filename.
 * Shows feedback during export process.
 */
document.getElementById('export_logs').addEventListener('click', async () => {
    const button = document.getElementById('export_logs');
    const originalText = button.textContent;

    try {
        button.textContent = 'Exporting...';
        button.disabled = true;

        const result = await chrome.storage.local.get(['Logs']);
        const logs = result.Logs || {};

        if (Object.keys(logs).length === 0) {
            console.log('No logs to export');
            return;
        }

        // Create blob with JSON data
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        a.download = `followers_logs_${date}.json`;
        a.href = url;
        a.click();

        // Cleanup
        URL.revokeObjectURL(url);
        button.textContent = 'Exported!';
        
        console.log('Logs exported successfully');
    } catch (err) {
        console.log('Error exporting logs:', err);
        button.textContent = 'Export Failed';
    } finally {
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }
});

/**
 * Event listener for the Compare Logs button.
 * Displays a list of logs to compare with the currently selected log.
 * Handles the selection and display of comparison results.
 */
document.getElementById('compare-logs-button').addEventListener('click', async () => {
    const button = document.getElementById('compare-logs-button');
    const logsContainer = document.getElementById('logs-container');
    const currentLogName = document.getElementById('selected-log-details-header').textContent.replace('Log Details: ', '');

    if (!button.classList.contains('comparing')) {
        // Enter comparison mode
        button.classList.add('comparing');
        
        // Change button text and style
        button.textContent = 'Cancel';
        
        // Add visual indicator to logs that can be compared
        const logEntries = logsContainer.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            if (entry.dataset.filename !== currentLogName) {
                entry.classList.add('comparable');
            }
        });
        
        // Modify click behavior temporarily
        logsContainer.dataset.compareMode = 'true';
    } else {
        cancelComparisonMode();
    }
});

/**
 * Cancels the comparison mode and resets the UI.
 * Removes visual indicators and resets button state.
 */
async function cancelComparisonMode() {
    const button = document.getElementById('compare-logs-button');
    button.classList.remove('comparing');
    button.textContent = 'Compare with...';
    
    // Remove visual indicators
    const logEntries = document.querySelectorAll('.log-entry');
    logEntries.forEach(entry => entry.classList.remove('comparable'));
    
    // Reset comparison mode
    document.getElementById('logs-container').dataset.compareMode = 'false';
}

// When a comparison log is clicked
document.getElementById('comparison-logs-list').addEventListener('click', async (e) => {
    // ...existing comparison log click handling code...
    
    // Scroll the selected-log-details div to the top
    document.getElementById('selected-log-details').scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

/**
 * Event listener for the Close Details button.
 * Closes the log details view and resets selection.
 */
document.getElementById('close-details-button').addEventListener('click', () => {
    const detailsContainer = document.getElementById('selected-log-details');
    const logEntries = document.querySelectorAll('.log-entry');
    
    // Hide details container
    detailsContainer.style.display = 'none';
    
    // Clear content
    document.getElementById('log-content').textContent = '';
    document.getElementById('selected-log-details-header').textContent = 'Log Details: ';
    
    // Remove active state from all log entries
    logEntries.forEach(entry => {
        entry.classList.remove('active');

        entry.style.backgroundColor = ''; // Reset background color
        entry.style.color = ''; // Reset text color
    });

    // Reset comparison mode
    cancelComparisonMode();

    // Refresh Whole Popup Size
    refreshPopupSize();
});

/**
 * Event listener for the Export Comparison button.
 * Exports the current comparison results as a text file.
 * Includes timestamp in filename for reference.
 */
document.getElementById('export-comparison-button').addEventListener('click', () => {
    const comparisonContent = document.getElementById('comparison-content').textContent;
    if (!comparisonContent) return;

    const blob = new Blob([comparisonContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.download = `followers_comparison_${date}.txt`;
    a.href = url;
    a.click();

    URL.revokeObjectURL(url);
});

/***
 * Event listener for the Close Comparison button.
 * Hides the comparison results and resets the UI.
 */
document.getElementById('close-comparison-button').addEventListener('click', () => {
    const comparisonResults = document.getElementById('comparison-results');
    const comparisonSelector = document.getElementById('comparison-selector');
    
    comparisonResults.style.display = 'none';
    comparisonSelector.style.display = 'none';
    document.getElementById('comparison-content').textContent = '';
});

/**
 * Event listener for the Delete Log button.
 * Implements a two-step confirmation process before deleting a log.
 * Shows confirmation message and requires second click within 3 seconds.
 */
document.getElementById('delete-log-button').addEventListener('click', async () => {
    const deleteButton = document.getElementById('delete-log-button');
    
    if (!deleteButton.classList.contains('delete-confirm')) {
        // First click - show confirmation
        deleteButton.classList.add('delete-confirm');
        deleteButton.textContent = 'Confirm?...';
        
        // Reset button after 3 seconds if not clicked
        setTimeout(() => {
            if (deleteButton.classList.contains('delete-confirm')) {
                deleteButton.classList.remove('delete-confirm');
                deleteButton.textContent = 'Delete Log';
            }
        }, 3000);
        
        return;
    }

    // Second click - proceed with deletion
    const headerElement = document.getElementById('selected-log-details-header');
    const logTitle = headerElement.textContent.replace('Log Details: ', '');
    
    try {
        // Get current logs from storage
        const result = await chrome.storage.local.get(['Logs']);
        const logs = result.Logs || {};
        
        // Remove the log
        delete logs[logTitle];
        
        // Save updated logs back to storage
        await chrome.storage.local.set({ Logs: logs });
        
        // Reset all containers and views
        document.getElementById('selected-log-details').style.display = 'none';
        document.getElementById('comparison-selector').style.display = 'none';
        document.getElementById('comparison-results').style.display = 'none';
        document.getElementById('comparison-content').textContent = '';
        document.getElementById('log-content').textContent = '';
        
        // Update the logs display
        instantiateLogEntries();

        // Cancel comparison mode
        cancelComparisonMode();

        // Refresh popup size
        refreshPopupSize();
        
        console.log(`Log "${logTitle}" deleted successfully`);
    } catch (err) {
        console.error('Error deleting log:', err);
    }
    
    // Reset button state
    deleteButton.classList.remove('delete-confirm');
    deleteButton.textContent = 'Delete Log';
});

/**
 * Event listener for the Import Logs button.
 * Handles importing logs from a JSON file and merging with existing logs.
 * Shows feedback during import process.
 */
document.getElementById('import_logs').addEventListener('click', async () => {
    const fileInput = document.getElementById('import-file');
    const importButton = document.getElementById('import_logs');
    const originalText = importButton.textContent;

    // Trigger file input when button is clicked
    fileInput.click();

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            importButton.textContent = 'Importing...';
            importButton.disabled = true;
            importButton.classList.add('importing');

            // Read file content
            const content = await file.text();
            const importedLogs = JSON.parse(content);

            // Validate imported data structure
            if (!importedLogs || typeof importedLogs !== 'object') {
                throw new Error('Invalid file format');
            }

            // Get existing logs
            const result = await chrome.storage.local.get(['Logs']);
            const currentLogs = result.Logs || {};

            // Merge logs
            const updatedLogs = {
                ...currentLogs,
                ...importedLogs
            };

            // Save merged logs
            await chrome.storage.local.set({ 'Logs': updatedLogs });

            importButton.textContent = 'Import Successful!';
            console.log('Logs imported successfully');
            
            // Refresh logs display
            await instantiateLogEntries();

        } catch (err) {
            console.error('Error importing logs:', err);
            importButton.textContent = 'Import Failed';
        } finally {
            setTimeout(() => {
                importButton.textContent = originalText;
                importButton.disabled = false;
                importButton.classList.remove('importing');
                fileInput.value = ''; // Reset file input
            }, 2000);
        }
    });
});