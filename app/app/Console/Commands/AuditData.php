<?php

namespace App\Console\Commands;

use App\Support\FieldOwners;
use App\Support\SampleOwners;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * GH-709 — A GUARD THAT LOOKS AT THE DATA, BECAUSE A TRACE IN THE DATA SPEAKS ABOUT THE PAST.
 *
 * Our censuses look at the code (the universe is a directory) and our mutations look at
 * behaviour (the universe is an execution path). Neither says anything about rows written
 * yesterday by a path that is closed today. This command reads the database and names one
 * relation broken in it: a JSON value in a row that belongs to one site, equal to the id of
 * ANOTHER site. The sign does not know any field name — it found `_savedForSite` by its form,
 * and it will find the next such stamp under any name.
 *
 * ITS OWN VERDICT CHANNEL. It is not part of the PHPUnit or Jest suites: it answers a question
 * about data, not code, and it can be red over a green tree. Run it on demand, and before any
 * claim about the data is handed on.
 *
 * WHAT IS COMPARED. Every foreign reference the sign names is compared, both ways, with the
 * recorded list of known ones (`database/data-audit/known-violations.json`), where each entry
 * carries the decision it rests on as a `GH-NNN`. Three outcomes, and they tell the TOOL apart
 * from the SUBJECT:
 *   - NEW     the sign names a reference the list does not carry — a finding about the data;
 *   - REMOVED a listed reference is no longer at its address — the list is edited, with reason;
 *   - BLIND   a listed reference IS still at its address, read directly past the sign, and
 *             the sign did not name it — a failure of this tool, not a finding about the data.
 * Any of the three exits non-zero.
 *
 * READ ONLY. It issues SELECTs and nothing else, inside a read-only transaction on MySQL, and
 * rolls back. It corrects nothing: correcting a trace is the owner's.
 *
 * WHAT IT DOES NOT SEE — said before the first run, not after:
 *   - a trace carried by VALUES rather than by an id: `Burns`'s PGR section holds another site's
 *     application (product, rate, date) with no site id in it, and this sign cannot name it;
 *   - what was deleted: a row erased by a wrong path leaves nothing to read;
 *   - the right address with foreign content, as an import of another site's file writes;
 *   - a trace overwritten by a later, legitimate write: a site saved from Settings after a
 *     foreign run looks clean. So "nothing found" never proves "nothing happened";
 *   - rows with no owning site (no `site_id`, not `sites` itself) are read for the universe but
 *     not judged, and the tables skipped for that reason are printed.
 *
 * TWO MORE RELATIONS, DECLARED BY CODE RATHER THAN FOUND BY FORM (part 2 of the same work):
 *   - `copy-differs-from-owner`: every field `FieldOwners::derivedCopies()` names, in each site's
 *     `gaip` config, equals its owning `sites` column as `FieldOwners::castForCopy` gives it;
 *   - `sample-of-another-site`: every key in an analysis row's `inputs.samples` that resolves to
 *     a sample resolves to one of the row's own site — the question the write path asks, through
 *     the same `SampleOwners::sitesOf`.
 * And what these two do not see:
 *   - a copy of a field the owners table does not declare as copied;
 *   - a column that is itself wrong: the copy follows its owner, so both agree and nothing shows;
 *   - a site with no `gaip` config row, and an analysis row with no `inputs.samples` — not checked;
 *   - a sample key that resolves to nothing is printed as unresolved and not judged;
 *   - a key that resolves to several samples passes if ANY of them is the row's site's — the write
 *     path's rule, kept, and with it its blind spot: a foreign sample sharing a key with an own one;
 *   - BLIND for these two re-reads the address and the owning value directly, past the walk, but
 *     judges them with the same comparison and the same resolver the walk uses.
 */
class AuditData extends Command
{
    protected $signature = 'gilba:audit-data {--known= : Path of the recorded list, relative to the app root}';

    protected $description = 'Read-only audit of stored data: JSON values naming another site than the row\'s own (GH-709)';

    private const KNOWN = 'database/data-audit/known-violations.json';

    /** Column types whose values may hold JSON; the values decide, not the declared type. */
    private const TEXT_TYPES = ['json', 'jsonb', 'text', 'tinytext', 'mediumtext', 'longtext'];

    public function handle(): int
    {
        $known = $this->loadKnown();
        if ($known === null) {
            return self::FAILURE;
        }

        $mysql = DB::connection()->getDriverName() === 'mysql';
        if ($mysql) {
            DB::statement('SET TRANSACTION READ ONLY');
        }
        DB::beginTransaction();
        try {
            $siteIds = array_map('strval', DB::table('sites')->pluck('id')->all());
            $sites = array_fill_keys($siteIds, true);
            [$found, $inspected, $skipped] = $this->census($sites);
            [$copies, $copiesChecked] = $this->copiesAgainstOwners();
            [$samples, $samplesChecked, $unresolved] = $this->samplesAgainstRowSite();
            $found = array_merge($found, $copies, $samples);
            $states = $this->compare($found, $known['entries'], $known['allowedColumns']);
        } finally {
            DB::rollBack();
        }

        $this->line('[audit] sites in the id dictionary: '.count($sites));
        foreach ($inspected as $t) {
            $this->line('[audit] inspected '.$t['table'].'.'.$t['column'].' — non-null rows '.$t['rows']
                .', of them JSON '.$t['jsonRows'].', max id '.($t['maxId'] ?? '-').($t['judged'] ? '' : ', no owning site: not judged'));
        }
        $this->line('[audit] tables not judged — no owning site, or no id to address a row by: '.json_encode(array_values(array_unique($skipped))));
        $this->line('[audit] copy-differs-from-owner: configs checked '.$copiesChecked.', fields '.json_encode(FieldOwners::derivedCopies()));
        $this->line('[audit] sample-of-another-site: analysis rows with inputs.samples '.$samplesChecked
            .'; keys resolving to no sample, not judged ('.count($unresolved).'): '.json_encode($unresolved));
        $this->line('[audit] violations named ('.count($found).'):');
        foreach ($found as $f) {
            $this->line('[audit]    '.$this->key($f).' (row owner '.$f['owner'].(isset($f['detail']) ? '; '.$f['detail'] : '').')');
        }
        foreach (['KNOWN', 'ALLOWED', 'NEW', 'REMOVED', 'BLIND'] as $state) {
            $this->line('[audit] '.$state.' ('.count($states[$state]).'): '.json_encode($states[$state]));
        }

        $red = count($states['NEW']) + count($states['REMOVED']) + count($states['BLIND']);
        $this->line($red ? '[audit] VERDICT: RED' : '[audit] VERDICT: GREEN');

        return $red ? self::FAILURE : self::SUCCESS;
    }

    /** @return array{entries: array<int,array<string,string>>, allowedColumns: array<string,string>}|null */
    private function loadKnown(): ?array
    {
        $option = $this->option('known');
        $path = $option && str_starts_with($option, '/') ? $option : base_path($option ?: self::KNOWN);
        $raw = @file_get_contents($path);
        $data = $raw === false ? null : json_decode($raw, true);
        if (! is_array($data) || ! isset($data['entries']) || ! is_array($data['entries'])) {
            $this->error('[audit] the recorded list is missing or unreadable: '.$path);

            return null;
        }
        foreach ($data['entries'] as $e) {
            if (! preg_match('/^GH-\d+\b/', (string) ($e['decision'] ?? ''))) {
                $this->error('[audit] every recorded entry needs a decision starting with GH-NNN: '.json_encode($e));

                return null;
            }
        }

        return ['entries' => $data['entries'], 'allowedColumns' => (array) ($data['allowedColumns'] ?? [])];
    }

    /**
     * Every JSON value, in every text-like column of every table, that equals the id of a site
     * other than the row's owner. The universe is the schema, listed each run.
     */
    private function census(array $sites): array
    {
        $found = [];
        $inspected = [];
        $skipped = [];
        foreach (Schema::getTables() as $table) {
            $name = $table['name'];
            $columns = Schema::getColumns($name);
            $names = array_column($columns, 'name');
            if (! in_array('id', $names, true)) {
                // No row address to name a finding by: listed, not silently passed over.
                $skipped[] = $name.' (no id column)';
                continue;
            }
            $ownerColumn = $name === 'sites' ? 'id' : (in_array('site_id', $names, true) ? 'site_id' : null);
            foreach ($columns as $col) {
                if (! in_array(strtolower((string) $col['type_name']), self::TEXT_TYPES, true)) {
                    continue;
                }
                $column = $col['name'];
                $rows = 0;
                $jsonRows = 0;
                $maxId = null;
                $query = DB::table($name)->select(array_values(array_unique(array_filter(['id', $ownerColumn, $column]))))
                    ->whereNotNull($column)->orderBy('id');
                foreach ($query->cursor() as $row) {
                    $rows++;
                    $id = (string) $row->id;
                    $later = ctype_digit($id) && $maxId !== null && ctype_digit($maxId)
                        ? (int) $id > (int) $maxId : strcmp($id, (string) $maxId) > 0;
                    $maxId = $maxId === null || $later ? $id : $maxId;
                    $decoded = $this->decode($row->{$column});
                    if ($decoded === null) {
                        continue;
                    }
                    $jsonRows++;
                    if ($ownerColumn === null) {
                        $skipped[] = $name;
                        continue;
                    }
                    $owner = (string) $row->{$ownerColumn};
                    foreach ($this->siteIdsIn($decoded, $sites) as [$path, $value]) {
                        if ($value !== $owner) {
                            $found[] = ['relation' => 'foreign-site-id', 'table' => $name, 'id' => $id, 'column' => $column,
                                'path' => $path, 'value' => $value, 'owner' => $owner];
                        }
                    }
                }
                // Every column considered is printed, with or without JSON in it: a column the
                // census never reached must not look the same as a column that was clean.
                $inspected[] = ['table' => $name, 'column' => $column, 'rows' => $rows,
                    'jsonRows' => $jsonRows, 'maxId' => $maxId, 'judged' => $ownerColumn !== null];
            }
        }

        return [$found, $inspected, $skipped];
    }

    /** Each copied field of each site's config against the `sites` column that owns it. */
    private function copiesAgainstOwners(): array
    {
        $found = [];
        $checked = 0;
        foreach (DB::table('site_configs')->where('namespace', 'gaip')->orderBy('id')->get(['id', 'site_id', 'config']) as $row) {
            $site = DB::table('sites')->where('id', $row->site_id)->first();
            $config = $this->decode($row->config) ?? [];
            if (! $site) {
                continue;
            }
            $checked++;
            foreach (FieldOwners::derivedCopies() as $field) {
                $column = FieldOwners::columnFor($field);
                $expected = FieldOwners::castForCopy($column, $site->{$column} ?? null);
                [$present, $actual] = $this->dig($config, $field);
                if ($present && $this->same($actual, $expected)) {
                    continue;
                }
                if (! $present && $expected === null) {
                    continue;
                }
                $found[] = ['relation' => 'copy-differs-from-owner', 'table' => 'site_configs', 'id' => (string) $row->id,
                    'column' => 'config', 'path' => $field, 'value' => $present ? json_encode($actual) : 'absent',
                    'owner' => (string) $row->site_id, 'detail' => 'sites.'.$column.' = '.json_encode($expected)];
            }
        }

        return [$found, $checked];
    }

    /** Each sample key an analysis row records against the row's own site. */
    private function samplesAgainstRowSite(): array
    {
        $found = [];
        $checked = 0;
        $unresolved = [];
        foreach (DB::table('analysis_results')->whereNotNull('inputs')->orderBy('id')->cursor() as $row) {
            $inputs = $this->decode($row->inputs) ?? [];
            if (! isset($inputs['samples']) || ! is_array($inputs['samples'])) {
                continue;
            }
            $checked++;
            foreach ($inputs['samples'] as $type => $key) {
                if (! (is_string($key) && $key !== '') && ! is_int($key) && ! is_float($key)) {
                    continue;
                }
                $key = (string) $key;
                $owners = SampleOwners::sitesOf($key);
                if ($owners === []) {
                    $unresolved[] = 'analysis_results#'.$row->id.' samples.'.$type.'='.$key;
                    continue;
                }
                if (! in_array((string) $row->site_id, $owners, true)) {
                    $found[] = ['relation' => 'sample-of-another-site', 'table' => 'analysis_results', 'id' => (string) $row->id,
                        'column' => 'inputs', 'path' => 'samples.'.$type, 'value' => $key,
                        'owner' => (string) $row->site_id, 'detail' => 'belongs to '.json_encode(array_values(array_unique($owners)))];
                }
            }
        }

        return [$found, $checked, $unresolved];
    }

    /** [present, value] at a dotted path. */
    private function dig(array $node, string $path): array
    {
        foreach (explode('.', $path) as $step) {
            if (! is_array($node) || ! array_key_exists($step, $node)) {
                return [false, null];
            }
            $node = $node[$step];
        }

        return [true, $node];
    }

    /** One comparison for a copy and its owner: numbers as numbers, everything else exactly. */
    private function same($a, $b): bool
    {
        if (is_numeric($a) && is_numeric($b)) {
            return abs((float) $a - (float) $b) < 1e-9;
        }

        return $a === $b;
    }

    private function decode($raw)
    {
        if (! is_string($raw)) {
            return null;
        }
        $t = ltrim($raw);
        if ($t === '' || ($t[0] !== '{' && $t[0] !== '[')) {
            return null;
        }
        $d = json_decode($t, true);

        return is_array($d) ? $d : null;
    }

    /** Every site id standing as a string value or as a key, with its path. */
    private function siteIdsIn(array $node, array $sites, string $prefix = ''): array
    {
        $out = [];
        foreach ($node as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix.'.'.$key;
            if (is_string($key) && isset($sites[$key])) {
                $out[] = [$path.'{key}', $key];
            }
            if (is_array($value)) {
                $out = array_merge($out, $this->siteIdsIn($value, $sites, $path));
            } elseif (is_string($value) && isset($sites[$value])) {
                $out[] = [$path, $value];
            }
        }

        return $out;
    }

    /**
     * NEW / REMOVED / BLIND against the recorded list. BLIND is decided by reading the listed
     * address DIRECTLY, past the sign: the value is there and the sign did not name it.
     */
    private function compare(array $found, array $entries, array $allowedColumns): array
    {
        $states = ['KNOWN' => [], 'ALLOWED' => [], 'NEW' => [], 'REMOVED' => [], 'BLIND' => []];
        $named = [];
        foreach ($found as $f) {
            $named[$this->key($f)] = $f;
        }
        $listed = [];
        foreach ($entries as $e) {
            $key = $this->key($e);
            $listed[$key] = true;
            if (isset($named[$key])) {
                $states['KNOWN'][] = $key.' ('.$e['decision'].')';
                continue;
            }
            $states[$this->stillThere($e) ? 'BLIND' : 'REMOVED'][] = $key;
        }
        foreach ($named as $key => $f) {
            if (isset($listed[$key])) {
                continue;
            }
            if (($f['relation'] ?? 'foreign-site-id') === 'foreign-site-id' && isset($allowedColumns[$f['table'].'.'.$f['column']])) {
                $states['ALLOWED'][] = $key;
                continue;
            }
            $states['NEW'][] = $key;
        }

        return $states;
    }

    /**
     * Is the recorded violation still there? Read directly, one row, past the walk that named
     * the violations.
     */
    private function stillThere(array $e): bool
    {
        $relation = $e['relation'] ?? 'foreign-site-id';
        if ($relation === 'copy-differs-from-owner') {
            $config = $this->decode(DB::table('site_configs')->where('id', $e['id'])->value('config')) ?? [];
            [$present, $actual] = $this->dig($config, $e['path']);
            if (($present ? json_encode($actual) : 'absent') !== $e['value']) {
                return false;
            }
            $siteId = DB::table('site_configs')->where('id', $e['id'])->value('site_id');
            $column = FieldOwners::columnFor($e['path']);
            $expected = FieldOwners::castForCopy($column, DB::table('sites')->where('id', $siteId)->value($column));

            return ! ($present && $this->same($actual, $expected));
        }
        if ($relation === 'sample-of-another-site') {
            if ($this->readAddress($e) !== $e['value']) {
                return false;
            }
            $siteId = (string) DB::table('analysis_results')->where('id', $e['id'])->value('site_id');
            $owners = SampleOwners::sitesOf($e['value']);

            return $owners !== [] && ! in_array($siteId, $owners, true);
        }

        return $this->readAddress($e) === $e['value'];
    }

    /** The value at a recorded address, read without the sign. */
    private function readAddress(array $e): ?string
    {
        $raw = DB::table($e['table'])->where('id', $e['id'])->value($e['column']);
        $node = is_string($raw) ? json_decode($raw, true) : null;
        foreach (explode('.', $e['path']) as $step) {
            if (str_ends_with($step, '{key}')) {
                $k = substr($step, 0, -5);

                return is_array($node) && array_key_exists($k, $node) ? $k : null;
            }
            if (! is_array($node) || ! array_key_exists($step, $node)) {
                return null;
            }
            $node = $node[$step];
        }

        return is_string($node) ? $node : null;
    }

    private function address(array $e): string
    {
        return $e['table'].'#'.$e['id'].'.'.$e['column'].':'.$e['path'];
    }

    private function key(array $e): string
    {
        return ($e['relation'] ?? 'foreign-site-id').' '.$this->address($e).'='.$e['value'];
    }
}
