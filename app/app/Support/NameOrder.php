<?php

namespace App\Support;

/**
 * GH-817 (queue item "Zones", the owner's requests about order) — ONE RULE FOR ORDERING THINGS BY THEIR NAME.
 *
 * Names with numbers in them are ordered by the value of the number and without regard to case: `Green 2`
 * before `Green 10`, `green 1` beside `Green 1`. Two lists use it -- a site's zones, and the samples of one
 * date on the Data page -- and both take it from here, so the rule is not written twice.
 */
final class NameOrder
{
    public static function compare(string $a, string $b): int
    {
        return strnatcasecmp($a, $b);
    }
}
