<?php

namespace App\Support;

/**
 * GH-768 (queue item 3vm) - THE AMMONIUM ACETATE RANGES, READ FROM THEIR ONE FILE.
 *
 * `assets/aa-ranges.json` holds the AA sufficiency ranges by soil type for all ten nutrients, moved
 * without edits from the literal in `mlsnEngine`, together with the five the Hill Labs certificate
 * may override. This class is their only reader on the server.
 *
 * The server's own table used to carry five of the ten, so an AA site's Fe, Mn, Zn, Cu and B were
 * graded by MLSN's single thresholds - a different methodology, silently. The table is gone; this is
 * what replaced it, by the shape `SlanRanges` already established.
 *
 * A missing or unreadable file is an error, not an empty table: an empty table would judge nothing
 * and say nothing about why.
 */
class AaRanges
{
    private const PATH = '../assets/aa-ranges.json';

    /** @var array<string,mixed>|null */
    private static ?array $cache = null;

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache === null) {
            $raw = @file_get_contents(base_path(self::PATH));
            $decoded = $raw === false ? null : json_decode($raw, true);
            if (! is_array($decoded) || ! is_array($decoded['bySoilType'] ?? null)
                || ! is_array($decoded['certificateOverridable'] ?? null)) {
                throw new \RuntimeException('aa-ranges.json is missing or unreadable');
            }
            self::$cache = $decoded;
        }

        return self::$cache;
    }

    /**
     * The ranges for one soil type, or null for a type the file does not declare. Nothing stands in
     * for an unknown type.
     *
     * @return array<string,array{lo:float|int,hi:float|int}>|null
     */
    public static function forSoilType(?string $soilType): ?array
    {
        $by = self::all()['bySoilType'];

        return is_string($soilType) && isset($by[$soilType]) ? $by[$soilType] : null;
    }

    /**
     * The nutrients a certificate may override, as the engine's own list names them. Everything the
     * certificate answers for outside this list is ignored, because the engine ignores it: an
     * overlay wider than the engine's would part the two without either side being edited.
     *
     * @return array<int,string>
     */
    public static function certificateOverridable(): array
    {
        return self::all()['certificateOverridable'];
    }
}
