// Utility functions for Eproc Pasta Digital

function parseDate(dateStr) {
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
