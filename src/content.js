// Content Script Entry Point
import { parseDate } from './utils.js';
import { extractEventsFromDocument } from './parser.js';
import { fetchAllOtherPages } from './api.js';

console.log("Eproc Pasta Digital: Content script loaded");

function injectPastaButton() {
    const toolbar = document.querySelector('.infraBarraComandos, .acoes-barra-superior') || document.body;

    if (!toolbar) return;

    // Check if already injected
    if (document.getElementById('eproc-pasta-btn')) return;

    const button = document.createElement('button');
    button.innerText = '📂 Pasta Digital';
    button.id = 'eproc-pasta-btn';
    button.className = 'infraButton'; // Native class for styling
    button.style.marginLeft = '10px';
    button.style.fontWeight = 'bold';
    button.style.cursor = 'pointer';
    button.title = "Visualizar documentos em ordem cronológica";

    button.addEventListener('click', openPastaWindow);

    toolbar.appendChild(button);
}

async function openPastaWindow() {
    console.log("Iniciando geração da Pasta Digital...");

    // Provide feedback
    const btn = document.getElementById('eproc-pasta-btn');
    const originalText = btn.innerText;
    btn.innerText = "⌛ Carregando...";
    btn.disabled = true;

    try {
        // 1. Scrape current page
        const currentEvents = extractEventsFromDocument(document);
        console.log(`Página atual: ${currentEvents.length} eventos.`);

        // 2. Fetch other pages
        const otherEvents = await fetchAllOtherPages();
        console.log(`Outras páginas: ${otherEvents.length} eventos.`);

        // 3. Combine and Sort
        let allEvents = [...currentEvents, ...otherEvents];

        // Filter unique by ID
        const seen = new Set();
        allEvents = allEvents.filter(e => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
        });

        // Sort: Oldest to Newest (Cronológica)
        allEvents.sort((a, b) => parseDate(a.dataHora) - parseDate(b.dataHora));

        console.log(`Total final: ${allEvents.length} eventos.`);

        // 4. Store and Open
        chrome.storage.local.set({ 'eproc_events': allEvents }, () => {
            const url = chrome.runtime.getURL('pasta_window.html');
            window.open(url, 'PastaDigitalEproc', 'width=1200,height=800');
        });

    } catch (err) {
        console.error("Erro ao gerar pasta:", err);
        alert("Erro ao gerar Pasta Digital: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Run injection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPastaButton);
} else {
    injectPastaButton();
}
