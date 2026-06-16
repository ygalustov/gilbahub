<?php

namespace App\Services;

use App\Models\SpeciesDefinition;

class SpeciesService
{
    /**
     * Returns the species matrix in the format consumed by window.GAIP_SpeciesData.speciesByType.
     *
     * Shape:
     *   [
     *     'golf'   => ['greens' => ['c3' => [...], 'c4' => [...]], ...],
     *     'sports' => ['c3' => [...], 'c4' => [...]],
     *     'lawns'  => ['c3' => [...], 'c4' => [...]],
     *   ]
     *
     * Each species entry:
     *   ['value' => '...', 'label' => '...', 'type' => 'C3'|'C4', 'regions' => [...] | null]
     */
    public function getSpeciesByType(): array
    {
        $all = SpeciesDefinition::orderBy('sort_order')->get();

        $result = [];

        foreach ($all as $row) {
            $entry = [
                'value' => $row->value,
                'label' => $row->label,
                'type'  => strtoupper($row->photosynthesis),
            ];
            if ($row->regions !== null) {
                $entry['regions'] = $row->regions;
            }

            if ($row->sub_category !== null) {
                // Golf sub-categories (greens / fairways / tees / surrounds)
                $result[$row->turf_type][$row->sub_category][$row->photosynthesis][] = $entry;
            } else {
                // Sports / Lawns — flat c3/c4 lists
                $result[$row->turf_type][$row->photosynthesis][] = $entry;
            }
        }

        return $result;
    }
}
