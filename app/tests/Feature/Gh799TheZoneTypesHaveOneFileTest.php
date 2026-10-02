<?php

namespace Tests\Feature;

use App\Support\ZoneTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * GH-799 (queue item "Zones", stage C0) — THE DICTIONARY HAS ONE FILE AND ONE READER.
 *
 * The analyst's decision of 01.10.2026 put the twelve zone types in `assets/zone-types.json` instead of
 * a table, for the reason written in the file: the code owns these values, nobody enters them on a
 * screen. The four water-source kinds the file also carried at first are NOT there any more: the owner
 * decided on 01.10.2026 that a water sample keeps only its name, so the column they were declared for
 * is not added -- and a list of allowed values with nothing that may hold one is a promise with no
 * writer. The case below says the file declares the twelve and nothing else. The same shape as `aa-ranges.json`, so the same guard
 * (`gh768-the-aa-ranges-have-one-file` is the model): the server reads the file, and a second reader in
 * `assets` is red here.
 *
 * AND THE VALUES WERE MOVED, NOT INVENTED. The labels come from the sample switcher's own table and the
 * area hints from the import's, both still live until stage C4 moves their readers. While two copies
 * exist they are held equal here — that is a seatbelt against a copy drifting, not a second owner, and
 * when C4 removes the originals this case is what records that the words survived the move.
 */
class Gh799TheZoneTypesHaveOneFileTest extends TestCase
{
    use RefreshDatabase;

    private const ASSETS = __DIR__.'/../../../assets/';

    public function test_the_file_declares_the_twelve_types_the_plan_names_and_nothing_else(): void
    {
        $zones = ZoneTypes::zoneTypeKeys();
        $sections = array_values(array_diff(array_keys(ZoneTypes::all()), ['$comment', 'version']));

        fwrite(STDOUT, '[gh799] the zone types the file declares: '.json_encode($zones)
            .PHP_EOL.'[gh799] the sections the file declares: '.json_encode($sections)
            .PHP_EOL);

        // The list, not its length, and in the plan's own order.
        $this->assertSame([
            'green', 'fairway', 'tee', 'rough', 'approach', 'collar', 'bunker',
            'sports_pitch', 'goal_area', 'centre', 'cotula_bowling_green', 'other',
        ], $zones);
        /**
         * ONE VOCABULARY, AND ONE SECTION AGAIN. A second vocabulary would be a list of allowed values
         * with no column that may hold one -- which is what the water sources became when the owner
         * decided water keeps only its name, and why they are not here.
         *
         * GH-804 (part 1): `zoneTypeField` was the second section between stage C2 and this hand-in. It
         * declared the OBLIGATION on the type, which is now the input `zones.zoneType` of
         * `calculation-inputs.schema.json`, read through `CalculationInputs` -- one file for what the
         * product requires. So this file is back to the one thing it is for, and a declaration arriving
         * here again is red.
         */
        /**
         * GH-806 (stage SZh1): `journalZoneWords` is the second section, and it is not a second
         * vocabulary of types either -- it is the table that answers which of the twelve a WORD of the
         * spray journal means, plus the words this dictionary declares no type for. It names no type
         * that `zoneTypes` does not declare, and the case below says so, so a vocabulary smuggled in
         * under that name is still red here.
         */
        /**
         * GH-816 (queue item "Zones", ZhT): `analysisZoneTypes` is the third section, and it is not a
         * vocabulary of types either -- it answers which of the twelve the analysis counts in the spray
         * journal, by the site's turf type. Its keys are exactly the turf types the inputs list declares,
         * both ways, and its values name only types this file declares or the word it declares for any.
         */
        $this->assertSame(['zoneTypes', 'journalZoneWords', 'analysisZoneTypes'], $sections);
        $answers = array_values(array_filter(ZoneTypes::journalWords(), fn ($t) => $t !== null));
        $this->assertSame([], array_values(array_diff($answers, ZoneTypes::zoneTypeKeys())));
        $analysis = ZoneTypes::all()['analysisZoneTypes'];
        $turfTypes = \App\Support\CalculationInputs::turfTypes();
        $this->assertSame($turfTypes, array_keys($analysis['byTurfType']));
        $named = [];
        foreach ($analysis['byTurfType'] as $value) {
            if ($value !== $analysis['anyType']) {
                $named = array_merge($named, (array) $value);
            }
        }
        $this->assertSame([], array_values(array_diff($named, ZoneTypes::zoneTypeKeys())));
    }

    public function test_a_key_the_file_does_not_carry_is_not_a_type_and_not_a_source(): void
    {
        $answers = [
            'green' => ZoneTypes::isZoneType('green'),
            'cotula_bowling_green' => ZoneTypes::isZoneType('cotula_bowling_green'),
            'greens (the old plural)' => ZoneTypes::isZoneType('greens'),
            'bore as a zone type' => ZoneTypes::isZoneType('bore'),
            'null' => ZoneTypes::isZoneType(null),
        ];
        fwrite(STDOUT, '[gh799] what the dictionary accepts: '.json_encode($answers).PHP_EOL);

        $this->assertSame([
            'green' => true,
            'cotula_bowling_green' => true,
            // The plural is what the spray log and the old `_zone` field use; it is not a zone type,
            // and reading it as one is the substitution stage C4 removes.
            'greens (the old plural)' => false,
            // `bore` is the OTHER meaning `payload._zone` has carried -- the source of a water sample
            // -- and it is not a zone type. That word is left where it is: water keeps only its name.
            'bore as a zone type' => false,
            'null' => false,
        ], $answers);
    }

    public function test_every_key_stored_in_the_type_column_is_one_the_file_declares(): void
    {
        /**
         * The equality the plan asks for, over the database this test built: whatever the transfer and
         * (from stage C1) the server put in that column must be a declared key.
         */
        $undeclaredZone = DB::table('zones')->whereNotNull('zone_type')->pluck('zone_type')
            ->reject(fn ($k) => ZoneTypes::isZoneType($k))->values()->all();
        fwrite(STDOUT, '[gh799] keys in `zones.zone_type` the file does not declare: '
            .json_encode($undeclaredZone).PHP_EOL);

        $this->assertSame([], $undeclaredZone);
        // And the reader that answers the question is reachable at all, so the two assertions above are
        // not satisfied by a dictionary that calls everything invalid.
        $this->assertTrue(ZoneTypes::isZoneType(ZoneTypes::zoneTypeKeys()[0]));
    }

    public function test_the_server_is_the_only_reader_of_the_file(): void
    {
        $readers = [];
        foreach (glob(self::ASSETS.'*.js') as $file) {
            $src = file_get_contents($file);
            if (str_contains($src, 'zone-types.json')) {
                $readers[] = basename($file);
            }
        }
        fwrite(STDOUT, '[gh799] files in `assets` that read the dictionary file: '
            .json_encode($readers).PHP_EOL);

        // A browser copy is the drift this shape exists to remove: pages get the dictionary from the
        // server, as they do the AA ranges and the inputs list.
        $this->assertSame([], $readers);
    }

    public function test_the_labels_and_the_area_hints_were_moved_and_not_invented(): void
    {
        $switcher = file_get_contents(self::ASSETS.'sample-switcher-ui.js');
        $manager = file_get_contents(self::ASSETS.'sample-manager.js');

        // The live tables, read out of the files that still hold them until stage C4.
        preg_match('/const ZONE_LABELS = \{(.*?)\n    \};/s', $switcher, $zm);
        $this->assertNotEmpty($zm, 'sample-switcher-ui.js no longer declares ZONE_LABELS');
        preg_match_all("/^\s*(\w+):\s*\{ label: '([^']*)'/m", $zm[1], $labels, PREG_SET_ORDER);
        $liveLabels = [];
        foreach ($labels as $m) {
            $liveLabels[$m[1]] = $m[2];
        }

        preg_match('/const AREA_GUIDANCE = \{(.*?)\n    \};/s', $manager, $am);
        $this->assertNotEmpty($am, 'sample-manager.js no longer declares AREA_GUIDANCE');
        preg_match_all('/^\s*(\w+):\s*\{\s*placeholder:\s*\'([^\']*)\',\s*minHa:\s*([0-9.]+),\s*maxHa:\s*([0-9.]+)/m',
            $am[1], $areas, PREG_SET_ORDER);
        $liveAreas = [];
        foreach ($areas as $m) {
            $liveAreas[$m[1]] = ['placeholder' => $m[2], 'minHa' => (float) $m[3], 'maxHa' => (float) $m[4]];
        }

        $differingLabels = [];
        foreach (ZoneTypes::zoneTypeKeys() as $key) {
            if (! array_key_exists($key, $liveLabels)) {
                continue;   // `cotula_bowling_green` is in neither live table; the file says so.
            }
            if ($liveLabels[$key] !== ZoneTypes::zoneTypeLabel($key)) {
                $differingLabels[$key] = [$liveLabels[$key], ZoneTypes::zoneTypeLabel($key)];
            }
        }
        $differingAreas = [];
        foreach (ZoneTypes::zoneTypeKeys() as $key) {
            if (! array_key_exists($key, $liveAreas)) {
                continue;
            }
            $mine = ZoneTypes::areaGuidance($key);
            $theirs = $liveAreas[$key];
            if ($mine['placeholder'] !== $theirs['placeholder']
                || (float) $mine['minHa'] !== $theirs['minHa']
                || (float) $mine['maxHa'] !== $theirs['maxHa']) {
                $differingAreas[$key] = [$theirs, $mine];
            }
        }

        fwrite(STDOUT, '[gh799] keys the live tables carry: labels '
            .json_encode(array_keys($liveLabels)).', area hints '.json_encode(array_keys($liveAreas))
            .PHP_EOL.'[gh799] labels that differ from the file: '.json_encode($differingLabels)
            .PHP_EOL.'[gh799] area hints that differ: '.json_encode($differingAreas)
            .PHP_EOL.'[gh799] keys of the file with no entry in either live table: '
            .json_encode(array_values(array_diff(
                ZoneTypes::zoneTypeKeys(),
                array_keys($liveLabels),
                array_keys($liveAreas)
            ))).PHP_EOL);

        // The universe is real: without this the two comparisons above pass over empty tables.
        $this->assertGreaterThan(8, count($liveLabels));
        $this->assertGreaterThan(8, count($liveAreas));
        $this->assertSame([], $differingLabels);
        $this->assertSame([], $differingAreas);
        // And the one key that has no live entry is named here rather than being absent quietly.
        $this->assertSame(['cotula_bowling_green'], array_values(array_diff(
            ZoneTypes::zoneTypeKeys(), array_keys($liveLabels), array_keys($liveAreas)
        )));
    }

}
