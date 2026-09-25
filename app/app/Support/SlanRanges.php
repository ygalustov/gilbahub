<?php

namespace App\Support;

/**
 * GH-752 (queue item 3bl, part B) - THE SLAN RANGES, READ FROM THEIR ONE FILE.
 *
 * `assets/slan-ranges.json` holds the SLAN sufficiency ranges by soil type and the pH adjustment of
 * Fe and Mn, moved without edits from the literal in `mlsnEngine`. This class is their only reader:
 * the server judges a SLAN sample with them, and the layouts hand `forClient()` to the pages that run
 * the engine. A copy in JavaScript would be a second source, which is the drift this file removes.
 *
 * A missing or unreadable file is an error, not an empty table: an empty table would judge nothing
 * and say nothing about why.
 */
class SlanRanges
{
    private const PATH = '../assets/slan-ranges.json';

    /** @var array<string,mixed>|null */
    private static ?array $cache = null;

    /** @return array<string,mixed> */
    public static function all(): array
    {
        if (self::$cache === null) {
            $raw = @file_get_contents(base_path(self::PATH));
            $decoded = $raw === false ? null : json_decode($raw, true);
            if (! is_array($decoded) || ! is_array($decoded['bySoilType'] ?? null) || ! is_array($decoded['phAdjusted'] ?? null)) {
                throw new \RuntimeException('slan-ranges.json is missing or unreadable');
            }
            self::$cache = $decoded;
        }

        return self::$cache;
    }

    /** What a page is given: the ranges and the adjustment, without the file's commentary. */
    public static function forClient(): array
    {
        $all = self::all();

        return [
            'version' => $all['version'] ?? null,
            'bySoilType' => $all['bySoilType'],
            'phAdjusted' => $all['phAdjusted'],
        ];
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
}
