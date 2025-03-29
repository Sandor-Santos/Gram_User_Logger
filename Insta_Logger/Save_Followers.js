/**
 * Retrieves and processes the followers list from the current Instagram page.
 * Makes API calls to Instagram's GraphQL endpoint to fetch follower data.
 * Handles pagination to get complete followers list up to the specified limit.
 * 
 * @async
 * @returns {Promise<Object|null>} Object containing follower data and timestamp, or null if error
 */
async function getFollowersLog() {

    const username = await getUsernameFromCurrentPage();

    const date = new Date();
    dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

    /**
     * Initialized like this so we can sill run it from browsers, but also use typescript on a code editor for intellisense.
     */
    let followers = [{
        username: "",
        full_name: ""
    }];

    followersString = "";
    trueFollowersCount = 0;

    console.log(" * SCRIPT: Username: " + username);

    try {
        console.log(`Process started! Give it a couple of seconds`);

        const userQueryRes = await fetch(`https://www.instagram.com/web/search/topsearch/?query=${username}`);
        const userQueryJson = await userQueryRes.json();
        const userId = userQueryJson.users[0].user.pk;

        let after = null;
        let has_next = true;

        // Get the limit from storage
        const result = await chrome.storage.local.get(['followerLimit']);
        let limit = result.followerLimit || 3000;

        console.log(" * SCRIPT: Follower limit: " + limit);

        // # Logs the followers of the current user
        while (has_next && limit > 0) {
            await fetch(`https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25a&variables=` + encodeURIComponent(JSON.stringify({
                id: userId,
                include_reel: false, //DISABLE last reel posted obtain
                fetch_mutual: true,
                first: 50,
                after: after,
            }))).then((res)=>res.json()).then((res)=>{

                has_next = res.data.user.edge_followed_by.page_info.has_next_page;
                after = res.data.user.edge_followed_by.page_info.end_cursor;
                followers = followers.concat(res.data.user.edge_followed_by.edges.map(({node})=>{

                    if(limit <= 0) {
                        console.log(" * SCRIPT: Follower limit reached.");
                        return;
                    }

                    //console.log("Saving: " + node.username + "\n");
                    followersString += node.username + "\n";
                    
                    limit--;
                    trueFollowersCount++;

                    return {
                        username: node.username,
                        full_name: node.full_name,
                    };
                }
                ));
            }
            );
        }

        console.log({
            followers // # Place list of followers into the console
        });
        after = null;
        has_next = true;

        console.log(
            `DONE \n` 
        );

        fileTitle = username + " - " + dateString + " Followers [" + trueFollowersCount + "]";
        
        console.log(" * SCRIPT: Done.");

        return {
            fileTitle,
            followersString
        };

    } catch (err) {
        console.log({
            err
        });
    }

};

/**
 * Extracts the username from the current Instagram page URL.
 * 
 * @async
 * @returns {Promise<string>} The username from the current Instagram profile
 */
async function getUsernameFromCurrentPage() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let currentPageURL = tab.url;

    splitURL = currentPageURL.split("/");
    usernameFromURL = splitURL[3]; // Should give back the username contained within the url

    return usernameFromURL;
}

/**
 * Saves the followers data to chrome.storage.local.
 * Creates a timestamped entry with the followers list.
 * 
 * @async
 * @param {Object} data - Object containing followers data to save
 * @returns {Promise<string|null>} The saved file title, or null if error
 */
async function saveToStorage(data) {
    if(!data) {
        console.log("No data to save.");
        return null;
    }

    try {
        // First, get existing logs
        const existingLogs = await chrome.storage.local.get(['Logs']);
        const currentLogs = existingLogs.Logs || {};

        // Convert string data into array by splitting on newlines and filtering empty entries
        const followersArray = data.followersString
            .split('\n')
            .filter(username => username.trim() !== '');

        // Add new log to existing ones
        const updatedLogs = {
            ...currentLogs,
            [data.fileTitle]: {
                data: followersArray,
                timestamp: Date.now()
            }
        };

        // Save updated logs back to storage
        await chrome.storage.local.set({
            'Logs': updatedLogs
        });

        console.log("Saved to storage:", data.fileTitle);
        return data.fileTitle;

    } catch (err) {
        console.log("Storage error:", err);
        return null;
    }
}

async function getLogs() {
    const logs = await chrome.storage.local.get(['Logs']);
    return logs;
}

// CLEAR ALL LOGS
async function clearAllLogs() {
    await chrome.storage.local.remove(['Logs']);
    console.log('Logs folder cleared');
}