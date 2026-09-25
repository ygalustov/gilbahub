<?php

namespace Tests\Feature;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Router;
use Tests\TestCase;

/**
 * GH-711 — EVERY WAY A WRITE REACHES THE SERVER, TAKEN FROM THE FRAMEWORK'S OWN REGISTRY.
 *
 * The four guards of the frame's site proved that four declared layers turn red; they did not
 * prove there are four ways to write. The claim this file holds is the other half: the set of
 * write routes, and for each the place its site comes from, equals the recorded list — both
 * ways. The universe is the route registry, which no request can go round, not a list of
 * names; a route added tomorrow in any file is named here without anyone editing a list.
 *
 * SIGN A, VERSIONED. A route is a write path when it answers any of the methods in
 * `SIGN['methods']`. Where its site comes from is read off the handler's own source: `{site}`
 * in the address is `url`; a `site_id` / `site_identifier` read is `body`; an `activeSite` /
 * `active_site_id` read is `pointer`; none of them is `none`. The recorded list carries the
 * sign it was measured under; a sign changed without a new version is red, and growth under
 * the same version is printed apart from growth brought by a new one. Changing the sign is an
 * announced event, not a quiet edit.
 *
 * The page half — which script calls which of these routes — is `tests/gh711-page-write-calls`,
 * reading the route list from the same recorded file this test proves equal to the registry.
 *
 * WHAT THIS DOES NOT SEE, said before the first run:
 *   - writes that are not HTTP: commands and queued jobs, classified by hand if ever;
 *   - where the site really comes from at run time: `siteFrom` is read off source text, so a
 *     handler that takes its site through a helper the text does not name reads as `none`.
 *     That half is measured only by behaviour — the frame invariant, which this delivery
 *     does not build;
 *   - a trace already lying in the data — that is `gilba:audit-data`.
 */
class Gh711WritePathsTest extends TestCase
{
    /** The sign in force. Change `methods` and you change `version`: that is the rule. */
    private const SIGN = ['version' => 1, 'methods' => ['DELETE', 'PATCH', 'POST', 'PUT']];

    private const INVENTORY = 'tests/fixtures/gh711-write-paths.json';

    /** @return array<string,array{siteFrom:string, handler:string}> */
    private function census(array $methods): array
    {
        $out = [];
        foreach (Router::getRoutes() as $route) {
            /** @var Route $route */
            $write = array_values(array_intersect($route->methods(), $methods));
            if ($write === []) {
                continue;
            }
            sort($write);
            $out[implode('|', $write).' '.$route->uri()] = [
                'siteFrom' => $this->siteFrom($route),
                'handler' => $this->handlerName($route),
            ];
        }
        ksort($out);

        return $out;
    }

    private function handlerName(Route $route): string
    {
        $uses = $route->getAction('uses');

        return is_string($uses) ? $uses : 'closure';
    }

    private function handlerSource(Route $route): string
    {
        $uses = $route->getAction('uses');
        try {
            if (is_string($uses) && str_contains($uses, '@')) {
                [$class, $method] = explode('@', $uses);
                $r = new \ReflectionMethod($class, $method);
            } elseif ($uses instanceof \Closure) {
                $r = new \ReflectionFunction($uses);
            } else {
                return '';
            }
        } catch (\ReflectionException $e) {
            return '';
        }
        $lines = file($r->getFileName());

        return implode('', array_slice($lines, $r->getStartLine() - 1, $r->getEndLine() - $r->getStartLine() + 1));
    }

    private function siteFrom(Route $route): string
    {
        $from = [];
        if (str_contains($route->uri(), '{site}')) {
            $from[] = 'url';
        }
        $src = $this->handlerSource($route);
        if (preg_match('/[\'"]site_id[\'"]|[\'"]site_identifier[\'"]/', $src)) {
            $from[] = 'body';
        }
        if (preg_match('/activeSite|active_site_id/', $src)) {
            $from[] = 'pointer';
        }

        return $from ? implode('+', $from) : 'none';
    }

    private function inventory(): array
    {
        return json_decode(file_get_contents(base_path(self::INVENTORY)), true);
    }

    /** Both ways, by key, and the site source of every path that is on both sides. */
    private function compare(array $census, array $recorded): array
    {
        $unknown = array_values(array_diff(array_keys($census), array_keys($recorded)));
        $notFound = array_values(array_diff(array_keys($recorded), array_keys($census)));
        $sourceChanged = [];
        foreach (array_intersect_key($census, $recorded) as $key => $c) {
            if ($c['siteFrom'] !== ($recorded[$key]['siteFrom'] ?? null)) {
                $sourceChanged[] = $key.': recorded '.($recorded[$key]['siteFrom'] ?? '?').', now '.$c['siteFrom'];
            }
        }

        return ['unknown write path' => $unknown, 'declared but not found' => $notFound, 'site source changed' => $sourceChanged];
    }

    public function test_the_write_routes_of_the_registry_equal_the_recorded_list_both_ways(): void
    {
        $inv = $this->inventory();
        $census = $this->census(self::SIGN['methods']);

        fwrite(STDOUT, "\n[gh711] sign in force: ".json_encode(self::SIGN).'; list measured under: '.json_encode($inv['sign'])."\n");
        fwrite(STDOUT, '[gh711] routes in the registry: '.count(Router::getRoutes()->getRoutes()).'; write paths by the sign ('.count($census)."):\n");
        foreach ($census as $key => $c) {
            fwrite(STDOUT, '[gh711]    '.$key.'  site from '.$c['siteFrom'].'  ('.$c['handler'].")\n");
        }
        if (getenv('GH711_PRINT')) {
            fwrite(STDOUT, json_encode($census, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
        }

        $this->assertSame(self::SIGN, $inv['sign'], 'the list was measured under another sign; re-measure it, and announce the change');
        $this->assertSame(['unknown write path' => [], 'declared but not found' => [], 'site source changed' => []],
            $this->compare($census, $inv['routes']));
    }

    public function test_growth_under_the_same_sign_is_told_apart_from_growth_by_a_new_sign(): void
    {
        // What a wider sign would add, measured rather than asserted: the recorded sign against
        // the same sign plus GET. The routes only the wider sign names are the widening's doing.
        $inv = $this->inventory();
        $recordedSign = $this->census($inv['sign']['methods']);
        $wider = $this->census(array_merge($inv['sign']['methods'], ['GET']));
        // A route is the same route whatever methods the key lists: compared by address and handler.
        $id = fn (array $census) => array_map(fn ($k, $c) => substr($k, strpos($k, ' ') + 1).' '.$c['handler'], array_keys($census), $census);
        $byWidening = array_values(array_diff($id($wider), $id($recordedSign)));
        fwrite(STDOUT, '[gh711] under the recorded sign '.count($recordedSign).' paths; a sign with GET would add '
            .count($byWidening).", named apart from growth by the code\n");

        $this->assertNotEmpty($byWidening);
        $this->assertSame([], array_values(array_diff($id($recordedSign), $id($wider))));
    }

    public function test_positive_control_a_route_registered_in_a_new_place_is_named_without_editing_any_list(): void
    {
        Router::post('/gh711-probe/{site}', fn () => null);
        Router::getRoutes()->refreshNameLookups();
        $diff = $this->compare($this->census(self::SIGN['methods']), $this->inventory()['routes']);

        $this->assertSame(['POST gh711-probe/{site}'], $diff['unknown write path']);
    }
}
