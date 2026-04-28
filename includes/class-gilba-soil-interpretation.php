<?php
/**
 * Gilba Soil Interpretation Service
 * 
 * Generates AI-powered interpretations for soil analysis results.
 * Supports MLSN, SLAN, and Ammonium Acetate (Hill Labs NZ) methodologies.
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since 10.4.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Include base interpreter
require_once __DIR__ . '/class-gilba-interpretation.php';

class Gilba_Soil_Interpretation {
    
    /** @var Gilba_Interpretation Base interpreter instance */
    private $interpreter;
    
    /** @var array Methodology-specific configurations */
    private $methodology_config = [
        'MLSN' => [
            'name'        => 'MLSN',
            'full_name'   => 'Minimum Levels for Sustainable Nutrition',
            'description' => 'Threshold-based approach using Mehlich-3 extraction. Identifies minimum soil nutrient levels below which deficiency risk increases. Well-validated for golf putting greens.',
            'threshold_label' => 'MLSN threshold',
            'status_logic' => 'above_minimum',
        ],
        'SLAN' => [
            'name'        => 'SLAN',
            'full_name'   => 'Sufficiency Level of Available Nutrients',
            'description' => 'Traditional sufficiency-range approach using Mehlich-3 extraction. Defines low/sufficient/high ranges, widely used across all turf types.',
            'threshold_label' => 'sufficiency range',
            'status_logic' => 'within_range',
        ],
        'AMMONIUM_ACETATE' => [
            'name'        => 'Ammonium Acetate',
            'full_name'   => 'Hill Labs NZ Method',
            'description' => 'Olsen P (sodium bicarbonate) + NH₄OAc (pH 8.1) extraction. Ranges calibrated for New Zealand soil and turf conditions.',
            'threshold_label' => 'Hill Labs optimal range',
            'status_logic' => 'within_range',
            'phosphorus_method' => 'olsen',
        ],
        'COTULA_S78' => [
            'name'        => 'Hill Labs S78',
            'full_name'   => 'Hill Labs NZ — Turf Cotula (S78)',
            'description' => 'Olsen P + NH₄OAc (pH 8.1) extraction. Ranges calibrated specifically for Leptinella spp. bowling greens in New Zealand. MLSN does not apply — cotula is a dicot (Asteraceae).',
            'threshold_label' => 'Hill Labs S78 optimal range',
            'status_logic' => 'within_range',
            'phosphorus_method' => 'olsen',
            'nz_only' => true,
        ],
    ];
    
    /**
     * Constructor
     */
    public function __construct() {
        $this->interpreter = new Gilba_Interpretation();
    }
    
    /**
     * Check if interpretation service is available
     * 
     * @return bool
     */
    public function is_available() {
        return $this->interpreter->is_configured();
    }
    
    /**
     * Interpret soil analysis output
     * 
     * @param array $soil_output The SSOT soil output
     * @return array Interpretation result
     */
    public function interpret($soil_output ) {
        
        if ( ! $this->is_available() ) {
            return [
                'success' => false,
                'error'   => 'Interpretation service not configured',
            ];
        }

        // Cotula S78: completely separate prompt — cotula is a dicot, not a grass.
        // The standard template references MLSN, sand rootzones, and grass physiology.
        // None of that is relevant here; route to the dedicated cotula prompt builder.
        $methodology = strtolower( $this->to_scalar( $soil_output['methodology'] ?? '' ) );
        $surface     = strtolower( $this->to_scalar( $soil_output['surfaceType'] ?? '' ) );
        $is_cotula   = str_contains( $methodology, 'cotula' )
                    || str_contains( $methodology, 's78' )
                    || $surface === 'cotula_bowling_green';

        if ( $is_cotula ) {
            $prompt    = $this->build_cotula_prompt( $soil_output );
            $citations = $this->extract_cotula_citations();
        } else {
            $prompt    = $this->build_soil_prompt( $soil_output );
            $citations = $this->extract_citations( $soil_output );
        }
        
        return $this->interpreter->interpret_with_prompt( $prompt, $citations, 'summary' );
    }
    
    /**
     * Build the soil interpretation prompt
     * 
     * @param array $soil_output The SSOT soil output
     * @return string The complete prompt
     */
    private function build_soil_prompt($soil_output ) {
        
        $template = $this->get_prompt_template();
        
        $methodology = $this->normalise_methodology( $this->to_scalar( $soil_output['methodology'] ?? 'mlsn' ) );
        $config = $this->methodology_config[ $methodology ] ?? $this->methodology_config['MLSN'];
        $context = $soil_output['context'] ?? [];
        $confidence = $soil_output['confidence'] ?? [];
        
        // Flatten context values to scalars
        if ( is_array( $context ) ) {
            $context = $this->flatten_to_scalars( $context );
        } else {
            $context = [];
        }
        
        // Flatten confidence values
        if ( ! is_array( $confidence ) ) {
            $confidence = [];
        }
        
        // Build soil type note for Ammonium Acetate
        $soil_type_note = '';
        if ( $methodology === 'AMMONIUM_ACETATE' ) {
            $soil_type = $this->to_scalar( $context['soilType'] ?? $soil_output['soilType'] ?? 'others' );
            $soil_type_note = $soil_type === 'sands' 
                ? 'Sand-based rootzone (USGA spec) - adjusted K/Mg sufficiency ranges' 
                : 'Native soil profile - standard sufficiency ranges';
        }
        
        // Build extractant note
        $extractant_note = '';
        if ( isset( $soil_output['extractants'] ) && is_array( $soil_output['extractants'] ) ) {
            $ext = $soil_output['extractants'];
            $extractant_note = sprintf( 'P: %s, Cations: %s', 
                $this->to_scalar( $ext['P'] ?? 'standard' ), 
                $this->to_scalar( $ext['cations'] ?? 'standard' )
            );
        }
        
        return strtr( $template, [
            '{turf_type}'              => $this->format_turf_type( $this->to_scalar( $context['turf_type'] ?? $context['turfType'] ?? 'turf' ) ),
            '{use_context}'            => $this->to_scalar( $context['use'] ?? $context['surfaceType'] ?? 'general turf' ),
            '{region}'                 => $this->format_region( $this->to_scalar( $context['region'] ?? 'temperate' ) ),
            '{season}'                 => $this->to_scalar( $context['season'] ?? $this->detect_season( $context ) ),
            '{methodology_name}'       => $config['name'],
            '{methodology_full_name}'  => $config['full_name'],
            '{methodology_description}' => $config['description'],
            '{soil_type_note}'         => $soil_type_note,
            '{extractant_note}'        => $extractant_note,
            '{results_summary}'        => $this->format_results( $soil_output ),
            '{recommendations_summary}' => $this->format_recommendations( $soil_output ),
            '{confidence_overall}'     => $this->format_confidence_overall( $confidence ),
            '{confidence_factors}'     => $this->format_confidence_factors( isset( $confidence['factors'] ) ? $confidence['factors'] : [] ),
        ] );
    }
    
    /**
     * Delegate to base Gilba_Interpretation::to_scalar()
     */
    private function to_scalar( $value ) {
        return $this->interpreter->to_scalar( $value );
    }
    
    /**
     * Flatten an array to scalar values only
     * 
     * @param array $arr
     * @return array
     */
    private function flatten_to_scalars( $arr ) {
        if ( ! is_array( $arr ) ) {
            return [];
        }
        
        $result = [];
        foreach ( $arr as $key => $value ) {
            // Skip non-scalar keys
            if ( ! is_scalar( $key ) ) {
                continue;
            }
            $result[ $key ] = $this->to_scalar( $value );
        }
        return $result;
    }
    
    /**
     * Get the prompt template
     * 
     * @return string
     */
    private function get_prompt_template() {
        return <<<'PROMPT'
You are an agronomic advisor interpreting soil analysis for a turf manager working with {turf_type} ({use_context}) in {region} during {season}.

## Analysis methodology
{methodology_name} ({methodology_full_name})
{methodology_description}
{soil_type_note}
{extractant_note}

## Results
{results_summary}

## Current recommendations from analysis
{recommendations_summary}

## Confidence assessment
Overall confidence: {confidence_overall}
{confidence_factors}

## Your task
Provide a practical interpretation structured as:

Opening statement (1-2 sentences): Name the most important finding directly. If everything falls within range, say so. For sand-based sports turf or USGA-spec greens, a CEC of 5-12 meq/100g is normal — don't present it as alarming, but explain what it means practically (nutrients move fast, split applications or CRFs work better than large seasonal doses).

Pattern analysis (2-4 plain subheadings): Each subheading names the specific issue or observation (e.g. "Leaching vulnerability amplified:" or "Calcium supply precarious:"). Write 2-4 complete sentences under each — no bullet fragments. Cover nutrient interactions, ratios worth noting, and rootzone characteristics. Say what is NOT a concern if that's the case.

Recommended actions (numbered): Lead with the action as a complete sentence, then explain the rationale. Be consistent — if you mention split applications and CRFs as valid options, don't then prescribe only one. Frame guidance around the outcome needed (steady supply, avoiding deficiency). If recommending frequency, make clear it applies to soluble fertilisers. Give practical options like foliar if soil delivery is limited.

Monitoring priority (1-2 sentences): What to retest, when, and why.

## Writing style
- Conversational and direct — this is a busy turf manager who needs clarity, not a textbook
- Use "you" and "your" throughout
- Use UK/Australian English spelling (fertiliser, colour, analyse)
- Plain subheadings, not bold markdown headers like **What matters most**
- Complete sentences throughout — "This is a classic sand rootzone dilemma" not "Classic sand rootzone dilemma:"
- Action-first in recommendations: what to do, then why
- Say "fall within range" not "sit in range"
- Say "at the moment" not "today"
- Say "turf" not "sward"
- Say "after mowing" not "post-mowing"
- Say "you only apply" not "you're relying on"
- Drop unnecessary qualifiers like "measured" before nutrient levels
- Don't hedge about data — interpret confidently
- Be internally consistent — don't present options then ignore some in recommendations
- Reference citations as [citation-id] only where a claim depends on research methodology
PROMPT;
    }
    
    /**
     * Format soil test results for the prompt
     * 
     * @param array $soil_output The SSOT soil output
     * @return string Formatted results
     */
    private function format_results($soil_output ) {
        
        $lines = [];
        $nutrients = isset( $soil_output['nutrients'] ) ? $soil_output['nutrients'] : [];
        $methodology = $this->normalise_methodology( isset( $soil_output['methodology'] ) ? $soil_output['methodology'] : 'mlsn' );
        
        // Handle both array of nutrient objects and flat ppm structure
        if ( ! empty( $nutrients ) && is_array( $nutrients ) && isset( $nutrients[0] ) && is_array( $nutrients[0] ) ) {
            // Array of nutrient objects (progressive disclosure output)
            foreach ( $nutrients as $nutrient ) {
                if ( is_array( $nutrient ) ) {
                    $lines[] = $this->format_nutrient_line( $nutrient, $methodology );
                }
            }
        } else {
            // Flat structure - build from ppm values
            $ppm = isset( $soil_output['ppm'] ) ? $soil_output['ppm'] : $soil_output;
            $thresholds = isset( $soil_output['thresholds'] ) ? $soil_output['thresholds'] : [];
            
            if ( is_array( $ppm ) ) {
                $nutrient_list = array( 'P', 'K', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Cu', 'Zn' );
                foreach ( $nutrient_list as $n ) {
                    $value = isset( $ppm[ $n ] ) ? $ppm[ $n ] : null;
                    if ( $value !== null && $value !== '' ) {
                        $threshold = isset( $thresholds[ $n ] ) ? $thresholds[ $n ] : null;
                        $lines[] = $this->format_simple_nutrient( $n, $value, $threshold, $methodology );
                    }
                }
            }
        }
        
        // Add pH if present
        $ph = isset( $soil_output['pH'] ) ? $soil_output['pH'] : ( isset( $soil_output['ph'] ) ? $soil_output['ph'] : null );
        if ( $ph !== null ) {
            $ph_status = $this->assess_ph( (float) $ph );
            array_unshift( $lines, sprintf( '- pH: %s (%s)', $ph, $ph_status ) );
        }
        
        // Add CEC if present
        $cec = isset( $soil_output['CEC'] ) ? $soil_output['CEC'] : ( isset( $soil_output['cec'] ) ? $soil_output['cec'] : null );
        if ( $cec !== null && $cec !== '' ) {
            $cec_status = $this->assess_cec( (float) $cec );
            $lines[] = sprintf( '- CEC: %s meq/100g (%s)', $cec, $cec_status );
        }
        
        return implode( "\n", $lines ) ?: 'No nutrient data available';
    }
    
    /**
     * Assess CEC status
     * 
     * @param float $cec CEC value in meq/100g
     * @return string Status description
     */
    private function assess_cec( $cec ) {
        if ( $cec < 5 ) {
            return 'very low - typical of sand-based rootzones, rapid nutrient leaching expected';
        } elseif ( $cec < 10 ) {
            return 'low - light frequent fertilisation recommended';
        } elseif ( $cec < 20 ) {
            return 'moderate - good nutrient retention';
        } elseif ( $cec < 30 ) {
            return 'high - excellent nutrient retention';
        } else {
            return 'very high - clay-dominated, watch for drainage';
        }
    }
    
    /**
     * Format a single nutrient line from progressive disclosure output
     * 
     * @param array  $nutrient    Nutrient data object
     * @param string $methodology Current methodology
     * @return string Formatted line
     */
    private function format_nutrient_line($nutrient, $methodology ) {
        
        // Ensure nutrient is an array
        if ( ! is_array( $nutrient ) ) {
            return '- Unknown nutrient (invalid data)';
        }
        
        $status_emoji = $this->status_emoji( isset( $nutrient['status'] ) ? $nutrient['status'] : 'unknown' );
        $name = isset( $nutrient['nutrient'] ) ? $nutrient['nutrient'] : 'Unknown';
        $value = isset( $nutrient['actual'] ) ? $nutrient['actual'] : ( isset( $nutrient['value'] ) ? $nutrient['value'] : '?' );
        $unit = isset( $nutrient['unit'] ) ? $nutrient['unit'] : 'ppm';
        $status = isset( $nutrient['status'] ) ? $nutrient['status'] : 'NO DATA';
        
        // Format threshold based on methodology
        $threshold_str = isset( $nutrient['mlsn'] ) ? $nutrient['mlsn'] : ( isset( $nutrient['threshold'] ) ? $nutrient['threshold'] : 'n/a' );
        if ( isset( $nutrient['rangeMin'] ) && isset( $nutrient['rangeMax'] ) ) {
            $threshold_str = sprintf( '%s–%s', $nutrient['rangeMin'], $nutrient['rangeMax'] );
        }
        
        // Add sufficiency ratio if available
        $ratio_str = '';
        if ( isset( $nutrient['sufficiency'] ) && is_numeric( $nutrient['sufficiency'] ) ) {
            $ratio_str = sprintf( ', sufficiency: %.2f', $nutrient['sufficiency'] );
        }
        
        return sprintf(
            '- %s %s: %s %s (threshold: %s%s) — %s',
            $status_emoji,
            $name,
            $value,
            $unit,
            $threshold_str,
            $ratio_str,
            $this->status_note( $status, $nutrient )
        );
    }
    
    /**
     * Format a simple nutrient from flat structure
     * 
     * @param string     $name       Nutrient name
     * @param mixed      $value      Nutrient value
     * @param array|null $threshold  Threshold data
     * @param string     $methodology Current methodology
     * @return string Formatted line
     */
    private function format_simple_nutrient($name, $value, $threshold, $methodology ) {
        
        $threshold_str = 'n/a';
        $status = 'NO DATA';
        
        if ( $threshold ) {
            if ( isset( $threshold['min'], $threshold['max'] ) ) {
                $threshold_str = sprintf( '%s–%s', $threshold['min'], $threshold['max'] );
                $status = $this->assess_range_status( (float) $value, $threshold['min'], $threshold['max'] );
            } elseif ( isset( $threshold['min'] ) ) {
                $threshold_str = (string) $threshold['min'];
                $status = (float) $value >= $threshold['min'] ? 'SUFFICIENT' : 'LOW';
            }
        }
        
        $emoji = $this->status_emoji( $status );
        
        return sprintf( '- %s %s: %s ppm (threshold: %s) — %s', $emoji, $name, $value, $threshold_str, strtolower( $status ) );
    }
    
    /**
     * Format recommendations from SSOT output
     * 
     * @param array $soil_output The SSOT soil output
     * @return string Formatted recommendations
     */
    private function format_recommendations($soil_output ) {
        
        $recommendations = $soil_output['recommendations'] ?? [];
        
        if ( empty( $recommendations ) ) {
            return 'No nutrient applications currently recommended.';
        }
        
        $lines = [];
        foreach ( $recommendations as $rec ) {
            $nutrient = $rec['nutrient'] ?? 'Unknown';
            $action = $rec['action'] ?? 'apply';
            $rate = $rec['rate'] ?? 'rate TBD';
            $priority = $rec['priority'] ?? 'moderate';
            $timeframe = $rec['timeframe'] ?? 'when appropriate';
            
            $lines[] = sprintf( '- %s %s: %s (%s priority, %s)', ucfirst( $action ), $nutrient, $rate, $priority, $timeframe );
        }
        
        return implode( "\n", $lines );
    }
    
    /**
     * Format overall confidence
     * 
     * @param array $confidence Confidence data
     * @return string Formatted confidence
     */
    private function format_confidence_overall($confidence ) {
        
        $score = $confidence['overall'] ?? $confidence['score'] ?? null;
        
        if ( $score === null ) {
            return 'Not assessed';
        }
        
        // Handle both 0-1 and 0-100 scales
        $pct = $score <= 1 ? $score * 100 : $score;
        
        $label = match( true ) {
            $pct >= 85 => 'High',
            $pct >= 65 => 'Moderate',
            $pct >= 45 => 'Low',
            default    => 'Very low',
        };
        
        return sprintf( '%s (%.0f%%)', $label, $pct );
    }
    
    /**
     * Format confidence factors
     * 
     * @param array $factors Confidence factors
     * @return string Formatted factors
     */
    private function format_confidence_factors($factors ) {
        
        if ( empty( $factors ) || ! is_array( $factors ) ) {
            return 'No detailed confidence breakdown available.';
        }
        
        $lines = [];
        foreach ( $factors as $key => $data ) {
            // Skip if key is not a valid string/int or data is not an array
            if ( is_array( $key ) || is_object( $key ) ) {
                continue;
            }
            if ( ! is_array( $data ) ) {
                // Handle simple key => value format
                $lines[] = sprintf( '- %s: %s', $this->humanise_factor_name( (string) $key ), (string) $data );
                continue;
            }
            
            $factor_name = $this->humanise_factor_name( (string) $key );
            $value = isset( $data['value'] ) ? $data['value'] : ( isset( $data['score'] ) ? $data['score'] : 0 );
            $pct = $value <= 1 ? $value * 100 : $value;
            $note = isset( $data['note'] ) ? $data['note'] : ( isset( $data['factor'] ) ? $data['factor'] : '' );
            
            $lines[] = sprintf( '- %s: %.0f%% — %s', $factor_name, $pct, $note );
        }
        
        return implode( "\n", $lines ) ?: 'No detailed confidence breakdown available.';
    }
    
    /**
     * Extract citations from soil output
     * 
     * @param array $soil_output The SSOT soil output
     * @return array Citation registry
     */
    private function extract_citations($soil_output ) {
        
        // Check for citations in output
        if ( isset( $soil_output['citations'] ) ) {
            return $soil_output['citations'];
        }
        
        // Build default citations based on methodology
        $methodology = $this->normalise_methodology( $soil_output['methodology'] ?? 'mlsn' );
        
        $default_citations = [
            'MLSN' => [
                'mlsn-2018' => [
                    'title'   => 'MLSN Guidelines for Turfgrass',
                    'authors' => 'Woods et al.',
                    'year'    => 2018,
                    'url'     => 'https://www.asianturfgrass.com/buckets/mlsn_article_woods_et_al_2018.pdf',
                ],
            ],
            'SLAN' => [
                'carrow-2004' => [
                    'title'   => 'SLAN Approach for Turfgrass Fertilization',
                    'authors' => 'Carrow et al.',
                    'year'    => 2004,
                    'url'     => '',
                ],
            ],
            'AMMONIUM_ACETATE' => [
                'hill-turf-guide' => [
                    'title'   => 'Turf Interpretation Guide',
                    'authors' => 'Hill Laboratories',
                    'year'    => 2022,
                    'url'     => 'https://www.hill-laboratories.com/',
                ],
            ],
            'COTULA_S78' => [
                'hill-s78' => [
                    'title'   => 'TURF Cotula (S78) — Soil Interpretation Ranges',
                    'authors' => 'RJ Hill Laboratories Ltd',
                    'year'    => 2024,
                    'url'     => 'https://www.hill-labs.co.nz/',
                ],
                'evans-1984' => [
                    'title'   => 'The use of cotula for bowling greens in New Zealand',
                    'authors' => 'Evans, P.S.',
                    'year'    => 1984,
                    'url'     => '',
                ],
            ],
        ];
        
        return $default_citations[ $methodology ] ?? [];
    }
    
    /**
     * Normalise methodology string
     * 
     * @param string $methodology Raw methodology string
     * @return string Normalised key
     */
    private function normalise_methodology($methodology ) {
        
        $upper = strtoupper( str_replace( [ '-', ' ' ], '_', $methodology ) );
        
        return match( true ) {
            str_contains( $upper, 'COTULA' )   => 'COTULA_S78',
            str_contains( $upper, 'S78' )      => 'COTULA_S78',
            str_contains( $upper, 'AMMONIUM' ) => 'AMMONIUM_ACETATE',
            str_contains( $upper, 'SLAN' )     => 'SLAN',
            default                            => 'MLSN',
        };
    }
    
    /**
     * Get status emoji
     * 
     * @param string $status Status string
     * @return string Emoji
     */
    private function status_emoji($status ) {
        
        return match( strtoupper( $status ) ) {
            'SUFFICIENT', 'OPTIMAL', 'ADEQUATE' => '✓',
            'MONITOR', 'BORDERLINE'             => '⚠',
            'LOW', 'DEFICIENT'                  => '✗',
            'HIGH', 'EXCESS'                    => '↑',
            default                             => '?',
        };
    }
    
    /**
     * Get status note
     * 
     * @param string $status  Status string
     * @param array  $nutrient Nutrient data
     * @return string Status note
     */
    private function status_note($status, $nutrient ) {
        
        $sufficiency = $nutrient['sufficiency'] ?? null;
        
        if ( $sufficiency !== null ) {
            return match( true ) {
                $sufficiency >= 2.0 => 'well above minimum, no action needed',
                $sufficiency >= 1.5 => 'comfortably sufficient',
                $sufficiency >= 1.0 => 'sufficient but worth monitoring',
                $sufficiency >= 0.8 => 'approaching threshold, consider application',
                default             => 'below threshold, application recommended',
            };
        }
        
        return match( strtoupper( $status ) ) {
            'SUFFICIENT', 'OPTIMAL', 'ADEQUATE' => 'within range',
            'HIGH', 'EXCESS'                    => 'above range, reduce inputs',
            'LOW', 'DEFICIENT'                  => 'below range, application recommended',
            'MONITOR', 'BORDERLINE'             => 'borderline, monitor closely',
            default                             => '',
        };
    }
    
    /**
     * Assess pH status
     * 
     * @param float $ph pH value
     * @return string Status description
     */
    private function assess_ph($ph ) {
        
        return match( true ) {
            $ph < 5.0 => 'very acidic - may limit nutrient availability',
            $ph < 5.5 => 'moderately acidic',
            $ph < 6.0 => 'slightly acidic',
            $ph <= 7.0 => 'optimal range',
            $ph <= 7.5 => 'slightly alkaline',
            $ph <= 8.0 => 'moderately alkaline',
            default   => 'highly alkaline - micronutrient lockout risk',
        };
    }
    
    /**
     * Assess range-based status
     * 
     * @param float $value Current value
     * @param float $min   Range minimum
     * @param float $max   Range maximum
     * @return string Status
     */
    private function assess_range_status($value, $min, $max ) {
        
        if ( $value < $min ) {
            return 'LOW';
        }
        if ( $value > $max ) {
            return 'HIGH';
        }
        return 'SUFFICIENT';
    }
    
    /**
     * Humanise factor name
     * 
     * @param string $factor Raw factor name
     * @return string Human-readable name
     */
    private function humanise_factor_name($factor ) {
        return ucfirst( str_replace( [ '_', '-' ], ' ', $factor ) );
    }
    
    /**
     * Delegate to base Gilba_Interpretation::format_turf_type()
     */
    private function format_turf_type( $turf_type ) {
        return $this->interpreter->format_turf_type( $turf_type );
    }

    /**
     * Delegate to base Gilba_Interpretation::format_region()
     */
    private function format_region( $region ) {
        return $this->interpreter->format_region( $region );
    }

    /**
     * Delegate to base Gilba_Interpretation::detect_season()
     * Fixes: soil version was missing south africa/argentina/chile detection
     */
    private function detect_season( $context ) {
        return $this->interpreter->detect_season( $context );
    }

    // =========================================================================
    // COTULA S78 — DEDICATED PROMPT BUILDER
    // Completely separate from the grass soil template. Cotula is a dicot;
    // MLSN, sand rootzone, and GP-linked guidance are all inapplicable.
    // =========================================================================

    /**
     * Build interpretation prompt specifically for Hill Labs S78 Cotula results.
     *
     * @param array $soil_output The SSOT soil output (cotula_s78 methodology)
     * @return string The complete prompt
     */
    private function build_cotula_prompt( $soil_output ) {

        $context    = $soil_output['context'] ?? [];
        $confidence = $soil_output['confidence'] ?? [];

        if ( is_array( $context ) ) {
            $context = $this->flatten_to_scalars( $context );
        }

        $region  = $this->format_region( $this->to_scalar( $context['region'] ?? 'new_zealand' ) );
        $season  = $this->to_scalar( $context['season'] ?? $this->detect_season( $context ) );
        $club    = $this->to_scalar( $context['site'] ?? $context['siteName'] ?? 'the bowling club' );

        $results_text  = $this->format_cotula_results( $soil_output );
        $antagonism    = $this->format_cotula_antagonism( $soil_output );
        $conf_overall  = $this->format_confidence_overall( $confidence );
        $conf_factors  = $this->format_confidence_factors( isset( $confidence['factors'] ) ? $confidence['factors'] : [] );

        return <<<PROMPT
You are an agronomic advisor interpreting a Hill Labs soil analysis for a bowls greenkeeper managing a cotula (Leptinella) bowling green at {$club} in {$region} during {$season}.

## What cotula is — and why it matters for interpretation

Cotula (Leptinella dioica / L. maniototo) is a native New Zealand dicot in the family Asteraceae. It is not a grass. This has three direct consequences for interpretation:

1. MLSN does not apply. Those thresholds were derived entirely from turfgrass tissue and soil data. Do not reference them.
2. Growth potential models (C3/C4) do not apply. Cotula has its own temperature activity window (roughly 8–24°C).
3. No published tissue N ratio data exists for cotula. Nutrient uptake guidance must be based on the S78 soil sufficiency ranges, not N-linked demand calculations.

The reference for all sufficiency judgements is the Hill Labs TURF Cotula (S78) interpretation ranges. These are the only calibrated thresholds for this surface.

## Analysis methodology

Hill Labs S78 — Turf Cotula
Extractants: Olsen P (NaHCO₃) for phosphorus; NH₄OAc (pH 8.1) for cations.
Results reported as %BS and me/100g for cations; mg/L for Olsen P.
Sample depth: 0–75 mm.
Reference: RJ Hill Laboratories Ltd [hill-s78]

## Results against Hill Labs S78 ranges

{$results_text}

{$antagonism}

## Confidence assessment
Overall: {$conf_overall}
{$conf_factors}

## Your task

Provide a practical interpretation structured as follows. Write for a greenkeeper, not a scientist.

Opening statement (1–2 sentences): Name the single most important finding. If the only out-of-range result is phosphorus being high, lead with that and note that everything else is in order.

Pattern analysis (2–4 plain subheadings): Each subheading names a specific issue or observation — e.g. "Phosphorus history:" or "K/Mg balance at the boundary:". Write 2–4 complete sentences under each. Explain what the finding means practically for cotula performance, not just that a number is high or low. Cover: phosphorus status (very common problem on older NZ bowling greens — legacy accumulation from decades of superphosphate); potassium status and the K/Mg relationship; cation balance (Ca, Mg, Na %BS); pH and CEC context. If something is not a concern, say so briefly.

Recommended actions (numbered): State the action as a complete sentence first, then the rationale. For K, specify sulphate of potash (SOP) rather than muriate — cotula is sensitive to chloride. For P, be direct: if it is very high, say to eliminate all P inputs and do not recommend P in the fertiliser program. For pH correction, name the product (calcitic lime, not dolomite, unless Mg is also low). Be specific about timing — cotula responds best to inputs during active growth (September–April in southern NZ).

Monitoring priority (1 sentence): Specify what to retest and when.

## Writing rules

- Write in UK/Australian English (fertiliser, colour, analyse)
- Use "you" and "your" throughout — address the greenkeeper directly
- Plain subheadings only — no bold markdown like **Phosphorus is high**
- Complete sentences throughout
- Action-first in numbered recommendations
- Be direct — this person manages a bowling green, not a golf course putting green, and needs practical guidance
- Do not mention MLSN, SLAN, Mehlich-3, growth potential, or C3/C4 physiology
- Do not use the word "sward"
- Do not use the phrase "it is worth noting"
- Do not hedge — if the data says something clearly, say it clearly
- Reference citations as [citation-id] only where a specific claim depends on published data
PROMPT;
    }

    /**
     * Format S78 results for the cotula prompt.
     * Reads directly from the SSOT soil output keys produced by interpretCotulaSoilTest().
     *
     * @param array $soil_output
     * @return string Formatted results block
     */
    private function format_cotula_results( $soil_output ) {

        // S78 parameter definitions: key => [label, unit, range_display]
        $params = [
            'pH'         => [ 'pH',             'pH units',  '5.8–6.5' ],
            'P_olsen'    => [ 'Olsen P',         'mg/L',      '20–30'   ],
            'K_pct_bs'   => [ 'K',               '%BS',       '3.0–6.0' ],
            'K_me'       => [ 'K',               'me/100g',   null      ],
            'Ca_pct_bs'  => [ 'Ca',              '%BS',       '45–75'   ],
            'Ca_me'      => [ 'Ca',              'me/100g',   null      ],
            'Mg_pct_bs'  => [ 'Mg',              '%BS',       '5.0–15.0'],
            'Mg_me'      => [ 'Mg',              'me/100g',   null      ],
            'Na_pct_bs'  => [ 'Na',              '%BS',       '0–5.0'   ],
            'Na_me'      => [ 'Na',              'me/100g',   null      ],
            'CEC'        => [ 'CEC',             'me/100g',   '12–25'   ],
            'TBS'        => [ 'Total BS',        '%',         '40–80'   ],
            'VW'         => [ 'Volume weight',   'g/mL',      '0.60–1.00'],
            'K_Mg_ratio' => [ 'K/Mg ratio',      '',          '0.3–1.0' ],
        ];

        // Results may come nested under 'results' (from interpretCotulaSoilTest output)
        // or flat in the soil_output itself (when passed directly as SSOT state)
        $r        = isset( $soil_output['results'] ) && is_array( $soil_output['results'] )
                    ? $soil_output['results'] : [];
        $flat     = $soil_output; // fallback for direct keys

        $lines = [];
        foreach ( $params as $key => [$label, $unit, $range] ) {

            // Prefer pre-interpreted result object
            if ( isset( $r[ $key ] ) && is_array( $r[ $key ] ) ) {
                $res     = $r[ $key ];
                $value   = $this->to_scalar( $res['value'] ?? '—' );
                $status  = strtoupper( $this->to_scalar( $res['status'] ?? 'NO DATA' ) );
            } else {
                // Fall back to raw value on soil_output
                $raw = $flat[ $key ] ?? null;
                if ( $raw === null || $raw === '' ) continue;
                $value = $this->to_scalar( $raw );
                // Determine status from range
                $status = $this->assess_s78_status( $key, (float) $value );
            }

            $emoji     = $this->status_emoji( $status );
            $range_str = $range ? " (range: {$range})" : '';
            $unit_str  = $unit  ? " {$unit}"            : '';
            $flag      = ( $status === 'LOW' || $status === 'HIGH' ) ? ' <<< ' . $status : '';

            // Only show me/100g lines if they add context (skip if already showed %BS)
            if ( str_ends_with( $key, '_me' ) ) {
                $lines[] = sprintf( '  (%s me/100g)', $value );
                continue;
            }

            $lines[] = sprintf(
                '- %s %s: %s%s%s%s',
                $emoji, $label, $value, $unit_str, $range_str, $flag
            );
        }

        // Append sample depth and soil type if present
        $depth     = $flat['sample_depth_mm'] ?? null;
        $soil_type = $flat['soil_type'] ?? null;
        if ( $depth )     $lines[] = "- Sample depth: {$depth} mm";
        if ( $soil_type ) $lines[] = "- Soil type: {$soil_type}";

        return implode( "
", $lines ) ?: 'No S78 results available.';
    }

    /**
     * Format K/Mg antagonism alert if present.
     *
     * @param array $soil_output
     * @return string Alert text or empty string
     */
    private function format_cotula_antagonism( $soil_output ) {

        $alert = $soil_output['antagonismAlert'] ?? null;
        if ( ! $alert || ! is_array( $alert ) ) return '';

        $severity = strtoupper( $this->to_scalar( $alert['severity'] ?? 'moderate' ) );
        $message  = $this->to_scalar( $alert['message'] ?? '' );

        if ( ! $message ) return '';

        return "## K/Mg antagonism [{$severity}]
{$message}";
    }

    /**
     * Assess S78 parameter status from raw value.
     * Used as fallback when pre-interpreted result objects are not present.
     *
     * @param string $param S78 parameter key
     * @param float  $value Measured value
     * @return string 'LOW' | 'SUFFICIENT' | 'HIGH'
     */
    private function assess_s78_status( $param, $value ) {

        // S78 ranges: [low_min, low_max, high_min] where medium = [low_max, high_min]
        $ranges = [
            'pH'         => [ 5.8, 6.5 ],
            'P_olsen'    => [ 20,  30  ],
            'K_pct_bs'   => [ 3.0, 6.0 ],
            'Ca_pct_bs'  => [ 45,  75  ],
            'Mg_pct_bs'  => [ 5.0, 15.0],
            'Na_pct_bs'  => [ 0,   5.0 ],
            'CEC'        => [ 12,  25  ],
            'TBS'        => [ 40,  80  ],
            'VW'         => [ 0.6, 1.0 ],
            'K_Mg_ratio' => [ 0.3, 1.0 ],
        ];

        if ( ! isset( $ranges[ $param ] ) ) return 'NO DATA';

        [ $min, $max ] = $ranges[ $param ];

        if ( $value < $min ) return 'LOW';
        if ( $value > $max ) return 'HIGH';
        return 'SUFFICIENT';
    }

    /**
     * Return citations specific to cotula S78 interpretation.
     *
     * @return array Citation registry
     */
    private function extract_cotula_citations() {
        return [
            'hill-s78' => [
                'title'   => 'TURF Cotula (S78) Soil Interpretation Ranges',
                'authors' => 'RJ Hill Laboratories Ltd',
                'year'    => 2024,
                'url'     => 'https://www.hill-labs.co.nz/',
            ],
            'evans-1984' => [
                'title'   => 'The use of cotula for bowling greens in New Zealand',
                'authors' => 'Evans, P.S.',
                'year'    => 1984,
                'url'     => '',
            ],
        ];
    }


}
