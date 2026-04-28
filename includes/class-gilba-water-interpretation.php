<?php
/**
 * Gilba Water Quality Interpretation Service
 * 
 * Generates AI-powered interpretations for irrigation water quality results.
 * Covers salinity, sodicity (SAR), toxicity risks, and treatment recommendations.
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since 10.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Include base interpreter
require_once __DIR__ . '/class-gilba-interpretation.php';

class Gilba_Water_Interpretation {
    
    /** @var Gilba_Interpretation Base interpreter instance */
    private $interpreter;
    
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
     * Interpret water quality output
     * 
     * @param array $water_output The water quality output from Hub
     * @return array Interpretation result
     */
    public function interpret( $water_output ) {
        
        if ( ! $this->is_available() ) {
            return [
                'success' => false,
                'error'   => 'Interpretation service not configured',
            ];
        }
        
        $prompt = $this->build_water_prompt( $water_output );
        $citations = $this->extract_citations( $water_output );
        
        return $this->interpreter->interpret_with_prompt( $prompt, $citations, 'summary' );
    }
    
    /**
     * Build the water interpretation prompt
     * 
     * @param array $water_output The water quality output
     * @return string The complete prompt
     */
    private function build_water_prompt( $water_output ) {
        
        $template = $this->get_prompt_template();
        
        $context = $water_output['context'] ?? [];
        $ions = $water_output['ions'] ?? [];
        $diagnostics = $water_output['diagnostics'] ?? [];
        
        // Detect season from context or default
        $season = $this->detect_season( $context );
        
        // Format the data sections
        $replacements = [
            '{turf_type}'        => $this->format_turf_type( $this->to_scalar( $context['turfType'] ?? $context['turf_type'] ?? 'turf' ) ),
            '{region}'           => $this->format_region( $this->to_scalar( $context['region'] ?? 'temperate' ) ),
            '{season}'           => $season,
            '{water_source}'     => $this->to_scalar( $context['waterSource'] ?? $context['water_source'] ?? 'irrigation water' ),
            '{ion_summary}'      => $this->format_ion_summary( $ions ),
            '{diagnostic_summary}' => $this->format_diagnostics( $diagnostics ),
            '{risk_summary}'     => $this->format_risk_summary( $diagnostics ),
            '{ecw}'              => $this->format_ec( $water_output ),
            '{sar}'              => $this->format_sar( $water_output ),
        ];
        
        return strtr( $template, $replacements );
    }
    
    /**
     * Get the prompt template for water interpretation
     * 
     * @return string
     */
    private function get_prompt_template() {
        
        return <<<'PROMPT'
You are an agronomic advisor interpreting irrigation water quality results for a turf manager managing {turf_type} in {region} during {season}.

## Water Source
{water_source}

## Ion Concentrations (mg/L)
{ion_summary}

## Key Indices
{ecw}
{sar}

## Diagnostic Results
{diagnostic_summary}

## Risk Summary
{risk_summary}

## Your task
Provide a practical interpretation structured as:

Opening statement (1-2 sentences): Name the key water quality situation directly — what is the main concern, or if the water is suitable, say so clearly.

Pattern analysis (2-4 plain subheadings): Each subheading names the specific issue (e.g. "Bicarbonate-driven pH pressure:" or "Sodium is currently not an issue:"). Write 2-4 sentences under each — complete sentences, no bullet fragments. Cover:
- The dominant concern (salinity/EC, sodium hazard/SAR, specific ion toxicity, bicarbonate effects) with actual values
- Any interactions between parameters (e.g. high bicarbonates making effective sodium hazard worse than SAR alone suggests; leaching fraction vs nutrient retention trade-off on low-CEC profiles)
- What is NOT a concern right now — say so directly if SAR or Na is low

Recommended actions (numbered): Lead each with the action as a plain sentence, then explain the rationale and mechanism. Be specific about rates, timing, and monitoring. No bold headers on the action items.

Monitoring priority (1-2 sentences): What to retest, when, and why that timing captures the critical information.

## CRITICAL CONSTRAINTS — Do not violate these:
- NEVER recommend drip or subsurface irrigation for turf — turf is irrigated by sprinklers, this is not negotiable
- NEVER recommend switching irrigation systems — focus on what can be done with existing infrastructure
- Keep recommendations practical for professional turf managers (golf courses, sports fields, bowling greens)
- Focus on: water treatment, leaching practices, timing, soil amendments, monitoring

## Writing style
- Use UK English spelling throughout (fertiliser, colour, behaviour, sulphur, sulphuric, sulphate, etc.)
- Write as an experienced agronomist talking directly to a superintendent, not as a formal report
- Use "you" and "your" throughout — address the reader personally
- Use plain subheadings (e.g. "Bicarbonate-driven pH pressure:") not bold markdown headers
- Write in complete sentences, not fragments — "This is a classic sand rootzone dilemma" not "Classic sand rootzone dilemma:"
- Action-first in recommendations: lead with what to do, then explain why
- Shorter, plainer sentences — break compound clauses rather than stacking them
- Say "you aren't going to see" not "without tissue data, early warning signs cannot be detected"
- Say "a couple of weeks" rather than "fortnightly" where it reads more naturally
- Say "fall within range" not "sit in range"
- Say "at the moment" not "today"
- Say "turf" not "sward"
- Say "gypsum" not "calcium sulfate"
- Say "sulphuric acid" not "sulfuric acid"
- Drop academic hedging — interpret confidently based on the data provided
- If SAR and SARadj differ significantly, explain which one to act on and why
- Avoid adverbs like "progressively", "continuously", "increasingly" where simpler phrasing works
- Keep response concise — aim for ~400 words maximum
PROMPT;
    }
    
    /**
     * Format ion concentrations for prompt
     */
    private function format_ion_summary( $ions ) {
        
        if ( empty( $ions ) ) {
            return 'No ion data provided';
        }
        
        $lines = [];
        $ion_names = [
            'Ca'   => 'Calcium',
            'Mg'   => 'Magnesium', 
            'Na'   => 'Sodium',
            'K'    => 'Potassium',
            'Cl'   => 'Chloride',
            'HCO3' => 'Bicarbonate',
            'CO3'  => 'Carbonate',
            'SO4'  => 'Sulfate',
            'B'    => 'Boron',
            'Fe'   => 'Iron',
        ];
        
        foreach ( $ion_names as $key => $name ) {
            if ( isset( $ions[ $key ] ) && $ions[ $key ] > 0 ) {
                $lines[] = sprintf( '- %s: %.1f mg/L', $name, $ions[ $key ] );
            }
        }
        
        // Also check for pH and EC in ions array
        if ( isset( $ions['pH'] ) && $ions['pH'] > 0 ) {
            $lines[] = sprintf( '- pH: %.1f', $ions['pH'] );
        }
        
        return empty( $lines ) ? 'No ion data provided' : implode( "\n", $lines );
    }
    
    /**
     * Format diagnostics for prompt
     */
    private function format_diagnostics( $diagnostics ) {
        
        if ( empty( $diagnostics ) ) {
            return 'No diagnostic data available';
        }
        
        $lines = [];
        
        foreach ( $diagnostics as $diag ) {
            $param = $diag['parameter'] ?? $diag['label'] ?? 'Unknown';
            $value = $diag['value'] ?? 'N/A';
            $unit = $diag['unit'] ?? '';
            $status = $diag['status'] ?? '';
            $driver = $diag['driver'] ?? '';
            
            $line = sprintf( '- %s: %s %s', $param, $value, $unit );
            if ( $status ) {
                $line .= sprintf( ' — %s', $status );
            }
            if ( $driver ) {
                $line .= sprintf( ' (%s)', $driver );
            }
            
            $lines[] = $line;
        }
        
        return implode( "\n", $lines );
    }
    
    /**
     * Format risk summary
     */
    private function format_risk_summary( $diagnostics ) {
        
        if ( empty( $diagnostics ) ) {
            return 'No risk data available';
        }
        
        $high_risk = [];
        $caution = [];
        $ok = [];
        
        foreach ( $diagnostics as $diag ) {
            $status_class = $diag['statusClass'] ?? '';
            $param = $diag['parameter'] ?? $diag['label'] ?? 'Unknown';
            
            if ( $status_class === 'status-deficient' || strpos( strtolower( $diag['status'] ?? '' ), 'high' ) !== false ) {
                $high_risk[] = $param;
            } elseif ( $status_class === 'status-borderline' || strpos( strtolower( $diag['status'] ?? '' ), 'moderate' ) !== false ) {
                $caution[] = $param;
            } else {
                $ok[] = $param;
            }
        }
        
        $lines = [];
        if ( ! empty( $high_risk ) ) {
            $lines[] = '⚠️ High risk: ' . implode( ', ', $high_risk );
        }
        if ( ! empty( $caution ) ) {
            $lines[] = '⚡ Caution: ' . implode( ', ', $caution );
        }
        if ( ! empty( $ok ) ) {
            $lines[] = '✓ Acceptable: ' . implode( ', ', $ok );
        }
        
        return empty( $lines ) ? 'No risk classification available' : implode( "\n", $lines );
    }
    
    /**
     * Format EC value
     */
    private function format_ec( $water_output ) {
        $ecw = $water_output['ecw'] ?? $water_output['EC'] ?? $water_output['ions']['EC'] ?? null;
        
        if ( ! $ecw ) {
            return 'ECw: Not provided';
        }
        
        $class = $this->get_ec_class( $ecw );
        return sprintf( 'ECw (Salinity): %.2f dS/m — %s', $ecw, $class );
    }
    
    /**
     * Format SAR values
     */
    private function format_sar( $water_output ) {
        $sar = $water_output['SAR'] ?? $water_output['sar'] ?? null;
        $saradj = $water_output['SARadj'] ?? $water_output['adjSAR'] ?? null;
        
        $lines = [];
        
        if ( $sar !== null ) {
            $class = $this->get_sar_class( $sar );
            $lines[] = sprintf( 'SAR (basic): %.2f — %s', $sar, $class );
        }
        
        if ( $saradj !== null && $saradj != $sar ) {
            $class = $this->get_sar_class( $saradj );
            $pct_diff = $sar > 0 ? ( ( $saradj - $sar ) / $sar * 100 ) : 0;
            $lines[] = sprintf( 'SARadj (Suarez): %.2f — %s (%+.0f%% vs basic)', $saradj, $class, $pct_diff );
        }
        
        return empty( $lines ) ? 'SAR: Not calculated' : implode( "\n", $lines );
    }
    
    /**
     * Get EC classification
     */
    private function get_ec_class( $ec ) {
        if ( $ec < 0.7 ) return 'Excellent quality, no restrictions';
        if ( $ec < 1.5 ) return 'Good quality, slight restriction';
        if ( $ec < 3.0 ) return 'Moderate restriction, sensitive species may show stress';
        return 'Severe restriction, only salt-tolerant species';
    }
    
    /**
     * Get SAR classification
     */
    private function get_sar_class( $sar ) {
        if ( $sar < 3 ) return 'Low sodium hazard';
        if ( $sar < 6 ) return 'Medium sodium hazard';
        if ( $sar < 9 ) return 'High sodium hazard';
        return 'Very high sodium hazard';
    }
    
    /**
     * Delegate to base Gilba_Interpretation::to_scalar()
     */
    private function to_scalar( $value ) {
        return $this->interpreter->to_scalar( $value );
    }

    /**
     * Delegate to base Gilba_Interpretation::detect_season()
     */
    private function detect_season( $context ) {
        return $this->interpreter->detect_season( $context );
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
     * Extract citations from water output
     */
    private function extract_citations( $water_output ) {
        // Water quality citations
        return [
            'ayers-westcot-1985' => [
                'title'   => 'Water Quality for Agriculture',
                'authors' => 'Ayers & Westcot',
                'year'    => 1985,
                'source'  => 'FAO Irrigation and Drainage Paper 29',
            ],
            'suarez-1981' => [
                'title'   => 'Relation between pHc and SAR',
                'authors' => 'Suarez',
                'year'    => 1981,
                'source'  => 'Soil Science Society of America Journal',
            ],
            'hanson-2006' => [
                'title'   => 'Irrigation water quality',
                'authors' => 'Hanson et al.',
                'year'    => 2006,
                'source'  => 'UC Davis Publication 8066',
            ],
        ];
    }
}
