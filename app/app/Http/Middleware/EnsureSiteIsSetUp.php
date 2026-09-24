<?php

namespace App\Http\Middleware;

use App\Support\CalculationInputs;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * GH-684 (item 3bk, analyst 89.7 place 3) — A PAGE IS NOT SHOWN FOR A SITE THAT IS NOT SET UP.
 *
 * The owner's decision is that methodology is required everywhere, for old sites and new, and
 * that the obligation is held by a wizard nobody can leave: "Skip Setup" goes, and reloading the
 * page opens the wizard again. A client-side wizard alone cannot hold that — a reload, a typed
 * address or a stale tab walks around it — so the lock is on the server.
 *
 * WHICH INPUTS HOLD IT IS NOT WRITTEN HERE. They are the ones the inputs list calls required for
 * the site's turf type, read through `CalculationInputs::requiredFor()`. A list written in this
 * file would be a second declaration of the same fact and would drift: when root depth stops
 * being required by the owner's decision, this lock follows without being touched.
 *
 * WHAT IS EXCEPT, and each for a reason rather than for convenience:
 *   - the wizard's own page, or the lock would redirect to itself;
 *   - switching site, or a person whose active site is incomplete could never reach a complete one;
 *   - the API, which answers JSON: a redirect there is not an answer a caller can read, and the
 *     pages are what the decision is about;
 *   - logging out.
 *
 * THE BOUNDARY, named by the analyst three times and not dissolved: a user WITHOUT WRITE ACCESS
 * on an incomplete site is locked in a wizard that cannot save. There are no such users today.
 */
class EnsureSiteIsSetUp
{
    /** Route names the lock does not apply to, each with why. */
    private const EXCEPT = [
        'dashboard' => 'the wizard opens on the dashboard; locking it would redirect to itself',
        'logout' => 'a person must be able to leave',
        'no-access' => 'the door shown to an account that has no site at all',
        'pending' => 'an account waiting for approval has no site to set up',
        'account' => 'switching site lives here; locking it would trap a person on one incomplete site',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return $next($request);
        }
        $name = $request->route()?->getName();
        if ($name !== null && array_key_exists($name, self::EXCEPT)) {
            return $next($request);
        }

        $site = $request->user()?->activeSite;
        if (! $site) {
            // Nothing to set up; a user with no site at all is another question and another door.
            return $next($request);
        }

        if (self::missingInputs($site) === []) {
            return $next($request);
        }

        return redirect()->route('dashboard', ['setup' => '1']);
    }

    /**
     * The required inputs this site has not answered, by the list's own names.
     *
     * @return string[]
     */
    public static function missingInputs($site): array
    {
        $site->load('configs');
        $record = $site->configs()->where('namespace', 'gaip')->first();
        $config = is_array($record?->config) ? $record->config : [];
        $turfType = $config['turf']['turfType'] ?? null;

        /**
         * GH-684 — REQUIRED AND ASKED BY THE WIZARD. The coordinator's rule of 24.09.2026, and it
         * is derived rather than written: an input holds this only if some wizard step collects it,
         * which is what its own `filledIn` says.
         *
         * `traffic.schedule` is the case that made the rule necessary. It is required for a sports
         * site and the wizard asks for it on no step, so before this it appeared here forever: the
         * list would never be empty, the wizard would open on every load and nothing in it could
         * answer. Measured on a sports site whose every other input was filled -- "a complete site
         * is told: [traffic.schedule]". Locking or reopening on a question nobody can be asked
         * makes the product unreachable with no way out.
         *
         * IT STAYS REQUIRED. What it no longer does is hold this gate; the calculation and the
         * panel that names an incomplete run read `requiredFor` and still want it.
         */
        $forWizard = CalculationInputs::wizardStepsFor(is_string($turfType) ? $turfType : '');
        $asked = $forWizard['byStep'] === [] ? [] : array_merge(...array_values($forWizard['byStep']));

        $missing = [];
        foreach (CalculationInputs::requiredFor(is_string($turfType) ? $turfType : '') as $key) {
            if (! in_array($key, $asked, true)) {
                continue;
            }
            if (self::isBlank(self::valueAt($config, $key))) {
                $missing[] = $key;
            }
        }

        return $missing;
    }

    /**
     * GH-684 (item 3bk) — the values this site HAS for the given inputs, by the list's own names.
     *
     * The wizard opens with what is already known filled in, and this is where those values come
     * from: the same config, read by the same reader as the one that decides what is missing. A
     * second reader that spelled a path differently would answer "missing" and "here is your
     * value" about the same field.
     *
     * @param  string[]  $keys
     * @return array<string, mixed>
     */
    public static function answersFor($site, array $keys): array
    {
        $record = $site?->configs()->where('namespace', 'gaip')->first();
        $config = is_array($record?->config) ? $record->config : [];

        $out = [];
        foreach ($keys as $key) {
            $value = self::valueAt($config, $key);
            if (! self::isBlank($value)) {
                $out[$key] = $value;
            }
        }

        return $out;
    }

    /** `turf.species` and the like, read out of the config by the list's own key. */
    private static function valueAt(array $config, string $key)
    {
        $at = $config;
        foreach (explode('.', $key) as $step) {
            if (! is_array($at) || ! array_key_exists($step, $at)) {
                return null;
            }
            $at = $at[$step];
        }

        return $at;
    }

    /**
     * WHAT COUNTS AS ANSWERED. `generic` counts, by the owner's decision of 24.09.2026 17:32 —
     * a person may choose it deliberately and it is filled. An empty string and a null do not.
     */
    private static function isBlank($value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return trim($value) === '';
        }
        if (is_array($value)) {
            return $value === [];
        }

        return false;
    }
}
