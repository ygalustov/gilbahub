<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * GH-682 — WHAT EVERY PAGE BEHIND THE LOGIN DOES FOR A USER WITH NO SITE.
 *
 * WHY THIS IS A SERVER MEASUREMENT AND NOT A CLICK. A person whose account has no site yet is
 * an ordinary state -- the first minute of every account -- and the question is which pages
 * FAIL or send them somewhere unintended. That does not need a browser or the live stand: the
 * suite has its own `sqlite :memory:` database, so the user is created there and lives until
 * the test ends. Nothing on the stand is touched and no site is created.
 *
 * THE UNIVERSE IS THE ROUTE TABLE, not a list written here. Every GET route whose middleware
 * requires a login is walked; a route that needs a parameter is NAMED as skipped rather than
 * left out silently, because a skipped route and a route nobody thought of look the same in a
 * list of results.
 *
 * WHAT IS PRINTED PER ROUTE: the status, where it redirected if it did, and the first line of
 * the failure if the render fell over. WHAT IS ASSERTED: that the walk reached a real number of
 * routes -- a measurement over two of them would be green and worthless -- and that no page
 * answers 5xx. A page that does is the finding this was taken for, and it arrives as a red with
 * its own name rather than as a line in a report nobody re-reads.
 */
class Gh682ViewsForAUserWithNoSiteTest extends TestCase
{
    use RefreshDatabase;

    /** A route that needs a parameter is not walked, and says so. */
    private function parameterised(string $uri): bool
    {
        return str_contains($uri, '{');
    }

    public function test_every_page_behind_the_login_answers_for_a_user_with_no_site(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $this->assertSame(0, $user->sites()->count(), 'the measurement needs a user with NO site');

        $walked = [];
        $skipped = [];
        $failures = [];

        foreach (Route::getRoutes() as $route) {
            if (! in_array('GET', $route->methods(), true)) {
                continue;
            }
            $middleware = $route->gatherMiddleware();
            $behindLogin = collect($middleware)->contains(
                fn ($m) => is_string($m) && (str_contains($m, 'auth') || str_contains($m, 'Authenticate'))
            );
            if (! $behindLogin) {
                continue;
            }
            $uri = '/'.ltrim($route->uri(), '/');
            if ($this->parameterised($uri)) {
                $skipped[] = $uri.' ('.($route->getName() ?? 'unnamed').')';
                continue;
            }

            /**
             * THE WALK MUST NOT LEAVE A TRAIL IN ITS OWN MEASUREMENT. The first run printed
             * `/api/site-summaries -> /api/samples` and `/api/field-log/entries ->
             * /api/site-summaries`: every route appeared to redirect to the PREVIOUS one I had
             * asked for. That is `back()` reading the session's previous URL -- an artefact of
             * requesting them in a row, not a fact about the product. The session is flushed
             * and the referer is fixed, so a `back()` target is the same every time and says
             * what it really is.
             */
            /**
             * AN API ROUTE IS ASKED AS AN API, and asking it for HTML was my own artefact: six
             * `/api/*` GET routes came back 302 in the first reading, which looked like
             * endpoints redirecting a JSON caller. They do not -- asked with
             * `Accept: application/json` the same route answers 422 JSON, with or without a
             * site. The redirect was Laravel sending an HTML request back, because I had asked
             * an API for a page.
             */
            $this->flushSession();
            $asJson = str_starts_with($uri, '/api/');
            $response = $asJson
                ? $this->actingAs($user)->from('/dashboard')->getJson($uri)
                : $this->actingAs($user)->from('/dashboard')->get($uri);
            $status = $response->getStatusCode();
            $to = $response->headers->get('Location');
            $row = [
                'uri' => $uri.($asJson ? ' (json)' : ''),
                'status' => $status,
                'redirectedTo' => $to,
            ];
            if ($status >= 500) {
                // The first line only: a stack trace in a measurement's output buries the one
                // fact a reader needs, which is WHICH page and WHY.
                $e = $response->exception;
                $row['broke'] = $e ? substr(explode("\n", $e->getMessage())[0], 0, 160) : 'no exception recorded';
                $failures[] = $uri.' -> '.$status.': '.$row['broke'];
            }
            $walked[] = $row;
        }

        fwrite(STDOUT, PHP_EOL.'[gh682] routes behind the login, walked as a user with NO site: '
            .count($walked).' | parameterised, not walked: '.count($skipped).PHP_EOL);
        foreach ($walked as $row) {
            fwrite(STDOUT, '[gh682]    '.str_pad($row['uri'], 26).' '.$row['status']
                .($row['redirectedTo'] ? '  -> '.$row['redirectedTo'] : '')
                .(isset($row['broke']) ? '  BROKE: '.$row['broke'] : '').PHP_EOL);
        }
        foreach ($skipped as $s) {
            fwrite(STDOUT, '[gh682]    skipped (needs a parameter): '.$s.PHP_EOL);
        }

        // The universe is real before anything is claimed about it.
        $this->assertGreaterThan(8, count($walked), 'the walk found almost no routes — the universe, not the pages, is what failed');

        // The finding, if there is one, arrives named.
        $this->assertSame([], $failures, 'a page behind the login fell over for a user with no site');
    }

    /**
     * THE DIFFERENTIATOR, and without it the finding above would be misattributed.
     *
     * A user with no site is sent from `/dashboard` to `/no-access` while every other page
     * answers. Two different causes produce that: having no SITE, or the ACCOUNT not being
     * approved -- and `/no-access` is the same door for both. So the same request is made by a
     * user who differs in exactly one thing, the site, and the two answers are printed side by
     * side. Without the pair, "no site sends you to no-access" is a guess with a redirect
     * attached to it.
     */
    public function test_the_same_page_for_a_user_who_differs_only_by_having_a_site(): void
    {
        $without = User::factory()->create(['is_admin' => false]);
        $with = User::factory()->create(['is_admin' => false]);
        // Built the way `SiteApiTest` builds one: there is no site factory, `id` is not
        // fillable, and the link carries a role.
        $account = \App\Models\Account::firstOrCreate(
            ['name' => 'gh682'],
            ['owner_user_id' => $with->id]
        );
        $site = new \App\Models\Site();
        $site->forceFill([
            'id' => 'gh682-site',
            'account_id' => $account->id,
            'name' => 'GH-682 site',
            'slug' => 'gh682-site',
            'site_type' => 'precinct',
            'created_by_user_id' => $with->id,
            'modified_by_user_id' => $with->id,
        ])->save();
        $site->users()->attach($with->id, ['role' => 'manager']);

        $this->flushSession();
        $a = $this->actingAs($without)->from('/dashboard')->get('/dashboard');
        $this->flushSession();
        $b = $this->actingAs($with)->from('/dashboard')->get('/dashboard');

        fwrite(STDOUT, PHP_EOL.'[gh682] /dashboard for a user with NO site : '.$a->getStatusCode()
            .($a->headers->get('Location') ? ' -> '.$a->headers->get('Location') : '').PHP_EOL
            .'[gh682] /dashboard for a user WITH a site: '.$b->getStatusCode()
            .($b->headers->get('Location') ? ' -> '.$b->headers->get('Location') : '').PHP_EOL);

        /**
         * THE SAME PAIR FOR AN API ENDPOINT, because six of them answered with a REDIRECT and a
         * redirect is not an answer a JSON caller can read. Whether that is about the missing
         * site is the same question as above and it is settled the same way.
         */
        $this->flushSession();
        $c = $this->actingAs($without)->from('/dashboard')->getJson('/api/site-summaries');
        $this->flushSession();
        $d = $this->actingAs($with)->from('/dashboard')->getJson('/api/site-summaries');
        fwrite(STDOUT, '[gh682] /api/site-summaries for NO site : '.$c->getStatusCode()
            .($c->headers->get('Location') ? ' -> '.$c->headers->get('Location') : '')
            .' | content-type '.($c->headers->get('Content-Type') ?: 'none').PHP_EOL
            .'[gh682] /api/site-summaries WITH a site : '.$d->getStatusCode()
            .($d->headers->get('Location') ? ' -> '.$d->headers->get('Location') : '')
            .' | content-type '.($d->headers->get('Content-Type') ?: 'none').PHP_EOL);

        // Both are printed whatever they are; what is asserted is that the pair is REAL --
        // the two users differ in one thing and the request is the same.
        $this->assertSame(0, $without->sites()->count());
        $this->assertSame(1, $with->sites()->count());
    }
}
