<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * GH-684 — A SITE IS CREATED IN THREE PLACES, AND A FOURTH
 * REDDENS BY NAME.
 *
 * The owner's decision is that methodology is required everywhere, for old sites and new ones,
 * and that the obligation is held by a wizard nobody can leave. That holds only while every road
 * that brings a site into being is known: a fourth creator added quietly would produce sites the
 * lock never sees, and nothing would say so.
 *
 * THE UNIVERSE IS THE TREE, not a list written here. Every call of `SiteConfigWriter::createEmpty`
 * under `app/app` is found by reading the files; the three that exist are allowed BY NAME WITH A
 * REASON, and the other direction is asserted too — an allowance whose call site has gone is an
 * open door nobody is watching.
 *
 * WHY `createEmpty` IS THE SIGN rather than `Site::create`: a row without its config is not yet a
 * site anybody can open, and the analyst's own reading of the three roads is through this call.
 * If a road is ever added that makes a site WITHOUT it, this guard will not see it — that is its
 * boundary and it is named rather than discovered later.
 */
class Gh684ThreePlacesCreateASiteTest extends TestCase
{
    /** The three roads, each with what it is. */
    private const ALLOWED = [
        'app/Http/Controllers/SiteController.php' => 'the API a person creates a site through',
        'app/Http/Controllers/MagicLinkController.php' => 'a first site made for an account that arrives by a magic link',
        'app/Http/Controllers/UsersController.php' => 'a site made for a user an administrator adds',
    ];

    /** @return array<string,int[]> file => the lines that call it */
    private function callSites(): array
    {
        $root = base_path();
        $found = [];
        $walk = function (string $dir) use (&$walk, &$found, $root): void {
            foreach (scandir($dir) ?: [] as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                $full = $dir.'/'.$entry;
                if (is_dir($full)) {
                    $walk($full);

                    continue;
                }
                if (! str_ends_with($entry, '.php')) {
                    continue;
                }
                $lines = file($full) ?: [];
                foreach ($lines as $i => $line) {
                    if (str_contains($line, 'SiteConfigWriter::createEmpty')
                        && ! str_starts_with(ltrim($line), '*')
                        && ! str_starts_with(ltrim($line), '//')) {
                        $rel = ltrim(str_replace($root, '', $full), '/');
                        $found[$rel][] = $i + 1;
                    }
                }
            }
        };
        $walk(base_path('app'));

        return $found;
    }

    public function test_exactly_the_three_known_roads_create_a_site(): void
    {
        $found = $this->callSites();
        ksort($found);
        foreach ($found as $file => $lines) {
            fwrite(STDOUT, '[gh684] creates a site: '.$file.' at line(s) '.implode(', ', $lines)
                .' — '.(self::ALLOWED[$file] ?? 'NOT A KNOWN ROAD').PHP_EOL);
        }

        // The universe is real before anything is claimed about it: the declaration itself is
        // in `SiteConfigWriter`, and a census finding nothing would be a green over nothing.
        $this->assertNotSame([], $found, 'no creation site was found at all — the census did not reach the tree');

        $unknown = array_values(array_diff(array_keys($found), array_keys(self::ALLOWED)));
        $gone = array_values(array_diff(array_keys(self::ALLOWED), array_keys($found)));

        $this->assertSame([], $unknown, 'a fourth road creates a site: the wizard lock would never see those sites');
        $this->assertSame([], $gone, 'an allowed road no longer creates a site — the allowance has outlived its reason');
    }

    public function test_the_declaration_it_is_counted_from_still_exists(): void
    {
        // A census keyed on a name says nothing once the name is gone: it would find zero call
        // sites and report a clean tree.
        $writer = file_get_contents(base_path('app/Support/SiteConfigWriter.php'));
        $this->assertStringContainsString('function createEmpty', $writer,
            'the call this census counts has been renamed; the census is now blind');
    }
}
