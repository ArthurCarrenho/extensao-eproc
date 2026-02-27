// Pasta UI Module
import { parseDate } from './utils.js';
import { formatEventDocument } from './formatter.js';

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
});

function loadEvents() {
    const loadingStatus = document.getElementById('loading-status');
    loadingStatus.innerText = "Carregando documentos da extensão...";

    chrome.storage.local.get(['eproc_events'], (result) => {
        const events = result.eproc_events || [];

        if (events.length === 0) {
            loadingStatus.innerText = "Nenhum documento encontrado.";
            return;
        }

        renderTree(events);

        // Count total documents
        const totalDocs = events.reduce((sum, e) => sum + (e.documents?.length || 0), 0);
        loadingStatus.innerText = `${events.length} eventos, ${totalDocs} documentos.`;

        // Select first document automatically
        if (events.length > 0) {
            setTimeout(() => {
                const firstItem = document.querySelector('.tree-item');
                if (firstItem) {
                    firstItem.click();
                }
            }, 0);
        }
    });

    // Listen for storage changes to auto-update
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.eproc_events) {
            const newEvents = changes.eproc_events.newValue;
            renderTree(newEvents);
            const totalDocs = newEvents.reduce((sum, e) => sum + (e.documents?.length || 0), 0);
            document.getElementById('loading-status').innerText = `${newEvents.length} eventos, ${totalDocs} documentos (Atualizado).`;
        }
    });
}

function renderTree(events) {
    const treeView = document.getElementById('tree-view');
    treeView.innerHTML = '';

    // Sort Chronologically (Oldest -> Newest)
    const sortedEvents = [...events].sort((a, b) => {
        return parseDate(a.dataHora) - parseDate(b.dataHora);
    });

    sortedEvents.forEach((event, index) => {
        const hasMultipleDocs = event.documents && event.documents.length > 1;

        if (hasMultipleDocs) {
            // Render as expandable folder
            const folder = createFolderItem(event, index);
            treeView.appendChild(folder);
        } else {
            // Render as single item
            const item = createTreeItem(event, index);
            item.addEventListener('click', () => selectItem(item, event));
            treeView.appendChild(item);
        }
    });
}

/**
 * Creates an expandable folder for events with multiple documents
 * @param {Object} event - Event object with documents array
 * @param {number} index - Index in the list
 * @returns {HTMLElement} - Folder container div
 */
function createFolderItem(event, index) {
    const folder = document.createElement('div');
    folder.className = 'tree-folder';
    folder.dataset.index = index;

    // Folder header (clickable to expand/collapse)
    const header = document.createElement('div');
    header.className = 'tree-folder-header';
    header.title = `${event.longTitle || event.shortTitle} - ${event.dataHora}`;

    const expandIcon = document.createElement('span');
    expandIcon.className = 'folder-expand-icon';
    expandIcon.textContent = '▶';

    const folderIcon = document.createElement('span');
    folderIcon.className = 'icon';
    folderIcon.textContent = '📁';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'date';
    dateSpan.textContent = `[${event.dataHora}]`;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'title';
    titleSpan.textContent = event.shortTitle || event.descricao || "Evento";

    const countBadge = document.createElement('span');
    countBadge.className = 'doc-count';
    countBadge.textContent = `(${event.documents.length})`;

    header.appendChild(expandIcon);
    header.appendChild(folderIcon);
    header.appendChild(dateSpan);
    header.appendChild(titleSpan);
    header.appendChild(countBadge);

    // Children container (hidden by default)
    const children = document.createElement('div');
    children.className = 'tree-folder-children';
    children.style.display = 'none';

    // Create child items for each document
    event.documents.forEach((doc, docIndex) => {
        const childItem = createDocumentItem(event, doc, docIndex);
        children.appendChild(childItem);
    });

    // Toggle expand/collapse on header click
    header.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = folder.classList.toggle('expanded');
        children.style.display = isExpanded ? 'block' : 'none';
        expandIcon.textContent = isExpanded ? '▼' : '▶';
        folderIcon.textContent = isExpanded ? '📂' : '📁';
    });

    folder.appendChild(header);
    folder.appendChild(children);

    return folder;
}

/**
 * Creates a tree item for a single document within a folder
 * @param {Object} event - Parent event object
 * @param {Object} doc - Document object
 * @param {number} docIndex - Index of document
 * @returns {HTMLElement} - Tree item div
 */
function createDocumentItem(event, doc, docIndex) {
    const item = document.createElement('div');
    item.className = 'tree-item tree-item--child';
    item.dataset.docIndex = docIndex;
    item.title = doc.title;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.textContent = getIconForType(doc.name, doc.mimetype);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'title';
    titleSpan.textContent = doc.name || doc.title || "Documento";

    item.appendChild(iconSpan);
    item.appendChild(titleSpan);

    // Create a synthetic event for this specific document
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const docEvent = {
            ...event,
            docTitle: doc.title,
            docName: doc.name,
            docUrl: doc.url,
            docId: doc.docId,
            docMimetype: doc.mimetype
        };
        selectItem(item, docEvent);
    });

    return item;
}

/**
 * Creates a tree item element for a single-document event
 * @param {Object} event - Event object
 * @param {number} index - Index in the list
 * @returns {HTMLElement} - Tree item div
 */
function createTreeItem(event, index) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    item.dataset.index = index;
    item.title = `${event.longTitle || event.descricao} - ${event.dataHora}`;

    const displayTitle = event.shortTitle || event.descricao || "Documento";
    const firstDoc = event.documents && event.documents[0];
    const icon = getIconForType(displayTitle, firstDoc?.mimetype);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'date';
    dateSpan.textContent = `[${event.dataHora}]`;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'title';
    titleSpan.textContent = displayTitle;

    const hasDoc = event.documents && event.documents.length > 0;

    if (hasDoc) {
        iconSpan.textContent = icon;
    } else {
        item.classList.add('tree-item--no-doc');
        iconSpan.textContent = '▪️';
    }

    item.appendChild(iconSpan);
    item.appendChild(dateSpan);
    item.appendChild(titleSpan);

    return item;
}

function selectItem(element, event) {
    if (!element) return;

    // Remove selected class from all
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));

    // Add to clicked
    element.classList.add('selected');

    // Open document
    openDocument(event);
}

function openDocument(event) {
    const viewer = document.getElementById('doc-viewer');
    // Use formatter module to generate the appropriate layout
    viewer.src = formatEventDocument(event);
}

function getIconForType(description, mimetype) {
    // Check mimetype for audio files
    if (mimetype && ['mp3', 'wav', 'ogg', 'aac', 'flac', 'wma'].includes(mimetype.toLowerCase())) return '🔊';
    const lowerDesc = (description || "").toLowerCase();
    if (/\u00e1udio\s*\d+/i.test(description || '')) return '🔊';
    if (lowerDesc.includes('despacho')) return '⚖️';
    if (lowerDesc.includes('sentença') || lowerDesc.includes('julgamento')) return '🔨';
    if (lowerDesc.includes('petição')) return '📝';
    if (lowerDesc.includes('laudo')) return '📋';
    if (lowerDesc.includes('ato ordinatório')) return '📌';
    if (lowerDesc.includes('dec') || lowerDesc.includes('decisão')) return '📜';
    return '📄';
}
