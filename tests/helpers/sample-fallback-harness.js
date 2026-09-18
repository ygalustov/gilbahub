/**
 * GH-521 — one harness for hub-persistence.js's "empty hub form" sample
 * fallback, shared by gh262 / gh263 / gh265 / gh266.
 *
 * Each of those four files used to carry its own copy of this sandbox. When
 * the methodology source moved from the page field to the site's config
 * (GH-521), all four copies had to be taught the new source, and four copies
 * of the same teaching is four chances to teach it differently. One harness,
 * so a test asking "where does methodology come from" gets its answer from
 * the same place the product does.
 *
 * The block is extracted from the real file, not reimplemented: a
 * reimplementation would keep passing after the product stopped doing this.
 */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '../../assets/hub-persistence.js');

function readSource() {
    return fs.readFileSync(SRC_PATH, 'utf8');
}

/** The real fallback block, from `var _turfState` to the end of the `if`. */
function extractFallbackBlock(src) {
    const source = src || readSource();
    const start = source.indexOf('var _turfState = (_gaipState && _gaipState.turf)');
    const fallbackStart = source.indexOf(
        'if (!cache.computed.soilNutrition && global.GAIP_SampleManager', start);
    if (start < 0 || fallbackStart < 0) {
        throw new Error('sample-fallback-harness: the fallback block was not found in '
            + 'hub-persistence.js — it has been renamed or removed, and these tests are '
            + 'no longer measuring it.');
    }
    const braceOpen = source.indexOf('{', fallbackStart);
    let depth = 0;
    let i = braceOpen;
    for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') { depth--; if (depth === 0) break; }
    }
    return source.slice(start, i + 1);
}

/**
 * Drop whole-line `//` comments, so a structural assertion about what the code
 * READS is not answered by prose about what it used to read. Trailing comments
 * on a code line are left alone: stripping those safely would mean parsing, and
 * the fields these tests ask about are never named in one.
 */
function stripLineComments(text) {
    return text.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
}

function parseMlsnTableHtml(html) {
    const tbodyMatch = html.match(/<table class="gaip-mlsn-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) return [];
    const rowRe = /<tr class="([^"]*)"((?:\s+data-[\w-]+="[^"]*")*)>([\s\S]*?)<\/tr>/g;
    const rows = [];
    let m;
    while ((m = rowRe.exec(tbodyMatch[1]))) {
        const dataset = {};
        const attrRe = /data-([\w-]+)="([^"]*)"/g;
        let am;
        while ((am = attrRe.exec(m[2]))) {
            dataset[am[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = am[2];
        }
        const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const cells = [];
        let cm;
        while ((cm = cellRe.exec(m[3]))) cells.push({ textContent: cm[1].replace(/<[^>]+>/g, '') });
        rows.push({
            className: m[1],
            dataset: Object.keys(dataset).length ? dataset : undefined,
            querySelectorAll: (sel) => (sel === 'td' ? cells : []),
        });
    }
    return rows;
}

function DOMParserStub() {
    this.parseFromString = (html) => ({
        querySelectorAll: (sel) => (sel === '.gaip-mlsn-table tbody tr' ? parseMlsnTableHtml(html) : []),
    });
}

/**
 * Run the real block.
 *
 * The three places a methodology can come from are separate arguments on
 * purpose, so a test can put a different answer in each and name which one it
 * expects to see in the result:
 *   configMethodology   — the site's own record (`GAIP_SiteConfig`), the owner
 *   domMethodology      — `.gaip-soil-methodology`, the field on the page
 *   snapshotMethodology — the sample's creation-time stamp
 *   rawMethodology      — a methodology key on the lab payload itself
 *
 * `otherSiteId`/`otherSiteMethodology` put a second site in the config store,
 * so a read by the wrong id has something wrong to find.
 */
function runSampleFallback(engineCtx, opts) {
    const o = opts || {};
    const siteId = o.siteId || 'site1';
    const block = extractFallbackBlock(o.src);
    const cache = { computed: {} };

    const domValues = {};
    if ('domMethodology' in o) domValues['.gaip-soil-methodology'] = o.domMethodology;
    if ('textureDom' in o) domValues['.gaip-soil-texture'] = o.textureDom;
    if ('phDom' in o) domValues['.gaip-soil-ph'] = o.phDom;
    if ('ecDom' in o) domValues['.gaip-soil-ec'] = o.ecDom;

    const configs = {};
    configs[siteId] = { turf: { methodology: o.configMethodology } };
    if (o.otherSiteId) configs[o.otherSiteId] = { turf: { methodology: o.otherSiteMethodology } };

    const sampleRaw = Object.assign({}, o.sampleRaw);
    if ('rawMethodology' in o) sampleRaw.methodology = o.rawMethodology;

    const sample = { date: o.sampleDate || '2026-01-01', label: 'Sample 1', rawData: sampleRaw };
    if ('snapshotMethodology' in o) sample.methodologySnapshot = o.snapshotMethodology;
    if ('textureSnapshot' in o) sample.soilTextureSnapshot = o.textureSnapshot;
    Object.assign(sample, o.sampleExtra || {});

    const allSites = {};
    allSites[siteId] = { soil: { sample_1: sample } };

    const globalObj = {
        GAIP_SampleManager: { getAllSamples: () => ({ allSites }) },
        mlsnEngine: engineCtx.mlsnEngine,
        rawWeatherData: null,
        climateMetrics: null,
        __GAIP_TISSUE_LAST__: null,
    };
    if (!o.noSiteConfig) {
        globalObj.GAIP_SiteConfig = {
            getConfig: (id) => (Object.prototype.hasOwnProperty.call(configs, id) ? configs[id] : null),
        };
    }
    // Present but wrong on purpose: if the resolver ever goes back to asking
    // these for the site id, it gets the page's site, not the sample's.
    globalObj.GAIP_SiteContext = { getSiteId: () => o.otherSiteId || 'page-site' };
    globalObj.GAIP_SampleManager.getActiveSiteId = () => o.otherSiteId || 'page-site';

    const sandbox = {
        cache,
        _gaipState: o.gaipState || {},
        _turfStateOverride: o.turfState,
        // Both falsy so the primary path short-circuits and this fallback's
        // `!cache.computed.soilNutrition` guard fires — the real "empty hub
        // form" race this block exists for.
        _mlsnHtml: '',
        _soilIn: null,
        DOMParser: DOMParserStub,
        document: { querySelector: (sel) => (domValues[sel] !== undefined ? { value: domValues[sel] } : null) },
        global: globalObj,
        window: { GAIP_HUB_CONFIG: { activeSiteId: o.hubActiveSiteId || siteId } },
        console: { log: () => {}, warn: () => {} },
    };
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(block, ctx);
    return ctx.cache.computed.soilNutrition;
}

module.exports = {
    runSampleFallback, extractFallbackBlock, stripLineComments,
    DOMParserStub, parseMlsnTableHtml, readSource,
};
