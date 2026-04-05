// Utility functions for Eproc Pasta Digital

/**
 * Parse Brazilian date format to timestamp
 * @param {string} dateStr - Date in dd/mm/yyyy hh:mm:ss format
 * @returns {number} - Unix timestamp
 */
export function parseDate(dateStr) {
    // dd/mm/yyyy hh:mm:ss
    if (!dateStr) return 0;
    try {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('/');
        const [hour, min, sec] = timePart.split(':');
        return new Date(year, month - 1, day, hour, min, sec).getTime();
    } catch (e) {
        console.warn("Failed to parse date:", dateStr);
        return 0;
    }
}

/**
 * Simple template interpolation
 * Replaces ___key___ placeholders with values from data object
 * @param {string} template - Template string with {{key}} placeholders
 * @param {Object} data - Key-value pairs for substitution
 * @returns {string} - Interpolated string
 */
export function interpolate(template, data) {
    return template.replace(/___([\w]+)___/g, (match, key) => {
        return data.hasOwnProperty(key) ? (data[key] ?? '') : match;
    });
}
