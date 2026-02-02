// Formatter Module - Handles special formatting cases for event documents

/**
 * Determines the appropriate formatting type for an event
 * @param {Object} event - Event object with all parsed fields
 * @returns {string} - Format type: 'duplicate', 'standard', or 'url'
 */
function getFormatType(event) {
    // If event has a URL, it's an external document
    if (event.docUrl) {
        return 'url';
    }

    const bodyContent = event.contentBody || event.conteudo || "";
    // Normalize string for comparison (remove HTML tags, extra spaces)
    const cleanContent = bodyContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const docTitle = (event.docTitle || '').trim();
    const headerTitle = (event.headerTitle || event.descricao || '').replace(/\s+/g, ' ').trim();

    // Check duplication against Doc Title
    const matchesDocTitle = docTitle &&
        docTitle !== "Evento sem documento" &&
        (cleanContent === docTitle || cleanContent.startsWith(docTitle));

    // Check duplication against Header Title (common for text-only events)
    // If we only have header and content, and content == header, it's a duplicate.
    const matchesHeaderTitle = headerTitle && (cleanContent === headerTitle || cleanContent.includes(headerTitle));

    return (matchesDocTitle || matchesHeaderTitle) ? 'duplicate' : 'standard';
}

/**
 * Renders the lawyers table HTML
 * @param {Array} lawyers - Array of lawyer objects {name, oab}
 * @returns {string} - HTML string for the table
 */
function renderLawyersTable(lawyers) {
    if (!lawyers || lawyers.length === 0) return '';

    const rows = lawyers.map(l => `
        <tr>
            <td>${l.name}</td>
            <td style="width: 150px; text-align: right;">${l.oab}</td>
        </tr>
    `).join('');

    return `
        <table class="lawyer-table">
            <thead>
                <tr>
                    <th>Advogados</th>
                    <th style="text-align: right;">OAB</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

/**
 * Generates HTML for duplicate content layout (single column, cleaner)
 * @param {Object} event - Event object
 * @returns {string} - Complete HTML document string
 */
function formatDuplicateLayout(event) {
    const bodyContent = event.contentBody || event.conteudo || "";

    // Choose the best title for the H1
    let mainTitle = event.docTitle || "Documento";
    const headerTitle = event.headerTitle || event.descricao || "";

    // If docTitle is generic or matches duplication logic that triggered this, 
    // we might want to use headerTitle if it's more descriptive.
    if (!mainTitle || mainTitle === "Evento sem documento" || mainTitle === "Documento") {
        if (headerTitle) {
            mainTitle = headerTitle;
        }
    } else {
        // Prefer HeaderTitle if it's longer/more detailed than the doc title
        if (headerTitle && headerTitle.length > mainTitle.length) {
            mainTitle = headerTitle;
        }
    }

    return `
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 0; line-height: 1.6; color: #333; margin: 0; }
                .single-content { padding: 30px; max-width: 900px; margin: 0 auto; }
                .single-content h1 { color: #0078D7; font-size: 24px; margin-bottom: 20px; border-bottom: 3px solid #0078D7; padding-bottom: 10px; }
                .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-left: 4px solid #0078D7; }
                .content-body { font-size: 15px; line-height: 1.8; }
                .lawyer-table { margin-top: 30px; border-collapse: collapse; width: 100%; font-size: 13px; }
                .lawyer-table th { text-align: left; border-bottom: 2px solid #ddd; padding: 8px; color: #666; background: #f9f9f9; }
                .lawyer-table td { border-bottom: 1px solid #eee; padding: 8px; color: #333; }
            </style>
        </head>
        <body>
            <div class="single-content">
                <h3>${mainTitle}</h1>
                <div class="meta">Data: ${event.dataHora}</div>
                ${renderLawyersTable(event.lawyers)}
            </div>
        </body>
        </html>
    `;
}

/**
 * Generates HTML for standard layout (header + content sections)
 * @param {Object} event - Event object
 * @returns {string} - Complete HTML document string
 */
function formatStandardLayout(event) {
    const bodyContent = event.contentBody || event.conteudo || "";
    const cleanHeaderTitle = (event.headerTitle || event.descricao || '').trim();

    return `
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 20px; line-height: 1.6; color: #333; margin: 0; }
                .header-container { border-bottom: 1px solid #ccc; padding-bottom: 15px; margin-bottom: 20px; background-color: #f9f9f9; padding: 20px; }
                h2 { margin: 0 0 10px 0; color: #0078D7; font-size: 18px; }
                .subtitle { font-weight: bold; color: #444; margin-bottom: 5px; }
                .meta { color: #666; font-size: 0.85em; margin-top: 10px; }
                .content { padding: 0 20px; white-space: pre-wrap; font-size: 14px; }
                .lawyer-table { margin: 20px; border-collapse: collapse; width: calc(100% - 40px); font-size: 13px; }
                .lawyer-table th { text-align: left; border-bottom: 2px solid #ddd; padding: 8px; color: #666; }
                .lawyer-table td { border-bottom: 1px solid #eee; padding: 8px; color: #333; }
            </style>
        </head>
        <body>
            <div class="header-container">
                <h2>${cleanHeaderTitle}</h2>
                ${event.subtitle ? `<div class="subtitle">${event.subtitle}</div>` : ''}
                <div class="meta">Data: ${event.dataHora}</div>
            </div>
            <div class="content">
                ${bodyContent}
                ${renderLawyersTable(event.lawyers)}
            </div>
        </body>
        </html>
    `;
}

/**
 * Main formatting function - returns the appropriate HTML based on event type
 * @param {Object} event - Event object with all parsed fields
 * @returns {string} - Data URI or URL for iframe src
 */
function formatEventDocument(event) {
    const formatType = getFormatType(event);

    if (formatType === 'url') {
        return event.docUrl;
    }

    let html;
    if (formatType === 'duplicate') {
        html = formatDuplicateLayout(event);
    } else {
        html = formatStandardLayout(event);
    }

    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}
