<?php

namespace App\Support;

/**
 * GH-801 (queue item "Zones", stage C2) — THE ONE COMPOSER OF "a, b and c".
 *
 * A refusal names the fields a person has to fill in, and it names them in a sentence rather than as a
 * list read like code: "Not saved: fill in the soil texture and the cultivar." That sentence was built
 * by a private method of `SiteController` (`readAsList`, GH-789), and the Zones tab of this stage is the
 * third place that refuses a save in the same words. A copy of three lines is still a second owner of
 * the wording, so the method moved here and both callers ask it.
 *
 * The browser has the same composer in `GilbaRequiredFields.mark` (`dashboard-ui.js`) for the refusals it
 * marks itself, and that is a boundary rather than a third copy: it composes from `missing` when the
 * server sends no sentence. Where the server does send one — this stage — the page prints the server's.
 */
class ReadableList
{
    /** "a", "a and b", "a, b and c" — empty words and repeats dropped. */
    public static function of(array $words): string
    {
        $words = array_values(array_unique(array_filter($words, 'is_string')));
        if (count($words) <= 1) {
            return (string) ($words[0] ?? '');
        }
        $last = array_pop($words);

        return implode(', ', $words).' and '.$last;
    }
}
