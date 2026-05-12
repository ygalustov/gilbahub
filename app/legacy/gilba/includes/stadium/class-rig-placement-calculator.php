<?php
/**
 * LED Grow Light Rig Placement Calculator
 * 
 * Calculates optimal placement of mobile LED grow light rigs based on
 * shade patterns, determines coverage requirements, and projects
 * turf health outcomes over deployment period.
 * 
 * Standard rig specifications:
 * - Coverage area: 400m² (20m x 20m typical)
 * - PPFD at canopy: 400-600 µmol/m²/s depending on unit
 * - Operating hours: Up to 16 hours/day
 * - DLI contribution: ~8-12 mol/m²/day at full operation
 * 
 * @package Gssh_Stadium
 */

class Gssh_Rig_Placement_Calculator {
    
    /**
     * Manufacturer rig profiles
     * 
     * Sources:
     * - SGL LED440 PPFD: 354 µmol/m²/s average (sglsystem.com/report/daily-light-integral)
     * - SGL LU440 power: 62.7 kW (sglsystem.com FAQ)
     * - SGL height: 1.90m above turf (LU440, MU360, MU50)
     * - SeeGrow: "up to 10mm leaf/root growth in 24h" (gilbasolutions.com/using-light)
     * - MLR Odin: used at ANZ Stadium, MCG (various industry sources)
     * - Mobiled: used at various European venues
     * 
     * mol_per_hour = average PPFD × 3600 seconds × 0.000001 (convert µmol to mol)
     * Example: 354 PPFD = 354 × 3600 × 0.000001 = 1.27 mol/m²/hour
     */
    const RIG_MANUFACTURERS = [
        // === SGL (Stadium Grow Lighting) - sglsystem.com ===
        'sgl_lu440' => [
            'manufacturer'   => 'SGL',
            'model'          => 'LU440 HPS',
            'type'           => 'HPS',
            'ppfd_avg'       => 320,            // Estimated from 62.7kW power, HPS efficiency ~1.7 µmol/J
            'mol_per_hour'   => 1.15,           // 320 × 3600 / 1e6
            'uniformity'     => 0.80,
            'max_daily_hours'=> 16,
            'coverage_m2'    => 440,
            'dimensions'     => [ 'length' => 20, 'width' => 22 ],
            'power_kw'       => 62.7,           // sglsystem.com FAQ
            'lamp_height_m'  => 1.90,           // sglsystem.com FAQ
        ],
        'sgl_lu120' => [
            'manufacturer'   => 'SGL',
            'model'          => 'LU120 HPS',
            'type'           => 'HPS',
            'ppfd_avg'       => 380,            // Smaller footprint = higher avg intensity
            'mol_per_hour'   => 1.37,           // 380 × 3600 / 1e6
            'uniformity'     => 0.82,
            'max_daily_hours'=> 16,
            'coverage_m2'    => 120,
            'dimensions'     => [ 'length' => 10, 'width' => 12 ],
            'power_kw'       => 18.7,           // Proportional to LU440
            'lamp_height_m'  => 1.90,
        ],
        'sgl_bu50' => [
            'manufacturer'   => 'SGL',
            'model'          => 'BU50 HPS',
            'type'           => 'HPS',
            'ppfd_avg'       => 420,            // Compact = more concentrated
            'mol_per_hour'   => 1.51,           // 420 × 3600 / 1e6
            'uniformity'     => 0.75,
            'max_daily_hours'=> 16,
            'coverage_m2'    => 50,
            'dimensions'     => [ 'length' => 7, 'width' => 7 ],
            'power_kw'       => 7.4,            // sglsystem.com FAQ
            'lamp_height_m'  => 1.50,           // "smaller units have 1.50m" - SGL FAQ
        ],
        'sgl_led440' => [
            'manufacturer'   => 'SGL',
            'model'          => 'LED440',
            'type'           => 'LED',
            'ppfd_avg'       => 354,            // sglsystem.com/report/daily-light-integral — verified
            'mol_per_hour'   => 1.27,           // 354 × 3600 / 1e6
            'uniformity'     => 0.88,           // LED = better uniformity than HPS
            'max_daily_hours'=> 18,             // LED can run longer (less heat stress)
            'coverage_m2'    => 440,
            'dimensions'     => [ 'length' => 20, 'width' => 22 ],
            'power_kw'       => 37.0,           // ~40% savings vs LU440 per SGL claims
            'lamp_height_m'  => 1.90,
            'spectrum'       => '95% red, 5% blue',  // sglsystem.com LED440 page
            'features'       => [ 'independent_heat_control', 'ir_heating', 'smartbox' ],
        ],
        'sgl_led120' => [
            'manufacturer'   => 'SGL',
            'model'          => 'LED120',
            'type'           => 'LED',
            'ppfd_avg'       => 400,            // Higher concentration on smaller area
            'mol_per_hour'   => 1.44,           // 400 × 3600 / 1e6
            'uniformity'     => 0.85,
            'max_daily_hours'=> 18,
            'coverage_m2'    => 120,
            'dimensions'     => [ 'length' => 10, 'width' => 12 ],
            'power_kw'       => 12.0,
            'lamp_height_m'  => 1.90,
            'spectrum'       => '95% red, 5% blue',
            'features'       => [ 'independent_heat_control', 'ir_heating' ],
        ],
        // === SeeGrow Developments ===
        'seegrow_led14' => [
            'manufacturer'   => 'SeeGrow',
            'model'          => 'LED14',
            'type'           => 'LED',
            'ppfd_avg'       => 500,
            'mol_per_hour'   => 1.80,           // 500 × 3600 / 1e6
            'uniformity'     => 0.90,
            'max_daily_hours'=> 20,             // CO2 enrichment allows longer effective hours
            'coverage_m2'    => 14,             // Intensive care unit
            'dimensions'     => [ 'length' => 4.7, 'width' => 3 ],
            'features'       => [ 'co2_enrichment', 'irrigation', 'heating' ],
        ],
        'seegrow_led28' => [
            'manufacturer'   => 'SeeGrow',
            'model'          => 'LED28',
            'type'           => 'LED',
            'ppfd_avg'       => 500,
            'mol_per_hour'   => 1.80,
            'uniformity'     => 0.90,
            'max_daily_hours'=> 20,
            'coverage_m2'    => 28,
            'dimensions'     => [ 'length' => 7, 'width' => 4 ],
            'features'       => [ 'co2_enrichment', 'irrigation', 'heating' ],
        ],
        // === Mobiled ===
        'mobiled_mlb3' => [
            'manufacturer'   => 'Mobiled',
            'model'          => 'MLB3',
            'type'           => 'LED',
            'ppfd_avg'       => 390,
            'mol_per_hour'   => 1.40,           // 390 × 3600 / 1e6
            'uniformity'     => 0.82,
            'max_daily_hours'=> 16,
            'coverage_m2'    => 360,
            'dimensions'     => [ 'length' => 19, 'width' => 19 ],
        ],
        // === MLR Sports ===
        'mlr_odin' => [
            'manufacturer'   => 'MLR Sports',
            'model'          => 'Odin (s100)',
            'type'           => 'HPS/MH',
            'ppfd_avg'       => 350,
            'mol_per_hour'   => 1.26,           // 350 × 3600 / 1e6
            'uniformity'     => 0.78,
            'max_daily_hours'=> 14,
            'coverage_m2'    => 500,
            'dimensions'     => [ 'length' => 22, 'width' => 23 ],
        ],
        // === Stogger Turf Care (stoggerturfcare.com) ===
        // DLS = Dynamic Light Spectrum, 4-channel LED, Mechatronix CoolStack engines
        // Product line: Booster 60, 70C, 80, 240, Carbon 460, 480
        'stogger_booster_460' => [
            'manufacturer'   => 'Stogger',
            'model'          => 'Booster Carbon 460 DLS',
            'type'           => 'LED',
            'ppfd_avg'       => 380,            // Estimated: large-area LED, carbon fibre frame
            'mol_per_hour'   => 1.37,           // 380 × 3600 / 1e6
            'uniformity'     => 0.88,           // Mechatronix batwing optics = good uniformity
            'max_daily_hours'=> 18,
            'coverage_m2'    => 460,            // stoggerturfcare.com product page - verified
            'dimensions'     => [ 'length' => 21, 'width' => 22 ],
            'features'       => [ 'dls_4channel', 'ir_heating_optional', 'carbon_fibre' ],
        ],
        'stogger_booster_480' => [
            'manufacturer'   => 'Stogger',
            'model'          => 'Booster 480 DLS',
            'type'           => 'LED',
            'ppfd_avg'       => 370,            // Slightly lower PPFD over larger area
            'mol_per_hour'   => 1.33,           // 370 × 3600 / 1e6
            'uniformity'     => 0.86,
            'max_daily_hours'=> 18,
            'coverage_m2'    => 480,            // stoggerturfcare.com product page
            'dimensions'     => [ 'length' => 22, 'width' => 22 ],
            'features'       => [ 'dls_4channel', 'ir_heating_optional' ],
        ],
        'stogger_booster_240' => [
            'manufacturer'   => 'Stogger',
            'model'          => 'Booster 240 DLS',
            'type'           => 'LED',
            'ppfd_avg'       => 420,            // Smaller footprint = higher concentration
            'mol_per_hour'   => 1.51,           // 420 × 3600 / 1e6
            'uniformity'     => 0.85,
            'max_daily_hours'=> 18,
            'coverage_m2'    => 240,            // stoggerturfcare.com product page
            'dimensions'     => [ 'length' => 15, 'width' => 16 ],
            'features'       => [ 'dls_4channel', 'hybrid_hps_led_option' ],
        ],
        'stogger_booster_60' => [
            'manufacturer'   => 'Stogger',
            'model'          => 'Booster 60 DLS',
            'type'           => 'LED',
            'ppfd_avg'       => 480,            // Compact = high concentration
            'mol_per_hour'   => 1.73,           // 480 × 3600 / 1e6
            'uniformity'     => 0.82,
            'max_daily_hours'=> 18,
            'coverage_m2'    => 60,             // stoggerturfcare.com product page
            'dimensions'     => [ 'length' => 7, 'width' => 8.5 ],
            'features'       => [ 'dls_4channel', 'ir_heating_optional' ],
        ],
        // === Rhenac GreenTec / TLS (rhenacsportsled.com) ===
        // CLS = Complete Light Spectrum, developed with TU Munich
        // Product line: R-ML mobiles (30, 200, 360) + R-BL fixed (1750, 3500, 7500)
        // Installed at: Real Madrid Bernabéu, Schalke 04 Veltins Arena, KRC Genk
        'rhenac_rml360' => [
            'manufacturer'   => 'Rhenac/TLS',
            'model'          => 'R-ML 360 CLS',
            'type'           => 'LED',
            'ppfd_avg'       => 400,            // Estimated: full-spectrum CLS, 6-arm truss design
            'mol_per_hour'   => 1.44,           // 400 × 3600 / 1e6
            'uniformity'     => 0.87,
            'max_daily_hours'=> 18,
            'coverage_m2'    => 360,            // rhenac-greentec.de: "6 light beams, 12m each = 360m²"
            'dimensions'     => [ 'length' => 18, 'width' => 20 ],
            'features'       => [ 'cls_full_spectrum', 'ir_heating', 'irrigation_optional', 'uvc_optional' ],
        ],
        'rhenac_rml200' => [
            'manufacturer'   => 'Rhenac/TLS',
            'model'          => 'R-ML 200 CLS',
            'type'           => 'LED',
            'ppfd_avg'       => 430,            // Mid-size = moderate concentration
            'mol_per_hour'   => 1.55,           // 430 × 3600 / 1e6
            'uniformity'     => 0.85,
            'max_daily_hours'=> 18,
            'coverage_m2'    => 200,            // KRC Genk case study
            'dimensions'     => [ 'length' => 14, 'width' => 14 ],
            'features'       => [ 'cls_full_spectrum', 'ir_heating' ],
        ],
        'rhenac_rml30' => [
            'manufacturer'   => 'Rhenac/TLS',
            'model'          => 'R-ML 30 CLS',
            'type'           => 'LED',
            'ppfd_avg'       => 500,            // Goalmouth spot treatment = high intensity
            'mol_per_hour'   => 1.80,           // 500 × 3600 / 1e6
            'uniformity'     => 0.82,
            'max_daily_hours'=> 20,
            'coverage_m2'    => 30,             // KRC Genk: "goalmouth area"
            'dimensions'     => [ 'length' => 5.5, 'width' => 5.5 ],
            'features'       => [ 'cls_full_spectrum', 'ir_heating' ],
        ],
        'custom' => [
            'manufacturer'   => 'Custom',
            'model'          => 'User Defined',
            'type'           => 'Variable',
            'ppfd_avg'       => 400,
            'mol_per_hour'   => 1.44,
            'uniformity'     => 0.85,
            'max_daily_hours'=> 16,
            'coverage_m2'    => 400,
            'dimensions'     => [ 'length' => 20, 'width' => 20 ],
        ],
    ];
    
    /**
     * Standard rig specifications (by size - legacy support)
     */
    /**
     * Mobile grow light rig specifications
     * 
     * Based on Stadium Grow Lighting (SGL) and similar commercial products.
     * 
     * Key metrics:
     * - coverage_m2: Effective coverage area per rig
     * - mol_per_hour: DLI contribution (mol/m²) per hour of operation
     * - ppfd_center/edge: PPFD (μmol/m²/s) at center vs edges
     * - uniformity: Light distribution uniformity (0-1)
     */
    const RIG_SPECS = [
        'small' => [
            'name'           => 'Small Mobile',
            'description'    => 'Compact unit for targeted zones (e.g., SGL LU120)',
            'coverage_m2'    => 120,
            'dimensions'     => [ 'length' => 10, 'width' => 12 ],
            'ppfd_center'    => 450,
            'ppfd_edge'      => 300,
            'uniformity'     => 0.67,
            'max_daily_hours'=> 16,
            'mol_per_hour'   => 1.37,   // Based on SGL LU120
            'power_kw'       => 18.7,
            'lamps'          => 48,
        ],
        'standard' => [
            'name'           => 'Standard Mobile',
            'description'    => 'Standard pitch coverage (e.g., SGL LU440)',
            'coverage_m2'    => 440,
            'dimensions'     => [ 'length' => 20, 'width' => 22 ],
            'ppfd_center'    => 500,
            'ppfd_edge'      => 380,
            'uniformity'     => 0.76,
            'max_daily_hours'=> 16,
            'mol_per_hour'   => 1.15,   // Based on SGL LU440
            'power_kw'       => 62.7,
            'lamps'          => 96,
        ],
        'large' => [
            'name'           => 'Large Mobile',
            'description'    => 'High-output for severe shade (e.g., MLR Odin)',
            'coverage_m2'    => 500,
            'dimensions'     => [ 'length' => 22, 'width' => 23 ],
            'ppfd_center'    => 550,
            'ppfd_edge'      => 400,
            'uniformity'     => 0.73,
            'max_daily_hours'=> 16,
            'mol_per_hour'   => 1.26,
            'power_kw'       => 36,
            'lamps'          => 144,
        ],
    ];
    
    /**
     * Minimum overlap between adjacent rigs (metres)
     */
    const MIN_OVERLAP = 2;
    
    /**
     * Grid resolution for shade analysis (metres)
     */
    const GRID_RESOLUTION = 5;
    
    /**
     * Dependencies
     */
    private $shade_engine;
    private $dli_calculator;
    private $variety_database;
    
    /**
     * Hub-provided ambient DLI (when integrated with main Hub)
     */
    private $hub_ambient_dli = null;
    
    /**
     * Constructor
     */
    public function __construct( $shade_engine = null, $dli_calculator = null, $variety_database = null ) {
        $this->shade_engine = $shade_engine;
        $this->dli_calculator = $dli_calculator;
        $this->variety_database = $variety_database;
    }
    
    /**
     * Get available rig types (legacy)
     */
    public static function get_rig_types(): array {
        return self::RIG_SPECS;
    }
    
    /**
     * Get available rig manufacturers
     */
    public static function get_rig_manufacturers(): array {
        return self::RIG_MANUFACTURERS;
    }
    
    /**
     * Get rig spec by manufacturer key or legacy type
     */
    public static function get_rig_spec( string $key ): array {
        // Normalise key to lowercase for case-insensitive matching
        $key = strtolower( $key );
        
        // Check manufacturer profiles first
        if ( isset( self::RIG_MANUFACTURERS[ $key ] ) ) {
            return self::RIG_MANUFACTURERS[ $key ];
        }
        // Fall back to legacy rig types
        if ( isset( self::RIG_SPECS[ $key ] ) ) {
            return self::RIG_SPECS[ $key ];
        }
        // Default to standard
        return self::RIG_SPECS['standard'];
    }
    
    /**
     * Calculate rig requirements for a venue
     * 
     * Analyses shade patterns over a period and determines optimal
     * rig placement to address DLI deficits.
     * 
     * @param string $venue_id Stadium identifier
     * @param array  $options {
     *     @type string $date           Analysis date (default: today)
     *     @type int    $month          Analysis month (1-12, overrides date for DLI)
     *     @type string $variety        Turf variety for DLI targets
     *     @type string $rig_type       'small', 'standard', or 'large'
     *     @type float  $target_dli     Override variety minimum DLI
     *     @type int    $analysis_days  Days to analyse (default: 14)
     *     @type float  $deficit_threshold Minimum deficit to address (default: 3.0 mol)
     * }
     * @return array Rig placement analysis
     */
    public function calculate_rig_requirements( string $venue_id, array $options = [] ): array {
        $options = self::parse_args( $options, [
            'date'              => date( 'Y-m-d' ),
            'month'             => null,
            'variety'           => null,         // Will resolve from stadium DB if not provided
            'rig_type'          => 'standard',
            'target_dli'        => null,
            'hub_target_dli'    => null,   // Hub-provided target DLI (overrides variety lookup)
            'hub_ambient_dli'   => null,   // Hub-provided ambient DLI (overrides estimate)
            'analysis_days'     => 14,
            'deficit_threshold' => 3.0,
            'target_coverage_pct' => null, // Slider override: 0-100, clamps rig count to this % of deficit area
            'hub_temperature'   => null,   // Current air temperature from hub climate engine (°C)
            'venue_environment' => [],     // Venue environment config for EUE calculation
        ]);
        
        // Get stadium data
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return [ 'error' => 'Stadium not found' ];
        }
        
        // Resolve variety from stadium database if not provided by hub
        // The hub sends 'generic' when no specific cultivar is selected in the dropdown
        if ( empty( $options['variety'] ) || $options['variety'] === 'generic' ) {
            $turf = $stadium['turf'] ?? [];
            $analysis_month = $options['month'] ?? (int) date( 'n' );
            
            // Check if overseed is active this month
            $is_overseed_month = false;
            if ( $turf['oversown'] ?? false ) {
                $period = $turf['overseed_period'] ?? [];
                $start = $period['start_month'] ?? 0;
                $end   = $period['end_month'] ?? 0;
                if ( $start && $end ) {
                    // Handle wrap-around (e.g. start=10, end=3 for Oct-Mar)
                    if ( $start <= $end ) {
                        $is_overseed_month = ( $analysis_month >= $start && $analysis_month <= $end );
                    } else {
                        $is_overseed_month = ( $analysis_month >= $start || $analysis_month <= $end );
                    }
                }
            }
            
            if ( $is_overseed_month ) {
                $options['variety'] = $turf['overseed_variety'] ?? 'perennial_rye';
            } else {
                // Region-aware default: UK/European venues = perennial ryegrass, AU/tropical = couch
                $default_variety = 'tiftuf';
                $lat = $stadium['location']['lat'] ?? -33.8;
                // Northern hemisphere temperate (UK, Europe, Japan) = C3 default
                if ( $lat > 30 ) {
                    $default_variety = 'perennial_rye';
                }
                $options['variety'] = $turf['variety'] ?? $default_variety;
            }
        }
        
        // Determine analysis month
        $analysis_month = $options['month'] ?? (int) date( 'n', strtotime( $options['date'] ) );
        
        // Get rig specifications (supports both manufacturer keys and legacy size keys)
        $rig_spec = self::get_rig_spec( $options['rig_type'] );
        
        // Get variety DLI requirements - Hub value takes precedence
        $target_dli = $options['hub_target_dli'] ?? $options['target_dli'];
        if ( ! $target_dli && $this->variety_database ) {
            $variety_data = $this->variety_database->get_variety( $options['variety'] );
            $target_dli = $variety_data['minimum_dli'] ?? 20;
        }
        $target_dli = $target_dli ?? 20;
        
        // Store Hub ambient DLI for use in deficit calculations
        $this->hub_ambient_dli = $options['hub_ambient_dli'];
        
        // Analyse shade patterns across the field
        $shade_analysis = $this->analyse_field_shade_patterns(
            $venue_id,
            $stadium,
            $options['date'],
            $options['analysis_days']
        );
        
        // Store month for ambient DLI calculation
        $shade_analysis['analysis_month'] = $analysis_month;
        
        // Calculate DLI deficit zones (uses month-specific ambient DLI)
        $deficit_zones = $this->identify_deficit_zones_for_month(
            $shade_analysis,
            $target_dli,
            $options['deficit_threshold'],
            $analysis_month
        );
        
        // Calculate optimal rig placements
        $placements = $this->calculate_optimal_placements(
            $deficit_zones,
            $rig_spec,
            $stadium
        );
        
        // If a target coverage % was supplied (from the UI slider), clamp the rig
        // count so the health projection reflects the user-chosen coverage level.
        if ( $options['target_coverage_pct'] !== null ) {
            $target_pct   = max( 0, min( 100, (float) $options['target_coverage_pct'] ) );
            $deficit_area = $placements['deficit_area'] ?? $placements['priority_area'] ?? 1;
            $rig_coverage = $placements['rig_coverage'] ?? ( $rig_spec['coverage_m2'] ?? 400 );
            $target_rigs  = (int) ceil( ( $target_pct / 100 ) * $deficit_area / max( 1, $rig_coverage ) );

            // Combine deployed + ghost rigs ordered by priority so we take the best ones first
            $all_rigs  = array_merge( $placements['rigs'] ?? [], $placements['ghost_rigs'] ?? [] );
            $kept_rigs = array_slice( $all_rigs, 0, $target_rigs );
            $ghost_rigs = array_slice( $all_rigs, $target_rigs );

            // Re-label promoted rigs: strip is_ghost flag and give them clean sequential IDs
            // NOTE: visualiser uses 'rig_id' key, calculator uses 'rig_id' (not 'id')
            $rig_counter = 1;
            $cleaned_rigs = [];
            foreach ( $kept_rigs as $rig ) {
                $rig['is_ghost'] = false;
                // Replace ghost_N rig_id with rig_N
                if ( isset( $rig['rig_id'] ) && ( str_starts_with( $rig['rig_id'], 'ghost' ) || str_starts_with( $rig['rig_id'], 'GHOST' ) ) ) {
                    $rig['rig_id'] = 'rig_' . $rig_counter;
                }
                $rig_counter++;
                $cleaned_rigs[] = $rig;
            }

            $placements['rigs']               = $cleaned_rigs;
            $placements['ghost_rigs']         = $ghost_rigs;
            $placements['total_rigs']         = count( $kept_rigs );
            $placements['recommended_additional'] = count( $ghost_rigs );
            $placements['_coverage_overridden']   = true;
            $placements['_target_coverage_pct']   = $target_pct;
        }

        // Calculate coverage and effectiveness
        $coverage_analysis = $this->analyse_coverage(
            $placements,
            $deficit_zones,
            $rig_spec,
            $target_dli
        );
        
        // Project turf health outcomes
        $health_projection = $this->project_turf_health(
            $deficit_zones,
            $placements,
            $rig_spec,
            $options['variety'],
            $options['analysis_days'],
            $options['hub_temperature']  // Pass live temperature to override estimate
        );
        
        // Calculate Environmental Utilisation Efficiency
        $eue_result = $this->calculate_eue(
            $options['variety'],
            $options['hub_temperature'],
            $stadium,
            $options['venue_environment'],
            $analysis_month
        );
        
        return [
            'venue_id'           => $venue_id,
            'venue_name'         => $stadium['name'],
            'analysis_date'      => $options['date'],
            'analysis_month'     => $analysis_month,
            'analysis_month_name'=> date( 'F', mktime( 0, 0, 0, $analysis_month, 1 ) ),
            'analysis_period'    => $options['analysis_days'] . ' days',
            'variety'            => $options['variety'],
            'target_dli'         => $target_dli,
            'rig_type'           => $options['rig_type'],
            'rig_spec'           => $rig_spec,
            'shade_analysis'     => $shade_analysis,
            'deficit_zones'      => $deficit_zones,
            'placements'         => $placements,
            'coverage'           => $coverage_analysis,
            'health_projection'  => $health_projection,
            'eue'                => $eue_result,
            'venue_readiness'    => $eue_result['venue_readiness'] ?? null,
            'summary'            => $this->generate_summary( $placements, $coverage_analysis, $health_projection, $eue_result ),
        ];
    }
    
    /**
     * Analyse shade patterns across the entire field
     * 
     * Creates a grid of shade factors representing average daily
     * light availability at each point.
     * 
     * @param string $venue_id
     * @param array  $stadium
     * @param string $start_date
     * @param int    $days
     * @return array
     */
    private function analyse_field_shade_patterns( 
        string $venue_id, 
        array $stadium, 
        string $start_date,
        int $days 
    ): array {
        
        $field = $stadium['field'] ?? [];
        // Use playing surface dimensions if available (excludes run-off/concourse)
        // Grid dimensions: the actual natural turf surface that needs light management.
        // Priority: turf_length > length > playing_length
        //   turf_length/turf_width = explicit "natural turf we care about" (best)
        //   length/width           = outer field boundary (may include non-turf run-off)
        //   playing_length/width   = playing rectangle only (excludes in-goals)
        //
        // NRL venues:  turf_length=120 (playing 100 + two 10m in-goals)
        // Suncorp:     turf_length=129 (playing_length already inc. in-goals)
        // EPL/J-League: length=105 (no in-goal concept)
        $grid_length = $field['turf_length'] ?? $field['length'] ?? $field['playing_length'] ?? 100;
        $grid_width  = $field['turf_width']  ?? $field['playing_width'] ?? $field['width'] ?? 68;
        
        $half_length = $grid_length / 2;
        $half_width  = $grid_width / 2;
        
        $grid = [];
        $min_factor = 1.0;
        $max_factor = 0.0;
        
        // Use larger grid step for faster calculation (10m instead of 5m)
        $grid_step = 10;
        
        // Reduce days to 1 for speed - mid-month is representative
        $analysis_days = 1;
        
        // Create grid across field
        for ( $x = -$half_width; $x <= $half_width; $x += $grid_step ) {
            for ( $y = -$half_length; $y <= $half_length; $y += $grid_step ) {
                
                // Use fast estimation instead of full shade engine calculation
                $avg_factor = $this->estimate_shade_factor( $x, $y, $half_width, $half_length, $stadium );
                
                $grid[] = [
                    'x'            => $x,
                    'y'            => $y,
                    'shade_factor' => round( $avg_factor, 3 ),
                ];
                
                $min_factor = min( $min_factor, $avg_factor );
                $max_factor = max( $max_factor, $avg_factor );
            }
        }
        
        return [
            'grid'        => $grid,
            'resolution'  => $grid_step,
            'field_dims'  => [
                'length' => $grid_length,
                'width'  => $grid_width,
            ],
            'latitude'    => $stadium['location']['lat'] ?? -33,
            'min_factor'  => round( $min_factor, 3 ),
            'max_factor'  => round( $max_factor, 3 ),
            'points'      => count( $grid ),
        ];
    }
    
    /**
     * Estimate shade factor based on position (fallback when no shade engine)
     */
    private function estimate_shade_factor( float $x, float $y, float $hw, float $hl, array $stadium ): float {
        $factor = 1.0;
        $lat = $stadium['location']['lat'] ?? -33;
        $is_southern = $lat < 0;
        
        // In southern hemisphere, north side of field gets more shade from northern stands
        // In northern hemisphere, south side gets more shade from southern stands
        
        foreach ( $stadium['structures'] ?? [] as $structure ) {
            $sx = $structure['position']['x'] ?? 0;
            $sy = $structure['position']['y'] ?? 0;
            $height = $structure['height'] ?? 20;
            
            // Distance from structure
            $dist = sqrt( pow( $x - $sx, 2 ) + pow( $y - $sy, 2 ) );
            
            // Shadow reach (rough estimate)
            $shadow_reach = $height * 2.5;  // Winter sun angle ~22° = tan(22°) ≈ 2.5
            
            if ( $dist < $shadow_reach ) {
                // Check if point is in shadow direction
                $in_shadow_zone = false;
                
                if ( $is_southern ) {
                    // Sun to north, shadows fall south
                    $in_shadow_zone = ( $sy > 0 && $y < $sy ) || ( $sy < 0 && $y < $sy + $shadow_reach );
                } else {
                    // Sun to south, shadows fall north
                    $in_shadow_zone = ( $sy < 0 && $y > $sy ) || ( $sy > 0 && $y > $sy - $shadow_reach );
                }
                
                if ( $in_shadow_zone ) {
                    $shadow_intensity = 1 - ( $dist / $shadow_reach );
                    $factor = min( $factor, 0.3 + ( 1 - $shadow_intensity ) * 0.7 );
                }
            }
        }
        
        return $factor;
    }
    
    /**
     * Identify zones with significant DLI deficit
     * 
     * @param array $shade_analysis
     * @param float $target_dli
     * @param float $threshold
     * @return array
     */
    private function identify_deficit_zones( 
        array $shade_analysis, 
        float $target_dli, 
        float $threshold 
    ): array {
        
        // Estimate ambient DLI (would come from climate module in production)
        $ambient_dli = $this->estimate_ambient_dli( $shade_analysis );
        
        return $this->calculate_deficit_zones( $shade_analysis, $target_dli, $threshold, $ambient_dli );
    }
    
    /**
     * Identify zones with significant DLI deficit for a specific month
     * 
     * @param array $shade_analysis
     * @param float $target_dli
     * @param float $threshold
     * @param int   $month
     * @return array
     */
    private function identify_deficit_zones_for_month( 
        array $shade_analysis, 
        float $target_dli, 
        float $threshold,
        int $month
    ): array {
        
        // Get month-specific ambient DLI
        $lat = $shade_analysis['latitude'] ?? -33;
        $ambient_dli = $this->get_monthly_ambient_dli( $lat, $month );
        
        // Estimate average temperature for dormancy calculations
        $estimated_temp = $this->estimate_monthly_temperature( $lat, $month );
        
        $zones = $this->calculate_deficit_zones( $shade_analysis, $target_dli, $threshold, $ambient_dli );
        $zones['estimated_temp'] = $estimated_temp;
        $zones['month'] = $month;
        
        return $zones;
    }
    
    /**
     * Estimate average monthly temperature based on latitude and month
     * 
     * Simplified model - actual implementation should use climate data.
     * This provides rough estimates for dormancy decisions.
     * 
     * @param float $lat Latitude (-90 to 90)
     * @param int $month Month (1-12)
     * @return float Estimated average temperature in °C
     */
    private function estimate_monthly_temperature( float $lat, int $month ): float {
        
        // Base annual average temperature by latitude
        // Calibrated to real-world stations: Equator ~29°C, Sydney ~18°C, London ~11°C
        $base_temp = 30 - ( abs( $lat ) * 0.35 );
        
        // Seasonal amplitude: larger at higher latitudes
        $seasonal_amplitude = min( 12, abs( $lat ) * 0.25 );
        
        // Phase so that warmest month = July (N hemisphere) or January (S hemisphere)
        // Formula: offset = -cos(phase) * amplitude
        // Northern: month 7 = warmest (phase = π), month 1 = coldest (phase = 0)
        // Southern: month 1 = warmest (phase = π), month 7 = coldest (phase = 0)
        if ( $lat >= 0 ) {
            // Northern hemisphere: shift so month 1 = phase 0 (coldest)
            $phase = ( ( $month - 1 ) / 12 ) * 2 * M_PI;
        } else {
            // Southern hemisphere: shift so month 7 = phase 0 (coldest)
            $phase = ( ( $month - 7 ) / 12 ) * 2 * M_PI;
        }
        
        $seasonal_offset = -cos( $phase ) * $seasonal_amplitude;
        
        return round( $base_temp + $seasonal_offset, 1 );
    }
    
    /**
     * Calculate deficit zones with given ambient DLI
     */
    private function calculate_deficit_zones(
        array $shade_analysis,
        float $target_dli,
        float $threshold,
        float $ambient_dli
    ): array {
        
        $deficit_zones = [];
        $total_deficit_area = 0;
        $max_deficit = 0;
        
        foreach ( $shade_analysis['grid'] as $point ) {
            $actual_dli = $ambient_dli * $point['shade_factor'];
            $deficit = $target_dli - $actual_dli;
            
            if ( $deficit >= $threshold ) {
                $deficit_zones[] = [
                    'x'          => $point['x'],
                    'y'          => $point['y'],
                    'actual_dli' => round( $actual_dli, 1 ),
                    'deficit'    => round( $deficit, 1 ),
                    'severity'   => $this->classify_deficit( $deficit, $target_dli ),
                ];
                
                $total_deficit_area += pow( $shade_analysis['resolution'] ?? self::GRID_RESOLUTION, 2 );
                $max_deficit = max( $max_deficit, $deficit );
            }
        }
        
        // Cluster nearby deficit points into zones
        $clusters = $this->cluster_deficit_zones( $deficit_zones, ( $shade_analysis['resolution'] ?? self::GRID_RESOLUTION ) * 2 );
        
        // Cap deficit area at playing surface area (grid discretization can overshoot)
        $field_dims = $shade_analysis['field_dims'];
        $playing_area = ( $field_dims['length'] ?? 100 ) * ( $field_dims['width'] ?? 68 );
        $total_deficit_area = min( $total_deficit_area, $playing_area );
        
        return [
            'ambient_dli'        => $ambient_dli,
            'target_dli'         => $target_dli,
            'threshold'          => $threshold,
            'total_deficit_area' => $total_deficit_area,
            'max_deficit'        => round( $max_deficit, 1 ),
            'deficit_points'     => $deficit_zones,
            'clusters'           => $clusters,
            'field_dims'         => $shade_analysis['field_dims'],
        ];
    }
    
    /**
     * Estimate ambient DLI based on date/location
     */
    private function estimate_ambient_dli( array $shade_analysis ): float {
        // Use Hub-provided ambient DLI if available (real weather data)
        if ( $this->hub_ambient_dli && $this->hub_ambient_dli > 0 ) {
            return $this->hub_ambient_dli;
        }
        
        $month = (int) date( 'n' );
        $lat = $shade_analysis['latitude'] ?? -33;  // Default to Sydney if not specified
        $is_northern = $lat >= 0;
        
        // Base seasonal DLI patterns (clear sky potential)
        // These represent typical values for mid-latitude locations
        
        if ( $is_northern ) {
            // Northern Hemisphere pattern (UK, Europe, North America)
            // Much lower values due to higher cloud cover in maritime climates
            $abs_lat = abs( $lat );
            
            if ( $abs_lat > 50 ) {
                // High latitude (UK, Northern Europe) - very low winter light
                $seasonal_dli = [
                    1  => 4,   // January (deep winter)
                    2  => 7,
                    3  => 14,
                    4  => 22,
                    5  => 30,
                    6  => 35,  // June (summer peak)
                    7  => 32,
                    8  => 26,
                    9  => 18,
                    10 => 10,
                    11 => 5,
                    12 => 3,   // December (winter solstice)
                ];
            } elseif ( $abs_lat > 35 ) {
                // Mid-latitude Northern (Mediterranean, Southern US)
                $seasonal_dli = [
                    1  => 12,
                    2  => 16,
                    3  => 24,
                    4  => 32,
                    5  => 40,
                    6  => 45,  // June (summer)
                    7  => 44,
                    8  => 38,
                    9  => 28,
                    10 => 20,
                    11 => 14,
                    12 => 10,
                ];
            } else {
                // Subtropical/Tropical Northern
                $seasonal_dli = [
                    1  => 28,
                    2  => 32,
                    3  => 38,
                    4  => 42,
                    5  => 45,
                    6  => 45,
                    7  => 44,
                    8  => 42,
                    9  => 38,
                    10 => 32,
                    11 => 28,
                    12 => 26,
                ];
            }
        } else {
            // Southern Hemisphere pattern (Australia, NZ, South Africa)
            $abs_lat = abs( $lat );
            
            if ( $abs_lat > 40 ) {
                // High latitude Southern (Tasmania, NZ South Island)
                $seasonal_dli = [
                    1  => 38,  // January (summer)
                    2  => 32,
                    3  => 24,
                    4  => 16,
                    5  => 10,
                    6  => 7,   // June (winter)
                    7  => 8,
                    8  => 12,
                    9  => 20,
                    10 => 28,
                    11 => 35,
                    12 => 40,
                ];
            } elseif ( $abs_lat > 30 ) {
                // Mid-latitude Southern (Sydney, Melbourne, Perth)
                $seasonal_dli = [
                    1  => 45,  // January (summer)
                    2  => 40,
                    3  => 32,
                    4  => 24,
                    5  => 18,
                    6  => 15,  // June (winter)
                    7  => 16,
                    8  => 20,
                    9  => 28,
                    10 => 35,
                    11 => 42,
                    12 => 48,  // December (summer)
                ];
            } else {
                // Subtropical Southern (Brisbane, Durban)
                $seasonal_dli = [
                    1  => 42,
                    2  => 40,
                    3  => 36,
                    4  => 30,
                    5  => 25,
                    6  => 22,
                    7  => 24,
                    8  => 28,
                    9  => 34,
                    10 => 38,
                    11 => 40,
                    12 => 42,
                ];
            }
        }
        
        return $seasonal_dli[ $month ] ?? 25;
    }
    
    /**
     * Classify deficit severity
     */
    private function classify_deficit( float $deficit, float $target ): string {
        $ratio = $deficit / $target;
        
        if ( $ratio > 0.5 ) return 'critical';
        if ( $ratio > 0.3 ) return 'significant';
        if ( $ratio > 0.15 ) return 'moderate';
        return 'minor';
    }
    
    /**
     * Cluster deficit points into contiguous zones
     */
    private function cluster_deficit_zones( array $points, float $max_distance ): array {
        if ( empty( $points ) ) {
            return [];
        }
        
        $clusters = [];
        $assigned = [];
        
        foreach ( $points as $i => $point ) {
            if ( isset( $assigned[ $i ] ) ) {
                continue;
            }
            
            // Start new cluster
            $cluster = [
                'points'       => [ $point ],
                'center_x'     => $point['x'],
                'center_y'     => $point['y'],
                'bounds'       => [
                    'min_x' => $point['x'],
                    'max_x' => $point['x'],
                    'min_y' => $point['y'],
                    'max_y' => $point['y'],
                ],
                'avg_deficit'  => $point['deficit'],
                'max_deficit'  => $point['deficit'],
                'area'         => 25,  // 5m x 5m per point
            ];
            $assigned[ $i ] = true;
            
            // Find all connected points
            $queue = [ $i ];
            while ( ! empty( $queue ) ) {
                $current_idx = array_shift( $queue );
                $current = $points[ $current_idx ];
                
                foreach ( $points as $j => $other ) {
                    if ( isset( $assigned[ $j ] ) ) {
                        continue;
                    }
                    
                    $dist = sqrt( 
                        pow( $current['x'] - $other['x'], 2 ) + 
                        pow( $current['y'] - $other['y'], 2 ) 
                    );
                    
                    if ( $dist <= $max_distance ) {
                        $cluster['points'][] = $other;
                        $cluster['bounds']['min_x'] = min( $cluster['bounds']['min_x'], $other['x'] );
                        $cluster['bounds']['max_x'] = max( $cluster['bounds']['max_x'], $other['x'] );
                        $cluster['bounds']['min_y'] = min( $cluster['bounds']['min_y'], $other['y'] );
                        $cluster['bounds']['max_y'] = max( $cluster['bounds']['max_y'], $other['y'] );
                        $cluster['max_deficit'] = max( $cluster['max_deficit'], $other['deficit'] );
                        $cluster['area'] += 25;
                        
                        $assigned[ $j ] = true;
                        $queue[] = $j;
                    }
                }
            }
            
            // Calculate cluster center and average deficit
            $sum_x = $sum_y = $sum_deficit = 0;
            foreach ( $cluster['points'] as $p ) {
                $sum_x += $p['x'];
                $sum_y += $p['y'];
                $sum_deficit += $p['deficit'];
            }
            $count = count( $cluster['points'] );
            
            $cluster['center_x'] = round( $sum_x / $count, 1 );
            $cluster['center_y'] = round( $sum_y / $count, 1 );
            $cluster['avg_deficit'] = round( $sum_deficit / $count, 1 );
            $cluster['severity'] = $this->classify_deficit( $cluster['avg_deficit'], 20 );
            
            // Calculate cluster dimensions
            $cluster['width'] = $cluster['bounds']['max_x'] - $cluster['bounds']['min_x'] + 5;
            $cluster['height'] = $cluster['bounds']['max_y'] - $cluster['bounds']['min_y'] + 5;
            
            $clusters[] = $cluster;
        }
        
        // Sort by severity (most severe first)
        usort( $clusters, function( $a, $b ) {
            return $b['max_deficit'] <=> $a['max_deficit'];
        });
        
        return $clusters;
    }
    
    /**
     * Calculate optimal rig placements
     * 
     * Uses a greedy algorithm to place rigs where they'll have
     * maximum impact on deficit reduction. Prioritises areas where
     * shade makes conditions significantly worse than ambient baseline.
     * 
     * @param array $deficit_zones
     * @param array $rig_spec
     * @param array $stadium
     * @return array
     */
    private function calculate_optimal_placements( 
        array $deficit_zones, 
        array $rig_spec,
        array $stadium 
    ): array {
        
        $placements = [];
        $rig_length = $rig_spec['dimensions']['length'];
        $rig_width = $rig_spec['dimensions']['width'];
        $field_dims = $deficit_zones['field_dims'] ?? [ 'length' => 100, 'width' => 68 ];
        
        // Get all deficit points
        $all_points = $deficit_zones['deficit_points'] ?? [];
        $ambient_dli = $deficit_zones['ambient_dli'] ?? 20;
        $target_dli = $deficit_zones['target_dli'] ?? 20;
        $rig_coverage = $rig_spec['coverage_m2'];
        $total_deficit_area = $deficit_zones['total_deficit_area'] ?? 0;
        
        // Calculate ambient deficit (shortfall even without shade)
        $ambient_deficit = max( 0, $target_dli - $ambient_dli );
        
        // KEY DECISION: Is supplemental lighting actually needed?
        // If ambient DLI meets or exceeds target, no rigs needed regardless of shade patterns
        if ( $ambient_dli >= $target_dli ) {
            // Ambient light is adequate - check if any severe shade zones exist
            $severe_shade_points = array_filter( $all_points, function( $p ) use ( $target_dli ) {
                return $p['actual_dli'] < ( $target_dli * 0.7 );  // More than 30% below target
            });
            
            if ( empty( $severe_shade_points ) ) {
                // No significant deficit - no rigs needed
                return [
                    'rigs'               => [],
                    'ghost_rigs'         => [],
                    'total_rigs'         => 0,
                    'min_rigs_needed'    => 0,
                    'priority_zones'     => 0,
                    'priority_coverage'  => 100,
                    'uncovered_points'   => 0,
                    'coverage_complete'  => true,
                    'deficit_area'       => $total_deficit_area,
                    'priority_area'      => 0,
                    'rig_coverage'       => $rig_coverage,
                    'ambient_deficit'    => 0,
                    'strategy'           => 'not_required',
                    'reason'             => 'Ambient DLI (' . round( $ambient_dli, 1 ) . ') meets target (' . $target_dli . ')',
                ];
            }
            
            // Some severe shade zones exist even though ambient is adequate
            $all_points = $severe_shade_points;
        }
        
        if ( empty( $all_points ) ) {
            return [
                'rigs'               => [],
                'ghost_rigs'         => [],
                'total_rigs'         => 0,
                'min_rigs_needed'    => 0,
                'priority_zones'     => 0,
                'priority_coverage'  => 100,
                'uncovered_points'   => 0,
                'coverage_complete'  => true,
                'deficit_area'       => 0,
                'priority_area'      => 0,
                'rig_coverage'       => $rig_coverage,
                'ambient_deficit'    => $ambient_deficit,
                'strategy'           => 'not_required',
            ];
        }
        
        // Calculate DLI contribution from rig
        $rig_dli_per_day = $rig_spec['mol_per_hour'] * ( $rig_spec['max_daily_hours'] ?? 16 );
        
        // PRIORITISE BY ABSOLUTE DEFICIT SEVERITY
        // Sort all deficit points by actual deficit (worst first)
        usort( $all_points, fn( $a, $b ) => $b['deficit'] <=> $a['deficit'] );
        
        // Categorise points by severity
        $critical_points = [];
        $significant_points = [];
        $moderate_points = [];
        
        foreach ( $all_points as $point ) {
            $point['shade_impact'] = $point['deficit'] - $ambient_deficit;
            
            if ( $point['severity'] === 'critical' ) {
                $critical_points[] = $point;
            } elseif ( $point['severity'] === 'significant' ) {
                $significant_points[] = $point;
            } else {
                $moderate_points[] = $point;
            }
        }
        
        // Calculate priority area (critical + significant zones)
        $priority_points = array_merge( $critical_points, $significant_points );
        $priority_area = count( $priority_points ) * pow( self::GRID_RESOLUTION, 2 );
        
        // Determine strategy and rig count based on ambient deficit severity
        $deficit_ratio = $ambient_deficit / $target_dli;  // 0 = no deficit, 1 = complete darkness
        
        // Calculate DLI each rig can provide per day
        $rig_dli_contribution = $rig_spec['mol_per_hour'] * ( $rig_spec['max_daily_hours'] ?? 16 ) * ( $rig_spec['uniformity'] ?? 0.85 );
        
        if ( $deficit_ratio >= 0.7 ) {
            // SEVERE ambient deficit (e.g., December at 3 DLI vs 18 target = 83% deficit)
            // Need maximum coverage of worst areas
            $strategy = 'severe_deficit';
            
            // For severe deficit, use a GRID-BASED approach instead of clustering
            // This ensures we systematically cover the pitch
            $uncovered_points = $all_points;
            
            // Calculate rigs needed based on:
            // 1. Total deficit area that needs coverage
            // 2. Absolute deficit magnitude (higher target = more rigs needed)
            $base_rigs = ceil( $total_deficit_area / $rig_coverage );
            
            // Scale by how much DLI is actually needed
            // If deficit is 15 mol and rig provides 18.4, we need good coverage
            // If deficit is 29 mol and rig provides 18.4, we need MAXIMUM coverage + longer hours
            $deficit_severity_multiplier = min( 1.5, $ambient_deficit / $rig_dli_contribution );
            
            // Minimum 50% coverage, scaled up for higher deficits
            $coverage_target = min( 0.9, 0.5 + ( $deficit_severity_multiplier * 0.3 ) );
            $min_rigs_needed = max( 4, min( ceil( $base_rigs * $coverage_target ), 16 ) );
            
            // Override priority area to reflect actual coverage needed
            $priority_area = $total_deficit_area;
            
            // For severe deficit, generate grid-based placement candidates
            // instead of clustering (which tends to bunch everything together)
            $grid_candidates = $this->generate_grid_candidates( $field_dims, $rig_spec );
            $use_grid_placement = true;
            
        } elseif ( $deficit_ratio >= 0.3 ) {
            // MODERATE ambient deficit
            $strategy = 'moderate_deficit';
            $uncovered_points = array_merge( $critical_points, $significant_points );
            
            // For moderate deficit, use grid placement to ensure coverage across the pitch
            $min_rigs_needed = max( 4, ceil( count( $uncovered_points ) * pow( self::GRID_RESOLUTION, 2 ) / $rig_coverage ) );
            $min_rigs_needed = min( $min_rigs_needed, 10 );
            
            // Use grid placement for moderate deficit too
            $grid_candidates = $this->generate_grid_candidates( $field_dims, $rig_spec );
            $use_grid_placement = true;
            
        } else {
            // LOW or NO ambient deficit - only address severe shade pockets
            $strategy = 'shade_pockets';
            
            // When ambient light is adequate, only treat areas where shade creates
            // a SIGNIFICANT deficit (more than 50% below target)
            $shade_threshold = ( $ambient_dli >= $target_dli ) 
                ? $target_dli * 0.5   // Stricter when ambient is adequate
                : $target_dli * 0.6;  // Standard threshold
            
            $uncovered_points = array_filter( $all_points, function( $p ) use ( $shade_threshold ) {
                return $p['actual_dli'] < $shade_threshold;
            });
            $uncovered_points = array_values( $uncovered_points );
            
            // Generate grid candidates for ghost rig suggestions even in shade_pockets mode
            $grid_candidates = $this->generate_grid_candidates( $field_dims, $rig_spec );
            $use_grid_placement = false;  // Don't use grid for primary placement, but have candidates for ghosts
            
            if ( empty( $uncovered_points ) ) {
                return [
                    'rigs'               => [],
                    'ghost_rigs'         => [],  // Explicitly include empty ghost_rigs
                    'total_rigs'         => 0,
                    'min_rigs_needed'    => 0,
                    'priority_zones'     => count( $priority_points ),
                    'priority_coverage'  => 100,
                    'uncovered_points'   => 0,
                    'coverage_complete'  => true,
                    'deficit_area'       => $total_deficit_area,
                    'priority_area'      => $priority_area,
                    'rig_coverage'       => $rig_coverage,
                    'ambient_deficit'    => $ambient_deficit,
                    'strategy'           => 'not_required',
                    'reason'             => 'Ambient light adequate; minor shade effects within tolerance',
                ];
            }
            
            // Cap rigs aggressively when ambient exceeds target
            $max_shade_rigs = ( $ambient_dli >= $target_dli ) ? 2 : 4;
            $min_rigs_needed = max( 1, ceil( count( $uncovered_points ) * pow( self::GRID_RESOLUTION, 2 ) / $rig_coverage ) );
            $min_rigs_needed = min( $min_rigs_needed, $max_shade_rigs );
            $use_grid_placement = false;
            
            // IMPORTANT: For shade_pockets, max_rigs should equal min_rigs_needed (no buffer)
            // This ensures we don't exceed the cap when ambient is adequate
        }
        
        // Initialize grid placement flag if not set
        if ( ! isset( $use_grid_placement ) ) {
            $use_grid_placement = false;
        }
        
        // Maximum rigs - scaled by strategy
        if ( $strategy === 'shade_pockets' ) {
            // For shade pockets, strictly enforce the cap
            $max_rigs = $min_rigs_needed;
        } else {
            // For severe/moderate deficit, allow buffer above minimum
            $max_rigs = min( $min_rigs_needed + 4, 20 );
        }
        
        $rig_id = 1;
        
        // For severe/moderate deficit with grid placement, use pre-generated grid positions
        if ( $use_grid_placement && isset( $grid_candidates ) ) {
            
            // Score grid candidates by deficit points they would cover
            foreach ( $grid_candidates as &$gc ) {
                $covered = 0;
                $deficit_sum = 0;
                foreach ( $all_points as $point ) {
                    if ( abs( $point['x'] - $gc['x'] ) <= $rig_width / 2 &&
                         abs( $point['y'] - $gc['y'] ) <= $rig_length / 2 ) {
                        $covered++;
                        $deficit_sum += $point['deficit'] ?? 0;
                    }
                }
                $gc['coverage_score'] = $covered;
                $gc['deficit_score'] = $deficit_sum;
            }
            unset( $gc );
            
            // Sort by deficit score (worst areas first) rather than just coverage count
            usort( $grid_candidates, fn( $a, $b ) => $b['deficit_score'] <=> $a['deficit_score'] );
            
            // Track which grid cells are "covered" to ensure spread
            $covered_cells = [];
            
            // Place rigs at grid positions, ensuring spatial distribution
            foreach ( $grid_candidates as $gc ) {
                if ( count( $placements ) >= $max_rigs ) {
                    break;
                }
                
                // Skip if this position has no deficit points
                if ( $gc['coverage_score'] === 0 ) {
                    continue;
                }
                
                $bounds = [
                    'min_x' => $gc['x'] - $rig_width / 2,
                    'max_x' => $gc['x'] + $rig_width / 2,
                    'min_y' => $gc['y'] - $rig_length / 2,
                    'max_y' => $gc['y'] + $rig_length / 2,
                ];
                
                // Check overlap with existing placements
                $overlaps = false;
                foreach ( $placements as $existing ) {
                    if ( $this->bounds_overlap( $bounds, $existing['bounds'], self::MIN_OVERLAP ) ) {
                        $overlaps = true;
                        break;
                    }
                }
                
                if ( $overlaps ) {
                    continue;
                }
                
                // Count deficit points covered
                $points_covered = 0;
                $deficit_sum = 0;
                foreach ( $all_points as $point ) {
                    if ( $this->point_in_bounds( $point, $bounds ) ) {
                        $points_covered++;
                        $deficit_sum += $point['deficit'];
                    }
                }
                
                if ( $points_covered === 0 ) {
                    continue;
                }
                
                $placements[] = [
                    'rig_id'              => 'rig_' . $rig_id++,
                    'x'                   => $gc['x'],
                    'y'                   => $gc['y'],
                    'position'            => [ 'x' => $gc['x'], 'y' => $gc['y'] ],
                    'rotation'            => 0,
                    'bounds'              => $bounds,
                    'points_covered'      => $points_covered,
                    'deficit_addressed'   => round( $deficit_sum / max( 1, $points_covered ), 1 ),
                    'shade_impact_addressed' => 0,
                    'priority'            => count( $placements ) + 1,
                ];
            }
        } else {
            // Original clustering-based placement for other strategies
            while ( ! empty( $uncovered_points ) && count( $placements ) < $max_rigs ) {
                
                // Find position that covers most severe remaining deficit
                $best_position = $this->find_best_rig_position(
                    $uncovered_points,
                    $rig_length,
                    $rig_width,
                    $field_dims,
                    $placements
                );
                
                if ( ! $best_position ) {
                    break;
                }
            
                // Calculate deficit addressed by this rig
                $deficit_addressed = 0;
                $points_in_coverage = 0;
                $shade_impact_addressed = 0;
                
                foreach ( $uncovered_points as $point ) {
                    if ( $this->point_in_bounds( $point, $best_position['bounds'] ) ) {
                        $deficit_addressed += $point['deficit'];
                        $shade_impact_addressed += $point['shade_impact'] ?? 0;
                        $points_in_coverage++;
                    }
                }
                
                // Add placement
                $placement = [
                    'rig_id'              => 'rig_' . $rig_id++,
                    'x'                   => $best_position['position']['x'],
                    'y'                   => $best_position['position']['y'],
                    'position'            => $best_position['position'],
                    'rotation'            => $best_position['rotation'],
                    'bounds'              => $best_position['bounds'],
                    'points_covered'      => $points_in_coverage,
                    'deficit_addressed'   => round( $deficit_addressed / max( 1, $points_in_coverage ), 1 ),
                    'shade_impact_addressed' => round( $shade_impact_addressed / max( 1, $points_in_coverage ), 1 ),
                    'priority'            => count( $placements ) + 1,
                ];
                
                $placements[] = $placement;
                
                // Remove covered points from uncovered list
                $uncovered_points = array_filter( $uncovered_points, function( $point ) use ( $best_position ) {
                    return ! $this->point_in_bounds( $point, $best_position['bounds'] );
                });
                $uncovered_points = array_values( $uncovered_points );
            }
        }
        
        // Calculate per-rig hours based on local deficit
        $rig_mol_per_hour = $rig_spec['mol_per_hour'] ?? 1.44;
        $max_hours = $rig_spec['max_daily_hours'] ?? 16;
        $max_daily_output = $rig_mol_per_hour * $max_hours;
        
        $total_weekly_hours = 0;
        $capacity_warnings = [];
        
        foreach ( $placements as &$rig ) {
            // Get average deficit in this rig's coverage zone
            $zone_deficit = $rig['deficit_addressed'] ?? 15;
            
            // Calculate hours needed to meet deficit
            $hours_needed = $zone_deficit / $rig_mol_per_hour;
            $hours_needed = round( min( $hours_needed, $max_hours ), 1 );
            
            // Check if rig can meet the deficit
            $rig_can_meet_deficit = ( $max_daily_output >= $zone_deficit );
            $shortfall = max( 0, $zone_deficit - $max_daily_output );
            
            $rig['hours_needed_daily'] = $hours_needed;
            $rig['can_meet_deficit'] = $rig_can_meet_deficit;
            $rig['daily_shortfall'] = round( $shortfall, 1 );
            $rig['rig_daily_output'] = round( $rig_mol_per_hour * $hours_needed, 1 );
            
            // Weekly hours (assuming 7 days operation)
            $rig['hours_weekly'] = $hours_needed * 7;
            $total_weekly_hours += $rig['hours_weekly'];
            
            if ( ! $rig_can_meet_deficit ) {
                $capacity_warnings[] = [
                    'rig_id'    => $rig['rig_id'],
                    'deficit'   => $zone_deficit,
                    'max_output'=> $max_daily_output,
                    'shortfall' => round( $shortfall, 1 ),
                    'message'   => sprintf( 
                        '%s: Deficit %.1f mol exceeds rig capacity %.1f mol (shortfall: %.1f mol/day)',
                        $rig['rig_id'],
                        $zone_deficit,
                        $max_daily_output,
                        $shortfall
                    ),
                ];
            }
        }
        unset( $rig );
        
        // Calculate actual coverage of priority areas
        $priority_coverage = ( count( $priority_points ) > 0 ) 
            ? round( ( count( $priority_points ) - count( $uncovered_points ) ) / count( $priority_points ) * 100, 1 )
            : 100;
        
        // Generate GHOST RIGS for recommended additional coverage
        $ghost_rigs = [];
        if ( ! empty( $uncovered_points ) && isset( $grid_candidates ) ) {
            $ghost_id = count( $placements ) + 1;
            $max_ghost_rigs = 12;  // Show up to 12 additional recommended positions
            
            // Filter grid candidates to those not yet placed
            foreach ( $grid_candidates as $gc ) {
                if ( count( $ghost_rigs ) >= $max_ghost_rigs ) {
                    break;
                }
                
                // Skip if already has a rig placed here
                $already_placed = false;
                foreach ( $placements as $existing ) {
                    if ( abs( $existing['x'] - $gc['x'] ) < $rig_width * 0.5 &&
                         abs( $existing['y'] - $gc['y'] ) < $rig_length * 0.5 ) {
                        $already_placed = true;
                        break;
                    }
                }
                
                if ( $already_placed ) {
                    continue;
                }
                
                // Check if this position covers any remaining uncovered points
                $covers_deficit = false;
                $deficit_sum = 0;
                foreach ( $uncovered_points as $point ) {
                    if ( abs( $point['x'] - $gc['x'] ) <= $rig_width / 2 &&
                         abs( $point['y'] - $gc['y'] ) <= $rig_length / 2 ) {
                        $covers_deficit = true;
                        $deficit_sum += $point['deficit'] ?? 0;
                    }
                }
                
                if ( $covers_deficit && $deficit_sum > 0 ) {
                    $ghost_rigs[] = [
                        'rig_id'            => 'ghost_' . $ghost_id++,
                        'x'                 => $gc['x'],
                        'y'                 => $gc['y'],
                        'position'          => [ 'x' => $gc['x'], 'y' => $gc['y'] ],
                        'bounds'            => [
                            'min_x' => $gc['x'] - $rig_width / 2,
                            'max_x' => $gc['x'] + $rig_width / 2,
                            'min_y' => $gc['y'] - $rig_length / 2,
                            'max_y' => $gc['y'] + $rig_length / 2,
                        ],
                        'deficit_addressed' => round( $deficit_sum / max( 1, count( $uncovered_points ) ) * 10, 1 ),
                        'is_ghost'          => true,
                        'priority'          => $ghost_id - 1,
                    ];
                }
            }
            
            // Sort ghost rigs by deficit (worst areas first)
            usort( $ghost_rigs, fn( $a, $b ) => ( $b['deficit_addressed'] ?? 0 ) <=> ( $a['deficit_addressed'] ?? 0 ) );
        }
        
        // Calculate coverage if ALL rigs (deployed + ghost) were used
        $full_coverage_rigs = count( $placements ) + count( $ghost_rigs );
        $full_coverage_area = $full_coverage_rigs * $rig_coverage;
        $full_coverage_percent = min( 100, round( $full_coverage_area / max( 1, $total_deficit_area ) * 100, 1 ) );
        
        return [
            'rigs'               => $placements,
            'ghost_rigs'         => $ghost_rigs,
            'total_rigs'         => count( $placements ),
            'recommended_additional' => count( $ghost_rigs ),
            'min_rigs_needed'    => $min_rigs_needed,
            'priority_zones'     => count( $priority_points ),
            'priority_coverage'  => $priority_coverage,
            'uncovered_points'   => count( $uncovered_points ),
            'coverage_complete'  => empty( $uncovered_points ),
            'deficit_area'       => $total_deficit_area,
            'priority_area'      => $priority_area ?? 0,
            'rig_coverage'       => $rig_coverage,
            'ambient_deficit'    => $ambient_deficit,
            'strategy'           => $strategy ?? 'shade_priority',
            'full_coverage_percent' => $full_coverage_percent,
            // Per-rig hours and capacity data
            'rig_spec'           => [
                'mol_per_hour'    => $rig_mol_per_hour,
                'max_daily_hours' => $max_hours,
                'max_daily_output'=> $max_daily_output,
            ],
            'total_weekly_hours' => round( $total_weekly_hours, 1 ),
            'capacity_warnings'  => $capacity_warnings,
            'has_capacity_issues'=> ! empty( $capacity_warnings ),
        ];
    }
    
    /**
     * Identify strategic placement zones when no severe shade zones exist
     * 
     * Focuses on goal mouths and touchlines which are typically
     * most affected by stand shadows even when not severe.
     */
    private function identify_strategic_zones( array $points, array $field_dims ): array {
        $strategic = [];
        $half_length = ( $field_dims['length'] ?? 100 ) / 2;
        $half_width = ( $field_dims['width'] ?? 68 ) / 2;
        
        // Goal mouth zones (within 20m of each goal line)
        // Touchline zones (within 15m of sidelines)
        foreach ( $points as $point ) {
            $near_goal = abs( $point['y'] ) > ( $half_length - 25 );
            $near_touchline = abs( $point['x'] ) > ( $half_width - 20 );
            
            if ( $near_goal || $near_touchline ) {
                $point['strategic_zone'] = $near_goal ? 'goal_mouth' : 'touchline';
                $strategic[] = $point;
            }
        }
        
        // Sort by deficit severity
        usort( $strategic, fn( $a, $b ) => $b['deficit'] <=> $a['deficit'] );
        
        return $strategic;
    }
    
    /**
     * Find best position for next rig
     */
    private function find_best_rig_position( 
        array $uncovered_points, 
        float $rig_length, 
        float $rig_width,
        array $field_dims,
        array $existing_placements
    ): ?array {
        
        if ( empty( $uncovered_points ) ) {
            return null;
        }
        
        $best = null;
        $best_score = 0;
        
        // Try each uncovered point as potential center
        $candidates = $this->get_placement_candidates( $uncovered_points );
        
        // If no candidates from clustering, use the points directly
        if ( empty( $candidates ) && ! empty( $uncovered_points ) ) {
            // Sort by deficit and take top points
            $sorted = $uncovered_points;
            usort( $sorted, fn( $a, $b ) => ( $b['deficit'] ?? 0 ) <=> ( $a['deficit'] ?? 0 ) );
            $candidates = array_slice( $sorted, 0, min( 20, count( $sorted ) ) );
        }
        
        $half_fw = $field_dims['width'] / 2;
        $half_fl = $field_dims['length'] / 2;
        
        foreach ( $candidates as $candidate ) {
            // Try both orientations
            foreach ( [ 0, 90 ] as $rotation ) {
                $w = $rotation === 0 ? $rig_width : $rig_length;
                $h = $rotation === 0 ? $rig_length : $rig_width;
                
                // Use candidate position directly (rig can extend beyond field edge - 
                // it will sit on the perimeter track/surrounds)
                $cx = $candidate['x'];
                $cy = $candidate['y'];
                
                // Only clamp if the RIG CENTER would be outside the field
                // (rig edges can extend beyond field, that's fine)
                $cx = max( -$half_fw, min( $half_fw, $cx ) );
                $cy = max( -$half_fl, min( $half_fl, $cy ) );
                
                $bounds = [
                    'min_x' => $cx - $w / 2,
                    'max_x' => $cx + $w / 2,
                    'min_y' => $cy - $h / 2,
                    'max_y' => $cy + $h / 2,
                ];
                
                // Check overlap with existing placements
                $overlaps = false;
                foreach ( $existing_placements as $existing ) {
                    if ( $this->bounds_overlap( $bounds, $existing['bounds'], self::MIN_OVERLAP ) ) {
                        $overlaps = true;
                        break;
                    }
                }
                
                if ( $overlaps ) {
                    continue;
                }
                
                // Score this position
                $points_covered = 0;
                $deficit_sum = 0;
                $critical_count = 0;
                
                foreach ( $uncovered_points as $point ) {
                    if ( $this->point_in_bounds( $point, $bounds ) ) {
                        $points_covered++;
                        $deficit_sum += $point['deficit'];
                        if ( ( $point['severity'] ?? '' ) === 'critical' ) {
                            $critical_count++;
                        }
                    }
                }
                
                // Must cover at least one point
                if ( $points_covered === 0 ) {
                    continue;
                }
                
                // Score: prioritise critical areas and high deficit coverage
                $score = $deficit_sum + ( $critical_count * 5 );
                
                if ( $score > $best_score ) {
                    $best_score = $score;
                    $best = [
                        'position'       => [ 'x' => $cx, 'y' => $cy ],
                        'rotation'       => $rotation,
                        'bounds'         => $bounds,
                        'points_covered' => $points_covered,
                        'deficit_impact' => round( $deficit_sum, 1 ),
                    ];
                }
            }
        }
        
        return $best;
    }
    
    /**
     * Generate grid-based placement candidates for systematic coverage
     * 
     * Creates a grid of potential rig positions across the field,
     * useful for severe deficit scenarios where the entire pitch needs coverage.
     * 
     * @param array $field_dims Field dimensions
     * @param array $rig_spec Rig specifications
     * @return array Grid of candidate positions
     */
    private function generate_grid_candidates( array $field_dims, array $rig_spec ): array {
        $candidates = [];
        
        // field_dims now contains playing surface dimensions (not full field)
        $field_length = $field_dims['length'] ?? 100;
        $field_width = $field_dims['width'] ?? 68;
        $rig_length = $rig_spec['dimensions']['length'] ?? 20;
        $rig_width = $rig_spec['dimensions']['width'] ?? 20;
        
        // Rigs should butt against each other for uniform coverage - no gaps
        $spacing_x = $rig_width;   // 100% - rigs touch edge to edge
        $spacing_y = $rig_length;
        
        $half_fw = $field_width / 2;
        $half_fl = $field_length / 2;
        
        // Generate grid positions
        $positions_x = [];
        $positions_y = [];
        
        // X positions (across width)
        for ( $x = -$half_fw + $rig_width / 2; $x <= $half_fw - $rig_width / 2; $x += $spacing_x ) {
            $positions_x[] = $x;
        }
        
        // Y positions (along length)
        for ( $y = -$half_fl + $rig_length / 2; $y <= $half_fl - $rig_length / 2; $y += $spacing_y ) {
            $positions_y[] = $y;
        }
        
        // Generate candidate positions in a pattern that ensures good spatial distribution
        // Start with goal ends (top and bottom rows), then alternate across the pitch
        $y_order = [];
        $y_count = count( $positions_y );
        
        // Interleave from both ends toward center for better priority
        for ( $i = 0; $i < $y_count; $i++ ) {
            if ( $i % 2 === 0 ) {
                // Take from start
                $idx = intval( $i / 2 );
            } else {
                // Take from end
                $idx = $y_count - 1 - intval( $i / 2 );
            }
            if ( $idx >= 0 && $idx < $y_count && ! in_array( $idx, $y_order ) ) {
                $y_order[] = $idx;
            }
        }
        
        // Similarly for X - prioritise edges (touchlines)
        $x_order = [];
        $x_count = count( $positions_x );
        for ( $i = 0; $i < $x_count; $i++ ) {
            if ( $i % 2 === 0 ) {
                $idx = intval( $i / 2 );
            } else {
                $idx = $x_count - 1 - intval( $i / 2 );
            }
            if ( $idx >= 0 && $idx < $x_count && ! in_array( $idx, $x_order ) ) {
                $x_order[] = $idx;
            }
        }
        
        // Generate candidates with Y (length) as outer loop for row-by-row placement
        foreach ( $y_order as $yi ) {
            foreach ( $x_order as $xi ) {
                if ( isset( $positions_y[ $yi ] ) && isset( $positions_x[ $xi ] ) ) {
                    $candidates[] = [
                        'x' => $positions_x[ $xi ],
                        'y' => $positions_y[ $yi ],
                    ];
                }
            }
        }
        
        return $candidates;
    }
    
    /**
     * Get candidate positions for rig placement
     */
    private function get_placement_candidates( array $points ): array {
        // Use cluster centers as primary candidates
        $clusters = $this->cluster_deficit_zones( $points, 15 );
        
        $candidates = [];
        foreach ( $clusters as $cluster ) {
            $candidates[] = [
                'x'       => $cluster['center_x'],
                'y'       => $cluster['center_y'],
                'deficit' => $cluster['avg_deficit'],
            ];
        }
        
        // If no clusters, use individual high-deficit points
        if ( empty( $candidates ) ) {
            usort( $points, fn( $a, $b ) => $b['deficit'] <=> $a['deficit'] );
            $candidates = array_slice( $points, 0, 10 );
        }
        
        return $candidates;
    }
    
    /**
     * Check if point is within bounds
     */
    private function point_in_bounds( array $point, array $bounds ): bool {
        return $point['x'] >= $bounds['min_x'] && 
               $point['x'] <= $bounds['max_x'] &&
               $point['y'] >= $bounds['min_y'] && 
               $point['y'] <= $bounds['max_y'];
    }
    
    /**
     * Check if two bounds overlap (with minimum separation)
     */
    private function bounds_overlap( array $a, array $b, float $min_sep = 0 ): bool {
        return ! (
            $a['max_x'] + $min_sep < $b['min_x'] ||
            $a['min_x'] - $min_sep > $b['max_x'] ||
            $a['max_y'] + $min_sep < $b['min_y'] ||
            $a['min_y'] - $min_sep > $b['max_y']
        );
    }
    
    /**
     * Analyse coverage effectiveness
     */
    private function analyse_coverage( 
        array $placements, 
        array $deficit_zones,
        array $rig_spec,
        float $target_dli
    ): array {
        
        $total_deficit_area = $deficit_zones['total_deficit_area'] ?? 0;
        $covered_area = 0;
        $total_dli_contribution = 0;
        
        // Safely get rigs array
        $rigs = $placements['rigs'] ?? [];
        $total_rigs = $placements['total_rigs'] ?? count( $rigs );
        
        foreach ( $rigs as $rig ) {
            $covered_area += $rig_spec['coverage_m2'];
            
            // DLI contribution per rig per day
            $hours = $rig_spec['max_daily_hours'];
            $dli_per_day = $rig_spec['mol_per_hour'] * $hours * $rig_spec['uniformity'];
            $total_dli_contribution += $dli_per_day;
        }
        
        $coverage_ratio = $total_deficit_area > 0 
            ? min( 1.0, $covered_area / $total_deficit_area )
            : 0;
        
        // Calculate average DLI improvement
        $avg_dli_improvement = $total_rigs > 0
            ? $total_dli_contribution / $total_rigs
            : 0;
        
        return [
            'total_deficit_area' => $total_deficit_area,
            'covered_area'       => $covered_area,
            'coverage_ratio'     => round( $coverage_ratio, 2 ),
            'coverage_percent'   => round( $coverage_ratio * 100, 1 ),
            'dli_per_rig_day'    => round( $rig_spec['mol_per_hour'] * $rig_spec['max_daily_hours'] * $rig_spec['uniformity'], 1 ),
            'total_daily_dli'    => round( $total_dli_contribution, 1 ),
            'effectiveness'      => $this->rate_coverage_effectiveness( $coverage_ratio, $deficit_zones['max_deficit'], $avg_dli_improvement ),
        ];
    }
    
    /**
     * Rate coverage effectiveness
     */
    private function rate_coverage_effectiveness( float $coverage_ratio, float $max_deficit, float $avg_improvement ): string {
        if ( $coverage_ratio >= 0.95 && $avg_improvement >= $max_deficit * 0.8 ) {
            return 'excellent';
        }
        if ( $coverage_ratio >= 0.8 && $avg_improvement >= $max_deficit * 0.6 ) {
            return 'good';
        }
        if ( $coverage_ratio >= 0.6 ) {
            return 'moderate';
        }
        return 'limited';
    }
    
    /**
     * Project turf health outcomes
     * 
     * @param array  $deficit_zones
     * @param array  $placements
     * @param array  $rig_spec
     * @param string $variety
     * @param int    $days
     * @return array
     */
    private function project_turf_health( 
        array $deficit_zones,
        array $placements,
        array $rig_spec,
        string $variety,
        int $days,
        ?float $hub_temp = null
    ): array {
        
        // Get variety stress response data
        $variety_data = $this->get_variety_health_params( $variety );
        
        $dli_per_rig = $rig_spec['mol_per_hour'] * $rig_spec['max_daily_hours'] * $rig_spec['uniformity'];
        
        // Calculate coverage ratio for partial coverage modeling
        $total_deficit_area = $deficit_zones['total_deficit_area'] ?? 1;
        $covered_area = ( $placements['total_rigs'] ?? 0 ) * ( $rig_spec['coverage_m2'] ?? 400 );
        $coverage_ratio = min( 1.0, $covered_area / max( 1, $total_deficit_area ) );
        
        // Project without supplemental light
        $without_supplement = $this->project_health_trajectory(
            $deficit_zones,
            0,
            0,  // No coverage
            $variety_data,
            $days,
            $hub_temp ?? null
        );
        
        // Project with supplemental light (accounting for partial coverage)
        // Each covered zone receives DLI from ONE rig, not all rigs combined.
        // Coverage ratio models what fraction of the deficit area is covered.
        $with_supplement = $this->project_health_trajectory(
            $deficit_zones,
            $dli_per_rig,           // Single rig DLI contribution per zone
            $coverage_ratio,
            $variety_data,
            $days,
            $hub_temp ?? null
        );
        
        return [
            'variety'              => $variety,
            'days_projected'       => $days,
            'coverage_ratio'       => round( $coverage_ratio, 2 ),
            'supplement_dli_per_rig' => round( $dli_per_rig, 1 ),
            'without_supplement'   => $without_supplement,
            'with_supplement'      => $with_supplement,
            'improvement'          => [
                'health_delta'     => round( $with_supplement['final_health'] - $without_supplement['final_health'], 1 ),
                'days_saved'       => max( 0, $without_supplement['days_to_decline'] - $with_supplement['days_to_decline'] ),
                'recovery_faster'  => $with_supplement['recovery_time'] < $without_supplement['recovery_time'],
            ],
        ];
    }
    
    /**
     * Get variety health parameters
     * 
     * Science-based parameters derived from:
     * - PACE Turf minimum DLI research (Gelernter & Stowell)
     * - NTEP shade tolerance trials
     * - University extension research (Purdue, Texas A&M, Penn State)
     * - Beard's Turfgrass Science and Culture
     * 
     * Key concepts:
     * - Minimum DLI: Light level below which carbohydrate reserves deplete
     * - Optimal DLI: Light level for positive carbon balance and active growth
     * - Compensation Point: DLI where photosynthesis = respiration (survival mode)
     * - Shade tolerance: Days turf can survive below minimum before visible decline
     * - Photosynthetic pathway: C3 (cool-season) vs C4 (warm-season) determines dormancy behaviour
     */
    private function get_variety_health_params( string $variety ): array {
        
        // Science-based variety parameters
        // Sources: PACE Turf, NTEP trials, Beard (2002), university research
        $variety_library = [
            
            // === COOL-SEASON GRASSES (C3 pathway) ===
            // - Optimal growth: 15-24°C
            // - Continue slow growth in winter (>5°C)
            // - Light stress applies year-round when actively growing
            
            'perennial_rye' => [
                'name'              => 'Perennial Ryegrass',
                'species'           => 'Lolium perenne',
                'pathway'           => 'C3',              // Cool-season
                'dormancy_temp'     => 5,                 // °C - growth stops below this
                'optimal_temp_min'  => 15,                // °C - optimal growth range
                'optimal_temp_max'  => 24,
                'minimum_dli'       => 22,    // PACE Turf: 20-25 mol/m²/day
                'optimal_dli'       => 35,    // Full sun preference
                'compensation_dli'  => 8,     // Survival minimum
                'shade_tolerance'   => 'low', // Poor shade adaptation
                'carb_reserve_days' => 7,     // Days of reserves at low light
                'decline_lag_days'  => 3,     // Days before visible symptoms
                'max_decline_rate'  => 8,     // % per day at severe deficit
                'recovery_rate'     => 2.5,   // % per day at optimal light
                'temp_stress_threshold' => 28, // °C - heat amplifies light stress
                'root_depth_factor' => 0.8,   // Shallow roots = less reserves
            ],
            
            'tall_fescue' => [
                'name'              => 'Tall Fescue',
                'species'           => 'Festuca arundinacea',
                'pathway'           => 'C3',
                'dormancy_temp'     => 5,
                'optimal_temp_min'  => 15,
                'optimal_temp_max'  => 25,
                'minimum_dli'       => 18,    // Better shade tolerance than rye
                'optimal_dli'       => 32,
                'compensation_dli'  => 6,
                'shade_tolerance'   => 'moderate',
                'carb_reserve_days' => 10,
                'decline_lag_days'  => 5,
                'max_decline_rate'  => 6,
                'recovery_rate'     => 2.0,
                'temp_stress_threshold' => 30,
                'root_depth_factor' => 1.2,   // Deep roots = more reserves
            ],
            
            'kentucky_bluegrass' => [
                'name'              => 'Kentucky Bluegrass',
                'species'           => 'Poa pratensis',
                'pathway'           => 'C3',
                'dormancy_temp'     => 5,
                'optimal_temp_min'  => 15,
                'optimal_temp_max'  => 24,
                'minimum_dli'       => 20,    // PACE: 18-22 mol/m²/day
                'optimal_dli'       => 35,
                'compensation_dli'  => 7,
                'shade_tolerance'   => 'low-moderate',
                'carb_reserve_days' => 8,
                'decline_lag_days'  => 4,
                'max_decline_rate'  => 7,
                'recovery_rate'     => 2.0,
                'temp_stress_threshold' => 27,
                'root_depth_factor' => 0.9,
            ],
            
            'creeping_bentgrass' => [
                'name'              => 'Creeping Bentgrass',
                'species'           => 'Agrostis stolonifera',
                'minimum_dli'       => 20,    // PACE: 18-22, higher for greens
                'optimal_dli'       => 30,
                'compensation_dli'  => 8,
                'shade_tolerance'   => 'low',
                'carb_reserve_days' => 5,     // Very limited reserves
                'decline_lag_days'  => 2,     // Quick to show stress
                'max_decline_rate'  => 10,    // Rapid decline when stressed
                'recovery_rate'     => 3.0,   // But also recovers quickly
                'temp_stress_threshold' => 25,
                'root_depth_factor' => 0.6,   // Very shallow
            ],
            
            // === WARM-SEASON GRASSES (C4 pathway) ===
            // - Optimal growth: 27-35°C
            // - Enter dormancy below ~15°C (turn brown, stop growing)
            // - Light stress only applies when actively growing
            // - In dormancy: survive on stored reserves, minimal metabolism
            
            'bermuda' => [
                'name'              => 'Common Bermuda',
                'species'           => 'Cynodon dactylon',
                'pathway'           => 'C4',              // Warm-season
                'dormancy_temp'     => 15,                // °C - enters dormancy below this
                'optimal_temp_min'  => 27,                // °C - optimal growth range
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 28,    // PACE: 26-32 mol/m²/day - high requirement
                'optimal_dli'       => 45,
                'compensation_dli'  => 12,
                'shade_tolerance'   => 'very_low',
                'carb_reserve_days' => 6,
                'decline_lag_days'  => 2,
                'max_decline_rate'  => 9,
                'recovery_rate'     => 4.0,   // Fast recovery in full sun
                'temp_stress_threshold' => 38, // Heat tolerant
                'root_depth_factor' => 1.0,
            ],
            
            'tiftuf' => [
                'name'              => 'TifTuf Bermuda',
                'species'           => 'Cynodon dactylon x C. transvaalensis',
                'pathway'           => 'C4',
                'dormancy_temp'     => 13,                // Slightly better cold tolerance
                'optimal_temp_min'  => 27,
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 24,    // Improved shade tolerance over common
                'optimal_dli'       => 40,
                'compensation_dli'  => 10,
                'shade_tolerance'   => 'low',
                'carb_reserve_days' => 8,
                'decline_lag_days'  => 3,
                'max_decline_rate'  => 7,
                'recovery_rate'     => 4.5,
                'temp_stress_threshold' => 40,
                'root_depth_factor' => 1.1,
            ],
            
            'tifdwarf' => [
                'name'              => 'TifDwarf Bermuda',
                'species'           => 'Cynodon dactylon x C. transvaalensis',
                'pathway'           => 'C4',
                'dormancy_temp'     => 15,
                'optimal_temp_min'  => 27,
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 30,    // Ultradwarf = higher light need
                'optimal_dli'       => 45,
                'compensation_dli'  => 14,
                'shade_tolerance'   => 'very_low',
                'carb_reserve_days' => 4,     // Very limited reserves
                'decline_lag_days'  => 2,
                'max_decline_rate'  => 12,
                'recovery_rate'     => 5.0,
                'temp_stress_threshold' => 38,
                'root_depth_factor' => 0.5,   // Ultra shallow
            ],
            
            'tifgrand' => [
                'name'              => 'TifGrand Bermuda',
                'species'           => 'Cynodon dactylon x C. transvaalensis',
                'pathway'           => 'C4',
                'dormancy_temp'     => 13,
                'optimal_temp_min'  => 25,
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 20,    // Best shade tolerance of bermudas
                'optimal_dli'       => 35,
                'compensation_dli'  => 8,
                'shade_tolerance'   => 'moderate', // Bred for shade
                'carb_reserve_days' => 12,
                'decline_lag_days'  => 5,
                'max_decline_rate'  => 5,
                'recovery_rate'     => 3.5,
                'temp_stress_threshold' => 38,
                'root_depth_factor' => 1.3,
            ],
            
            'zoysia' => [
                'name'              => 'Zoysiagrass',
                'species'           => 'Zoysia spp.',
                'pathway'           => 'C4',
                'dormancy_temp'     => 10,                // Better cold tolerance than bermuda
                'optimal_temp_min'  => 25,
                'optimal_temp_max'  => 32,
                'minimum_dli'       => 16,    // Good shade tolerance
                'optimal_dli'       => 30,
                'compensation_dli'  => 5,
                'shade_tolerance'   => 'good',
                'carb_reserve_days' => 14,
                'decline_lag_days'  => 7,
                'max_decline_rate'  => 4,
                'recovery_rate'     => 1.5,   // Slow but steady
                'temp_stress_threshold' => 35,
                'root_depth_factor' => 1.4,
            ],
            
            'zeon' => [
                'name'              => 'Zeon Zoysia',
                'species'           => 'Zoysia matrella',
                'minimum_dli'       => 14,    // Excellent shade tolerance
                'optimal_dli'       => 28,
                'compensation_dli'  => 4,
                'shade_tolerance'   => 'very_good',
                'carb_reserve_days' => 18,
                'decline_lag_days'  => 10,
                'max_decline_rate'  => 3,
                'recovery_rate'     => 1.2,
                'temp_stress_threshold' => 35,
                'root_depth_factor' => 1.5,
            ],
            
            'kikuyu' => [
                'name'              => 'Kikuyu',
                'species'           => 'Pennisetum clandestinum',
                'pathway'           => 'C4',
                'dormancy_temp'     => 10,                // Relatively cold tolerant for C4
                'optimal_temp_min'  => 20,
                'optimal_temp_max'  => 30,
                'minimum_dli'       => 20,    // Moderate-high requirement
                'optimal_dli'       => 38,
                'compensation_dli'  => 8,
                'shade_tolerance'   => 'moderate',
                'carb_reserve_days' => 10,
                'decline_lag_days'  => 4,
                'max_decline_rate'  => 6,
                'recovery_rate'     => 5.0,   // Very vigorous recovery
                'temp_stress_threshold' => 35,
                'root_depth_factor' => 1.3,
            ],
            
            'paspalum' => [
                'name'              => 'Seashore Paspalum',
                'species'           => 'Paspalum vaginatum',
                'pathway'           => 'C4',
                'dormancy_temp'     => 12,
                'optimal_temp_min'  => 25,
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 24,
                'optimal_dli'       => 40,
                'compensation_dli'  => 10,
                'shade_tolerance'   => 'low',
                'carb_reserve_days' => 7,
                'decline_lag_days'  => 3,
                'max_decline_rate'  => 8,
                'recovery_rate'     => 3.5,
                'temp_stress_threshold' => 38,
                'root_depth_factor' => 1.0,
            ],
            
            // === COUCH/BERMUDA VARIETIES (Australian) - All C4 ===
            
            'legend' => [
                'name'              => 'Legend Couch',
                'species'           => 'Cynodon dactylon x C. transvaalensis',
                'pathway'           => 'C4',
                'dormancy_temp'     => 14,
                'optimal_temp_min'  => 25,
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 22,
                'optimal_dli'       => 38,
                'compensation_dli'  => 9,
                'shade_tolerance'   => 'low-moderate',
                'carb_reserve_days' => 9,
                'decline_lag_days'  => 4,
                'max_decline_rate'  => 7,
                'recovery_rate'     => 4.0,
                'temp_stress_threshold' => 40,
                'root_depth_factor' => 1.1,
            ],
            
            'wintergreen' => [
                'name'              => 'Wintergreen Couch',
                'species'           => 'Cynodon dactylon',
                'pathway'           => 'C4',
                'dormancy_temp'     => 12,                // Better winter colour retention
                'optimal_temp_min'  => 24,
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 20,
                'optimal_dli'       => 35,
                'compensation_dli'  => 8,
                'shade_tolerance'   => 'moderate',
                'carb_reserve_days' => 10,
                'decline_lag_days'  => 5,
                'max_decline_rate'  => 6,
                'recovery_rate'     => 3.5,
                'temp_stress_threshold' => 38,
                'root_depth_factor' => 1.2,
            ],
            
            'santa_ana' => [
                'name'              => 'Santa Ana Couch',
                'species'           => 'Cynodon dactylon x C. transvaalensis',
                'pathway'           => 'C4',
                'dormancy_temp'     => 14,
                'optimal_temp_min'  => 27,
                'optimal_temp_max'  => 38,
                'minimum_dli'       => 24,
                'optimal_dli'       => 40,
                'compensation_dli'  => 10,
                'shade_tolerance'   => 'low',
                'carb_reserve_days' => 7,
                'decline_lag_days'  => 3,
                'max_decline_rate'  => 8,
                'recovery_rate'     => 4.5,
                'temp_stress_threshold' => 42,
                'root_depth_factor' => 1.0,
            ],
            
            'platinum_te' => [
                'name'              => 'Platinum TE Paspalum',
                'species'           => 'Paspalum vaginatum',
                'pathway'           => 'C4',
                'dormancy_temp'     => 12,
                'optimal_temp_min'  => 25,
                'optimal_temp_max'  => 35,
                'minimum_dli'       => 22,
                'optimal_dli'       => 38,
                'compensation_dli'  => 9,
                'shade_tolerance'   => 'low-moderate',
                'carb_reserve_days' => 8,
                'decline_lag_days'  => 4,
                'max_decline_rate'  => 7,
                'recovery_rate'     => 3.5,
                'temp_stress_threshold' => 38,
                'root_depth_factor' => 1.1,
            ],
        ];
        
        // Check if variety exists in library
        $key = strtolower( str_replace( [ ' ', '-' ], '_', $variety ) );
        
        // Alias mapping for database variety keys to library keys
        $aliases = [
            'tahoma31'      => 'tiftuf',          // Tahoma 31 ≈ TifTuf (both improved bermudas, similar shade/DLI profile)
            'tahoma_31'     => 'tiftuf',
            'ryegrass'      => 'perennial_rye',
            'prg'           => 'perennial_rye',
            'couch'         => 'bermuda_common',
            'zeon'          => 'zoysia',
            'zeon_zoysia'   => 'zoysia',
        ];
        $key = $aliases[ $key ] ?? $key;
        
        if ( isset( $variety_library[ $key ] ) ) {
            return $variety_library[ $key ];
        }
        
        // Check variety database if available (for Hub integration)
        if ( $this->variety_database ) {
            $data = $this->variety_database->get_variety( $variety );
            if ( $data && isset( $data['minimum_dli'] ) ) {
                return [
                    'name'              => $data['name'] ?? $variety,
                    'species'           => $data['species'] ?? 'Unknown',
                    'minimum_dli'       => $data['minimum_dli'] ?? 20,
                    'optimal_dli'       => $data['optimal_dli'] ?? 35,
                    'compensation_dli'  => $data['compensation_dli'] ?? 8,
                    'shade_tolerance'   => $data['shade_tolerance'] ?? 'moderate',
                    'carb_reserve_days' => $data['carb_reserve_days'] ?? 10,
                    'decline_lag_days'  => $data['decline_lag_days'] ?? 4,
                    'max_decline_rate'  => $data['max_decline_rate'] ?? 6,
                    'recovery_rate'     => $data['recovery_rate'] ?? 2.5,
                    'temp_stress_threshold' => $data['temp_stress_threshold'] ?? 30,
                    'root_depth_factor' => $data['root_depth_factor'] ?? 1.0,
                ];
            }
        }
        
        // Default: moderate cool-season grass
        return [
            'name'              => ucwords( str_replace( '_', ' ', $variety ) ),
            'species'           => 'Unknown',
            'minimum_dli'       => 20,
            'optimal_dli'       => 32,
            'compensation_dli'  => 7,
            'shade_tolerance'   => 'moderate',
            'carb_reserve_days' => 10,
            'decline_lag_days'  => 4,
            'max_decline_rate'  => 6,
            'recovery_rate'     => 2.5,
            'temp_stress_threshold' => 30,
            'root_depth_factor' => 1.0,
        ];
    }
    
    /**
     * Project health trajectory using carbohydrate reserve depletion model
     * 
     * SCIENTIFIC BASIS:
     * Turfgrass health under shade stress follows a carbohydrate reserve depletion
     * pattern, not a linear decline. The model is based on:
     * 
     * 1. PHOTOSYNTHESIS vs RESPIRATION BALANCE
     *    - Above compensation point: Net carbon gain (recovery possible)
     *    - Below compensation point: Net carbon loss (consuming reserves)
     *    - Below minimum DLI: Accelerated reserve depletion
     * 
     * 2. CARBOHYDRATE RESERVE DYNAMICS (Beard, 2002; Hull, 1992)
     *    - Turf stores carbs in crowns, stolons, rhizomes, roots
     *    - Reserves buffer against short-term light deficits
     *    - Depletion follows exponential decay pattern
     *    - Visible decline occurs after ~60-70% reserve depletion
     * 
     * 3. VARIETY-SPECIFIC RESPONSES (PACE Turf; NTEP shade trials)
     *    - Shade tolerance = reserve capacity + metabolic efficiency
     *    - Warm-season grasses: Higher light needs, faster recovery
     *    - Cool-season grasses: Lower light needs, slower recovery
     * 
     * 4. TEMPERATURE INTERACTION (Huang & Gao, 2000)
     *    - High temp + low light = accelerated decline (respiration > photosynthesis)
     *    - Optimal temp + adequate light = fastest recovery
     * 
     * 5. DORMANCY (C4 grasses in cool climates)
     *    - C4 grasses enter dormancy below ~10-15°C
     *    - Dormant grass maintains reserves, doesn't decline from light stress
     *    - Shows as brown/straw colour but is alive and will green up in spring
     * 
     * Health score represents:
     * - 100%: Full carbohydrate reserves, optimal density/colour
     * - 70-99%: Adequate reserves, acceptable quality
     * - 50-69%: Depleted reserves, visible thinning/yellowing
     * - 30-49%: Critical depletion, significant decline
     * - <30%: Severe damage, recovery uncertain
     * - DORMANT: Special state for C4 grasses - not declining, just waiting
     */
    private function project_health_trajectory( 
        array $deficit_zones,
        float $supplement_dli,
        float $coverage_ratio,
        array $variety_data,
        int $days,
        ?float $avg_temperature = null
    ): array {
        
        // Extract variety parameters
        $min_dli = $variety_data['minimum_dli'] ?? 20;
        $optimal_dli = $variety_data['optimal_dli'] ?? 32;
        $compensation_dli = $variety_data['compensation_dli'] ?? 7;
        $carb_reserve_days = $variety_data['carb_reserve_days'] ?? 10;
        $decline_lag = $variety_data['decline_lag_days'] ?? 4;
        $max_decline = $variety_data['max_decline_rate'] ?? 6;
        $recovery_rate = $variety_data['recovery_rate'] ?? 2.5;
        $root_factor = $variety_data['root_depth_factor'] ?? 1.0;
        
        // C3/C4 pathway and dormancy
        $pathway = $variety_data['pathway'] ?? 'C3';
        $dormancy_temp = $variety_data['dormancy_temp'] ?? ( $pathway === 'C4' ? 15 : 5 );
        
        // Check for dormancy condition (C4 grass in cold climate)
        // If no temperature provided, estimate from latitude/month in deficit_zones
        if ( $avg_temperature === null ) {
            $avg_temperature = $deficit_zones['estimated_temp'] ?? null;
        }
        
        $is_dormant = false;
        $dormancy_message = null;
        
        if ( $pathway === 'C4' && $avg_temperature !== null && $avg_temperature < $dormancy_temp ) {
            $is_dormant = true;
            $dormancy_message = sprintf(
                '%s is a C4 (warm-season) grass that enters dormancy below %d°C. ' .
                'At %d°C average temperature, the turf is dormant and does not require supplemental lighting. ' .
                'Dormant turf maintains stored reserves and will green up when temperatures rise above %d°C.',
                $variety_data['name'] ?? 'This variety',
                $dormancy_temp,
                round( $avg_temperature ),
                $dormancy_temp
            );
        }
        
        // If dormant, return stable health trajectory (no decline, no recovery needed)
        if ( $is_dormant ) {
            $dormant_trajectory = [];
            for ( $d = 0; $d <= $days; $d++ ) {
                $dormant_trajectory[] = [
                    'day'                => $d,
                    'health'             => 100,  // Dormant = stable, not declining
                    'covered'            => 100,
                    'uncovered'          => 100,
                    'reserves_covered'   => 95,   // Slight reserve use for maintenance
                    'reserves_uncovered' => 95,
                    'status'             => 'dormant',
                ];
            }
            
            return [
                'trajectory'         => $dormant_trajectory,
                'final_health'       => 100,
                'final_covered'      => 100,
                'final_uncovered'    => 100,
                'days_to_decline'    => $days,  // No decline expected
                'recovery_time'      => 0,
                'is_dormant'         => true,
                'dormancy_message'   => $dormancy_message,
                'dli_analysis'       => [
                    'ambient'         => round( $deficit_zones['ambient_dli'] ?? 0, 1 ),
                    'note'            => 'Light stress model not applicable during dormancy',
                ],
            ];
        }
        
        // === ACTIVE GROWTH - Apply light stress model ===
        
        // Calculate DLI values for different zones
        $ambient_dli = $deficit_zones['ambient_dli'] ?? 15;
        $max_deficit = $deficit_zones['max_deficit'] ?? 12;
        
        // Shaded zone receives reduced ambient light
        $shade_factor = max( 0.1, 1 - ( $max_deficit / max( 1, $ambient_dli + $max_deficit ) ) );
        $dli_shaded = $ambient_dli * $shade_factor;
        
        // Covered zones get shaded DLI + supplement
        $dli_covered = $dli_shaded + $supplement_dli;
        $dli_uncovered = $dli_shaded;
        
        // Initialize carbohydrate reserves (100% = full)
        $reserves_covered = 100;
        $reserves_uncovered = 100;
        
        // Track cumulative stress days (for lag effect)
        $stress_days_covered = 0;
        $stress_days_uncovered = 0;
        
        $trajectory = [ [ 
            'day' => 0, 
            'health' => 100, 
            'covered' => 100, 
            'uncovered' => 100,
            'reserves_covered' => 100,
            'reserves_uncovered' => 100,
        ] ];
        
        $days_to_decline = $days;
        
        for ( $d = 1; $d <= $days; $d++ ) {
            
            // === UNCOVERED ZONES ===
            $reserves_uncovered = $this->calculate_daily_reserve_change(
                $reserves_uncovered,
                $dli_uncovered,
                $min_dli,
                $optimal_dli,
                $compensation_dli,
                $carb_reserve_days,
                $max_decline,
                $recovery_rate,
                $root_factor,
                $stress_days_uncovered
            );
            
            // Track stress accumulation
            if ( $dli_uncovered < $min_dli ) {
                $stress_days_uncovered++;
            } else {
                $stress_days_uncovered = max( 0, $stress_days_uncovered - 0.5 ); // Slow stress relief
            }
            
            // === COVERED ZONES ===
            $reserves_covered = $this->calculate_daily_reserve_change(
                $reserves_covered,
                $dli_covered,
                $min_dli,
                $optimal_dli,
                $compensation_dli,
                $carb_reserve_days,
                $max_decline,
                $recovery_rate,
                $root_factor,
                $stress_days_covered
            );
            
            if ( $dli_covered < $min_dli ) {
                $stress_days_covered++;
            } else {
                $stress_days_covered = max( 0, $stress_days_covered - 0.5 );
            }
            
            // Convert reserves to visible health score
            // Visible symptoms lag behind reserve depletion
            $health_covered = $this->reserves_to_health( $reserves_covered, $decline_lag, $d );
            $health_uncovered = $this->reserves_to_health( $reserves_uncovered, $decline_lag, $d );
            
            // Overall health weighted by coverage
            $overall_health = ( $health_covered * $coverage_ratio ) + 
                             ( $health_uncovered * ( 1 - $coverage_ratio ) );
            
            $trajectory[] = [
                'day'                 => $d,
                'health'              => round( $overall_health, 1 ),
                'covered'             => round( $health_covered, 1 ),
                'uncovered'           => round( $health_uncovered, 1 ),
                'reserves_covered'    => round( $reserves_covered, 1 ),
                'reserves_uncovered'  => round( $reserves_uncovered, 1 ),
            ];
            
            // Track days to visible decline (health < 70%)
            if ( $overall_health < 70 && $days_to_decline === $days ) {
                $days_to_decline = $d;
            }
        }
        
        $final = end( $trajectory );
        
        // Calculate recovery time based on reserve status
        $recovery_time = $this->estimate_recovery_time( 
            $final['reserves_covered'] ?? $final['health'],
            $recovery_rate,
            $optimal_dli
        );
        
        return [
            'trajectory'         => $trajectory,
            'final_health'       => $final['health'],
            'final_covered'      => $final['covered'],
            'final_uncovered'    => $final['uncovered'],
            'days_to_decline'    => $days_to_decline,
            'recovery_time'      => $recovery_time,
            'dli_analysis'       => [
                'ambient'        => round( $ambient_dli, 1 ),
                'shaded'         => round( $dli_shaded, 1 ),
                'covered'        => round( $dli_covered, 1 ),
                'uncovered'      => round( $dli_uncovered, 1 ),
                'target_min'     => $min_dli,
                'target_optimal' => $optimal_dli,
            ],
        ];
    }
    
    /**
     * Calculate daily carbohydrate reserve change
     * 
     * Models the carbon balance equation:
     * ΔReserves = Photosynthesis - Respiration - Growth
     * 
     * Simplified to DLI-based reserve change rate
     */
    private function calculate_daily_reserve_change(
        float $current_reserves,
        float $actual_dli,
        float $min_dli,
        float $optimal_dli,
        float $compensation_dli,
        float $reserve_capacity_days,
        float $max_decline_rate,
        float $recovery_rate,
        float $root_factor,
        float $cumulative_stress_days
    ): float {
        
        // Adjust capacity based on root depth (deeper roots = more storage)
        $effective_capacity = $reserve_capacity_days * $root_factor;
        
        if ( $actual_dli >= $optimal_dli ) {
            // OPTIMAL LIGHT: Maximum recovery
            // Recovery rate decreases as reserves approach 100%
            $recovery_potential = ( 100 - $current_reserves ) / 100;
            $daily_gain = $recovery_rate * $recovery_potential * 1.5;
            return min( 100, $current_reserves + $daily_gain );
            
        } elseif ( $actual_dli >= $min_dli ) {
            // ADEQUATE LIGHT: Maintenance to slow recovery
            // Between minimum and optimal - proportional recovery
            $adequacy_ratio = ( $actual_dli - $min_dli ) / ( $optimal_dli - $min_dli );
            $recovery_potential = ( 100 - $current_reserves ) / 100;
            $daily_gain = $recovery_rate * $adequacy_ratio * $recovery_potential;
            return min( 100, $current_reserves + $daily_gain );
            
        } elseif ( $actual_dli >= $compensation_dli ) {
            // BELOW MINIMUM BUT ABOVE COMPENSATION: Slow depletion
            // Turf surviving but not thriving - gradual reserve use
            $deficit_severity = ( $min_dli - $actual_dli ) / ( $min_dli - $compensation_dli );
            $base_decline = $max_decline_rate * 0.3 * $deficit_severity;
            
            // Accelerate decline if stress has accumulated
            $stress_multiplier = 1 + ( $cumulative_stress_days / $effective_capacity ) * 0.5;
            $daily_loss = $base_decline * $stress_multiplier;
            
            return max( 0, $current_reserves - $daily_loss );
            
        } else {
            // BELOW COMPENSATION POINT: Rapid depletion
            // Respiration exceeds photosynthesis - burning reserves fast
            $severity = ( $compensation_dli - $actual_dli ) / $compensation_dli;
            $base_decline = $max_decline_rate * ( 0.5 + 0.5 * $severity );
            
            // Exponential acceleration as reserves deplete
            // (Less reserves = less root function = less ability to recover)
            $depletion_multiplier = 1 + ( ( 100 - $current_reserves ) / 100 ) * 0.5;
            
            // Stress accumulation effect
            $stress_multiplier = 1 + ( $cumulative_stress_days / $effective_capacity );
            
            $daily_loss = $base_decline * $depletion_multiplier * $stress_multiplier;
            
            return max( 0, $current_reserves - $daily_loss );
        }
    }
    
    /**
     * Convert carbohydrate reserves to visible health score
     * 
     * Visible symptoms lag behind actual reserve depletion because:
     * 1. Surface tissue remains green while reserves deplete
     * 2. Crown/root reserves deplete before shoot tissue
     * 3. Chlorophyll breakdown takes time
     * 
     * Research indicates visible symptoms appear after ~30-40% reserve loss
     */
    private function reserves_to_health( float $reserves, int $lag_days, int $current_day ): float {
        
        // Early in the period, visible health lags behind reserves
        if ( $current_day <= $lag_days ) {
            // Dampen the visible effect during lag period
            $lag_factor = $current_day / $lag_days;
            $reserve_effect = 100 - $reserves; // How much reserves have dropped
            $visible_effect = $reserve_effect * $lag_factor * 0.5; // Partial visibility
            return max( 0, min( 100, 100 - $visible_effect ) );
        }
        
        // After lag period, health tracks reserves more closely
        // But there's still some buffering
        if ( $reserves >= 80 ) {
            // High reserves = minimal visible symptoms
            return max( 85, $reserves );
        } elseif ( $reserves >= 50 ) {
            // Moderate reserves = proportional decline
            return $reserves + 5; // Slight buffer
        } else {
            // Low reserves = visible decline catches up
            return max( 0, $reserves - 5 ); // Worse than reserves
        }
    }
    
    /**
     * Estimate days to recover to acceptable health
     * 
     * Recovery is non-linear:
     * - Initial recovery is slow (rebuilding root function)
     * - Mid-recovery accelerates (restored photosynthetic capacity)
     * - Final approach to 100% slows (diminishing returns)
     */
    private function estimate_recovery_time( float $current_reserves, float $recovery_rate, float $optimal_dli ): int {
        
        if ( $current_reserves >= 90 ) {
            return 0; // Already healthy
        }
        
        if ( $current_reserves < 20 ) {
            return 999; // May not recover - too depleted
        }
        
        // Estimate days to reach 90% reserves at optimal light
        $target = 90;
        $reserves = $current_reserves;
        $days = 0;
        $max_iterations = 120; // Cap at 4 months
        
        while ( $reserves < $target && $days < $max_iterations ) {
            $recovery_potential = ( 100 - $reserves ) / 100;
            
            // Slower initial recovery if reserves are very low
            $efficiency = $reserves < 50 ? 0.5 : 1.0;
            
            $daily_gain = $recovery_rate * $recovery_potential * $efficiency * 1.5;
            $reserves += $daily_gain;
            $days++;
        }
        
        return $days;
    }
    
    /**
     * Classify health status
     */
    private function classify_health_status( float $health ): string {
        if ( $health >= 90 ) return 'excellent';
        if ( $health >= 75 ) return 'good';
        if ( $health >= 60 ) return 'stressed';
        if ( $health >= 40 ) return 'declining';
        return 'critical';
    }
    
    /**
     * Generate summary
     */
    /**
     * Calculate Environmental Utilisation Efficiency for rig placement context.
     * 
     * Uses available data: hub temperature, stadium location (for temp estimate),
     * and venue environment config (enclosure, drainage, airflow, etc).
     * 
     * @param string $variety          Turf variety key
     * @param ?float $hub_temperature  Live air temperature from climate engine
     * @param array  $stadium          Stadium database record
     * @param array  $venue_env        Venue environment config from UI
     * @param int    $month            Analysis month (1-12)
     * @return array EUE result from Gssh_EUE_Calculator
     */
    private function calculate_eue(
        string $variety,
        ?float $hub_temperature,
        array $stadium,
        array $venue_env,
        int $month
    ): array {
        $eue_calc = new Gssh_EUE_Calculator();
        
        // Helper: read venue_env with camelCase or snake_case key
        $env = function( $snake, $camel = null ) use ( $venue_env ) {
            if ( isset( $venue_env[ $snake ] ) && $venue_env[ $snake ] !== '' ) return $venue_env[ $snake ];
            if ( $camel && isset( $venue_env[ $camel ] ) && $venue_env[ $camel ] !== '' ) return $venue_env[ $camel ];
            return null;
        };
        
        // Determine air temperature
        $lat = $stadium['location']['lat'] ?? -33.8;
        $air_temp = $hub_temperature ?? $this->estimate_monthly_temperature( $lat, $month );
        
        // Read enclosure type early — needed for air temp adjustment
        $enclosure = $env( 'enclosure_type', 'enclosureType' ) ?? 'open';
        
        // Enclosed venues retain heat — air temp inside is higher than outdoor ambient
        // Fixed roof stadiums typically maintain 5–10°C above outdoor in winter
        // Retractable roofs provide moderate shelter
        if ( $enclosure === 'fixed_roof' || $enclosure === 'enclosed' || $enclosure === 'enclosed_enriched' ) {
            $air_temp = $air_temp + 6;
        } elseif ( $enclosure === 'retractable_closed' ) {
            $air_temp = $air_temp + 3;
        }
        
        // Estimate soil temperature (lags air, less extreme)
        $soil_temp = $air_temp * 0.85 + 3;
        
        // Resolve airflow
        $wind_speed = null;
        $airflow = $env( 'estimated_airflow_ms', 'estimatedAirflowMs' );
        if ( $airflow !== null ) {
            $wind_speed = floatval( $airflow );
        } else {
            $fans = $env( 'has_fans', 'hasFans' );
            if ( $fans && $fans !== 'false' && $fans !== '0' ) {
                $wind_speed = 0.5;
            }
        }
        
        // Sub-soil heating upgrades soil temp in cold conditions
        $heating = $env( 'has_sub_soil_heating', 'hasSubSoilHeating' );
        if ( $heating && $heating !== 'false' && $heating !== '0' ) {
            $soil_temp = max( $soil_temp, 15 ); // Heated systems typically maintain ≥15°C
        }
        
        $humidity = $env( 'humidity_pct', 'humidityPct' );
        $co2 = $env( 'co2_ppm', 'co2ppm' );
        $drainage = $env( 'drainage_rating', 'drainageRating' );
        $soil_moisture = $env( 'soil_moisture_pct', 'soilMoisturePct' );
        
        $params = array(
            'species'           => $variety,
            'soil_temp_c'       => round( $soil_temp, 1 ),
            'air_temp_c'        => round( $air_temp, 1 ),
            'humidity_pct'      => $humidity !== null ? floatval( $humidity ) : null,
            'wind_speed_ms'     => $wind_speed,
            'co2_ppm'           => $co2 !== null ? floatval( $co2 ) : null,
            'venue_enclosure'   => $enclosure,
            'drainage_rating'   => $drainage !== null ? floatval( $drainage ) : null,
            'soil_moisture_pct' => $soil_moisture !== null ? floatval( $soil_moisture ) : null,
        );
        
        $result = $eue_calc->calculate( $params );
        
        // Debug: attach what we actually processed
        $result['_debug_eue_input'] = array(
            'outdoor_temp'  => $hub_temperature ?? $this->estimate_monthly_temperature( $lat, $month ),
            'air_temp'      => $air_temp,
            'soil_temp'     => $soil_temp,
            'heating_val'   => $heating,
            'heating_check' => ( $heating && $heating !== 'false' && $heating !== '0' ) ? 'YES' : 'NO',
            'enclosure'     => $enclosure,
            'wind_speed'    => $wind_speed,
        );
        
        return $result;
    }

    private function generate_summary( array $placements, array $coverage, array $health, ?array $eue = null ): array {
        $min_rigs = $placements['min_rigs_needed'] ?? 0;
        $priority_zones = $placements['priority_zones'] ?? 0;
        $strategy = $placements['strategy'] ?? 'not_required';
        
        $summary = [
            'rigs_required'      => $placements['total_rigs'],
            'min_rigs_needed'    => $min_rigs,
            'priority_zones'     => $priority_zones,
            'priority_coverage'  => $placements['priority_coverage'] ?? 100,
            'coverage_percent'   => $coverage['coverage_percent'],
            'effectiveness'      => $coverage['effectiveness'],
            'health_improvement' => $health['improvement']['health_delta'],
            'strategy'           => $strategy,
            'recommendation'     => $this->generate_recommendation( $placements, $coverage, $health ),
        ];
        
        // Include EUE summary when available
        if ( $eue && isset( $eue['composite_eue'] ) ) {
            $summary['eue_coefficient']  = $eue['composite_eue'];
            $summary['wasted_photon_pct'] = $eue['wasted_photon_pct'] ?? 0;
            $summary['venue_readiness']  = $eue['venue_readiness']['status'] ?? 'UNKNOWN';
            
            // Append environmental advisory to recommendation if EUE is low
            if ( $eue['composite_eue'] < 0.6 ) {
                $primary = $eue['primary_limiting'] ?? null;
                $factor_label = $primary ? ( $primary['factor'] ?? 'environmental conditions' ) : 'environmental conditions';
                $summary['recommendation'] .= sprintf(
                    ' Note: environmental constraints (primarily %s) reduce LED utilisation to ~%d%%. Address limiting factors for better return on light investment.',
                    str_replace( '_', ' ', $factor_label ),
                    round( $eue['composite_eue'] * 100 )
                );
            }
        }
        
        return $summary;
    }
    
    /**
     * Generate text recommendation
     */
    private function generate_recommendation( array $placements, array $coverage, array $health ): string {
        $rigs = $placements['total_rigs'];
        $min_needed = $placements['min_rigs_needed'] ?? 0;
        $deficit_area = $placements['deficit_area'] ?? 0;
        $priority_area = $placements['priority_area'] ?? 0;
        $priority_zones = $placements['priority_zones'] ?? 0;
        $rig_coverage = $placements['rig_coverage'] ?? 400;
        $ambient_deficit = $placements['ambient_deficit'] ?? 0;
        $strategy = $placements['strategy'] ?? 'not_required';
        $reason = $placements['reason'] ?? '';
        
        // No rigs needed
        if ( $strategy === 'not_required' ) {
            if ( $reason ) {
                return $reason . ' Supplemental lighting not required.';
            }
            return 'Ambient light levels are adequate. Supplemental lighting not required.';
        }
        
        // Severe deficit - critical need
        if ( $strategy === 'severe_deficit' ) {
            $rec = sprintf(
                '⚠️ CRITICAL: %d rig%s required to address severe light deficit. ',
                $rigs,
                $rigs > 1 ? 's' : ''
            );
            $rec .= sprintf(
                'Ambient DLI is %.1f mol/m²/day below target — turf health at significant risk. ',
                $ambient_deficit
            );
            
            // Use actual ghost rig count instead of calculated min_needed
            $additional_recommended = $placements['recommended_additional'] ?? ( $min_needed - $rigs );
            $priority_coverage = $placements['priority_coverage'] ?? 0;
            if ( $priority_coverage < 80 && $additional_recommended > 0 ) {
                $rec .= sprintf(
                    'Consider %d additional rigs for better coverage. ',
                    $additional_recommended
                );
            }
            
            if ( $health['improvement']['health_delta'] > 0 ) {
                $rec .= sprintf(
                    'Projected %.0f%% turf health improvement in treated areas.',
                    $health['improvement']['health_delta']
                );
            }
            
            return $rec;
        }
        
        // Moderate deficit
        if ( $strategy === 'moderate_deficit' ) {
            $rec = sprintf(
                '%d rig%s recommended to address moderate light deficit (%.1f mol/m²/day below target). ',
                $rigs,
                $rigs > 1 ? 's' : '',
                $ambient_deficit
            );
            
            if ( $health['improvement']['health_delta'] > 0 ) {
                $rec .= sprintf(
                    'Projected %.0f%% turf health improvement in treated areas.',
                    $health['improvement']['health_delta']
                );
            }
            
            return $rec;
        }
        
        // Shade pockets only
        if ( $strategy === 'shade_pockets' ) {
            $rec = sprintf(
                '%d rig%s recommended to address localised shade zones. ',
                $rigs,
                $rigs > 1 ? 's' : ''
            );
            $rec .= 'Ambient light is generally adequate but persistent shadows create deficit pockets.';
            
            return $rec;
        }
        
        // Fallback
        return sprintf(
            '%d mobile light rig%s recommended, providing %s coverage of deficit areas.',
            $rigs,
            $rigs > 1 ? 's' : '',
            $coverage['coverage_percent'] . '%'
        );
    }
    
    // =========================================================================
    // SEASONAL ANALYSIS METHODS
    // =========================================================================
    
    /**
     * Calculate seasonal rig requirements
     * 
     * Provides comprehensive seasonal analysis including monthly breakdown,
     * rotation schedules, and deployment summary.
     * 
     * @param string $venue_id Stadium identifier
     * @param array  $options {
     *     @type string $variety           Turf variety
     *     @type string $rig_type          Rig size
     *     @type int    $rotation_days     Days per rig position (default: 5)
     *     @type array  $months            Months to analyse (default: auto-detect critical months)
     * }
     * @return array Complete seasonal analysis
     */
    public function calculate_seasonal_requirements( string $venue_id, array $options = [] ): array {
        $options = self::parse_args( $options, [
            'variety'       => null,   // Will resolve per-month from stadium DB
            'rig_type'      => 'standard',
            'rotation_days' => 5,
            'months'        => null,  // Auto-detect
            'currency'      => 'GBP',
            'elec_rate'     => 0.35,
        ]);
        
        // Get stadium data
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return [ 'error' => 'Stadium not found' ];
        }
        
        $lat = $stadium['location']['lat'] ?? -33;
        $is_northern = $lat >= 0;
        
        // Resolve variety from stadium database if not provided
        $turf = $stadium['turf'] ?? [];
        $base_variety = $options['variety'] ?? $turf['variety'] ?? 'tiftuf';
        $overseed_variety = $turf['overseed_variety'] ?? 'perennial_rye';
        $overseed_months = ( $turf['oversown'] ?? false ) ? ( $turf['overseed_months'] ?? [] ) : [];
        
        // For seasonal analysis, variety changes per month based on overseed schedule
        // We'll determine effective_variety per month below
        $effective_variety = $base_variety;
        
        // Get base variety DLI requirements (may be overridden per month)
        $target_dli = 18;  // Default for PRG
        
        // Handle 'auto' variety - default to PRG for cool/temperate climates, TifTuf for warm
        // Threshold at 32° latitude (Sydney at 34° should get cool-season default)
        if ( $effective_variety === 'auto' ) {
            $effective_variety = ( $lat >= 32 || $lat <= -32 ) ? 'perennial_rye' : 'tiftuf';
        }
        
        if ( $this->variety_database ) {
            $variety_data = $this->variety_database->get_variety( $effective_variety );
            $target_dli = $variety_data['minimum_dli'] ?? 18;
        }
        
        // Determine which months to analyse
        $months_to_analyse = $options['months'];
        if ( ! $months_to_analyse ) {
            $months_to_analyse = $this->get_critical_months( $lat );
        }
        
        // Analyse each month
        $monthly_analysis = [];
        foreach ( $months_to_analyse as $month ) {
            $monthly_analysis[ $month ] = $this->analyse_month( 
                $venue_id, 
                $stadium, 
                $month, 
                $target_dli,
                $options['rig_type'],
                $options['rotation_days']
            );
        }
        
        // Generate rotation schedule
        $rotation_schedule = $this->generate_rotation_schedule(
            $monthly_analysis,
            $options['rotation_days'],
            self::RIG_SPECS[ $options['rig_type'] ] ?? self::RIG_SPECS['standard']
        );
        
        // Generate seasonal summary with cost data
        $seasonal_summary = $this->generate_seasonal_summary(
            $monthly_analysis,
            $rotation_schedule,
            $options
        );
        
        // Calculate energy costs
        $rig_spec = self::RIG_SPECS[ $options['rig_type'] ] ?? self::RIG_SPECS['standard'];
        $cost_analysis = $this->calculate_seasonal_costs(
            $monthly_analysis,
            $rig_spec,
            $options['elec_rate'],
            $options['currency']
        );
        
        return [
            'venue_id'          => $venue_id,
            'venue_name'        => $stadium['name'],
            'variety'           => $options['variety'],
            'target_dli'        => $target_dli,
            'rig_type'          => $options['rig_type'],
            'rig_spec'          => $rig_spec,
            'rotation_days'     => $options['rotation_days'],
            'hemisphere'        => $is_northern ? 'northern' : 'southern',
            'monthly_analysis'  => $monthly_analysis,
            'rotation_schedule' => $rotation_schedule,
            'seasonal_summary'  => $seasonal_summary,
            'cost_analysis'     => $cost_analysis,
            'currency'          => $options['currency'],
            'elec_rate'         => $options['elec_rate'],
        ];
    }
    
    /**
     * Get critical months requiring supplemental light
     * 
     * @param float $lat Latitude
     * @return array Month numbers
     */
    private function get_critical_months( float $lat ): array {
        $is_northern = $lat >= 0;
        $abs_lat = abs( $lat );
        
        if ( $abs_lat > 50 ) {
            // High latitude - extended critical period
            return $is_northern 
                ? [ 10, 11, 12, 1, 2, 3 ]   // Oct-Mar
                : [ 4, 5, 6, 7, 8, 9 ];      // Apr-Sep
        }
        
        if ( $abs_lat > 35 ) {
            // Mid-latitude - standard winter period
            return $is_northern 
                ? [ 11, 12, 1, 2 ]           // Nov-Feb
                : [ 5, 6, 7, 8 ];            // May-Aug
        }
        
        if ( $abs_lat > 23.5 ) {
            // Subtropical - shorter critical period
            return $is_northern 
                ? [ 12, 1, 2 ]               // Dec-Feb
                : [ 6, 7, 8 ];               // Jun-Aug
        }
        
        // Tropical - usually no critical period, but check
        return $is_northern ? [ 12, 1 ] : [ 6, 7 ];
    }
    
    /**
     * Analyse a single month's requirements
     * 
     * @param string $venue_id
     * @param array  $stadium
     * @param int    $month
     * @param float  $target_dli
     * @param string $rig_type
     * @param int    $rotation_days
     * @return array Month analysis
     */
    private function analyse_month( 
        string $venue_id, 
        array $stadium, 
        int $month, 
        float $target_dli,
        string $rig_type,
        int $rotation_days 
    ): array {
        
        // Use mid-month as representative date
        $year = ( $month >= date( 'n' ) ) ? date( 'Y' ) : date( 'Y' ) + 1;
        $representative_date = sprintf( '%d-%02d-15', $year, $month );
        
        // Get ambient DLI for this month
        $lat = $stadium['location']['lat'] ?? -33;
        $ambient_dli = $this->get_monthly_ambient_dli( $lat, $month );
        
        // Analyse shade patterns
        $shade_analysis = $this->analyse_field_shade_patterns(
            $venue_id,
            $stadium,
            $representative_date,
            7  // Analyse one week as representative
        );
        $shade_analysis['latitude'] = $lat;
        
        // Calculate deficit zones
        $deficit_zones = $this->identify_deficit_zones(
            $shade_analysis,
            $target_dli,
            2.0  // Lower threshold for monthly planning
        );
        
        // Override ambient DLI with month-specific value
        $deficit_zones['ambient_dli'] = $ambient_dli;
        
        // Recalculate deficits with correct ambient DLI
        $deficit_zones = $this->recalculate_deficits_with_ambient(
            $shade_analysis,
            $target_dli,
            $ambient_dli
        );
        
        // Calculate rig placements
        $rig_spec = self::RIG_SPECS[ $rig_type ] ?? self::RIG_SPECS['standard'];
        $placement_result = $this->calculate_optimal_placements(
            $deficit_zones,
            $rig_spec,
            $stadium
        );
        
        // Calculate coverage using full placement result
        $coverage = $this->analyse_coverage(
            $placement_result,  // Pass full result, not just rigs
            $deficit_zones,
            $rig_spec,
            $target_dli
        );
        
        // Extract actual rig placements for other uses
        $placements = $placement_result['rigs'] ?? [];
        
        // Calculate rotation positions needed
        $total_deficit_area = $deficit_zones['total_deficit_area'] ?? 0;
        $rig_coverage = $rig_spec['coverage_m2'];
        $positions_needed = ceil( $total_deficit_area / $rig_coverage );
        
        // Days in month
        $days_in_month = self::days_in_month( $month, $year );
        $rotations_per_month = ceil( $days_in_month / $rotation_days );
        
        // Determine severity
        $dli_gap = $target_dli - $ambient_dli;
        $severity = $this->classify_monthly_severity( $dli_gap, $target_dli, $ambient_dli );
        
        return [
            'month'              => $month,
            'month_name'         => date( 'F', strtotime( $representative_date ) ),
            'ambient_dli'        => round( $ambient_dli, 1 ),
            'target_dli'         => $target_dli,
            'dli_gap'            => round( max( 0, $dli_gap ), 1 ),
            'severity'           => $severity,
            'deficit_area_m2'    => $total_deficit_area,
            'rigs_required'      => count( $placements ),
            'positions_total'    => $positions_needed,
            'rotations_in_month' => $rotations_per_month,
            'placements'         => $placements,
            'coverage'           => $coverage,
            'rig_hours_per_day'  => $this->calculate_required_hours( $dli_gap, $rig_spec ),
            'recommendation'     => $this->generate_month_recommendation( $severity, count( $placements ), $dli_gap ),
        ];
    }
    
    /**
     * Recalculate deficit zones with specific ambient DLI
     */
    private function recalculate_deficits_with_ambient( 
        array $shade_analysis, 
        float $target_dli, 
        float $ambient_dli 
    ): array {
        $deficit_zones = [];
        $total_deficit_area = 0;
        $max_deficit = 0;
        $threshold = 2.0;
        
        foreach ( $shade_analysis['grid'] as $point ) {
            $actual_dli = $ambient_dli * $point['shade_factor'];
            $deficit = $target_dli - $actual_dli;
            
            if ( $deficit >= $threshold ) {
                $severity = $this->classify_deficit( $deficit, $target_dli );
                
                $deficit_zones[] = [
                    'x'          => $point['x'],
                    'y'          => $point['y'],
                    'actual_dli' => round( $actual_dli, 1 ),
                    'deficit'    => round( $deficit, 1 ),
                    'severity'   => $severity,
                ];
                
                $cell_area = pow( self::GRID_RESOLUTION, 2 );
                $total_deficit_area += $cell_area;
                $max_deficit = max( $max_deficit, $deficit );
            }
        }
        
        return [
            'deficit_points'     => $deficit_zones,
            'zones'              => $deficit_zones,  // Keep for backward compatibility
            'total_deficit_area' => $total_deficit_area,
            'max_deficit'        => round( $max_deficit, 1 ),
            'ambient_dli'        => $ambient_dli,
            'target_dli'         => $target_dli,
            'point_count'        => count( $deficit_zones ),
            'field_dims'         => $shade_analysis['field_dims'] ?? [ 'length' => 100, 'width' => 68 ],
            'threshold'          => $threshold,
        ];
    }
    
    /**
     * Get ambient DLI for a specific month and latitude
     */
    private function get_monthly_ambient_dli( float $lat, int $month ): float {
        $is_northern = $lat >= 0;
        $abs_lat = abs( $lat );
        
        // Define seasonal patterns by latitude band
        if ( $is_northern ) {
            if ( $abs_lat > 50 ) {
                // High latitude Northern (UK, N. Europe)
                $pattern = [ 1 => 4, 2 => 7, 3 => 14, 4 => 22, 5 => 30, 6 => 35, 
                             7 => 32, 8 => 26, 9 => 18, 10 => 10, 11 => 5, 12 => 3 ];
            } elseif ( $abs_lat > 35 ) {
                // Mid-latitude Northern
                $pattern = [ 1 => 12, 2 => 16, 3 => 24, 4 => 32, 5 => 40, 6 => 45,
                             7 => 44, 8 => 38, 9 => 28, 10 => 20, 11 => 14, 12 => 10 ];
            } else {
                // Subtropical Northern
                $pattern = [ 1 => 28, 2 => 32, 3 => 38, 4 => 42, 5 => 45, 6 => 45,
                             7 => 44, 8 => 42, 9 => 38, 10 => 32, 11 => 28, 12 => 26 ];
            }
        } else {
            if ( $abs_lat > 40 ) {
                // High latitude Southern
                $pattern = [ 1 => 38, 2 => 32, 3 => 24, 4 => 16, 5 => 10, 6 => 7,
                             7 => 8, 8 => 12, 9 => 20, 10 => 28, 11 => 35, 12 => 40 ];
            } elseif ( $abs_lat > 30 ) {
                // Mid-latitude Southern (Sydney, Melbourne)
                $pattern = [ 1 => 45, 2 => 40, 3 => 32, 4 => 24, 5 => 18, 6 => 15,
                             7 => 16, 8 => 20, 9 => 28, 10 => 35, 11 => 42, 12 => 48 ];
            } else {
                // Subtropical Southern
                $pattern = [ 1 => 42, 2 => 40, 3 => 36, 4 => 30, 5 => 25, 6 => 22,
                             7 => 24, 8 => 28, 9 => 34, 10 => 38, 11 => 40, 12 => 42 ];
            }
        }
        
        return $pattern[ $month ] ?? 25;
    }
    
    /**
     * Classify monthly severity
     */
    private function classify_monthly_severity( float $gap, float $target, float $ambient ): string {
        if ( $gap <= 0 ) return 'adequate';
        
        $ratio = $gap / $target;
        
        if ( $ratio > 0.7 ) return 'critical';      // >70% of target missing
        if ( $ratio > 0.5 ) return 'severe';        // >50% missing
        if ( $ratio > 0.3 ) return 'significant';   // >30% missing
        if ( $ratio > 0.15 ) return 'moderate';     // >15% missing
        return 'minor';
    }
    
    /**
     * Calculate required operating hours to bridge DLI gap
     */
    private function calculate_required_hours( float $dli_gap, array $rig_spec ): float {
        if ( $dli_gap <= 0 ) return 0;
        
        $mol_per_hour = $rig_spec['mol_per_hour'] ?? 1.44;
        $hours_needed = $dli_gap / $mol_per_hour;
        
        return min( $hours_needed, $rig_spec['max_daily_hours'] ?? 16 );
    }
    
    /**
     * Generate month-specific recommendation
     */
    private function generate_month_recommendation( string $severity, int $rigs, float $gap ): string {
        switch ( $severity ) {
            case 'critical':
                return "Critical light deficit. Deploy {$rigs} rigs for 14-16 hours daily around matches/training. Prioritise overnight operation (6pm-10am) to maximise hours without disrupting use.";
            case 'severe':
                return "Severe deficit requires {$rigs} rigs running 12-14 hours daily. Use split shifts around pitch access windows.";
            case 'significant':
                return "Significant supplementation needed. {$rigs} rigs at 10-12 hours daily recommended. Schedule overnight plus early morning.";
            case 'moderate':
                return "Moderate support required. {$rigs} rigs at 8-10 hours daily should maintain turf health.";
            case 'minor':
                return "Minor supplementation. Consider targeted deployment in worst-affected zones only.";
            default:
                return "Ambient light sufficient. Supplementation not required this month.";
        }
    }
    
    /**
     * Generate rotation schedule
     * 
     * @param array $monthly_analysis
     * @param int   $rotation_days
     * @param array $rig_spec
     * @return array
     */
    private function generate_rotation_schedule( 
        array $monthly_analysis, 
        int $rotation_days,
        array $rig_spec 
    ): array {
        
        $schedule = [];
        $all_zones = [];
        
        // Collect all deficit zones across months
        foreach ( $monthly_analysis as $month => $analysis ) {
            if ( empty( $analysis['placements'] ) ) continue;
            
            foreach ( $analysis['placements'] as $placement ) {
                $zone_key = sprintf( '%.0f,%.0f', $placement['x'], $placement['y'] );
                
                if ( ! isset( $all_zones[ $zone_key ] ) ) {
                    $all_zones[ $zone_key ] = [
                        'x'           => $placement['x'],
                        'y'           => $placement['y'],
                        'months'      => [],
                        'max_deficit' => 0,
                        'priority'    => 0,
                    ];
                }
                
                $all_zones[ $zone_key ]['months'][] = $month;
                $all_zones[ $zone_key ]['max_deficit'] = max(
                    $all_zones[ $zone_key ]['max_deficit'],
                    $placement['deficit_addressed'] ?? 0
                );
            }
        }
        
        // Sort zones by priority (more months = higher priority)
        uasort( $all_zones, function( $a, $b ) {
            $month_diff = count( $b['months'] ) - count( $a['months'] );
            if ( $month_diff !== 0 ) return $month_diff;
            return $b['max_deficit'] <=> $a['max_deficit'];
        });
        
        // Assign priority rankings
        $priority = 1;
        foreach ( $all_zones as $key => &$zone ) {
            $zone['priority'] = $priority++;
        }
        unset( $zone );
        
        // Generate weekly rotation schedule for each month
        foreach ( $monthly_analysis as $month => $analysis ) {
            $month_zones = array_filter( $all_zones, function( $z ) use ( $month ) {
                return in_array( $month, $z['months'] );
            });
            
            if ( empty( $month_zones ) ) {
                $schedule[ $month ] = [
                    'month'      => $month,
                    'month_name' => $analysis['month_name'],
                    'rotations'  => [],
                    'note'       => 'No supplementation required',
                ];
                continue;
            }
            
            $rigs_available = $analysis['rigs_required'];
            $zones_list = array_values( $month_zones );
            $rotations = [];
            
            // Calculate rotations for the month
            $days_in_month = self::days_in_month( $month, date( 'Y' ) );
            $num_rotations = ceil( $days_in_month / $rotation_days );
            
            for ( $r = 0; $r < $num_rotations; $r++ ) {
                $start_day = $r * $rotation_days + 1;
                $end_day = min( ( $r + 1 ) * $rotation_days, $days_in_month );
                
                // Assign rigs to zones in priority order, cycling through
                $rotation_placements = [];
                for ( $i = 0; $i < $rigs_available; $i++ ) {
                    $zone_index = ( $r * $rigs_available + $i ) % count( $zones_list );
                    $zone = $zones_list[ $zone_index ];
                    
                    $rotation_placements[] = [
                        'rig_number' => $i + 1,
                        'x'          => $zone['x'],
                        'y'          => $zone['y'],
                        'priority'   => $zone['priority'],
                    ];
                }
                
                $rotations[] = [
                    'rotation_number' => $r + 1,
                    'days'            => sprintf( 'Days %d-%d', $start_day, $end_day ),
                    'date_range'      => sprintf( '%s %d-%d', $analysis['month_name'], $start_day, $end_day ),
                    'placements'      => $rotation_placements,
                ];
            }
            
            $schedule[ $month ] = [
                'month'           => $month,
                'month_name'      => $analysis['month_name'],
                'rotations'       => $rotations,
                'total_rotations' => count( $rotations ),
                'zones_covered'   => count( $month_zones ),
            ];
        }
        
        return $schedule;
    }
    
    /**
     * Generate seasonal summary
     * 
     * @param array $monthly_analysis
     * @param array $rotation_schedule
     * @param array $options
     * @return array
     */
    private function generate_seasonal_summary( 
        array $monthly_analysis, 
        array $rotation_schedule,
        array $options 
    ): array {
        
        // Find peak requirements
        $peak_rigs = 0;
        $peak_month = null;
        $total_rig_days = 0;
        $critical_months = [];
        $months_needing_rigs = [];
        
        foreach ( $monthly_analysis as $month => $analysis ) {
            $rigs = $analysis['rigs_required'] ?? 0;
            
            if ( $rigs > 0 ) {
                $months_needing_rigs[] = $analysis['month_name'];
                $days_in_month = self::days_in_month( $month, date( 'Y' ) );
                $total_rig_days += $rigs * $days_in_month;
            }
            
            if ( $rigs > $peak_rigs ) {
                $peak_rigs = $rigs;
                $peak_month = $analysis['month_name'];
            }
            
            if ( in_array( $analysis['severity'], [ 'critical', 'severe' ] ) ) {
                $critical_months[] = $analysis['month_name'];
            }
        }
        
        // Calculate average requirements
        $avg_rigs = count( $months_needing_rigs ) > 0 
            ? round( $total_rig_days / array_sum( array_map( function( $m ) {
                return self::days_in_month( $m, date( 'Y' ) );
            }, array_keys( array_filter( $monthly_analysis, function( $a ) {
                return ( $a['rigs_required'] ?? 0 ) > 0;
            } ) ) ) ), 1 )
            : 0;
        
        // Generate deployment period string
        if ( ! empty( $months_needing_rigs ) ) {
            $first_month = reset( $months_needing_rigs );
            $last_month = end( $months_needing_rigs );
            $deployment_period = ( $first_month === $last_month ) 
                ? $first_month 
                : "{$first_month} - {$last_month}";
        } else {
            $deployment_period = 'None required';
        }
        
        // Build summary text
        $summary_text = $this->build_summary_text(
            $peak_rigs,
            $months_needing_rigs,
            $options['rotation_days'],
            $critical_months
        );
        
        return [
            'deployment_period'   => $deployment_period,
            'months_count'        => count( $months_needing_rigs ),
            'months_list'         => $months_needing_rigs,
            'critical_months'     => $critical_months,
            'peak_rigs_required'  => $peak_rigs,
            'peak_month'          => $peak_month,
            'average_rigs'        => $avg_rigs,
            'total_rig_days'      => $total_rig_days,
            'rotation_frequency'  => $options['rotation_days'] . ' days',
            'summary_text'        => $summary_text,
            'equipment_recommendation' => $this->generate_equipment_recommendation( $peak_rigs, $months_needing_rigs ),
        ];
    }
    
    /**
     * Build human-readable summary text
     */
    private function build_summary_text( int $peak_rigs, array $months, int $rotation_days, array $critical ): string {
        if ( empty( $months ) ) {
            return 'No supplemental lighting required during the analysis period.';
        }
        
        $first = reset( $months );
        $last = end( $months );
        $period = ( count( $months ) === 1 ) ? $first : "{$first}-{$last}";
        
        $text = "{$period}: {$peak_rigs} rigs continuous, rotating every {$rotation_days} days.";
        
        if ( ! empty( $critical ) ) {
            $critical_list = implode( ', ', $critical );
            $text .= " Critical attention needed in {$critical_list}.";
        }
        
        return $text;
    }
    
    /**
     * Generate equipment procurement recommendation
     */
    private function generate_equipment_recommendation( int $peak_rigs, array $months ): array {
        if ( $peak_rigs === 0 ) {
            return [
                'rigs_to_own'    => 0,
                'rigs_to_hire'   => 0,
                'recommendation' => 'No equipment required.',
            ];
        }
        
        $duration_months = count( $months );
        
        // If needed for 4+ months, ownership may be cost-effective
        if ( $duration_months >= 4 ) {
            return [
                'rigs_to_own'    => $peak_rigs,
                'rigs_to_hire'   => 0,
                'recommendation' => "Consider purchasing {$peak_rigs} rigs for {$duration_months}-month deployment. Long-term ownership likely more cost-effective than seasonal hire.",
            ];
        }
        
        // Shorter period - recommend hire
        if ( $duration_months <= 2 ) {
            return [
                'rigs_to_own'    => 0,
                'rigs_to_hire'   => $peak_rigs,
                'recommendation' => "Hire {$peak_rigs} rigs for {$duration_months}-month period. Short deployment favours rental over purchase.",
            ];
        }
        
        // Mid-duration - hybrid approach
        $own = ceil( $peak_rigs * 0.6 );
        $hire = $peak_rigs - $own;
        
        return [
            'rigs_to_own'    => $own,
            'rigs_to_hire'   => $hire,
            'recommendation' => "Consider owning {$own} rigs with {$hire} additional hired for peak months. Balances capital investment with flexibility.",
        ];
    }
    
    /**
     * Calculate seasonal energy costs
     * 
     * @param array  $monthly_analysis Monthly analysis data
     * @param array  $rig_spec         Rig specifications
     * @param float  $elec_rate        Electricity rate per kWh
     * @param string $currency         Currency code
     * @return array Cost breakdown
     */
    private function calculate_seasonal_costs( 
        array $monthly_analysis, 
        array $rig_spec, 
        float $elec_rate,
        string $currency 
    ): array {
        
        $currency_symbols = [
            'GBP' => '£',
            'AUD' => '$',
            'USD' => '$',
            'EUR' => '€',
            'JPY' => '¥',
        ];
        $symbol = $currency_symbols[ $currency ] ?? '£';
        
        // Rig power draw in kW
        $power_kw = $rig_spec['power_kw'] ?? 2.4;
        
        $total_kwh = 0;
        $total_cost = 0;
        $monthly_costs = [];
        
        foreach ( $monthly_analysis as $month => $data ) {
            $rigs = $data['rigs_required'] ?? 0;
            $hours_per_day = $data['rig_hours_per_day'] ?? 0;
            $days_in_month = self::days_in_month( $month, date( 'Y' ) );
            
            if ( $rigs > 0 && $hours_per_day > 0 ) {
                $month_kwh = $rigs * $hours_per_day * $days_in_month * $power_kw;
                $month_cost = $month_kwh * $elec_rate;
                
                $monthly_costs[ $month ] = [
                    'month_name'   => $data['month_name'],
                    'kwh'          => round( $month_kwh, 0 ),
                    'cost'         => round( $month_cost, 2 ),
                    'cost_formatted' => $symbol . number_format( $month_cost, 2 ),
                ];
                
                $total_kwh += $month_kwh;
                $total_cost += $month_cost;
            }
        }
        
        // Calculate average daily cost during deployment
        $deployment_days = 0;
        foreach ( $monthly_analysis as $month => $data ) {
            if ( ( $data['rigs_required'] ?? 0 ) > 0 ) {
                $deployment_days += self::days_in_month( $month, date( 'Y' ) );
            }
        }
        $avg_daily_cost = $deployment_days > 0 ? $total_cost / $deployment_days : 0;
        
        return [
            'currency'           => $currency,
            'symbol'             => $symbol,
            'elec_rate'          => $elec_rate,
            'power_kw'           => $power_kw,
            'total_kwh'          => round( $total_kwh, 0 ),
            'total_cost'         => round( $total_cost, 2 ),
            'total_formatted'    => $symbol . number_format( $total_cost, 0 ),
            'avg_daily_cost'     => round( $avg_daily_cost, 2 ),
            'avg_daily_formatted'=> $symbol . number_format( $avg_daily_cost, 2 ),
            'monthly_costs'      => $monthly_costs,
            'deployment_days'    => $deployment_days,
        ];
    }

    private static function parse_args( array $args, array $defaults ): array {
        return array_merge( $defaults, $args );
    }

    private static function days_in_month( $month, $year ): int {
        return (int) date( 't', strtotime( sprintf( '%04d-%02d-01', (int) $year, (int) $month ) ) );
    }
}
