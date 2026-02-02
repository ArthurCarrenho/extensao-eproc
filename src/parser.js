// Parser Logic for Eproc Pasta Digital

/**
 * Extracts events from the Eproc HTML document.
 * Handles:
 * - Event metadata (ID, Date, Description)
 * - Document links
 * - Text-only events (Teor do ato)
 * - Splitting of Long Titles/Subtitles
 * 
 * @param {Document} doc - The DOM document or parsed HTML document
 * @returns {Array} Array of event objects
 */
function extractEventsFromDocument(doc) {
    const events = [];
    // Select both tables just in case (Novos and standard)
    const rows = doc.querySelectorAll('table#tblEventosNovos tr[id^="trEvento"], table#tblEventos tr[id^="trEvento"]');

    rows.forEach(row => {
        try {
            // Structure:
            // Cell 0: ID/Sequence
            // Cell 1: Date/Time (dd/mm/yyyy hh:mm:ss)
            // Cell 2: Description (.infraEventoDescricao)
            // Cell 3: User
            // Cell 4: Document Link (or "Evento não gerou documento")

            const cells = row.cells;
            if (cells.length < 5) return;

            const dataHora = cells[1]?.innerText.trim();
            const descricaoEl = row.querySelector('.infraEventoDescricao');

            // 1. Short Description (Tree View)
            let shortDescription = "Evento";
            const labelEl = descricaoEl ? descricaoEl.querySelector('label.infraEventoDescricao') : null;
            if (labelEl) {
                shortDescription = labelEl.innerText.trim();
            } else if (descricaoEl) {
                // Fallback: First 30 chars of text
                shortDescription = descricaoEl.innerText.substring(0, 30).trim() + "...";
            }

            // 2. Full Description Parsing for Header/Body
            const fullText = descricaoEl ? descricaoEl.innerText.replace(/\s+/g, ' ').trim() : "";

            let headerTitle = fullText;
            let subtitle = "";
            let contentBody = "";

            // Split by "Teor do ato:"
            // Example: "Header Text Teor do ato: Subtitle Text. Content Text"
            const teorIndex = fullText.indexOf("Teor do ato:");
            if (teorIndex !== -1) {
                headerTitle = fullText.substring(0, teorIndex).trim();

                const remainder = fullText.substring(teorIndex);

                // Try to split subtitle (first sentence) from content
                const firstPeriodIndex = remainder.indexOf('.');
                if (firstPeriodIndex !== -1) {
                    subtitle = remainder.substring(0, firstPeriodIndex + 1).trim();
                    contentBody = remainder.substring(firstPeriodIndex + 1).trim();
                } else {
                    subtitle = remainder;
                }
            } else {
                // If no "Teor do ato", usually the whole text is the title or short text
                // Check if it's very long? For now keep as header.
            }

            // Extract Lawyers Table if present
            // Look for "Advogados(s):" or "Advogado:" case insensitive
            let lawyers = [];

            // Regex to find the Advogados section at the end of contentBody or fullText
            const advMatch = contentBody.match(/Advogados?\(s\)?:\s*(.+)$/i) || fullText.match(/Advogados?\(s\)?:\s*(.+)$/i);

            if (advMatch) {
                const lawyersStr = advMatch[1];
                // Remove the lawyers string from contentBody to avoid duplication
                // Escape special chars for replace
                const escapedStr = advMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                contentBody = contentBody.replace(new RegExp(escapedStr + '$'), '').trim();

                // Parse lawyers list
                // Improved Regex: exclude commas from name capture
                const lawyerRegex = /([^,(]+)\(([^)]+)\)/g;
                let match;
                while ((match = lawyerRegex.exec(lawyersStr)) !== null) {
                    // Clean name (remove possible leading/trailing comma or spaces)
                    const name = match[1].trim().replace(/^,/, '').trim();
                    const oab = match[2].trim();
                    if (oab.toUpperCase().includes('OAB')) {
                        lawyers.push({ name: name, oab: oab });
                    }
                }
            }

            // 3. HTML Content (Fallback Body)
            const conteudoHtml = descricaoEl ? descricaoEl.innerHTML : "";

            // Find ALL document links in the row
            const docLinks = row.querySelectorAll('a.infraLinkDocumento');

            if (docLinks.length > 0) {
                // Create an event entry for EACH document
                docLinks.forEach((link, index) => {
                    const docTitle = link.getAttribute('title') || link.innerText.trim();
                    const docName = link.innerText.trim(); // e.g., "DEC78"

                    events.push({
                        id: `${row.id}_${index}`,
                        dataHora: dataHora,
                        shortTitle: `${shortDescription} - ${docName}`,
                        longTitle: fullText,
                        headerTitle: headerTitle,
                        subtitle: subtitle,
                        contentBody: contentBody,
                        lawyers: lawyers,
                        docTitle: docTitle,
                        docUrl: link.href,
                        docId: link.getAttribute('data-doc'),
                        conteudo: conteudoHtml
                    });
                });
            } else {
                // No documents
                events.push({
                    id: row.id,
                    dataHora: dataHora,
                    shortTitle: shortDescription,
                    longTitle: fullText,
                    headerTitle: headerTitle,
                    subtitle: subtitle,
                    contentBody: contentBody,
                    lawyers: lawyers,
                    docTitle: "Evento sem documento",
                    docUrl: null,
                    docId: null,
                    conteudo: conteudoHtml
                });
            }
        } catch (error) {
            console.error("Error parsing row:", row, error);
        }
    });

    return events;
}
