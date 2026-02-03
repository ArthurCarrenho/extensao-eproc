// Formatter Module - Handles special formatting cases for event documents
import { interpolate } from './utils.js';
import baseCss from './templates/base-layout.css?raw';
import duplicateLayoutTemplate from './templates/duplicate-layout.html?raw';
import standardLayoutTemplate from './templates/standard-layout.html?raw';

/**
 * Determines the appropriate formatting type for an event
 * @param {Object} event - Event object with all parsed fields
 * @returns {string} - Format type: 'duplicate', 'standard', or 'url'
 */
export function getFormatType(event) {
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
 * Renders combined header metadata (user + event info) as inline text
 * @param {Object} userData - User data object {id, name, role, unit}
 * @param {Object} eventInfo - Event info object with various fields
 * @returns {string} - HTML string
 */
function renderHeaderMeta(userData, eventInfo) {
    const rows = [];

    // User row
    if (userData && (userData.name || userData.role)) {
        const userItems = [];
        if (userData.name) {
            userItems.push(`<span class="header-meta-item"><span class="label">Usuário:</span> <span class="value user-name">${userData.name}</span></span>`);
        }
        if (userData.role) {
            userItems.push(`<span class="header-meta-item"><span class="value">${userData.role}</span></span>`);
        }
        if (userData.unit) {
            userItems.push(`<span class="header-meta-item"><span class="value">${userData.unit}</span></span>`);
        }
        if (userItems.length > 0) {
            rows.push(`<div class="header-meta-row">${userItems.join('')}</div>`);
        }
    }

    // Event info row
    if (eventInfo) {
        const eventItems = [];

        if (eventInfo.magistrado) {
            eventItems.push(`<span class="header-meta-item"><span class="label">Magistrado:</span> <span class="value">${eventInfo.magistrado}</span></span>`);
        }

        if (eventInfo.statusPrazo) {
            const statusClass = eventInfo.statusPrazo.toLowerCase() === 'fechado' ? 'fechado' : 'aberto';
            eventItems.push(`<span class="header-meta-item"><span class="label">Status:</span> <span class="status-badge ${statusClass}">${eventInfo.statusPrazo}</span></span>`);
        }

        if (eventInfo.dataFinal) {
            eventItems.push(`<span class="header-meta-item"><span class="label">Prazo:</span> <span class="value">${eventInfo.dataFinal}</span></span>`);
        }

        if (eventInfo.dataInicial) {
            eventItems.push(`<span class="header-meta-item"><span class="label">Início:</span> <span class="value">${eventInfo.dataInicial}</span></span>`);
        }

        if (eventItems.length > 0) {
            rows.push(`<div class="header-meta-row">${eventItems.join('')}</div>`);
        }
    }

    if (rows.length === 0) return '';

    return `<div class="header-meta">${rows.join('')}</div>`;
}

/**
 * Parses a concatenated title string to extract structured data
 * @param {string} title - The concatenated title string
 * @returns {Object} - { header: string, segments: string[], details: Array<{key, value}>, description: string }
 */
function parseStructuredContent(title) {
    if (!title) return { header: '', segments: [], details: [], description: '' };

    // First, split by " - " to get main segments
    const segments = title.split(' - ').map(s => s.trim()).filter(Boolean);

    // Extract the header (first segment)
    let header = segments[0] || '';
    let remainingSegments = segments.slice(1);

    // If SAJ is second segment, skip it
    if (remainingSegments[0] === 'SAJ') {
        remainingSegments = remainingSegments.slice(1);
    }

    // Join remaining segments
    const remainingText = remainingSegments.join(' - ');

    // If remaining text is too long (> 500 chars), it's likely legal prose, not structured data
    // In this case, show it as description, not a table
    if (remainingText.length > 500) {
        return {
            header,
            segments: remainingSegments,
            details: [],
            description: remainingText
        };
    }

    const details = [];

    // Known keys that indicate structured metadata (exact match only)
    const knownKeys = [
        'Juntada de AR', 'Situação', 'Modelo', 'Destinatário',
        'Relação', 'Data da Publicação', 'Número do Diário',
        'Prazo', 'Data', 'Motivo', 'Observação', 'Tipo',
        'Número', 'Valor', 'Parte', 'Certidão', 'AR',
        'Data de Publicação', 'Número', 'Processo'
    ];

    // Try to extract key-value pairs for known keys only
    // This prevents matching random text like "C.P.C que dispõe:"
    for (const key of knownKeys) {
        // Look for "Key : Value" or "Key: Value" pattern
        const pattern = new RegExp(key + '\\s*:\\s*([^:]+?)(?=(?:' + knownKeys.join('|') + ')\\s*:|$)', 'i');
        const match = remainingText.match(pattern);
        if (match && match[1]) {
            const value = match[1].trim();
            // Only add if value is reasonable length (not an entire paragraph)
            if (value.length > 0 && value.length < 200) {
                details.push({ key, value });
            }
        }
    }

    // If we found structured key-value pairs, use them
    if (details.length > 0) {
        return { header, segments: remainingSegments, details, description: '' };
    }

    // Otherwise, use remaining text as description (with bullet separators)
    const description = remainingSegments.length > 0
        ? remainingSegments.join(' • ')
        : '';

    return { header, segments: remainingSegments, details: [], description };
}

/**
 * Renders a details table HTML from key-value pairs
 * @param {Array} details - Array of {key, value} objects
 * @returns {string} - HTML string for the details table
 */
function renderDetailsTable(details) {
    if (!details || details.length === 0) return '';

    const rows = details.map(d => `
        <tr>
            <td class="detail-key">${d.key}</td>
            <td class="detail-value">${d.value}</td>
        </tr>
    `).join('');

    return `
        <table class="details-table">
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
    // Choose the best title for parsing
    let mainTitle = event.docTitle || "";
    const headerTitle = event.headerTitle || event.descricao || "";

    // Use the longer/more detailed title
    if (!mainTitle || mainTitle === "Evento sem documento" || mainTitle === "Documento") {
        mainTitle = headerTitle;
    } else if (headerTitle && headerTitle.length > mainTitle.length) {
        mainTitle = headerTitle;
    }

    // Parse the title into structured content
    const parsed = parseStructuredContent(mainTitle);

    // Generate details table HTML
    const detailsHtml = renderDetailsTable(parsed.details);

    // Generate description HTML if no details
    const descriptionHtml = parsed.description
        ? `<p class="description">${parsed.description}</p>`
        : '';

    return interpolate(duplicateLayoutTemplate, {
        baseStyles: baseCss,
        mainTitle: parsed.header,
        dataHora: event.dataHora,
        detailsTable: detailsHtml,
        description: descriptionHtml,
        lawyersTable: renderLawyersTable(event.lawyers)
    });
}

/**
 * Generates HTML for standard layout (header + content sections)
 * @param {Object} event - Event object
 * @returns {string} - Complete HTML document string
 */
function formatStandardLayout(event) {
    // Get the best header title
    let headerTitle = (event.headerTitle || event.descricao || '').trim();
    const docTitle = (event.docTitle || '').trim();

    // If docTitle is more descriptive, use it
    if (docTitle && docTitle !== "Evento sem documento" && docTitle.length > headerTitle.length) {
        headerTitle = docTitle;
    }

    // Get body content
    let bodyContent = event.contentBody || event.conteudo || "";
    const cleanContent = bodyContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Check if content duplicates the header
    const isDuplicate = cleanContent === headerTitle ||
        cleanContent.includes(headerTitle) ||
        headerTitle.includes(cleanContent);

    // Parse structured content from the title to extract key-value pairs
    const parsed = parseStructuredContent(headerTitle);
    const detailsHtml = renderDetailsTable(parsed.details);

    // Use parsed header (first segment) as the display title
    const displayTitle = parsed.header || headerTitle;

    // Handle body content based on whether it's a duplicate
    if (isDuplicate && parsed.details.length === 0) {
        // If duplicate with no structured details, use remaining segments as body
        bodyContent = parsed.description || '';
    } else if (parsed.details.length > 0 && isDuplicate) {
        // If we have structured details and it's a duplicate, clear body (details table shows info)
        bodyContent = '';
    }
    // else: keep original bodyContent (it's different from header)

    const subtitleHtml = event.subtitle ? `<div class="subtitle">${event.subtitle}</div>` : '';

    // Render combined header metadata
    const headerMetaHtml = renderHeaderMeta(event.userData, event.eventInfo);

    return interpolate(standardLayoutTemplate, {
        baseStyles: baseCss,
        headerTitle: displayTitle,
        subtitle: subtitleHtml,
        dataHora: event.dataHora,
        headerMeta: headerMetaHtml,
        detailsTable: detailsHtml,
        bodyContent: bodyContent,
        lawyersTable: renderLawyersTable(event.lawyers)
    });
}

/**
 * Main formatting function - returns the appropriate HTML based on event type
 * @param {Object} event - Event object with all parsed fields
 * @returns {string} - Data URI or URL for iframe src
 */
export function formatEventDocument(event) {
    // If event has a URL, use it directly
    if (event.docUrl) {
        return event.docUrl;
    }

    // Use standard layout for all text content
    const html = formatStandardLayout(event);
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

