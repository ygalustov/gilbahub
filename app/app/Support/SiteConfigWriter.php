<?php

namespace App\Support;

use App\Models\SiteConfig;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * GH-447 — the one way a site's config column changes.
 *
 * Every write here is read-modify-write: something reads the stored config,
 * changes part of it and writes the column back. Two of those overlapping is
 * how GH-442 lost whole patches -- six concurrent requests, six 200s, four
 * keys in the database -- and the fix was a transaction with a row lock. Two
 * such places existed; the second was found only because it was looked for.
 *
 * So the lock stops being a rule each caller has to remember and becomes the
 * only door: this class takes the row under `lockForUpdate`, hands the current
 * config to the caller's closure, and stores what comes back. A structural
 * test (tests/gh447-one-config-writer.test.js) asserts that nothing else
 * writes the column at all -- not "writes it with a lock", but writes it.
 *
 * The closure must be pure bookkeeping: it runs inside the transaction, so no
 * HTTP calls and no work that can block.
 */
class SiteConfigWriter
{
    /**
     * Change a site's config under a row lock.
     *
     * The closure receives the stored config (an empty array when the row does
     * not exist yet) and returns what to store. Returning null leaves the row
     * untouched, which is how a caller says "on second thoughts, nothing to
     * do" without a second query.
     *
     * $syncedAt overrides the stamp for callers that record when the data was
     * produced rather than when it was stored (the analysis cache).
     *
     * @param  Closure(array): ?array  $mutator
     * @return SiteConfig|null  the stored row, or null when the mutator declined
     */
    public static function mutate(string $siteId, string $namespace, Closure $mutator, ?string $syncedAt = null): ?SiteConfig
    {
        return DB::transaction(function () use ($siteId, $namespace, $mutator, $syncedAt) {
            $row = SiteConfig::query()
                ->where('site_id', $siteId)
                ->where('namespace', $namespace)
                ->lockForUpdate()
                ->first();

            $current = is_array($row?->config) ? $row->config : [];
            $next = $mutator($current);

            if ($next === null) {
                return $row;
            }

            return SiteConfig::query()->updateOrCreate(
                ['site_id' => $siteId, 'namespace' => $namespace],
                ['config' => $next, 'synced_at' => $syncedAt ?? now()],
            );
        });
    }

    /**
     * Create the empty config row a brand-new site starts with.
     *
     * Separate from mutate() because it is not a read-modify-write: there is
     * nothing to read, and no other writer can be holding a row that does not
     * exist yet. It goes through this class anyway so that "who writes the
     * config column" has exactly one answer.
     */
    public static function createEmpty(string $siteId, string $namespace = 'gaip'): SiteConfig
    {
        return SiteConfig::query()->firstOrCreate(
            ['site_id' => $siteId, 'namespace' => $namespace],
            ['config' => (object) [], 'synced_at' => now()],
        );
    }
}
