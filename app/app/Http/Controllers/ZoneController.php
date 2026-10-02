<?php

namespace App\Http\Controllers;

use App\Models\Site;
use App\Services\ZoneService;
use App\Support\CalculationInputs;
use App\Support\ReadableList;
use App\Support\ZoneTypes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * GH-801 (queue item "Zones", stage C2) — THE ZONES OF A SITE, AS THE SETTINGS TAB CHANGES THEM.
 *
 * WHY A ROUTE OF ITS OWN. The tab saved by PATCHing the SITE with the whole list of names the browser
 * held (`attributes_json: {zones: [...]}`) — the last place in the product where a page sent a copy of
 * the product's own state back to be stored, and the shape the project's rule names outright: send the
 * change, not the state. A zone is a row with an identity now, and what a person did to it — created,
 * renamed, typed, deleted — is what travels here.
 *
 * WHAT THIS CONTROLLER DOES AND WHAT IT DOES NOT. It answers for the request: who may, what shape, which
 * keys the dictionary declares, and what words a refusal carries. WHICH SAVES ARE ALLOWED is not its
 * business and is not spelled here — that is `ZoneService::applyFromSettings`, the one door, which judges
 * the set of zones the site is left with. A second judgement here would be a second owner of the rule.
 *
 * NOTHING READS `samples.zone_id` IN THIS STAGE, this controller included. The link is written (stage C1)
 * and read from stage C3, and `Gh801NobodyReadsTheZoneOfASampleYetTest` is what holds the order rather
 * than a sentence in a file.
 */
class ZoneController extends Controller
{
    /**
     * Apply the changes the Zones tab made, all of them or none.
     *
     * 422 is the answer to every refusal, in the same shape the config route and the site route use
     * (`missing: [{input, label}]`), so the page marks the rows with the marker every other Settings tab
     * marks with and prints the sentence the server composed.
     */
    public function update(Request $request, string $site): JsonResponse
    {
        $site = Site::query()->findOrFail($site);
        abort_unless($request->user()->canEditSite($site), 403);

        /**
         * The type travels as a KEY of the dictionary and the rule comes from the dictionary's own
         * reader, not from a list written out here — the owner's decision of 22.09.2026 that a type is a
         * reference to a declared value. An empty string is how a select nobody touched arrives, and it
         * means "no type": allowed by the shape, and then refused by the obligation, which is the one
         * place that decides whether an absent type is acceptable.
         */
        $isAType = Rule::in(array_merge([''], ZoneTypes::zoneTypeKeys()));

        $changes = $request->validate([
            'created' => ['sometimes', 'array'],
            'created.*.name' => ['required', 'string', 'max:191'],
            'created.*.zoneType' => ['nullable', 'string', $isAType],
            'renamed' => ['sometimes', 'array'],
            'renamed.*.id' => ['required', 'string', 'max:64'],
            'renamed.*.name' => ['required', 'string', 'max:191'],
            'typed' => ['sometimes', 'array'],
            'typed.*.id' => ['required', 'string', 'max:64'],
            'typed.*.zoneType' => ['nullable', 'string', $isAType],
            'deleted' => ['sometimes', 'array'],
            'deleted.*' => ['required', 'string', 'max:64'],
        ]);

        $outcome = app(ZoneService::class)->applyFromSettings($site, $changes, $request->user()->id);

        if ($outcome['ok']) {
            return response()->json(['data' => ['zones' => $outcome['zones']]]);
        }

        return response()->json(array_merge($outcome, [
            'message' => $this->whyNot($outcome),
            // The older field every caller of a Settings refusal already reads.
            'invalid_keys' => array_column($outcome['missing'], 'input'),
        ]), 422);
    }

    /**
     * The sentence a person reads, composed once, from the refusal itself.
     *
     * The obligation's wording is the owner's: "Not saved: fill in the zone type for Green 1, Green 2 and
     * Green 3." It names THE ZONES and not just the field, which the other refusals of this product do
     * not have to do — there a person left a field empty themselves, and here the zones may be ones they
     * never touched: created from the Data page, or moved in by the transfer. Without the names they
     * would not know why a change to a different zone was refused.
     */
    private function whyNot(array $outcome): string
    {
        if ($outcome['missing'] !== []) {
            return 'Not saved: fill in '.CalculationInputs::zoneTypeLabel().' for '
                .ReadableList::of(array_column($outcome['missing'], 'zone')).'.';
        }
        /**
         * GH-804: the zone cannot go while samples point at it, and the sentence carries the number the
         * person has to act on — per zone, because that is what they have to move.
         */
        if (($outcome['inUse'] ?? []) !== []) {
            // GH-817: the words come from the one builder the Zones tab's cross also reads.
            $said = array_map(
                fn ($z) => ZoneService::samplesClause($z['zone'], (int) $z['samples']),
                $outcome['inUse']
            );

            return 'Not saved: '.ReadableList::of($said).'. '.ZoneService::samplesTail();
        }
        if (($outcome['nameless'] ?? 0) > 0) {
            return 'Not saved: a zone needs a name.';
        }
        if ($outcome['conflict'] !== []) {
            return 'Not saved: this site already has a zone called '
                .ReadableList::of($outcome['conflict']).'.';
        }

        return 'Not saved: the zones on this page have changed since you opened it. Reload and try again.';
    }
}
