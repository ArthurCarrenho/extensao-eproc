// API Fetching Logic
import { extractEventsFromDocument } from './parser.js';

export async function fetchAllOtherPages() {
    const events = [];

    // 1. Find pagination select
    const select = document.querySelector('select#selPaginacaoR, select[name="selPaginacaoR"]');
    if (!select) return events; // No pagination

    const numProcessoInput = document.querySelector('input[name="num_processo"]');
    const numProcesso = numProcessoInput ? numProcessoInput.value : null;

    if (!numProcesso) {
        console.warn("Num processo não encontrado.");
        return events;
    }

    // Get Hash from URL
    const urlParams = new URLSearchParams(window.location.search);
    const hash = urlParams.get('hash');

    if (!hash) {
        console.warn("Hash não encontrado na URL.");
        return events;
    }

    // Identify pages to fetch (all except current)
    // The current page is selected in the dropdown
    const pagesToFetch = Array.from(select.options)
        .filter(opt => !opt.selected)
        .map(opt => opt.value);

    console.log(`Fetching pages: ${pagesToFetch.join(', ')}`);

    // Fetch in parallel
    const promises = pagesToFetch.map(pageVal => fetchPage(pageVal, numProcesso, hash));
    const results = await Promise.all(promises);

    return results.flat();
}

async function fetchPage(pageVal, numProcesso, hash) {
    const baseUrl = window.location.origin + window.location.pathname; // /eproc/controlador.php
    const queryParams = new URLSearchParams({
        acao: 'processo_selecionar_pagina',
        num_processo: numProcesso,
        hash: hash
    });

    const bodyParams = new URLSearchParams({
        pagina: pageVal
    });

    try {
        const response = await fetch(`${baseUrl}?${queryParams.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: bodyParams
        });

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        return extractEventsFromDocument(doc);

    } catch (err) {
        console.error(`Erro ao buscar página ${pageVal}:`, err);
        return [];
    }
}
