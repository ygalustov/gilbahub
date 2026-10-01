<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Carbon;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * GH-708 (item 3bk, part 3) — A SITE THE WIZARD LOCK LETS THROUGH.
     *
     * The lock redirects every page of a site that has not answered what the calculation needs, by
     * the owner's decision of 24.09.2026, and that changed the precondition of every page test at
     * once: thirty-one cases in ten files were drawing pages for sites their fixtures had left
     * incomplete. Those fixtures were preconditions, not subjects — the tests are about a plan page,
     * a notice, a frame — so this puts the answers in rather than each file inventing its own set.
     *
     * IT ADDS AND NEVER OVERWRITES. A test whose subject IS a missing input passes its own value and
     * keeps it; `SiteApiTest` and `Gh533TurfProfileAnalyseTest` rest on an absent methodology and
     * must not be touched.
     *
     * The seven are not written out here either: they come from `CalculationInputs`, the one list, so
     * a test fixture cannot fall behind what the product requires. Values are the shapes the product
     * already uses; a value the list does not know about would be inventing data.
     *
     * @param  array<string,mixed>  $config  what the test itself wants the config to say
     * @return array<string,mixed>
     */
    protected function configThePageLockAccepts(array $config = []): array
    {
        $answers = $this->answersThePageLockAccepts();

        foreach (\App\Support\CalculationInputs::requiredFor($config['turf']['turfType'] ?? 'sports') as $key) {
            if (! array_key_exists($key, $answers)) {
                // An input the list requires and this helper does not answer. Named rather than
                // skipped: the fixture would be incomplete and every page test would redirect again,
                // and the reason would be a value nobody declared here.
                continue;
            }
            /**
             * GH-797 — AN INPUT STORED SOMEWHERE ELSE IS NOT WRITTEN INTO THE CONFIG.
             *
             * `explode` would have put `sites.soil_texture_override` at `$config['sites']`, which is
             * nowhere: the lock reads the column, the fixture would still be short of it, and every page
             * test of a site built by this helper would redirect. GH-789 is where that cost was measured
             * — a skipped input sent 64 page tests into the wizard.
             */
            if (! in_array('config', \App\Support\CalculationInputs::storedIn($key) ?? [], true)) {
                continue;
            }
            [$section, $field] = explode('.', $key, 2);
            if (($config[$section][$field] ?? null) !== null) {
                continue;
            }
            $config[$section][$field] = $answers[$key];
        }

        return $config;
    }

    /**
     * GH-797 (queue item 3ashch): the answers themselves, in ONE place.
     *
     * They were a literal inside the config half, and the soil texture is not kept in a config -- so the
     * column half would have carried a second copy of the same answer, which is the kind of pair that
     * drifts. Keyed by the input's own name, as the list names it; where each one is written is decided by
     * `storedIn`, not here.
     *
     * @return array<string,mixed>
     */
    protected function answersThePageLockAccepts(): array
    {
        return [
            'location.lat' => -35.28,
            'location.lon' => 149.13,
            'turf.turfType' => 'sports',
            'turf.species' => 'Perennial Ryegrass',
            'turf.variety' => 'generic',
            'turf.construction' => 'native_soil',
            'turf.methodology' => 'slan',
            /**
             * GH-789 (queue item 7): the match and training schedule, which the list requires of a SPORTS
             * surface and the setup wizard now asks for — so the lock holds a sports site without one, and 64
             * page tests began redirecting the moment the wizard step was declared. Nought and nought is what
             * the owner entered on the stand's own sports sites on 30.09.2026, by the product's route: a week
             * with no load, which is an answer and not an absence.
             */
            'traffic.schedule' => ['matchesPerWeek' => 0, 'sessionsPerWeek' => 0],
            /**
             * GH-789 (queue item 7): the surface of a GOLF site. The list declared `wizard.step: 2` for it
             * in golf's own branch all along and nothing read that declaration, so the lock did not ask for
             * a golf surface and the setup wizard held it with a line of its own. The reader reads the
             * branch now, so a golf site without one is held -- and a fixture for a golf page needs it.
             * It is filled only where it is required: for sports the obligation is the owner's open
             * question, and for a lawn there is none.
             */
            'turf.subCategory' => 'greens',
            /**
             * GH-797 (queue item 3ashch): the soil texture, which the owner made required on 01.10.2026.
             * It is NOT written into the config — the list keeps it in a column of `sites`, and
             * `giveTheSiteWhatTheLockNeeds` puts it there. A value from the list's own six.
             */
            'sites.soil_texture_override' => 'sand',
        ];
    }

    /**
     * GH-797 (queue item 3ashch) — the same answers for the inputs the list keeps in a column of `sites`.
     *
     * Column to value, so a caller writes the row rather than guessing which key is which column. Only
     * the inputs required of this turf type, and only those this helper has an answer for — the rule the
     * config half above follows.
     *
     * @return array<string,mixed>
     */
    protected function columnsThePageLockAccepts(string $turfType = 'sports'): array
    {
        $answers = $this->answersThePageLockAccepts();

        $out = [];
        foreach (\App\Support\CalculationInputs::requiredFor($turfType) as $key) {
            $column = \App\Support\CalculationInputs::siteColumnOf($key);
            if ($column === null || ! array_key_exists($key, $answers)) {
                continue;
            }
            $out[$column] = $answers[$key];
        }

        return $out;
    }

    /**
     * GH-708 — the same answers, written onto a site that already exists.
     *
     * Most of the fixtures the lock stopped do not build a gaip config at all: their subject is a
     * page, and a page used to be drawn for a site that had answered nothing. One call gives the site
     * what the lock needs and leaves everything the fixture did say alone.
     *
     * GH-797 (queue item 3ashch): and what the lock needs is no longer all in the config. The soil texture
     * is a column of `sites`, so it is written onto the row — still adding and never overwriting, so a
     * fixture whose subject IS an empty texture keeps it.
     */
    protected function giveTheSiteWhatTheLockNeeds(\App\Models\Site $site): void
    {
        $row = \App\Models\SiteConfig::query()
            ->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $config = is_array($row?->config) ? $row->config : [];
        $config = $this->configThePageLockAccepts($config);

        $columns = [];
        foreach ($this->columnsThePageLockAccepts($config['turf']['turfType'] ?? 'sports') as $column => $value) {
            $held = $site->getAttributes()[$column] ?? null;
            if ($held === null || trim((string) $held) === '') {
                $columns[$column] = $value;
            }
        }
        if ($columns !== []) {
            $site->forceFill($columns)->save();
        }

        if ($row) {
            $row->forceFill(['config' => $config])->save();

            return;
        }
        \App\Models\SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config, 'synced_at' => now(),
        ]);
    }

    /**
     * GH-791 (queue item 3gp) — THE CLOCK A CASE ABOUT A STORED ROW RUNS ON.
     *
     * WHY THIS EXISTS. Five cases in four files assert that the analysis panel says nothing about a run that
     * went well, and each builds its row with a date written into the fixture. The panel warns when a row is
     * more than two days old (`AnalysisNotice::STALE_AFTER_DAYS`, the age taken from `Carbon::now()`), so from
     * the third day after those dates all five went red with "Analysis data is N days old" -- and the number
     * in the sentence grew with the wall clock. Opened by running them: each of the five fails on that
     * sentence and on nothing else, and the panel's gates are ordered no-data, failure, partial, age, so
     * reaching the age branch proves the row was complete. The product is right; the fixtures had a date and
     * the clock was free.
     *
     * WHAT IT DOES. The case states the row's own stamp and HOW OLD it wants the row to be; the clock is
     * pinned there. So a case that means "a run from just now" says so, and one that means "four days ago"
     * says that -- the age becomes part of what the case asserts instead of a property of the day it runs on.
     *
     * THE DATES IN THE FIXTURES ARE NOT UPDATED, deliberately: a newer date reddens again two days later,
     * which is the same defect with a later alarm.
     *
     * PER CASE AND NOT PER FILE. `Gh548AnalysisNoticeTest` carries two dates -- `2026-09-18` on its other
     * cases, `2026-09-22` on this one -- and they are green for their own reasons. One clock pinned for the
     * whole file would break what it was meant to protect.
     *
     * @param  string  $analyzedAt  the stamp the row carries
     * @param  int  $daysOld  how old the row is at the moment the case looks at it
     */
    protected function clockAtRowAge(string $analyzedAt, int $daysOld = 0): void
    {
        if (trim($analyzedAt) === '') {
            throw new RuntimeException(
                'clockAtRowAge needs the row\'s own stamp. A case that pins the clock to nothing pins it to '
                .'the day it runs on, which is the defect this helper exists to remove.'
            );
        }
        if ($daysOld < 0) {
            throw new RuntimeException('clockAtRowAge: a row cannot be read before it was written.');
        }

        Carbon::setTestNow(Carbon::parse($analyzedAt)->addDays($daysOld));
    }

    /**
     * GH-791: and the clock is let go after every case, whether it was pinned or not.
     *
     * Laravel's own `TestCase` does not reset `Carbon::setTestNow` here -- measured, there is no call to it in
     * its `tearDown` -- so a pinned clock would leak into whatever ran next in the same process, and the next
     * case's failure would be about a time nobody set.
     */
    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function createApplication()
    {
        putenv('APP_ENV=testing');
        putenv('DB_CONNECTION=sqlite');
        putenv('DB_DATABASE=:memory:');
        putenv('CACHE_STORE=array');
        putenv('QUEUE_CONNECTION=sync');
        putenv('SESSION_DRIVER=array');

        $_ENV['APP_ENV'] = 'testing';
        $_ENV['DB_CONNECTION'] = 'sqlite';
        $_ENV['DB_DATABASE'] = ':memory:';
        $_ENV['CACHE_STORE'] = 'array';
        $_ENV['QUEUE_CONNECTION'] = 'sync';
        $_ENV['SESSION_DRIVER'] = 'array';

        $_SERVER['APP_ENV'] = 'testing';
        $_SERVER['DB_CONNECTION'] = 'sqlite';
        $_SERVER['DB_DATABASE'] = ':memory:';
        $_SERVER['CACHE_STORE'] = 'array';
        $_SERVER['QUEUE_CONNECTION'] = 'sync';
        $_SERVER['SESSION_DRIVER'] = 'array';

        $app = require dirname(__DIR__).'/bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();

        if ($app['config']->get('database.default') !== 'sqlite' || $app['config']->get('database.connections.sqlite.database') !== ':memory:') {
            throw new RuntimeException('Tests are misconfigured: refusing to run against a non-SQLite database.');
        }

        return $app;
    }
}
