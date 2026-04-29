<?php
/**
 * Gilba Cross-Module Synthesis Interpretation
 * 
 * Analyses patterns and anomalies across soil, water, and tissue data.
 * Identifies interactions that individual engines can't detect.
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since 10.5.11
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Synthesis_Interpretation extends Gilba_Interpretation {
    
    /**
     * Check if interpretation service is available
     * 
     * @return bool
     */
    public function is_available() {
        return $this->is_configured();
    }
    
    /**
     * Interpret cross-module patterns
     * 
     * @param array $data Combined data from soil, water, tissue modules
     * @return array Interpretation result
     */
    public function interpret( $data ) {
        
        $prompt = $this->build_prompt( $data );
        
        // Use Sonnet for cross-module synthesis - needs more reasoning capability
        return $this->interpret_with_prompt( $prompt, [], 'detailed' );
    }
    
    /**
     * Build the synthesis prompt
     */
    private function build_prompt( $data ) {
        
        $template = $this->get_prompt_template();
        
        $context = $data['context'] ?? [];
        
        // Detect what data is available
        $has_soil = ! empty( $data['soil'] );
        $has_water = ! empty( $data['water'] );
        $has_tissue = ! empty( $data['tissue'] );
        
        $modules_available = [];
        if ( $has_soil ) $modules_available[] = 'soil';
        if ( $has_water ) $modules_available[] = 'water';
        if ( $has_tissue ) $modules_available[] = 'tissue';
        
        $replacements = [
            '{turf_type}'        => $this->format_turf_type( $this->to_scalar( $context['turfType'] ?? $context['species'] ?? 'turf' ) ),
            '{region}'           => $this->format_region( $this->to_scalar( $context['region'] ?? 'temperate' ) ),
            '{season}'           => $this->detect_season( $context ),
            '{modules_available}' => implode( ', ', $modules_available ),
            '{soil_summary}'     => $has_soil ? $this->format_soil_summary( $data['soil'] ) : 'No soil data provided.',
            '{water_summary}'    => $has_water ? $this->format_water_summary( $data['water'] ) : 'No water data provided.',
            '{tissue_summary}'   => $has_tissue ? $this->format_tissue_summary( $data['tissue'] ) : 'No tissue data provided.',
            '{known_patterns}'   => $this->get_known_patterns(),
        ];
        
        return strtr( $template, $replacements );
    }
    
    /**
     * Get the prompt template for synthesis interpretation
     */
    private function get_prompt_template() {
        
        return <<<'PROMPT'
You are an experienced agronomist analysing soil, water, and tissue data together to identify patterns and interactions that wouldn't be visible looking at each dataset alone.

## Context
- Turf type: {turf_type}
- Region: {region}
- Season: {season}
- Data available: {modules_available}

## Soil Analysis
{soil_summary}

## Water Quality
{water_summary}

## Tissue Analysis
{tissue_summary}

## Known interaction patterns to check for
{known_patterns}

## Your task
Analyse these datasets TOGETHER to identify:

1. **Cross-module interactions** — Where one factor explains or amplifies another. For example:
   - Low tissue Fe despite adequate soil Fe + high water pH/bicarbonate = pH-induced unavailability
   - Rising soil Na + high water SAR + elevated tissue Na = sodium accumulation pathway active
   - Low tissue K + adequate soil K + sandy rootzone = leaching losses

2. **Anomalies requiring investigation** — Unexpected patterns that warrant attention:
   - Tissue levels that don't match soil availability (uptake problems)
   - Water quality issues that should be showing in soil/tissue but aren't yet (early warning)
   - Contradictions between datasets that suggest sampling or timing issues

3. **Combined risk assessment** — How multiple moderate concerns compound:
   - Marginal salinity + marginal sodicity + moderate traffic = cumulative stress
   - Borderline nutrients + environmental stress = likely deficiency expression

## Response format
Structure your response as:

Key Findings (2-3 sentences)
The most important interaction or anomaly and why it matters. Write in plain prose — no bold header in the output, just the text under a plain "Key Findings" subheading.

Pattern Analysis (2-4 plain subheadings)
Each subheading names the specific cross-module connection (e.g. "Bicarbonate-driven pH pressure:" or "Sodium pathway primed but not active:"). 2-4 complete sentences under each — no bullet fragments. Include the actual values from the data.

Recommended Actions (numbered list)
Lead each action with a complete sentence stating what to do, then explain why. Base these on the combined picture, not what individual analyses would suggest in isolation.

Monitoring Priority (1-2 sentences)
What to retest, when, and why that timing is the right one.

## CRITICAL CONSTRAINTS
- Use UK English spelling (fertiliser, colour, sulphur, analyse)
- Write as an agronomist talking to a superintendent — direct, second-person, no formal report language
- Plain subheadings only — do NOT use bold markdown headers like **Key Findings** in your output
- Complete sentences throughout — no bullet fragments in the pattern analysis
- Be specific — cite actual values from the data
- Focus on INTERACTIONS, not summaries of individual modules
- Only flag genuine anomalies, not minor variations
- Keep recommendations practical for professional turf managers
- NEVER recommend drip irrigation for turf (turf uses sprinklers)
- If datasets are consistent with no concerning interactions, say so clearly — don't invent problems
- Maximum ~350 words total

## PRACTICAL APPLICATION RATES (do not exceed these per application)
When recommending amendments, use these maximum single-application rates:
- Gypsum: 1-2 kg/100m² per application (can repeat monthly if needed)
- Elemental sulphur: 0.5-1 kg/100m² per application (to avoid phytotoxicity)
- Iron sulphate: 0.3-0.5 kg/100m² per application
- Fertiliser N: 0.2-0.5 kg N/100m² per application
- Calcium sources: Light, frequent applications preferred over heavy single doses

IMPORTANT: For pH adjustment, total sulphur or lime requirements can be calculated from soil CEC and target pH change (see Appendix II methodology), but these MUST be split into multiple applications over several months. Never recommend the full calculated requirement in a single application.

Do NOT recommend specific kg/100m² rates unless you are confident they are within safe single-application limits. Instead, recommend "light applications" or "split applications over X months" when discussing pH adjustment.
PROMPT;
    }
    
    /**
     * Format soil summary for prompt
     */
    private function format_soil_summary( $soil ) {
        $lines = [];
        
        // pH
        if ( isset( $soil['pH'] ) ) {
            $lines[] = sprintf( 'pH: %.1f', $soil['pH'] );
        }
        
        // EC
        if ( isset( $soil['EC'] ) || isset( $soil['ECe'] ) ) {
            $ec = $soil['ECe'] ?? $soil['EC'] ?? 0;
            $lines[] = sprintf( 'EC: %.2f dS/m', $ec );
        }
        
        // CEC
        if ( isset( $soil['CEC'] ) ) {
            $lines[] = sprintf( 'CEC: %.1f meq/100g', $soil['CEC'] );
        }
        
        // Nutrients with status
        $nutrients = [ 'K', 'P', 'Ca', 'Mg', 'S', 'Fe', 'Mn', 'Zn', 'Cu', 'Na' ];
        $nutrient_lines = [];
        
        foreach ( $nutrients as $n ) {
            $value = $soil['ppm'][ $n ] ?? $soil[ $n ] ?? null;
            $status = $soil['status'][ $n ] ?? null;
            
            if ( $value !== null ) {
                $line = sprintf( '%s: %.0f ppm', $n, $value );
                if ( $status ) {
                    $line .= " ({$status})";
                }
                $nutrient_lines[] = $line;
            }
        }
        
        if ( ! empty( $nutrient_lines ) ) {
            $lines[] = 'Nutrients: ' . implode( ', ', $nutrient_lines );
        }
        
        // Methodology
        if ( isset( $soil['methodology'] ) ) {
            $lines[] = 'Methodology: ' . strtoupper( $soil['methodology'] );
        }
        
        // Construction
        if ( isset( $soil['construction'] ) ) {
            $lines[] = 'Rootzone: ' . str_replace( '_', ' ', $soil['construction'] );
        }
        
        return empty( $lines ) ? 'Minimal soil data provided.' : implode( "\n", $lines );
    }
    
    /**
     * Format water summary for prompt
     */
    private function format_water_summary( $water ) {
        $lines = [];
        
        // EC
        if ( isset( $water['ecw'] ) || isset( $water['EC'] ) ) {
            $ec = $water['ecw'] ?? $water['EC'];
            $lines[] = sprintf( 'ECw: %.2f dS/m', $ec );
        }
        
        // pH
        if ( isset( $water['pH'] ) ) {
            $lines[] = sprintf( 'pH: %.1f', $water['pH'] );
        }
        
        // SAR
        if ( isset( $water['SAR'] ) ) {
            $lines[] = sprintf( 'SAR: %.1f', $water['SAR'] );
        }
        if ( isset( $water['SARadj'] ) && $water['SARadj'] != ( $water['SAR'] ?? 0 ) ) {
            $lines[] = sprintf( 'SARadj: %.1f', $water['SARadj'] );
        }
        
        // Key ions
        $ions = $water['ions'] ?? $water;
        $ion_lines = [];
        
        $key_ions = [ 'Na', 'Cl', 'Ca', 'Mg', 'HCO3', 'B', 'Fe' ];
        foreach ( $key_ions as $ion ) {
            $value = $ions[ $ion ] ?? null;
            if ( $value !== null && $value > 0 ) {
                $ion_lines[] = sprintf( '%s: %.0f mg/L', $ion, $value );
            }
        }
        
        if ( ! empty( $ion_lines ) ) {
            $lines[] = 'Ions: ' . implode( ', ', $ion_lines );
        }
        
        // Diagnostics if present
        if ( ! empty( $water['diagnostics'] ) ) {
            $flags = [];
            foreach ( $water['diagnostics'] as $diag ) {
                if ( isset( $diag['status'] ) && in_array( $diag['status'], [ 'high', 'caution', 'warning', 'elevated' ] ) ) {
                    $flags[] = ( $diag['label'] ?? $diag['parameter'] ?? 'Unknown' ) . ': ' . ( $diag['status'] ?? '' );
                }
            }
            if ( ! empty( $flags ) ) {
                $lines[] = 'Flags: ' . implode( ', ', $flags );
            }
        }
        
        return empty( $lines ) ? 'Minimal water data provided.' : implode( "\n", $lines );
    }
    
    /**
     * Format tissue summary for prompt
     */
    private function format_tissue_summary( $tissue ) {
        $lines = [];
        
        $nutrients = [
            'N'  => [ 'unit' => '%', 'divisor' => 1 ],
            'P'  => [ 'unit' => '%', 'divisor' => 1 ],
            'K'  => [ 'unit' => '%', 'divisor' => 1 ],
            'Ca' => [ 'unit' => '%', 'divisor' => 1 ],
            'Mg' => [ 'unit' => '%', 'divisor' => 1 ],
            'S'  => [ 'unit' => '%', 'divisor' => 1 ],
            'Fe' => [ 'unit' => 'ppm', 'divisor' => 1 ],
            'Mn' => [ 'unit' => 'ppm', 'divisor' => 1 ],
            'Zn' => [ 'unit' => 'ppm', 'divisor' => 1 ],
            'Cu' => [ 'unit' => 'ppm', 'divisor' => 1 ],
            'B'  => [ 'unit' => 'ppm', 'divisor' => 1 ],
            'Na' => [ 'unit' => 'ppm', 'divisor' => 1 ],
        ];
        
        $tissue_lines = [];
        foreach ( $nutrients as $n => $meta ) {
            $value = $tissue[ $n ] ?? $tissue[ strtolower( $n ) ] ?? null;
            $status = $tissue['status'][ $n ] ?? null;
            
            if ( $value !== null ) {
                $formatted = $meta['unit'] === '%' 
                    ? sprintf( '%.2f%%', $value )
                    : sprintf( '%.0f ppm', $value );
                    
                $line = "{$n}: {$formatted}";
                if ( $status ) {
                    $line .= " ({$status})";
                }
                $tissue_lines[] = $line;
            }
        }
        
        if ( ! empty( $tissue_lines ) ) {
            $lines[] = implode( ', ', $tissue_lines );
        }
        
        return empty( $lines ) ? 'No tissue data provided.' : implode( "\n", $lines );
    }
    
    /**
     * Get known interaction patterns to check
     */
    private function get_known_patterns() {
        return <<<'PATTERNS'
## Soil ↔ Tissue patterns
- Low tissue Fe/Mn despite adequate soil levels + high soil pH → pH-induced trace element unavailability
- Low tissue K + adequate soil K + low CEC/sandy rootzone → leaching losses, need split applications
- High tissue Na + moderate soil Na → sodium uptake pathway active, check water source
- Low tissue Ca despite adequate soil Ca + high soil K or Mg → cation competition

## Water ↔ Soil patterns  
- High water Na/SAR + rising soil Na → sodium accumulation, structure degradation risk
- High water HCO3 + declining soil Ca → bicarbonate-induced Ca precipitation
- High water EC + rising soil EC → insufficient leaching
- Water RSC positive + soil Ca/Mg declining → carbonate stripping of exchange sites

## Water ↔ Tissue patterns
- High water Na/Cl + elevated tissue Na/Cl → foliar or root uptake from irrigation
- High water B + elevated tissue B → boron accumulation (early toxicity warning)

## Three-way interactions
- High pH soil + high HCO3 water + low tissue Fe/Mn = classic trace element lockup pattern
- Sandy rootzone + saline water + low tissue K = leaching + salt stress compound
- Low CEC + high Na water + rising tissue Na = rapid sodium pathway, urgent intervention
PATTERNS;
    }
    
    // to_scalar(), detect_season(), format_turf_type(), format_region()
    // are inherited from parent Gilba_Interpretation class
}
