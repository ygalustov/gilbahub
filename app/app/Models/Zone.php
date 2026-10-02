<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * GH-800 (queue item "Zones", stage C1) — A ZONE OF A SITE, as a row.
 *
 * The table arrived with stage C0 (`GH-799`) and the transfer filled it from the names a site already
 * had. This stage gives the server a way to write one: a sample saved for a zone the site does not yet
 * have brings that zone into being, with no type, and the sample points at it.
 *
 * WHAT IT IS NOT, said here because the word "zone" has meant three things in this product: it is not
 * the TYPE of a surface (that is a key of `assets/zone-types.json`, held in `zone_type`), and it is not
 * the name of a visit (`payload._label` keeps that — "Green 1 (June 2025)" is one visit to the zone
 * "Green 1"). It is the place itself, the thing that keeps its identity when somebody renames it.
 *
 * `zone_type` IS NULL UNTIL A PERSON CHOOSES ONE — the owner's decision of 22.09.2026. Nothing in this
 * stage fills it, and no figure depends on it.
 */
class Zone extends Model
{
    use HasUuids;

    protected $fillable = [
        'site_id',
        'name',
        'zone_type',
        'created_by_user_id',
        'modified_by_user_id',
    ];

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
