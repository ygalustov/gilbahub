'use strict';

/**
 * GH-752 (queue item 3bl, part D) — THE SITE A TEST OF THE SOIL PAGE RENDERS FOR.
 *
 * The soil page takes its methodology from the site's config on the page and the word for it from
 * the inputs list, which the server sends as `GAIP_HUB_CONFIG.methodologyShort`. It no longer reads
 * the run's stamp `sn.methodology`. A test that renders the page gives it a site the way the page is
 * given one, with the word read from the list rather than written here.
 */
const path = require('path');

const LIST = require(path.join(__dirname, '..', '..', 'assets', 'calculation-inputs.schema.json'));

function siteFor(methodology) {
    const v = (LIST.inputs['turf.methodology'].values || {})[methodology];

    return {
        gaipConfig: { turf: methodology ? { methodology } : {} },
        methodologyShort: v && v.short ? v.short : null,
    };
}

/** A render function whose every call renders for a site set to the methodology its `sn` names. */
function asTheSite(win, render) {
    return function (sn, ...rest) {
        win.GAIP_HUB_CONFIG = siteFor(sn && sn.methodology);
        return render(sn, ...rest);
    };
}

module.exports = { siteFor, asTheSite };
