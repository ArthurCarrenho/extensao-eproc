// Parser Logic for Eproc Pasta Digital

/**
 * Parses the HTML string from event info tooltips to extract structured data
 * @param {string} htmlStr - The HTML string from data-infoevento or onmouseover
 * @returns {Object} - Parsed key-value pairs
 */
function parseEventInfoHtml(htmlStr) {
    if (!htmlStr) return null;

    // Decode HTML entities
    const decoded = htmlStr
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Extract key-value pairs from patterns like "<b>Key:</b></u></font><br>...value..."
    const result = {};

    // Known keys to look for
    const keyPatterns = [
        { key: 'dataEvento', pattern: /Data do Evento:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'evento', pattern: /Evento:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'usuario', pattern: /Usuário:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'magistrado', pattern: /Magistrado\(s\):<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'statusPrazo', pattern: /Status do Prazo:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'dataInicial', pattern: /Data Inicial da Contagem do Prazo:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'dataFinal', pattern: /Data Final do Prazo:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'fechamentoPrazo', pattern: /Fechamento do Prazo:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
        { key: 'aberturaIntimacao', pattern: /Abertura da Intimação:<\/b><\/u><\/font>.*?<font[^>]*>([^<]+)/i },
    ];

    for (const { key, pattern } of keyPatterns) {
        const match = decoded.match(pattern);
        if (match && match[1]) {
            result[key] = match[1].trim();
        }
    }

    // Only return if we found something
    return Object.keys(result).length > 0 ? result : null;
}

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
export function extractEventsFromDocument(doc) {
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

            // 4. Extract User Data from infraEventoUsuario
            const userLabel = row.querySelector('label.infraEventoUsuario');
            let userData = null;
            if (userLabel) {
                const userAriaLabel = userLabel.getAttribute('aria-label');
                const userId = userLabel.innerText.trim();
                if (userAriaLabel) {
                    // Parse aria-label: "NOME<br>CARGO<br>UNIDADE"
                    const userParts = userAriaLabel.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
                    userData = {
                        id: userId,
                        name: userParts[0] || userId,
                        role: userParts[1] || '',
                        unit: userParts.slice(2).join(' - ') || ''
                    };
                }
            }

            // 5. Extract Event Info from tooltip (data-infoevento or onmouseover)
            const infoLupa = row.querySelector('a[data-infoevento]');
            const infoFromOnmouseover = row.querySelector('a[onmouseover*="infraTooltipMostrar"]');
            let eventInfo = null;

            if (infoLupa) {
                // Parse data-infoevento attribute
                const infoHtml = infoLupa.getAttribute('data-infoevento');
                if (infoHtml) {
                    eventInfo = parseEventInfoHtml(infoHtml);
                }
            } else if (infoFromOnmouseover) {
                // Parse from onmouseover attribute
                const onmouseoverAttr = infoFromOnmouseover.getAttribute('onmouseover');
                const match = onmouseoverAttr?.match(/infraTooltipMostrar\('(.+?)',\s*'/);
                if (match && match[1]) {
                    eventInfo = parseEventInfoHtml(match[1]);
                }
            }

            // Find ALL document links in the row
            const docLinks = row.querySelectorAll('a.infraLinkDocumento');

            // Store documents as an array within the event
            const documents = [];
            docLinks.forEach((link, index) => {
                documents.push({
                    id: `${row.id}_doc${index}`,
                    title: link.getAttribute('title') || link.innerText.trim(),
                    name: link.innerText.trim(),
                    url: link.href,
                    docId: link.getAttribute('data-doc')
                });
            });

            // Create a single event with documents array
            events.push({
                id: row.id,
                dataHora: dataHora,
                shortTitle: shortDescription,
                longTitle: fullText,
                headerTitle: headerTitle,
                subtitle: subtitle,
                contentBody: contentBody,
                lawyers: lawyers,
                userData: userData,
                eventInfo: eventInfo,
                documents: documents, // Array of documents
                // Keep legacy fields for backward compatibility
                docTitle: documents.length > 0 ? documents[0].title : "Evento sem documento",
                docUrl: documents.length > 0 ? documents[0].url : null,
                docId: documents.length > 0 ? documents[0].docId : null,
                conteudo: conteudoHtml
            });
        } catch (error) {
            console.error("Error parsing row:", row, error);
        }
    });

    return events;
}
