<?php

namespace App\Support;

/**
 * GH-474 (PLAN-GH439 section 10.6, thirteenth refinement as amended) — who
 * owns each fact about a site.
 *
 * Ownership is declared PER FIELD, not per section. The first version of this
 * refinement gave the whole `location` section to the columns and refused the
 * section at the config route; it did not fit `location.elevation`, which has
 * no column to live in, and it would have broken both senders of that section
 * — the Settings form and the setup wizard.
 *
 * So there are two legitimate owners, and a field has exactly one:
 *
 *   - a column on `sites`, for facts the row carries;
 *   - the config, for facts no column exists for.
 *
 * A field with no column is not an exception to the rule: it is the other half
 * of it. What the rule forbids is the same fact living in two places with two
 * writers, which is how a site's config said one place and its column another
 * with nothing to say they disagreed.
 *
 * This table is the single source for both sides. The server routes every
 * write through it; the browser's resolver builds its own read paths from the
 * same table, exported to tests/fixtures/field-owners.json, and a test
 * compares the two enumerations in both directions.
 */
class FieldOwners
{
    /**
     * Dotted field path inside the gaip config → the `sites` column that owns
     * it, or null when the config itself is the owner.
     *
     * A field absent from this table is unknown to the routing and stays in
     * the config, which is the safe half: it means "nobody has said this is a
     * column", not "this may go anywhere".
     */
    public const OWNERS = [
        'location.name' => 'location_name',
        'location.lat' => 'latitude',
        'location.lon' => 'longitude',
        // No column exists for it. The config owns it, and it has no copy.
        'location.elevation' => null,
        'timezone' => 'timezone',
    ];

    /**
     * The fields that HAVE a copy in the config, derived by the server from
     * the column that owns them.
     *
     * Having an owner and having a copy are two different things, and the
     * difference matters. `config.location.{name,lat,lon}` existed as a copy
     * before any of this and is read by the legacy /hub form, so it is kept
     * and kept correct. `timezone` never had a copy: the column owns it and
     * nothing in the config carries it. Deriving one would be CREATING a
     * second place for a fact, which is the thing this section removes —
     * measured on the stand, that derivation wanted to add a `timezone` key to
     * all twelve live configs.
     *
     * `location.elevation` is not here either, for the other reason: its owner
     * IS the config, so there is nothing to derive it from.
     */
    private const COPIED = ['location.name', 'location.lat', 'location.lon'];

    public static function derivedCopies(): array
    {
        return self::COPIED;
    }

    /**
     * Columns whose value must be a number in the copy.
     *
     * The coordinate columns are DECIMAL, so the database hands them back as
     * strings ('-45.8788000'). The copy is read by three regional
     * integrations that decide a country's product catalogue from it, and a
     * string there is a different value from the number a client used to
     * write — so the copy carries the type the readers expect, not the type
     * the driver returned.
     */
    private const NUMERIC_COLUMNS = ['latitude', 'longitude'];

    /** The column's value as the copy should carry it. */
    public static function castForCopy(string $column, $value)
    {
        if ($value === null || ! in_array($column, self::NUMERIC_COLUMNS, true)) {
            return $value;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    /** The column that owns a field, or null when the config owns it. */
    public static function columnFor(string $field): ?string
    {
        return self::OWNERS[$field] ?? null;
    }

    /** Whether a column owns this field. */
    public static function isColumnOwned(string $field): bool
    {
        return array_key_exists($field, self::OWNERS) && self::OWNERS[$field] !== null;
    }

    /**
     * Split a config patch into what belongs in the columns and what stays in
     * the config, by this table and nothing else.
     *
     * @return array{columns: array<string,mixed>, config: array}
     */
    public static function route(array $patch): array
    {
        $columns = [];
        $remaining = $patch;

        foreach (self::OWNERS as $field => $column) {
            if ($column === null) {
                continue;
            }
            $parts = explode('.', $field);
            $cursor = $remaining;
            foreach ($parts as $part) {
                if (! is_array($cursor) || ! array_key_exists($part, $cursor)) {
                    $cursor = null;
                    break;
                }
                $cursor = $cursor[$part];
            }
            if ($cursor === null && ! self::patchHasPath($remaining, $parts)) {
                continue;
            }
            $columns[$column] = $cursor;
        }

        return ['columns' => $columns, 'config' => $remaining];
    }

    private static function patchHasPath(array $patch, array $parts): bool
    {
        $cursor = $patch;
        foreach ($parts as $part) {
            if (! is_array($cursor) || ! array_key_exists($part, $cursor)) {
                return false;
            }
            $cursor = $cursor[$part];
        }

        return true;
    }

    /**
     * The config with every column-owned field rewritten from the columns.
     *
     * One place, after the column is written, whichever route wrote it. That
     * is what makes the copy correct by construction instead of by everyone
     * who writes remembering to update it.
     */
    public static function deriveCopies(array $config, array $columnValues): array
    {
        foreach (self::COPIED as $field) {
            $column = self::OWNERS[$field] ?? null;
            if ($column === null || ! array_key_exists($column, $columnValues)) {
                continue;
            }
            $parts = explode('.', $field);
            $leaf = array_pop($parts);
            $cursor = &$config;
            foreach ($parts as $part) {
                if (! isset($cursor[$part]) || ! is_array($cursor[$part])) {
                    $cursor[$part] = [];
                }
                $cursor = &$cursor[$part];
            }
            $cursor[$leaf] = self::castForCopy($column, $columnValues[$column]);
            unset($cursor);
        }

        return $config;
    }
}
