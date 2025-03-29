/**
 * Compares two logs and generates a formatted string showing the differences.
 * Identifies both new entries (present in compareLog but not in baseLog)
 * and removed entries (present in baseLog but not in compareLog).
 * 
 * @param {Object} baseLog - The original log to compare against
 * @param {Object} compareLog - The new log to compare with baseLog
 * @returns {string} A formatted string showing added and removed entries
 */
export function compareLogs(baseLog, compareLog) {
    const baseSet = new Set(baseLog.data);
    const compareSet = new Set(compareLog.data);

    const added = [...compareSet].filter(x => !baseSet.has(x));
    const removed = [...baseSet].filter(x => !compareSet.has(x));

    let result = "";

    result += "__________DIFFERENCES__________\n\n";
    
    result += `NEW ENTRIES: ${added.length}\n\n`;
    added.forEach(item => {
        result += `+ ADDED:  ${item}\n`;
    });
    
    result += "\n________________________________\n\n";
    
    result += `REMOVED ENTRIES: ${removed.length}\n\n`;
    removed.forEach(item => {
        result += `- MISSING:  ${item}\n`;
    });

    return result;
}