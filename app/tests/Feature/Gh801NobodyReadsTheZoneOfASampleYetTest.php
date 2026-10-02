<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * GH-801 (queue item "Zones", stage C2) — NOTHING READS `samples.zone_id` YET, AND THIS IS WHAT SAYS SO.
 *
 * THE RULE THIS WORK IS HELD TO is that nothing starts reading a new field before something writes it,
 * and nothing stops writing an old one before its readers have moved. Stage C1 added the write; the
 * readers come in stage C3, after the transfer has given the old samples a zone and the server gives one
 * to every new sample. A read arriving earlier would drop whatever the transfer had not reached — which
 * is a sample on a screen with no zone, not an error anybody would see.
 *
 * WHY IT IS A CASE AND NOT A SENTENCE. Until now "nothing reads it" was held by the absence of a reader,
 * which is a thing nobody can check except by reading a diff. The reviewer's requirement of 01.10.2026
 * is that the order of the stages be kept by a case, and that it be this one rather than a later one:
 * declared empty now, it reddens on the first read written before its stage, and in stage C3 it is
 * filled in with the readers that stage declares. The shape is the writer census of `GH-800`: the
 * perechen is taken from the tree and compared BOTH WAYS, so a reader nobody declared reddens it and a
 * declared one that stopped reading reddens it too.
 *
 * GH-803 (stage C3) — THE DECLARATION IS FINER THAN A FILE, and that is the analyst's requirement for
 * this stage rather than tidiness: a declaration that says "`nutrient-trend.js` reads it" lets a SECOND
 * read appear in that same file and pass in silence — the "length instead of the perechen" fault one
 * level up. So the unit is (file · function · why), and the census is taken the same way. A function
 * name survives a shift of lines; a line number does not, which is why neither side carries one.
 *
 * ONE BORDER OF THAT UNIT, said rather than left to be met: in PHP the enclosing function comes from the
 * tokenizer and is exact. In JavaScript it is the nearest function DECLARATION above the line, so a read
 * inside a callback is attributed to the nearest named helper above it rather than to the callback. It is
 * coarser than the PHP half and still far finer than a file, which is what this unit is for.
 *
 * HOW AN OCCURRENCE IS JUDGED, in this order, and the default is the strict one:
 *   1. a WRITE — `'zone_id' => …`, `->zone_id = …`;
 *   2. a NAME OF THE COLUMN with no value read — the migration's own column, index and foreign key, a
 *      `$fillable` entry, a column named in a select list, `Schema::hasColumn`;
 *   3. anything else is a READ. A property read, an array read, a `where`/`whereNull`/`pluck` over the
 *      column: all of them are reading what a sample's zone is. The default falls here on purpose — an
 *      occurrence this file cannot recognise is counted as a read and reddens rather than being passed.
 *
 * THE UNIVERSE is the PRODUCT: `app/app`, `app/database/migrations`, `app/resources/views` and `assets`.
 * A test that inspects the column is not the product reading it, so `app/tests` is not in it — and the
 * cases of stages C0 and C1 do inspect it, which is how they assert what the transfer and the server
 * wrote. Comments are not code: the PHP is read through the tokenizer, which drops them, and the two
 * other kinds have theirs stripped.
 *
 * AND ONE BORDER, named rather than left to be found: `ANOTHER_ZONE` below holds the files whose
 * `zone_id` is a different thing entirely — a shade zone of a stadium, a cluster of sensors — and they
 * are skipped whole. A read of a SAMPLE's zone written inside one of those files would not be seen by
 * this case. They are declared by name, with the reason, so the list cannot grow quietly.
 */
class Gh801NobodyReadsTheZoneOfASampleYetTest extends TestCase
{
    /**
     * THE DECLARED PERECHEN: every place in the product that mentions a sample's zone, by file and by
     * the function it stands in, with what it does there.
     *
     * Stage C3 adds its readers here and to `READERS` below; nothing else may.
     */
    private const DECLARED = [
        // The write this product does: the one service decides the zone, the controller stores it.
        'app/Http/Controllers/SampleController.php · saveSampleRecord' => ['writes'],
        'app/Http/Controllers/SampleController.php · update' => ['writes'],
        // GH-803, stage C3: the first reader, and the only one on the server. It answers with the id and
        // the zone's name so that a browser can group by the id and still have a name to print at the
        // head of a series.
        'app/Http/Controllers/SampleController.php · samplePayload' => ['reads'],
        // The field is writable on the model, which is a declaration and not a read. The relation
        // `Sample::zone()` is NOT on this list and that is correct: declaring a relation names no column
        // and reads nothing -- the read happens where it is used, which is `samplePayload` above.
        'app/Models/Sample.php · (file)' => ['names-the-column'],
        // The one-off transfer of stage C0: it writes the link, and it names the column in its select
        // list so that a dry run before the migration does not ask for a column that is not there. It
        // reads no value out of it -- what it decides by is `payload._label`.
        'app/Console/Commands/TransferZones.php · handle' => ['writes'],
        'app/Console/Commands/TransferZones.php · samplesOf' => ['names-the-column'],
        // The migration that made the column.
        'database/migrations/2026_10_01_000000_create_zones_table.php · up' => ['names-the-column'],
        'database/migrations/2026_10_01_000000_create_zones_table.php · down' => ['names-the-column'],
        // GH-804, part 1 — the one reader that asks the column a question about a ZONE rather than
        // about a sample: how many samples point at the zone somebody is deleting.
        'app/Services/ZoneService.php · applyFromSettings' => ['reads'],
        // GH-817: the Zones tab is handed each zone's number of live samples.
        'app/Services/ZoneService.php · forThePage' => ['reads'],
        // GH-822, stage C4: the Data page's one reader of the link -- the type of each row's zone.
        'app/Http/Controllers/DataController.php · zoneTypeOfEachRow' => ['reads'],
        // GH-803, stage C3 — the readers in the browser, each in the function it stands in.
        'assets/sample-persistence.js · nameOrNothing' => ['reads'],
        'assets/nutrient-trend.js · seriesKeyOf' => ['reads'],
        'assets/nutrient-trend.js · seriesLabelOf' => ['reads'],
        'assets/nutrition-program-inputs.js · zoneIdentityOf' => ['reads'],
        'assets/nutrition-calendar.js · applySample' => ['reads'],
        'assets/nutrition-calendar.js · collectFromState' => ['reads'],
        // GH-826: the Plan page's tissue list carries the zone the server answers with, so the pair can meet it.
        'assets/nutrition-calendar.js · loadTissueSamples' => ['reads'],
        'assets/hub-persistence.js · _zoneKeyOf' => ['reads'],
        'assets/word-export-combined.js · zoneIdentityOf' => ['reads'],
        'assets/word-export-combined.js · buildZoneMap' => ['reads'],
    ];

    /**
     * THE READERS, each with what it reads the zone FOR.
     *
     * Stage C2 left this empty, which was the whole of its claim: nothing read the field before
     * something wrote it. Stage C3 is where reading starts, and it starts on the server — the order
     * inside the stage is "the server answers with the zone first, the browser reads it second", so the
     * server's reader is declared in the same hand-in that introduces it.
     */
    private const READERS = [
        'app/Http/Controllers/SampleController.php · samplePayload' => 'answers with the zone of a sample, id and name, so a page can group by identity and print a name',
        'app/Services/ZoneService.php · applyFromSettings' => 'counts the samples of a zone being deleted, so the save is refused with that number instead of unlinking them',
        'app/Services/ZoneService.php · forThePage' => 'counts the live samples of each zone, for the sentence the Zones tab prints beside its cross',
        'app/Http/Controllers/DataController.php · zoneTypeOfEachRow' => 'the type of each sample row\'s zone, printed on the Data page by its label from the dictionary',
        'assets/sample-persistence.js · nameOrNothing' => 'carries the answer into the store: the object of a sample gains `zoneId` and `zoneName`',
        'assets/nutrient-trend.js · seriesKeyOf' => 'which series a sample belongs to: the zone, for soil and tissue; water keeps its own key',
        'assets/nutrient-trend.js · seriesLabelOf' => 'the caption of a series -- the one place a zone NAME is printed in this stage',
        'assets/nutrition-program-inputs.js · zoneIdentityOf' => 'which zone a sample is of, for the tissue-to-soil pair',
        'assets/nutrition-calendar.js · applySample' => 'puts the zone of the soil sample on the object the programme is built from',
        'assets/nutrition-calendar.js · collectFromState' => 'asks for the tissue of THIS zone by its identity',
        'assets/nutrition-calendar.js · loadTissueSamples' => 'carries the zone of each tissue sample from the server\'s answer, so the tissue of a zone is found',
        'assets/hub-persistence.js · _zoneKeyOf' => 'keys the zone list of a stored result by the zone, and records the id in each entry',
        'assets/word-export-combined.js · zoneIdentityOf' => 'groups the report into sections by zone',
        'assets/word-export-combined.js · buildZoneMap' => 'hands the zone over to the shared pair rule',
    ];

    /**
     * THE TOKEN — the column by name, as a WHOLE word, and a read made THROUGH THE RELATION.
     *
     * Whole word, because `$zoneIdByKey` is a local of the transfer and `zone_name` a field of a shade
     * analysis: a substring match called both of them a mention of this column, and one of them a read.
     *
     * AND `->zone->` / `->zone?->` / `->zone(`, because a read through the Eloquent relation names no
     * column at all — `$sample->zone?->name` asks the database for `zone_id` and the word does not
     * appear. Without this half the first reader of this stage would have been invisible to its own
     * guard. A bare `$row->zone` is NOT this: that is the journal's own `zone` column (`spray_logs`,
     * `field_log_entries`), a word rather than a link, and it is left out by requiring the arrow.
     */
    private const TOKEN = '/(?<![A-Za-z0-9_])(zone_id|zoneId)(?![A-Za-z0-9_])|->zone\s*(\?->|->|\()/';

    /**
     * Files whose `zone_id` / `zoneId` is not a sample's zone at all, each with what it is instead.
     *
     * A stadium's shade analysis divides a VENUE into zones and keys them by a name it makes up
     * (`zone_north`); the sensor import clusters probes into zones of its own and edits their names on a
     * page. Neither has anything to do with a zone of a site or a sample taken from one. They are
     * skipped whole, and that is this case's border: a read of a SAMPLE's zone written inside one of
     * these nine files would not be seen here, so a reader that belongs in one of them has to be
     * declared by hand. Stage C3 has none.
     */
    private const ANOTHER_ZONE = [
        'app/Support/Stadium/interface-shade-engine.php' => 'a shade zone of a venue, in an example',
        'app/Support/Stadium/class-dli-gap-calculator.php' => 'a shade zone of a venue',
        'app/Support/Stadium/class-shade-engine.php' => 'a shade zone of a venue',
        'app/Support/Stadium/class-supplemental-light-module.php' => 'a shade zone of a venue',
        'app/Support/Stadium/class-schedule-optimiser.php' => 'a shade zone of a venue',
        'assets/eue-integration-bridge.js' => 'a shade zone of a venue, from the stadium engine',
        'assets/venue-readiness-ui.js' => 'a shade zone of a venue, on the readiness panel',
        'assets/sensor-api-hydrosight.js' => 'a cluster of sensors',
        'assets/sensor-import.js' => 'a cluster of sensors, named by the person importing them',
    ];

    public function test_the_zone_of_a_sample_is_written_and_read_by_nothing(): void
    {
        $occurrences = [];
        $census = [];

        foreach ($this->productFiles() as $path => $relative) {
            if (array_key_exists($relative, self::ANOTHER_ZONE)) {
                continue;
            }
            $functions = $this->functionsOf($path);
            foreach ($this->occurrencesIn($path) as $hit) {
                $role = $this->roleOf($hit['code']);
                $where = $relative.' · '.$this->enclosing($functions, $hit['line']);
                $occurrences[] = ['where' => $where, 'line' => $hit['line'],
                    'role' => $role, 'code' => $hit['code']];
                $census[$where][$role] = true;
            }
        }

        foreach ($census as $where => $roles) {
            $sorted = array_keys($roles);
            sort($sorted);
            $census[$where] = $sorted;
        }
        ksort($census);

        $readers = [];
        foreach (self::READERS as $where => $why) {
            $readers[$where] = $why;
        }
        ksort($readers);
        $readsNow = [];
        foreach ($census as $where => $roles) {
            if (in_array('reads', $roles, true)) {
                $readsNow[$where] = self::READERS[$where] ?? 'NOT DECLARED';
            }
        }
        ksort($readsNow);
        $declared = self::DECLARED;
        ksort($declared);

        // What it inspected, not only what it concluded: every occurrence, where it is and what it does.
        fwrite(STDOUT, '[gh801] every place the product mentions a sample\'s zone:'.PHP_EOL);
        foreach ($occurrences as $hit) {
            fwrite(STDOUT, '  '.$hit['role'].'  '.$hit['where'].' (line '.$hit['line'].')  '
                .$hit['code'].PHP_EOL);
        }
        fwrite(STDOUT, '[gh801] the census, by file and function: '.json_encode($census)
            .PHP_EOL.'[gh801] places nobody declared: '
            .json_encode(array_values(array_diff(array_keys($census), array_keys($declared))))
            .PHP_EOL.'[gh801] declared places that no longer mention it: '
            .json_encode(array_values(array_diff(array_keys($declared), array_keys($census))))
            .PHP_EOL.'[gh801] READERS of the field, and what each reads it for: '.json_encode($readsNow)
            .PHP_EOL.'[gh801] files skipped as another kind of zone: '
            .json_encode(array_keys(self::ANOTHER_ZONE)).PHP_EOL);

        // The universe is real: without this the assertions below pass over nothing at all.
        $this->assertGreaterThan(5, count($occurrences));
        // BOTH WAYS, as a perechen: a place nobody declared, and a declaration the tree has outgrown.
        $this->assertSame($declared, $census);
        /**
         * AND THE ANSWER THIS STAGE IS ABOUT: nothing reads it. The day something does, this is the
         * assertion that says so -- and if that day is stage C3, the reader is declared here and in the
         * census above, which is the whole of what filling it in costs.
         */
        $this->assertSame($readers, $readsNow);
    }

    /**
     * GH-822 (stage C4) — THE TYPE OF A ZONE, BY ITS FIELD NAMES, AS A SECOND CENSUS.
     *
     * The census above follows the link (`zone_id`). A reader of a zone's TYPE need not name the link at all: a
     * page handed `zoneTypeLabel` beside a sample reads the type without a word of `zone_id`, and the census
     * above would not see it by construction (the reviewer's W4). So every place that names the type's fields
     * is listed here, by file and function, both ways.
     *
     * `spray_logs.zone_type` is a column of the spray journal with the same name; its places are listed as such.
     */
    private const TYPE_TOKEN = '/(?<![A-Za-z0-9_])(zone_type|zoneTypeLabel)(?![A-Za-z0-9_])/';

    private const DECLARED_TYPE = [
        // The zone's own column: made, written and read where the zone is the subject.
        'database/migrations/2026_10_01_000000_create_zones_table.php · up' => 'makes `zones.zone_type`',
        'app/Models/Zone.php · (file)' => 'the column is writable on the model',
        'app/Console/Commands/TransferZones.php · writeZones' => 'the one-off transfer makes zones with no type',
        'app/Services/ZoneService.php · resolveOrCreate' => 'a zone made by name has no type',
        'app/Services/ZoneService.php · applyFromSettings' => 'the Zones tab writes the types and refuses a zone without one',
        'app/Services/ZoneService.php · forThePage' => 'hands the Zones tab each zone\'s type key',
        'app/Http/Controllers/ZoneController.php · whyNot' => 'names the zones without a type in the refusal',
        // The one dictionary and the obligation that names the field.
        'app/Support/ZoneTypes.php · zoneTypeLabel' => 'the label of a type, from zone-types.json',
        'app/Support/CalculationInputs.php · zoneTypeLabel' => 'the words of the zone-type obligation',
        'app/Support/CalculationInputs.php · zoneTypeFieldForThePage' => 'the obligation as the Zones tab is handed it',
        // GH-822, stage C4: the Data page's reader of the type of each sample row's zone.
        'app/Http/Controllers/DataController.php · zoneTypeOfEachRow' => 'the type of each sample row\'s zone on the Data page',
        // `spray_logs.zone_type` -- the spray journal's own column of the same name, not a zone's type.
        'database/migrations/2026_10_02_000000_add_zone_type_to_spray_logs.php · up' => 'spray journal column',
        'database/migrations/2026_10_02_000000_add_zone_type_to_spray_logs.php · down' => 'spray journal column',
        'app/Console/Commands/TypeJournalZones.php · handle' => 'spray journal column',
        'app/Console/Commands/TypeJournalZones.php · tally' => 'spray journal column',
        'app/Http/Controllers/SprayLogController.php · buildFilteredQuery' => 'spray journal column',
        'app/Http/Controllers/SprayLogController.php · store' => 'spray journal column',
        'app/Http/Controllers/SprayLogController.php · update' => 'spray journal column',
        'app/Support/RunStart.php · filledInSprayLog' => 'spray journal column',
    ];

    public function test_every_place_that_names_the_type_of_a_zone_is_declared(): void
    {
        $census = [];
        foreach ($this->productFiles() as $path => $relative) {
            $src = file_get_contents($path);
            if (! preg_match(self::TYPE_TOKEN, $src)) {
                continue;
            }
            $functions = $this->functionsOf($path);
            $code = str_ends_with($path, '.php') && ! str_contains($path, '/views/')
                ? $this->phpWithoutComments($src) : $this->strippedComments($src);
            foreach (explode("\n", $code) as $i => $line) {
                if (preg_match(self::TYPE_TOKEN, $line)) {
                    $census[$relative.' · '.$this->enclosing($functions, $i + 1)] = true;
                }
            }
        }
        $census = array_keys($census);
        sort($census);
        $declared = array_keys(self::DECLARED_TYPE);
        sort($declared);
        fwrite(STDOUT, '[gh822] places naming the zone type: '.count($census).PHP_EOL.'  '.implode(PHP_EOL.'  ', $census).PHP_EOL
            .'[gh822] not declared: '.json_encode(array_values(array_diff($census, $declared)))
            .PHP_EOL.'[gh822] declared and gone: '.json_encode(array_values(array_diff($declared, $census))).PHP_EOL);

        $this->assertGreaterThan(5, count($census));
        $this->assertSame($declared, $census);
    }

    /**
     * The functions of a file, by the line each begins on, so an occurrence can be told which one it
     * stands in. A name, not a line number: the name survives the next edit above it.
     *
     * @return array<int,string> line => function name
     */
    private function functionsOf(string $path): array
    {
        $src = file_get_contents($path);
        $out = [];
        if (str_ends_with($path, '.php')) {
            $tokens = token_get_all($src);
            for ($i = 0; $i < count($tokens); $i++) {
                if (! is_array($tokens[$i]) || $tokens[$i][0] !== T_FUNCTION) {
                    continue;
                }
                for ($j = $i + 1; $j < count($tokens) && $j < $i + 5; $j++) {
                    // `function (Blueprint $table)` is anonymous: its first word is a type, not a name,
                    // so the search stops at the parenthesis and the occurrence keeps the enclosing
                    // NAMED function -- `up` and `down` in a migration rather than `Blueprint`.
                    if (! is_array($tokens[$j]) && $tokens[$j] === '(') {
                        break;
                    }
                    if (is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {
                        $out[$tokens[$i][2]] = $tokens[$j][1];
                        break;
                    }
                }
            }

            return $out;
        }
        foreach (explode("\n", $src) as $i => $line) {
            if (preg_match('/function\s+([A-Za-z_$][\w$]*)\s*\(/', $line, $m)
                || preg_match('/([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s+)?function\s*\(/', $line, $m)
                || preg_match('/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^=;]*\)?\s*=>/', $line, $m)) {
                $out[$i + 1] = $m[1];
            }
        }

        return $out;
    }

    /** The function an occurrence stands in, or `(file)` for one outside any. */
    private function enclosing(array $functions, int $line): string
    {
        $best = null;
        $bestLine = 0;
        foreach ($functions as $at => $name) {
            if ($at <= $line && $at >= $bestLine) {
                $bestLine = $at;
                $best = $name;
            }
        }

        return $best ?? '(file)';
    }

    /** @return array<string,string> absolute path => path as the declarations spell it */
    private function productFiles(): array
    {
        $app = dirname(__DIR__, 2);          // …/app
        $repo = dirname($app);               // …/gilbahub
        $out = [];
        foreach ([$app.'/app', $app.'/database/migrations', $app.'/resources/views', $repo.'/assets'] as $dir) {
            if (! is_dir($dir)) {
                continue;
            }
            foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir)) as $file) {
                if (! $file->isFile() || ! in_array($file->getExtension(), ['php', 'js'], true)) {
                    continue;
                }
                $relative = str_replace([$app.'/', $repo.'/'], '', $file->getPathname());
                $out[$file->getPathname()] = $relative;
            }
        }

        return $out;
    }

    /**
     * The lines of this file that mention a sample's zone, comments excluded.
     *
     * @return array<int,array{line:int,code:string}>
     */
    private function occurrencesIn(string $path): array
    {
        $src = file_get_contents($path);
        if (! preg_match(self::TOKEN, $src)) {
            return [];
        }
        $lines = explode("\n", $src);
        $code = str_ends_with($path, '.php') && ! str_contains($path, '/views/')
            ? $this->phpWithoutComments($src)
            : $this->strippedComments($src);

        $hits = [];
        foreach (explode("\n", $code) as $i => $line) {
            if (preg_match(self::TOKEN, $line)) {
                $hits[] = ['line' => $i + 1, 'code' => trim($lines[$i] ?? $line)];
            }
        }

        return $hits;
    }

    /** The same source with every comment blanked and the line numbers kept. */
    private function phpWithoutComments(string $src): string
    {
        $out = '';
        foreach (token_get_all($src) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                $out .= str_repeat("\n", substr_count($token[1], "\n"));

                continue;
            }
            $out .= is_array($token) ? $token[1] : $token;
        }

        return $out;
    }

    /** Line numbers kept, so a hit still points at the line a person can open. */
    private function strippedComments(string $src): string
    {
        $src = preg_replace_callback('#/\*.*?\*/|\{\{--.*?--\}\}#s',
            fn ($m) => str_repeat("\n", substr_count($m[0], "\n")), $src);

        return preg_replace('#^(\s*)//.*$#m', '$1', (string) $src);
    }

    /** The ladder written out in this file's own words, in that order. */
    private function roleOf(string $line): string
    {
        /**
         * A VALUE TAKEN OUT OF THE FIELD IS A READ, and it is asked first: `'zone_id' => $sample->zone_id`
         * matches the write shape below as well, and it is a read into an array — which is exactly what
         * the server's answer does. `$sample->zone_id = …` is excluded by the `=` and falls through to
         * the write rule, where it belongs.
         */
        if ((preg_match('/->zone_id(?![\w])/', $line) && ! preg_match('/->zone_id\s*=[^=]/', $line))
            || preg_match('/->zone\s*(\?->|->|\()/', $line)
            || preg_match('/(where|whereNull|whereNotNull|orderBy|groupBy|pluck|value)\([^)]*[\'"]zone_id[\'"]/', $line)) {
            return 'reads';
        }
        if (preg_match('/[\'"]zone_id[\'"]\s*=>/', $line)
            || preg_match('/->zone_id\s*=[^=]/', $line)
            || preg_match('/[\'"]zone_id[\'"]\s*:/', $line)) {
            return 'writes';
        }
        if (preg_match('/(uuid|string|foreign|index|dropIndex|dropColumn|dropForeign)\(\s*\[?\s*[\'"]zone_id[\'"]/', $line)
            || preg_match('/hasColumn\([^)]*[\'"]zone_id[\'"]/', $line)
            || preg_match('/^[\'"]zone_id[\'"],$/', $line)
            || preg_match('/=\s*[\'"]zone_id[\'"];/', $line)) {
            return 'names-the-column';
        }

        return 'reads';
    }
}
