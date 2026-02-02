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
        loadingStatus.innerText = `${events.length} documentos.`;

        // Select first document automatically
        if (events.length > 0) {
            setTimeout(() => {
                const firstItem = document.querySelector('.tree-item');
                if (firstItem) {
                    selectItem(firstItem, events[0]);
                }
            }, 0);
        }
    });

    // Listen for storage changes to auto-update
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.eproc_events) {
            const newEvents = changes.eproc_events.newValue;
            renderTree(newEvents);
            document.getElementById('loading-status').innerText = `${newEvents.length} documentos (Atualizado).`;
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
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.index = index;
        item.title = `${event.longTitle || event.descricao} - ${event.dataHora}`;

        const displayTitle = event.shortTitle || event.descricao || "Documento";
        const icon = getIconForType(displayTitle);

        if (event.docUrl) {
            item.innerHTML = `
                <span class="icon">${icon}</span>
                <span class="date">[${event.dataHora}]</span>
                <span class="title">${displayTitle}</span>
            `;
            item.addEventListener('click', () => {
                selectItem(item, event);
            });
        } else {
            item.classList.add('no-doc');
            item.innerHTML = `
                <span class="icon" style="opacity:0.5; filter: grayscale(100%);">▪️</span>
                <span class="date" style="opacity:0.7">[${event.dataHora}]</span>
                <span class="title" style="color:#666">${displayTitle}</span>
            `;
            item.addEventListener('click', () => {
                selectItem(item, event);
            });
        }

        treeView.appendChild(item);
    });
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

function parseDate(dateStr) {
    if (!dateStr) return 0;
    try {
        const parts = dateStr.split(' ');
        if (parts.length < 2) return 0;
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
    } catch (e) {
        return 0;
    }
}

function getIconForType(description) {
    const lowerDesc = (description || "").toLowerCase();
    if (lowerDesc.includes('despacho')) return '⚖️';
    if (lowerDesc.includes('sentença') || lowerDesc.includes('julgamento')) return '🔨';
    if (lowerDesc.includes('petição')) return '📝';
    if (lowerDesc.includes('laudo')) return '📋';
    if (lowerDesc.includes('ato ordinatório')) return '📌';
    return '📄';
}
