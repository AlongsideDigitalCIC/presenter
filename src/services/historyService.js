import { get, set } from 'idb-keyval';

const HISTORY_KEY = 'presenter_song_history';

/**
 * @typedef {Object} SongPlayRecord
 * @property {string} title
 * @property {string} artist
 * @property {string} ccli
 * @property {string} date - ISO 8601 string
 */

/**
 * Adds a song play record to the history.
 * Prevents rapid duplicates within the same session by checking the last record.
 * @param {Object} songData
 * @param {string} songData.title
 * @param {string} songData.artist
 * @param {string} songData.ccli
 */
export async function addSongPlay(songData) {
    if (!songData || !songData.title) return;

    try {
        const history = (await get(HISTORY_KEY)) || [];
        
        // Prevent duplicate logging if the exact same song was just played recently (last 10 minutes)
        if (history.length > 0) {
            const lastPlay = history[history.length - 1];
            if (lastPlay.title === songData.title && lastPlay.artist === songData.artist) {
                const lastTime = new Date(lastPlay.date).getTime();
                const now = Date.now();
                if (now - lastTime < 10 * 60 * 1000) {
                    return; // Skip logging duplicate
                }
            }
        }
        
        history.push({
            title: songData.title,
            artist: songData.artist || '',
            ccli: songData.ccli || '',
            date: new Date().toISOString()
        });
        
        await set(HISTORY_KEY, history);
    } catch (err) {
        console.error("Failed to save song history:", err);
    }
}

/**
 * Retrieves the song history between two dates.
 * @param {Date} fromDate 
 * @param {Date} toDate 
 * @returns {Promise<SongPlayRecord[]>}
 */
export async function getSongHistory(fromDate, toDate) {
    try {
        const history = (await get(HISTORY_KEY)) || [];
        
        if (!fromDate && !toDate) return history;
        
        return history.filter(record => {
            const recordDate = new Date(record.date);
            // Ignore time portion for inclusive day matching
            const recDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate()).getTime();
            const fromDay = fromDate ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime() : 0;
            const toDay = toDate ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime() : Infinity;
            
            return recDay >= fromDay && recDay <= toDay;
        });
    } catch (err) {
        console.error("Failed to get song history:", err);
        return [];
    }
}

/**
 * Generates and downloads a CSV of the song history.
 * @param {SongPlayRecord[]} records 
 */
export function exportHistoryCSV(records) {
    if (!records || records.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date Played,Artist,Song Title,CCLI Number\n";
    
    records.forEach(record => {
        const dateStr = new Date(record.date).toLocaleDateString();
        // Escape quotes and commas
        const artist = `"${record.artist.replace(/"/g, '""')}"`;
        const title = `"${record.title.replace(/"/g, '""')}"`;
        const ccli = `"${record.ccli.replace(/"/g, '""')}"`;
        
        csvContent += `${dateStr},${artist},${title},${ccli}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `presenter_ccli_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
