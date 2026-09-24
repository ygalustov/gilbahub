<?php

namespace App\Support;

use App\Models\Site;
use Illuminate\Http\Request;

/**
 * GH-663 (queue item 3ak, the analyst's section 29.3 layer 1) — WHICH SITE A PAGE
 * IS RENDERED FOR, DECIDED IN ONE PLACE.
 *
 * WHY THIS EXISTS. The run frame is opened as `/hub?rerun=<id>&site=<A>`, but the
 * page was rendered from the user's pointer, `users.last_active_site_id`. Both
 * `layouts/app.blade.php` and `hub.blade.php` reached for `auth()->user()->activeSite`
 * on their own, so the config, the location, `GAIP_HUB_CONFIG.activeSiteId` and,
 * through it, the samples all came from whatever the user was looking at — while
 * `?site=` decided only the address the result was filed under.
 *
 * MEASURED, NOT REASONED ABOUT (GH-660, GH-661): with the pointer on `Westview`
 * and the frame opened for `Burns`, the page reported Westview's id, Westview's
 * coordinates, Westview's species and Westview's samples; the write that was held
 * instead of sent carried `site_id: Burns` with Westview's soil sample 118, its
 * sample date, its soil temperature and its warm-season disease. That is GH-459
 * with a second address: the right curve on another site's temperatures, with
 * annual totals that still agree because the annual figure is normalised.
 *
 * THE RULE, and it has exactly two branches:
 *   - a request that carries BOTH `rerun` and `site` is a run frame, and it is
 *     rendered for the site the parameter names;
 *   - anything else is rendered for the pointer, exactly as before.
 *
 * NO FALLING BACK TO THE POINTER WHEN THE PARAMETER CANNOT BE HONOURED. An
 * unreachable or unknown site is refused, because falling back is the defect
 * itself: it is how a frame asked for one site came to compute another. The
 * refusal is the API's own rule — `Site` by id or slug, admins see all, everyone
 * else must be attached — so `/hub?site=<somebody else's>` cannot render a site
 * its viewer may not see.
 *
 * THE POINTER IS NEVER MOVED HERE. A frame that wrote `last_active_site_id` would
 * switch the site under the user's other tab, which is the same defect running
 * backwards.
 */
class PageSite
{
    /**
     * The site this request's page is rendered for, or null when the user has no
     * pointer and no parameter was given.
     */
    public static function forRequest(?Request $request = null): ?Site
    {
        $request = $request ?: request();
        $user = $request?->user();
        if (! $user) {
            return null;
        }

        $asked = self::askedFor($request);
        if ($asked === null) {
            return $user->activeSite;
        }

        // A run frame. The parameter decides, and a parameter that cannot be
        // honoured is an outcome rather than a reason to use the pointer.
        $site = Site::query()
            ->where(function ($q) use ($asked) {
                $q->where('id', $asked)->orWhere('slug', $asked);
            })
            ->first();

        abort_unless($site, 404);
        abort_unless($user->canViewSite($site), 403);

        return $site;
    }

    /**
     * The site a run frame asked for, or null when this request is not one.
     *
     * BOTH PARAMETERS ARE REQUIRED, because that is what the opener sends and
     * what the runner reads: `?rerun=` alone has no address to file under, and
     * `?site=` alone is not a run. Treating a lone `?site=` as a frame would give
     * any page a second way to choose its site, which is the shape this removes.
     */
    private static function askedFor(Request $request): ?string
    {
        $rerun = trim((string) $request->query('rerun', ''));
        $site = trim((string) $request->query('site', ''));

        return ($rerun !== '' && $site !== '') ? $site : null;
    }

    /**
     * Whether this request is a run frame — for the places that need to say so
     * without resolving the site again.
     */
    public static function isRunFrame(?Request $request = null): bool
    {
        $request = $request ?: request();

        return $request ? self::askedFor($request) !== null : false;
    }
}
