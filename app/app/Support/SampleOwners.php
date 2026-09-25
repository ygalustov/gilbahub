<?php

namespace App\Support;

use App\Models\Sample;

/**
 * GH-709 — WHICH SITES A SAMPLE KEY BELONGS TO, ASKED IN ONE PLACE.
 *
 * The analysis-cache write path refuses a row whose samples belong to another site, and the
 * data audit (`gilba:audit-data`) asks the same question of rows already stored. Two copies
 * of this lookup would answer it two ways the day one of them changed, so both call this.
 *
 * A sample travels as its own id (`118`, `sample_118`) or as the key the browser built for it
 * (`client_uid`), and a key is not unique between sites; deleted samples still answer.
 */
final class SampleOwners
{
    /** @return array<int,string> the site ids of every sample the key resolves to */
    public static function sitesOf(string $id): array
    {
        $bare = preg_replace('/^sample_/', '', $id);
        // GH-663 — THE NUMERIC COLUMN IS ONLY ASKED A NUMERIC QUESTION, AND
        // THIS GUARD HAS NO CASE. Both halves are said on purpose.
        //
        // The hazard, measured in both engines rather than reasoned about:
        // `SELECT … WHERE id = '26_zz9y'` matches one row in MySQL and none in
        // SQLite, because MySQL coerces the string to 26. The sample keys this
        // product builds today begin with a letter — `Soil_26_zo0t` coerces to
        // 0 and matches nothing — so nothing is wrong today; a key beginning
        // with digits would let another site's row answer for this one, and
        // clear a foreign sample rather than refuse it.
        //
        // THE BOUNDARY: the test bench is SQLite, which does not coerce, so no
        // case here can show this red. The guard is hygiene with its reason
        // written down, not a repair with a witness — and saying so is the
        // difference between a boundary and a silence. Three attempts at a case
        // went green with the guard removed before the engines were measured.
        return Sample::withTrashed()
            ->where(function ($q) use ($id, $bare) {
                if (ctype_digit($bare)) {
                    $q->orWhere('id', (int) $bare);
                }
                $q->orWhere('client_uid', $id);
                if ($bare !== $id) {
                    $q->orWhere('client_uid', $bare);
                }
            })
            ->pluck('site_id')
            ->map(fn ($s) => (string) $s)
            ->all();
    }
}
