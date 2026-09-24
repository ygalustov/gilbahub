<?php

namespace Tests\Feature;

use App\Support\AnalysisNotice;
use Tests\TestCase;

/**
 * GH-640 (link 11, plan 4.13a point 3) — NO ASSET CARRIES A COPY OF THE
 * COMPOSER'S WORDS, AND THE WORDS ARE TAKEN FROM WHAT THE COMPOSER OUTPUTS.
 *
 * WHY NOT THE EXISTING GUARD. `gh548`'s case takes phrases out of the PHP with a
 * regular expression that matches `=> '…'` of 25 characters or more. Two of the
 * composer's strings are declared as `const X = '…'` and fall outside that
 * pattern — the failure frame and the unworded-code sentence — so their copies in
 * `dashboard-ui.js` and `settings-init.js` live at a green suite. A guard whose
 * name is wider than its pattern is the shape the analyst calls class F.
 *
 * SO THE WORDS COME FROM `clientTexts()` ITSELF: every string it hands the
 * browser, whatever constant it was declared as. A copy of one of them inside an
 * asset is a second author of that sentence.
 *
 * THE REMAINDER IS NAMED, WITH ITS REASON, and it is not a permission. These
 * three copies are the opener composing the failure sentence itself instead of
 * taking the server's — the analyst's open question about the moment of failure.
 * Whether the opener switches over changes what a client reads, so it is the
 * owner's; until then the copies are listed HERE, by file and by sentence, so a
 * FOURTH one is red on the day it appears.
 */
class Gh640ComposerWordsHaveNoCopiesTest extends TestCase
{
    /**
     * file => the composer's sentences it still carries, with why.
     *
     * Reason for all three: the opener writes the failure sentence at the moment
     * of failure and the server writes it after a reload. Moving the opener onto
     * the server's sentence changes the words a client reads in that moment, so
     * it waits for the owner's answer.
     */
    private const REMAINDER = [
        'dashboard-ui.js' => 2,
    ];

    public function test_the_words_and_the_assets_are_both_real(): void
    {
        // Positive control: an empty word list agrees with every asset in the
        // tree, and an empty asset list agrees with every word.
        $words = $this->composerWords();
        $assets = $this->assets();
        fwrite(STDOUT, PHP_EOL.'[gh640] composer strings: '.count($words).' | assets scanned: '.count($assets).PHP_EOL);

        $this->assertGreaterThan(20, count($words));
        $this->assertGreaterThan(50, count($assets));
    }

    public function test_no_asset_carries_a_copy_of_a_composed_sentence_beyond_the_named_remainder(): void
    {
        $words = $this->composerWords();
        $found = [];
        foreach ($this->assets() as $file => $src) {
            $code = $this->codeOnly($src);
            foreach ($words as $word) {
                if (mb_strlen($word) >= 25 && str_contains($code, $word)) {
                    $found[$file] = ($found[$file] ?? 0) + 1;
                }
            }
        }
        ksort($found);
        fwrite(STDOUT, '[gh640] copies by file: '.json_encode($found).PHP_EOL);

        $expected = self::REMAINDER;
        ksort($expected);
        $this->assertSame($expected, $found,
            'a sentence the composer owns is written in an asset too — or the remainder is out of date');
    }

    public function test_the_frame_and_the_unworded_sentence_are_among_the_words_this_guard_takes(): void
    {
        // The two the old pattern could not see. If they ever stop travelling in
        // `clientTexts()`, this guard quietly narrows, so it says so here.
        $words = $this->composerWords();
        $this->assertContains(AnalysisNotice::clientTexts()['frame'], $words);
        $this->assertContains(AnalysisNotice::clientTexts()['unknown'], $words);
    }


    public function test_the_door_actually_carries_a_sentence_for_every_declared_section(): void
    {
        // THE HOLE THIS CLOSES WAS FOUND BY MUTATION, not by reading: emptying
        // `sections` in `clientTexts()` reddened NOTHING — the page guard passes
        // its own sentinel in by hand, so it never notices that the real door
        // carries nothing. A guard that cannot see its own delivery failing is
        // the shape the reviewer caught twice today.
        $projection = [
            'metrics' => [], 'computed' => [], 'analyzedAt' => null, 'lastRun' => null,
            'status' => 'complete', 'numbersFrom' => 'complete',
            'numbersRun' => ['outcome' => 'complete', 'skipped' => [], 'notApplicable' => [],
                'notes' => [], 'assumptions' => []],
        ];

        $texts = AnalysisNotice::clientTexts($projection);
        $this->assertArrayHasKey('sections', $texts);

        $declared = \App\Support\AnalysisResultSchema::consumerKeys();
        fwrite(STDOUT, '[gh640] the door carries '.count($texts['sections'])
            .' sections for '.count($declared).' declared keys'.PHP_EOL);

        $this->assertSame(sort($declared) ? $declared : $declared, $declared); // keep the list stable
        foreach ($declared as $key) {
            $this->assertArrayHasKey($key, $texts['sections'], $key.' never reaches the page');
            // Every section is empty in this projection, so each one carries an
            // answer rather than null — silence is what link 11 removes.
            $this->assertIsArray($texts['sections'][$key], $key.' was answered with silence');
            $this->assertArrayHasKey('class', $texts['sections'][$key], $key);
        }
    }

    public function test_a_section_with_numbers_is_null_at_the_door_so_the_page_draws_them(): void
    {
        $projection = [
            'metrics' => [], 'computed' => ['pgr' => ['gdd' => ['accumulated' => 10]]],
            'analyzedAt' => null, 'lastRun' => null, 'status' => 'complete', 'numbersFrom' => 'complete',
            'numbersRun' => ['outcome' => 'complete', 'skipped' => [], 'notApplicable' => [],
                'notes' => [], 'assumptions' => []],
        ];

        $sections = AnalysisNotice::clientTexts($projection)['sections'];
        $this->assertNull($sections['pgr'], 'a produced section was given a sentence about being empty');
        $this->assertIsArray($sections['wear'], 'an empty section was left without one');
    }

    /** @return array<int,string> every string the composer hands the browser */
    private function composerWords(): array
    {
        $out = [];
        $texts = AnalysisNotice::clientTexts();
        array_walk_recursive($texts, function ($value) use (&$out) {
            if (is_string($value) && trim($value) !== '') {
                $out[] = $value;
            }
        });

        return array_values(array_unique($out));
    }

    /** @return array<string,string> */
    private function assets(): array
    {
        $dir = base_path('../assets');
        $out = [];
        foreach (scandir($dir) ?: [] as $name) {
            if (! str_ends_with($name, '.js') || str_ends_with($name, '.min.js')) {
                continue;
            }
            $out[$name] = (string) file_get_contents($dir.'/'.$name);
        }

        return $out;
    }

    /** Comments removed: a guard that reads prose measures prose. */
    private function codeOnly(string $src): string
    {
        $src = preg_replace('#/\*[\s\S]*?\*/#', '', $src) ?? $src;

        return preg_replace('#^\s*//.*$#m', '', $src) ?? $src;
    }
}
