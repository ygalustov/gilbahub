/**
 * GH-808 (queue item 3gy) — READING A BUILT DOCUMENT THE WAY A CLIENT READS IT.
 *
 * The assertions of this ticket are about what the report SAYS, per section and per element, so a
 * flat string of the whole document is not enough: "no rate next to dolomite" and "no second
 * product for this element" are both questions about a place in the document. Earlier suites
 * flattened `word/document.xml` to text and matched substrings, which cannot tell a recommendation
 * in the soil section from the same word in the glossary.
 *
 * So this helper keeps the three things the XML knows and the flat text throws away: whether a
 * paragraph is a heading (and at which level), whether it is inside a table, and in which section
 * it sits. Nothing here is specific to this ticket — it is the reading side of the same export the
 * other suites build.
 */
'use strict';

/** Build the document and return its parts, in order. */
async function documentParts(sandbox, data) {
    const sections = sandbox.GAIP_WordExport.buildSections(data, {});
    const doc = new sandbox.docx.Document({ sections: [{ properties: {}, children: sections }] });
    const blob = await sandbox.docx.Packer.toBlob(doc);
    const zip = await sandbox.JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');

    // The table structure is what the flat text loses, and every cell is its own paragraph, so the
    // row and table boundaries are marked before the split and counted afterwards.
    const marked = xml
        .replace(/<w:tbl>/g, '\u0001TBL_IN\u0001').replace(/<\/w:tbl>/g, '\u0001TBL_OUT\u0001')
        .replace(/<w:tr[ >]/g, '\u0001TR_IN\u0001$&').replace(/<\/w:tr>/g, '\u0001TR_OUT\u0001');
    const chunks = marked.split('</w:p>');
    const parts = [];
    let tableDepth = 0;
    let rowSerial = 0;
    let section = null;        // nearest Heading1
    let subsection = null;     // nearest Heading2 or lower
    chunks.forEach((chunk) => {
        const opens = (chunk.match(/\u0001TBL_IN\u0001/g) || []).length;
        const closes = (chunk.match(/\u0001TBL_OUT\u0001/g) || []).length;
        const rowOpens = (chunk.match(/\u0001TR_IN\u0001/g) || []).length;
        // The marker sits before the paragraph's own text, so a row opened in this chunk already
        // holds this paragraph; a row closed in it does not.
        rowSerial += rowOpens;
        const insideTable = tableDepth + opens > 0;
        tableDepth = tableDepth + opens - closes;
        const hm = /<w:pStyle w:val="Heading(\d)"\/>/.exec(chunk);
        const heading = hm ? parseInt(hm[1], 10) : null;
        const text = chunk.replace(/\u0001(TBL|TR)_(IN|OUT)\u0001/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        if (!text.trim() && heading == null) return;
        if (heading === 1) { section = text.trim(); subsection = null; }
        else if (heading != null) { subsection = text.trim(); }
        // GH-810: the text colours of the paragraph's runs. The water table says its level by colour
        // (green, amber, red), and a level a client reads off a colour is a level all the same.
        const colors = (chunk.match(/<w:color w:val="([0-9A-Fa-f]{6})"\/>/g) || [])
            .map((c) => c.replace(/.*w:val="([0-9A-Fa-f]{6})".*/, '$1').toUpperCase());
        parts.push({
            text: text.replace(/\s+$/, ''),
            colors: colors,
            heading: heading,
            inTable: insideTable,
            row: insideTable ? rowSerial : null,
            section: section,
            subsection: subsection
        });
    });
    return parts;
}

/** The flat text, for the places where a whole-document claim is the honest one. */
function flatText(parts) {
    return parts.map((p) => p.text).join('\n');
}

/**
 * The rows of a table that starts at a given heading, as arrays of cell values.
 *
 * The table's own cells are the only place the report prints a COMPUTED amendment rate, so every
 * assertion about "the one verdict" is stated against these rows rather than against prose.
 */
function tableRowsUnder(parts, headingText) {
    const start = parts.findIndex((p) => p.heading != null && p.text.trim() === headingText);
    if (start === -1) return null;
    const byRow = new Map();
    for (let i = start + 1; i < parts.length; i++) {
        const p = parts[i];
        if (p.heading != null && p.text.trim() !== headingText) break;
        if (!p.inTable) continue;
        if (!byRow.has(p.row)) byRow.set(p.row, []);
        byRow.get(p.row).push(p.text.replace(/\n/g, ' ').trim());
    }
    return Array.from(byRow.values());
}

module.exports = { documentParts, flatText, tableRowsUnder };
