<?php

namespace Database\Seeders;

use App\Models\SpeciesDefinition;
use Illuminate\Database\Seeder;

class SpeciesDefinitionSeeder extends Seeder
{
    public function run(): void
    {
        SpeciesDefinition::truncate();

        $AU_REGIONS = ['australia_tropical', 'australia_subtropical', 'australia_temperate', 'australia_mediterranean'];
        $NZ         = ['new_zealand'];
        $UK_NZ_SCAN = ['uk_ireland', 'new_zealand', 'scandinavia'];

        $rows = [
            // ── Sports ────────────────────────────────────────────────────────
            ['sports', null, 'c3', 'Perennial Ryegrass',          'Perennial Ryegrass',                  null,         0],
            ['sports', null, 'c3', 'Kentucky Bluegrass',          'Kentucky Bluegrass',                  null,         1],
            ['sports', null, 'c3', 'Tall Fescue',                 'Tall Fescue',                         null,         2],
            ['sports', null, 'c4', 'Couch',                       'Couch (Bermudagrass)',                 null,         3],
            ['sports', null, 'c4', 'Kikuyu',                      'Kikuyu',                              null,         4],

            // ── Golf / Greens ─────────────────────────────────────────────────
            ['golf', 'greens', 'c3', 'Creeping Bentgrass (Greens)',        'Creeping Bentgrass',            null,         0],
            ['golf', 'greens', 'c3', 'Browntop Bent (Greens)',             'Browntop Bent / Colonial',      $UK_NZ_SCAN,  1],
            ['golf', 'greens', 'c3', 'Annual Bluegrass (Greens)',          'Poa annua',                     null,         2],
            ['golf', 'greens', 'c3', 'Chewings Fescue (Greens)',           'Chewings Fescue',               $NZ,          3],
            ['golf', 'greens', 'c3', 'Slender Creeping Red Fescue (Greens)', 'Slender Creeping Red Fescue', $NZ,          4],
            ['golf', 'greens', 'c4', 'Couch',                             'Couch / Bermudagrass (ultradwarf)', null,      5],
            ['golf', 'greens', 'c4', 'Seashore Paspalum',                 'Seashore Paspalum (Saltene / Velvetene)', $AU_REGIONS, 6],

            // ── Golf / Fairways ───────────────────────────────────────────────
            ['golf', 'fairways', 'c3', 'Perennial Ryegrass',              'Perennial Ryegrass',             null,         0],
            ['golf', 'fairways', 'c3', 'Annual Bluegrass (Fairway)',       'Poa annua',                     null,         1],
            ['golf', 'fairways', 'c3', 'Chewings Fescue (Fairways)',       'Chewings Fescue',               $NZ,          2],
            ['golf', 'fairways', 'c3', 'Slender Creeping Red Fescue (Fairways)', 'Slender Creeping Red Fescue', $NZ,       3],
            ['golf', 'fairways', 'c3', 'Strong Creeping Red Fescue (Fairways)',  'Strong Creeping Red Fescue',  $NZ,       4],
            ['golf', 'fairways', 'c4', 'Couch',                           'Couch (Bermudagrass)',            null,         5],
            ['golf', 'fairways', 'c4', 'Kikuyu',                          'Kikuyu',                         null,         6],

            // ── Golf / Tees ───────────────────────────────────────────────────
            ['golf', 'tees', 'c3', 'Perennial Ryegrass',                  'Perennial Ryegrass',             null,         0],
            ['golf', 'tees', 'c4', 'Couch',                               'Couch (Bermudagrass)',            null,         1],
            ['golf', 'tees', 'c4', 'Kikuyu',                              'Kikuyu',                         null,         2],

            // ── Golf / Surrounds ──────────────────────────────────────────────
            ['golf', 'surrounds', 'c3', 'Perennial Ryegrass',             'Perennial Ryegrass',             null,         0],
            ['golf', 'surrounds', 'c4', 'Couch',                          'Couch (Bermudagrass)',            null,         1],
            ['golf', 'surrounds', 'c4', 'Kikuyu',                         'Kikuyu',                         null,         2],

            // ── Lawns ─────────────────────────────────────────────────────────
            ['lawns', null, 'c3', 'Perennial Ryegrass',                   'Perennial Ryegrass',             null,         0],
            ['lawns', null, 'c3', 'Kentucky Bluegrass',                   'Kentucky Bluegrass',             null,         1],
            ['lawns', null, 'c3', 'Tall Fescue',                          'Tall Fescue',                    null,         2],
            ['lawns', null, 'c3', 'Cotula',                               'Cotula (Leptinella)',             $NZ,          3],
            ['lawns', null, 'c4', 'Couch',                                'Couch (Bermudagrass)',            null,         4],
            ['lawns', null, 'c4', 'Buffalograss',                         'Buffalo (Sir Walter, Sapphire)', null,         5],
            ['lawns', null, 'c4', 'Kikuyu',                               'Kikuyu',                         null,         6],
            ['lawns', null, 'c4', 'Zoysia',                               'Zoysia (Empire, Nara)',           null,         7],
            ['lawns', null, 'c4', 'Seashore Paspalum',                    'Seashore Paspalum (Saltene / Velvetene)', $AU_REGIONS, 8],
        ];

        foreach ($rows as [$turfType, $subCategory, $photosynthesis, $value, $label, $regions, $sortOrder]) {
            SpeciesDefinition::create([
                'turf_type'      => $turfType,
                'sub_category'   => $subCategory,
                'photosynthesis' => $photosynthesis,
                'value'          => $value,
                'label'          => $label,
                'regions'        => $regions,
                'sort_order'     => $sortOrder,
            ]);
        }
    }
}
