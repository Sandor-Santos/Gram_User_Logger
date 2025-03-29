import { compareLogs } from './Log_Comparer.js';

console.log('Save Followers Popup');

await chrome.storage.local.get(['followerLimit'], (result) => {
    if (result.followerLimit < 1) {
        result.followerLimit = 3000;
    }
    document.getElementById('log-limit').value = result.followerLimit || 3000;
});

updateLogs();

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
        error_label.textContent = "This is not an Instagram Profile page.";
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

        console.log(` + BUTTON: Saved as "${savedTitle}"`);
    } 
    catch (err) {
        console.log(' + BUTTON: Error saving followers:');
    } 
    finally {
        button.textContent = originalText;
        button.disabled = false; // Re-enable button
    }

    updateLogs();
    
    console.log(" + BUTTON: Done.");
});

/**
 * Event listener for the Update Logs button.
 * Refreshes the display of saved logs in the popup.
 */
document.getElementById('update_logs').addEventListener('click', async () => {
    updateLogs();
});

/**
 * Event listener for the Clear Logs button.
 * Implements a two-step confirmation process before clearing all logs.
 * Shows confirmation message and requires second click within 3 seconds.
 */
document.getElementById('clear_logs').addEventListener('click', async function() {
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
        await updateLogs();
        
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

async function getFollowerLimit() {
    const result = await chrome.storage.local.get(['followerLimit']);
    return result.followerLimit || 3000;
}

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
    const comparisonSelector = document.getElementById('comparison-selector');
    const comparisonList = document.getElementById('comparison-logs-list');
    const currentLogName = document.getElementById('selected-log-details-header').textContent.replace('Log Details: ', '');
    
    // Toggle comparison selector
    if (comparisonSelector.style.display === 'none') {
        const result = await chrome.storage.local.get(['Logs']);
        const logs = result.Logs || {};
        
        // Create list of logs excluding the currently selected one
        const logsHtml = Object.keys(logs)
            .filter(filename => filename !== currentLogName)
            .map(filename => `<div class="log-entry" data-filename="${filename}">${filename}</div>`)
            .join('');
            
        comparisonList.innerHTML = logsHtml;
        comparisonSelector.style.display = 'block';
        
        // Add click handlers for comparison selection
        comparisonList.querySelectorAll('.log-entry').forEach(entry => {
            entry.addEventListener('click', async () => {
                const compareLogName = entry.dataset.filename;
                const logs = (await chrome.storage.local.get(['Logs'])).Logs;
                
                const baseLog = logs[currentLogName];
                const compareLog = logs[compareLogName];
                
                const comparisonResults = compareLogs(baseLog, compareLog);
                
                // Display results
                document.getElementById('comparison-results').style.display = 'block';
                document.getElementById('comparison-content').textContent = comparisonResults;
                comparisonSelector.style.display = 'none';
            });
        });
    } else {
        comparisonSelector.style.display = 'none';
    }
});

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
        await updateLogs();
        
        console.log(`Log "${logTitle}" deleted successfully`);
    } catch (err) {
        console.error('Error deleting log:', err);
    }
    
    // Reset button state
    deleteButton.classList.remove('delete-confirm');
    deleteButton.textContent = 'Delete Log';
});

/**
 * Updates and displays the list of saved logs in the popup.
 * Handles the display of log entries and attaches click listeners.
 * Shows loading state and error messages when appropriate.
 * @async
 * @returns {void}
 */
async function updateLogs() {
    console.log("Getting logs...");
    const logsContainer = document.getElementById('logs-container');
    logsContainer.innerHTML = 'Loading Logs...';
    
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
            entry.addEventListener('click', () => {
                const filename = entry.dataset.filename;
                const logData = logs[filename];

                // Update details header to include filename
                document.getElementById('selected-log-details-header').textContent = 'Log Details: ' + filename;
                
                // Update details view
                logContent.textContent = JSON.stringify(logData, null, 2);
                detailsContainer.style.display = 'block';
                
                // Update active state
                logEntries.forEach(e => e.classList.remove('active'));
                entry.classList.add('active');
            });
        });

    } catch (err) {
        console.log('Error loading logs:', err);
        logsContainer.innerHTML = '<div class="log-entry">Error loading logs</div>';
    }
}