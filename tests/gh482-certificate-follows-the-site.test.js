/**
 * GH-482 — the Ammonium Acetate certificate, and the ranges it carries, are
 * derived from the site's own soil texture, read from the row that owns it.
 *
 * What this closes: `deriveCode(species, texture)` chooses the Hill Labs
 * certificate (S277/S279/S81/S78), and the certificate IS the sufficiency
 * ranges a client is shown. Its texture argument was `soilInput.soilTexture` —
 * `GAIP_STATE.soil`, the page's own state, which is undefined throughout a
 * real export (measured on the stand), so the derivation ran with no texture
 * at all and every AA site fell through to the standing S277 default whatever
 * its rootzone.
 *
 * Behind it, the resolver's texture chain read `GAIP_HUB_CONFIG.soilTexture` —
 * one site's setting, rendered once for the page, answering for every site it
 * was asked about. The owning column `sites.soil_texture_override` has existed
 * since the initial schema and the PATCH endpoint accepts it; `/api/sites`
 * simply never returned it. It does now, with `accounts.soil_texture` beside
 * it as the second link — the rule the server applies to itself.
 *
 * The chain is those two links and nothing else: the owner's decision on
 * question 10.8(17) is that a mark recorded on a sample is not a setting a
 * user can see, and the methodology or texture may have been changed after the
 * row was written. The snapshot, the sample's own soil object and the
 * construction guess all left the chain with it.
 *
 * ── Passport ────────────────────────────────────────────────────────────────
 * guarantee   The certificate a report is interpreted against comes from the
 *             site's own texture setting; no other site's texture, and no
 *             page field, can decide it.
 * claims      By VALUE: a site whose setting is sand-based earns a certificate
 *             and is marked as having derived it; a site whose setting is not
 *             derives none; the answers do not move when the page holds a
 *             different texture, and two sites in one sandbox get their own.
 * universe    collectData(), the border both entry points pass.
 * unit        One report.
 * moment      During collection, after the texture is resolved by site id.
 * distinguishability  Two sites whose settings differ ('sand' against
 *             'clay_loam'), and the same site with each of its two links in
 *             turn, so "followed the site" is distinguishable from "followed
 *             the account" and from "fell to the default".
 * carrier     `data.soil.aaSampleType` with `aaSampleTypeSource` beside it,
 *             and `data.soil.thresholds` — the object every printed range and
 *             the amendment math read.
 * input       The resolver by site id, fed by the site row the API returns.
 * positive-control  The sand case asserts a certificate IS derived and its
 *             ranges ARE present; without it, "no certificate" would pass on a
 *             report that failed to build its soil block at all.
 * exemptions  None.
 * ratchet     None.
 * rc          The reviewer's mutation: pass the page's texture to deriveCode,
 *             read the texture from `GAIP_HUB_CONFIG`, or let the account's
 *             setting outrank the site's own column.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * PINNED, not approved: a site that derives no certificate still prints the
 * standing S277 default (`word-export.js`, "if (!aaSampleType)"). Removing it
 * leaves an Ammonium Acetate report with no sufficiency ranges at all, and
 * what such a report should show is a domain question nobody has answered.
 * The state is recorded below rather than decided here.
 */

'use strict';

const { loadPage, SITE_ID, OTHER_SITE_ID, poisonPage } = require('./helpers/export-page-sandbox');

describe('GH-482 — the certificate follows the site\'s own texture', () => {
    let page, npi, we, row;

    beforeAll(() => {
        page = loadPage({ errors: [], warnings: [], alerts: [] });
        expect(page.failures).toEqual([]);
        npi = page.sandbox.GAIP_NutritionProgramInputs;
        we = page.sandbox.GAIP_WordExport;
        row = page.sandbox.GAIP_SiteConfig.getSite(SITE_ID);
        // Every DOM answer becomes a sentinel and every page-state root is
        // poisoned, so a texture taken from the page is visible rather than
        // merely wrong.
        poisonPage(page.sandbox);
    });

    afterEach(() => {
        row.soil_texture_override = 'sand';
        row.account_soil_texture = 'loam';
    });

    test('a site whose own setting is sand-based earns its certificate, and the ranges come with it', () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(data.soil.methodology).toBe('AMMONIUM_ACETATE');
        expect(data.soil.aaSampleTypeSource).toBe('derived');
        expect(data.soil.aaSampleType).toBe('S277');
        expect(data.soil.aaSoilTexture).toBe('sands');
        // the positive control: the ranges are really there
        expect(data.soil.thresholds).toBeTruthy();
        expect(data.soil.thresholds.K).toEqual(expect.objectContaining({ min: 78.2, max: 195.5 }));
    });

    test('a site whose own setting is not sand-based derives none', () => {
        row.soil_texture_override = 'clay_loam';
        const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(data.soil.aaSoilTexture).toBe('others');
        expect(data.soil.aaSampleTypeSource).toBe('default');
        // PINNED: what it prints instead is the standing S277 default, which
        // is the open domain question named in the header — not an approval.
        expect(data.soil.aaSampleType).toBe('S277');
    });

    test('the account\'s setting answers only when the site has none of its own', () => {
        row.soil_texture_override = null;
        const fromAccount = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(fromAccount.soil.aaSoilTexture).toBe('others');   // account is 'loam'
        expect(fromAccount.soil.aaSampleTypeSource).toBe('default');

        row.account_soil_texture = 'sand';
        const accountSand = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        expect(accountSand.soil.aaSoilTexture).toBe('sands');
        expect(accountSand.soil.aaSampleTypeSource).toBe('derived');
    });

    test('with neither link set nothing is derived, and the page cannot supply one', () => {
        row.soil_texture_override = null;
        row.account_soil_texture = null;
        // The page's own copy holds a texture, loudly: if any rung still reads
        // it, this site resolves 'sand' instead of nothing.
        page.sandbox.GAIP_HUB_CONFIG.soilTexture = 'sand';
        try {
            const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
            expect(data.soil.aaSoilTexture).toBeNull();
            expect(data.soil.aaSampleTypeSource).toBe('default');
            const resolved = npi.resolveExportInputs({ siteId: SITE_ID });
            expect(resolved.program.soilTexture).toBeNull();
            expect(resolved.program.sources.soilTexture).toBe('unresolved');
        } finally {
            delete page.sandbox.GAIP_HUB_CONFIG.soilTexture;
        }
    });

    test('two sites in one document each get their own answer', () => {
        const mine = npi.resolveExportInputs({ siteId: SITE_ID });
        const other = npi.resolveExportInputs({ siteId: OTHER_SITE_ID });
        expect(mine.program.soilTexture).toBe('sand');
        expect(other.program.soilTexture).toBe('clay_loam');
        expect(mine.program.sources.soilTexture).toBe('site-override');
        expect(other.program.sources.soilTexture).toBe('site-override');
    });

    test('the page cannot decide it: the poisoned page reaches neither the texture nor the certificate', () => {
        const data = we.collectData(npi.resolveExportInputs({ siteId: SITE_ID }));
        const { POISON_SENTINEL } = require('./helpers/export-page-sandbox');
        expect(String(data.soil.aaSoilTexture)).not.toContain(POISON_SENTINEL);
        expect(String(data.soil.aaSampleType)).not.toContain(POISON_SENTINEL);
    });
});
