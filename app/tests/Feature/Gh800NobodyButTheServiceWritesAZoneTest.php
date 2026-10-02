<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * GH-800 (queue item "Zones", stage C1) — THE ZONE HAS ONE WRITER, AND THIS IS WHAT KEEPS IT ONE.
 *
 * A zone's name arrives by five roads (the Data page, the CSV import, the Hill Labs import, the
 * per-record POST and the bulk push), and before this stage each of them merged it into the site's list
 * by its own copy of the same three lines. The point of `ZoneService` is that "which zone is this" has
 * one answer; the point of this case is that it stays one. Modelled on `gh447`: the universe is read
 * out of the tree, and a new writer is red the day it appears rather than the day somebody notices two
 * answers.
 *
 * WHAT COUNTS AS WRITING: an insert, update or delete against `zones` — through Eloquent on the model,
 * or through the query builder by table name.
 *
 * THE TWO PLACES THAT MAY, each with why:
 *   - `App\Services\ZoneService` — the writer this stage introduces;
 *   - `App\Console\Commands\TransferZones` — the one-off transfer of stage C0 (`GH-799`), which fills
 *     the table from the names that already existed. It is not a second owner of the rule: it runs by
 *     hand, once, in the coordinator's window, and the owner's decision of 01.10.2026 is what allows
 *     it. When stage C5 closes the migration it goes, and this list shrinks by one.
 *
 * AND THE TESTS MAY, because a fixture that cannot build a state cannot check one. Only the files of
 * this queue item are allowed it, by name, so a fixture elsewhere reaching for the table is still red.
 */
class Gh800NobodyButTheServiceWritesAZoneTest extends TestCase
{
    /** The two places allowed to write, and the reasons are in the file's own words above. */
    private const MAY_WRITE = [
        'app/Services/ZoneService.php',
        'app/Console/Commands/TransferZones.php',
    ];

    /** Fixtures of this item, which build the states its cases check. */
    private const FIXTURES_THAT_MAY = [
        'tests/Feature/Gh799TheZonesATheSiteAlreadyHasTest.php',
        'tests/Feature/Gh799TheZoneTypesHaveOneFileTest.php',
        'tests/Feature/Gh799TheMigrationIsReversibleTest.php',
        'tests/Feature/Gh800TheServerWritesTheZoneOfASampleTest.php',
    ];

    public function test_only_the_service_and_the_declared_transfer_write_a_zone(): void
    {
        $root = dirname(__DIR__, 2);
        $writers = [];

        foreach ($this->phpFilesUnder($root.'/app') + $this->phpFilesUnder($root.'/tests') as $path => $relative) {
            $src = file_get_contents($path);

            /**
             * `Zone::` through the model, and `table('zones')` through the builder — the two ways this
             * repository writes a row. A read is not a write: `->get(`, `->first(`, `->count(`,
             * `->value(`, `->pluck(`, `->exists(` are what the cases of the item use to LOOK at the
             * table, and they are not what this guard is about.
             */
            $calls = [];
            if (preg_match_all('/Zone::query\(\)->(\w+)|Zone::(\w+)\(/', $src, $m, PREG_SET_ORDER)) {
                foreach ($m as $hit) {
                    $calls[] = $hit[1] !== '' ? $hit[1] : ($hit[2] ?? '');
                }
            }
            if (preg_match_all("/table\('zones'\)->(\w+)/", $src, $m2, PREG_SET_ORDER)) {
                foreach ($m2 as $hit) {
                    $calls[] = $hit[1];
                }
            }

            $written = array_values(array_unique(array_filter($calls, fn ($call) => in_array($call, [
                'create', 'insert', 'insertGetId', 'update', 'updateOrCreate', 'firstOrCreate',
                'delete', 'forceDelete', 'truncate', 'upsert', 'save',
            ], true))));
            if ($written !== []) {
                $writers[$relative] = $written;
            }
        }

        ksort($writers);
        fwrite(STDOUT, '[gh800] every place that writes a zone, and how: '
            .json_encode($writers, JSON_PRETTY_PRINT).PHP_EOL);

        $allowed = array_merge(self::MAY_WRITE, self::FIXTURES_THAT_MAY);
        $unexpected = array_values(array_diff(array_keys($writers), $allowed));
        $gone = array_values(array_diff(self::MAY_WRITE, array_keys($writers)));

        fwrite(STDOUT, '[gh800] writers nobody declared: '.json_encode($unexpected)
            .PHP_EOL.'[gh800] declared writers that no longer write: '.json_encode($gone).PHP_EOL);

        // Both ways, by name: a new writer is red, and a declared one that stopped writing is red too —
        // the second half is what keeps this list from describing a tree that has moved on.
        $this->assertSame([], $unexpected, 'something other than the service writes a zone');
        $this->assertSame([], $gone, 'a declared writer no longer writes: shrink the list and say why');
    }

    /** @return array<string,string> absolute path => path relative to `app/` */
    private function phpFilesUnder(string $dir): array
    {
        $out = [];
        $root = dirname(__DIR__, 2).'/';
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
        foreach ($files as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $out[$file->getPathname()] = str_replace($root, '', $file->getPathname());
            }
        }

        return $out;
    }
}
