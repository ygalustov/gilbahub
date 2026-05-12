<?php
/**
 * Hub Variety Adapter
 * 
 * Bridges the Supplemental Light module to the Hub's Variety Traits database.
 * Uses Hub data when available, falls back to built-in data otherwise.
 */

class Gssh_Hub_Variety_Adapter {
    
    private $varieties;
    
    public function __construct() {
        $this->load_variety_data();
    }
    
    /**
     * Load variety data - tries Hub first, then uses built-in
     */
    private function load_variety_data() {
        // Built-in variety database with research-backed DLI values
        $this->varieties = [
            // =====================================================
            // BERMUDAGRASS / COUCH VARIETIES
            // =====================================================
            
            'tiftuf' => [
                'name'          => 'TifTuf',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 32,
                'optimal_dli'   => 43,
                'critical_dli'  => 26,
                'shade_tolerance_rating' => 2,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 10,
                'shade_response' => [
                    'days_to_visible_decline' => 14,
                    'recovery_rate_modifier'  => 0.6,
                    'disease_susceptibility_increase' => 1.4,
                ],
                'source' => 'Bunnell et al. 2005; Trappe et al. 2011',
            ],
            
            'tifgrand' => [
                'name'          => 'TifGrand',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 26,
                'optimal_dli'   => 38,
                'critical_dli'  => 20,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 10,
                'shade_response' => [
                    'days_to_visible_decline' => 24,
                    'recovery_rate_modifier'  => 0.75,
                    'disease_susceptibility_increase' => 1.2,
                ],
                'source' => 'Hanna et al. 2010; Wherley et al. 2011',
            ],
            
            'platinum_te' => [
                'name'          => 'Platinum TE',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 30,
                'optimal_dli'   => 40,
                'critical_dli'  => 24,
                'shade_tolerance_rating' => 3,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 10,
                'shade_response' => [
                    'days_to_visible_decline' => 18,
                    'recovery_rate_modifier'  => 0.65,
                    'disease_susceptibility_increase' => 1.3,
                ],
                'source' => 'Trappe et al. 2011; UGA trials',
            ],
            
            'legend' => [
                'name'          => 'Legend Couch',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 32,
                'optimal_dli'   => 42,
                'critical_dli'  => 26,
                'shade_tolerance_rating' => 2,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 12,
                'shade_response' => [
                    'days_to_visible_decline' => 14,
                    'recovery_rate_modifier'  => 0.6,
                    'disease_susceptibility_increase' => 1.4,
                ],
                'source' => 'Cockerham et al. 2002',
            ],
            
            'wintergreen' => [
                'name'          => 'Wintergreen',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 30,
                'optimal_dli'   => 40,
                'critical_dli'  => 24,
                'shade_tolerance_rating' => 3,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 8,
                'shade_response' => [
                    'days_to_visible_decline' => 16,
                    'recovery_rate_modifier'  => 0.65,
                    'disease_susceptibility_increase' => 1.35,
                ],
                'source' => 'Australian sports turf trials',
            ],
            
            'santa_ana' => [
                'name'          => 'Santa Ana',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 30,
                'optimal_dli'   => 40,
                'critical_dli'  => 24,
                'shade_tolerance_rating' => 2,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 10,
                'shade_response' => [
                    'days_to_visible_decline' => 14,
                    'recovery_rate_modifier'  => 0.6,
                    'disease_susceptibility_increase' => 1.4,
                ],
                'source' => 'Australian sports turf trials',
            ],
            
            'tifdwarf' => [
                'name'          => 'TifDwarf',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 35,
                'optimal_dli'   => 45,
                'critical_dli'  => 28,
                'shade_tolerance_rating' => 1,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 12,
                'shade_response' => [
                    'days_to_visible_decline' => 10,
                    'recovery_rate_modifier'  => 0.5,
                    'disease_susceptibility_increase' => 1.6,
                ],
                'source' => 'Bunnell et al. 2005',
            ],
            
            'tifeagle' => [
                'name'          => 'TifEagle',
                'species'       => 'bermudagrass',
                'species_aus'   => 'couch',
                'minimum_dli'   => 34,
                'optimal_dli'   => 44,
                'critical_dli'  => 27,
                'shade_tolerance_rating' => 1,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 12,
                'shade_response' => [
                    'days_to_visible_decline' => 10,
                    'recovery_rate_modifier'  => 0.5,
                    'disease_susceptibility_increase' => 1.6,
                ],
                'source' => 'Bunnell et al. 2005',
            ],
            
            // =====================================================
            // ZOYSIA VARIETIES
            // =====================================================
            
            'zeon' => [
                'name'          => 'Zeon Zoysia',
                'species'       => 'zoysia',
                'species_aus'   => 'zoysia',
                'minimum_dli'   => 18,
                'optimal_dli'   => 30,
                'critical_dli'  => 12,
                'shade_tolerance_rating' => 5,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 10,
                'shade_response' => [
                    'days_to_visible_decline' => 35,
                    'recovery_rate_modifier'  => 0.85,
                    'disease_susceptibility_increase' => 1.15,
                ],
                'source' => 'Wherley et al. 2011; Patton & Reicher 2007',
            ],
            
            'empress' => [
                'name'          => 'Empress Zoysia',
                'species'       => 'zoysia',
                'species_aus'   => 'zoysia',
                'minimum_dli'   => 16,
                'optimal_dli'   => 28,
                'critical_dli'  => 10,
                'shade_tolerance_rating' => 6,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 8,
                'shade_response' => [
                    'days_to_visible_decline' => 42,
                    'recovery_rate_modifier'  => 0.9,
                    'disease_susceptibility_increase' => 1.1,
                ],
                'source' => 'Patton & Reicher 2007',
            ],
            
            // =====================================================
            // RYEGRASS VARIETIES
            // =====================================================
            
            'perennial_rye' => [
                'name'          => 'Perennial Ryegrass',
                'species'       => 'ryegrass',
                'species_aus'   => 'ryegrass',
                'minimum_dli'   => 18,
                'optimal_dli'   => 28,
                'critical_dli'  => 12,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C3',
                'dormancy_temp' => null, // C3 - no thermal dormancy
                'shade_response' => [
                    'days_to_visible_decline' => 21,
                    'recovery_rate_modifier'  => 0.7,
                    'disease_susceptibility_increase' => 1.5,
                ],
                'source' => 'Trappe et al. 2011; STRI trials',
            ],
            
            'keynote_ii' => [
                'name'          => 'Keynote II',
                'species'       => 'ryegrass',
                'species_aus'   => 'ryegrass',
                'minimum_dli'   => 18,
                'optimal_dli'   => 28,
                'critical_dli'  => 12,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C3',
                'dormancy_temp' => null,
                'shade_response' => [
                    'days_to_visible_decline' => 21,
                    'recovery_rate_modifier'  => 0.7,
                    'disease_susceptibility_increase' => 1.5,
                ],
                'source' => 'Trappe et al. 2011',
            ],
            
            'colosseum' => [
                'name'          => 'Colosseum',
                'species'       => 'ryegrass',
                'species_aus'   => 'ryegrass',
                'minimum_dli'   => 20,
                'optimal_dli'   => 30,
                'critical_dli'  => 14,
                'shade_tolerance_rating' => 3,
                'photosynthetic_pathway' => 'C3',
                'dormancy_temp' => null,
                'shade_response' => [
                    'days_to_visible_decline' => 18,
                    'recovery_rate_modifier'  => 0.65,
                    'disease_susceptibility_increase' => 1.6,
                ],
                'source' => 'NTEP trials; Trappe et al. 2011',
            ],
            
            // =====================================================
            // KENTUCKY BLUEGRASS
            // =====================================================
            
            'kentucky_bluegrass' => [
                'name'          => 'Kentucky Bluegrass',
                'species'       => 'bluegrass',
                'species_aus'   => 'bluegrass',
                'minimum_dli'   => 16,
                'optimal_dli'   => 26,
                'critical_dli'  => 10,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C3',
                'dormancy_temp' => null,
                'shade_response' => [
                    'days_to_visible_decline' => 24,
                    'recovery_rate_modifier'  => 0.75,
                    'disease_susceptibility_increase' => 1.4,
                ],
                'source' => 'Gardner & Goss 2013',
            ],
            
            // =====================================================
            // KIKUYU
            // =====================================================
            
            'kikuyu' => [
                'name'          => 'Kikuyu',
                'species'       => 'kikuyu',
                'species_aus'   => 'kikuyu',
                'minimum_dli'   => 28,
                'optimal_dli'   => 38,
                'critical_dli'  => 22,
                'shade_tolerance_rating' => 3,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 8,
                'shade_response' => [
                    'days_to_visible_decline' => 18,
                    'recovery_rate_modifier'  => 0.75,
                    'disease_susceptibility_increase' => 1.25,
                ],
                'source' => 'South African sports turf research',
            ],
            
            // =====================================================
            // SEASHORE PASPALUM
            // =====================================================
            
            'seashore_paspalum' => [
                'name'          => 'Seashore Paspalum',
                'species'       => 'paspalum',
                'species_aus'   => 'paspalum',
                'minimum_dli'   => 30,
                'optimal_dli'   => 40,
                'critical_dli'  => 24,
                'shade_tolerance_rating' => 3,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 12,
                'shade_response' => [
                    'days_to_visible_decline' => 16,
                    'recovery_rate_modifier'  => 0.65,
                    'disease_susceptibility_increase' => 1.35,
                ],
                'source' => 'Duncan & Carrow 2000',
            ],
        ];
    }
    
    /**
     * Get variety data
     */
    public function get_variety( $variety ) {
        $key = $this->normalize_variety_key( $variety );
        
        if ( isset( $this->varieties[ $key ] ) ) {
            return $this->varieties[ $key ];
        }
        
        return $this->get_species_default( $variety );
    }
    
    /**
     * Normalize variety key
     */
    private function normalize_variety_key( $variety ) {
        $key = strtolower( trim( $variety ) );
        $key = str_replace( [ ' ', '-' ], '_', $key );
        return $key;
    }
    
    /**
     * Get all varieties with DLI data
     */
    public function get_varieties_with_dli_data() {
        return $this->varieties;
    }
    
    /**
     * Get species default when variety not found
     */
    private function get_species_default( $variety ) {
        $variety_lower = strtolower( $variety );
        
        // Handle 'auto' - default to PRG
        if ( $variety_lower === 'auto' ) {
            return [
                'name'          => 'Auto-detected (PRG)',
                'species'       => 'ryegrass',
                'minimum_dli'   => 18,
                'optimal_dli'   => 28,
                'critical_dli'  => 12,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C3',
                'dormancy_temp' => null,
                'shade_response' => [
                    'days_to_visible_decline' => 21,
                    'recovery_rate_modifier'  => 0.7,
                    'disease_susceptibility_increase' => 1.5,
                ],
                'source' => 'Auto default (PRG)',
            ];
        }
        
        // Zoysia
        if ( strpos( $variety_lower, 'zoysia' ) !== false || strpos( $variety_lower, 'zeon' ) !== false ) {
            return [
                'name'          => $variety,
                'species'       => 'zoysia',
                'minimum_dli'   => 20,
                'optimal_dli'   => 32,
                'critical_dli'  => 14,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C4',
                'dormancy_temp' => 10,
                'shade_response' => [
                    'days_to_visible_decline' => 28,
                    'recovery_rate_modifier'  => 0.8,
                    'disease_susceptibility_increase' => 1.2,
                ],
                'source' => 'Species default',
            ];
        }
        
        // Ryegrass
        if ( strpos( $variety_lower, 'rye' ) !== false ) {
            return [
                'name'          => $variety,
                'species'       => 'ryegrass',
                'minimum_dli'   => 18,
                'optimal_dli'   => 28,
                'critical_dli'  => 12,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C3',
                'dormancy_temp' => null,
                'shade_response' => [
                    'days_to_visible_decline' => 21,
                    'recovery_rate_modifier'  => 0.7,
                    'disease_susceptibility_increase' => 1.5,
                ],
                'source' => 'Species default',
            ];
        }
        
        // Bluegrass
        if ( strpos( $variety_lower, 'blue' ) !== false || strpos( $variety_lower, 'poa' ) !== false ) {
            return [
                'name'          => $variety,
                'species'       => 'bluegrass',
                'minimum_dli'   => 16,
                'optimal_dli'   => 26,
                'critical_dli'  => 10,
                'shade_tolerance_rating' => 4,
                'photosynthetic_pathway' => 'C3',
                'dormancy_temp' => null,
                'shade_response' => [
                    'days_to_visible_decline' => 24,
                    'recovery_rate_modifier'  => 0.75,
                    'disease_susceptibility_increase' => 1.4,
                ],
                'source' => 'Species default',
            ];
        }
        
        // Kikuyu
        if ( strpos( $variety_lower, 'kikuyu' ) !== false ) {
            return $this->varieties['kikuyu'];
        }
        
        // Default to couch/bermuda
        return [
            'name'          => $variety,
            'species'       => 'bermudagrass',
            'species_aus'   => 'couch',
            'minimum_dli'   => 32,
            'optimal_dli'   => 42,
            'critical_dli'  => 26,
            'shade_tolerance_rating' => 2,
            'photosynthetic_pathway' => 'C4',
            'dormancy_temp' => 10,
            'shade_response' => [
                'days_to_visible_decline' => 14,
                'recovery_rate_modifier'  => 0.6,
                'disease_susceptibility_increase' => 1.4,
            ],
            'source' => 'Species default',
        ];
    }
    
    /**
     * Check if variety is C4 (warm season)
     */
    public function is_c4( $variety ) {
        $data = $this->get_variety( $variety );
        return isset( $data['photosynthetic_pathway'] ) && $data['photosynthetic_pathway'] === 'C4';
    }
    
    /**
     * Get dormancy temperature for C4 grasses
     */
    public function get_dormancy_temp( $variety ) {
        $data = $this->get_variety( $variety );
        return $data['dormancy_temp'] ?? null;
    }
}
