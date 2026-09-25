<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
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
        $answers = [
            'location.lat' => -35.28,
            'location.lon' => 149.13,
            'turf.turfType' => 'sports',
            'turf.species' => 'Perennial Ryegrass',
            'turf.variety' => 'generic',
            'turf.construction' => 'native_soil',
            'turf.methodology' => 'slan',
        ];

        foreach (\App\Support\CalculationInputs::requiredFor($config['turf']['turfType'] ?? 'sports') as $key) {
            if (! array_key_exists($key, $answers)) {
                // An input the list requires and this helper does not answer. Named rather than
                // skipped: the fixture would be incomplete and every page test would redirect again,
                // and the reason would be a value nobody declared here.
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
     * GH-708 — the same answers, written onto a site that already exists.
     *
     * Most of the fixtures the lock stopped do not build a gaip config at all: their subject is a
     * page, and a page used to be drawn for a site that had answered nothing. One call gives the site
     * what the lock needs and leaves everything the fixture did say alone.
     */
    protected function giveTheSiteWhatTheLockNeeds(\App\Models\Site $site): void
    {
        $row = \App\Models\SiteConfig::query()
            ->where('site_id', $site->id)->where('namespace', 'gaip')->first();
        $config = is_array($row?->config) ? $row->config : [];
        $config = $this->configThePageLockAccepts($config);

        if ($row) {
            $row->forceFill(['config' => $config])->save();

            return;
        }
        \App\Models\SiteConfig::query()->create([
            'site_id' => $site->id, 'namespace' => 'gaip', 'config' => $config, 'synced_at' => now(),
        ]);
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
