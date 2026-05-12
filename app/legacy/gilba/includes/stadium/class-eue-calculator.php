<?php
/**
 * Environmental Utilisation Efficiency (EUE) Calculator
 * 
 * PHP-side implementation of the Liebig's Law limiting factor model.
 * Mirrors the JS environmental-utilisation-engine.js for server-side
 * LED prescription calculations.
 * 
 * Each environmental factor produces a utilisation coefficient (0.0–1.0).
 * Composite EUE = minimum of all factors (Liebig's Law).
 * Effective DLI = delivered DLI × EUE.
 * 
 * Scientific sources:
 *   - Liebig's Law of the Minimum (1840)
 *   - Principality Stadium field data (2017)
 *   - Sodick Growth Equation Framework (2026)
 *   - "Lawn Growth Under Artificial Light" technical compendium
 *   - Tifton Artificial Light Technical Document
 * 
 * @since 1.0.0
 */

class Gssh_EUE_Calculator {

    /* -----------------------------------------------------------------------
       PHYSIOLOGICAL THRESHOLDS
    ----------------------------------------------------------------------- */

    private static $ROOT_ZONE_TEMP = array(
        'c4' => array( 'dead' => 5, 'minimum' => 10, 'reduced' => 15, 'opt_low' => 22, 'opt_high' => 28, 'stress_high' => 35 ),
        'c3' => array( 'dead' => -2, 'minimum' => 4, 'reduced' => 7, 'opt_low' => 10, 'opt_high' => 20, 'stress_high' => 28 ),
    );

    private static $LEAF_TEMP = array(
        'c4' => array( 'dead' => 5, 'minimum' => 12, 'opt_low' => 20, 'opt_high' => 30, 'stress_high' => 38 ),
        'c3' => array( 'dead' => -2, 'minimum' => 5, 'opt_low' => 10, 'opt_high' => 20, 'stress_high' => 30 ),
    );

    private static $VPD = array(
        'too_low' => 0.3, 'opt_low' => 0.5, 'opt_high' => 1.2,
        'closure_onset' => 1.8, 'closure_severe' => 2.5, 'acute' => 3.5,
    );

    private static $AIRFLOW = array(
        'stagnant' => 0.1, 'minimum' => 0.3, 'opt_low' => 0.3, 'opt_high' => 1.0, 'excessive' => 3.0,
    );

    private static $CO2 = array(
        'depleted' => 250, 'sub_optimal' => 350, 'ambient' => 420,
        'enhanced' => 600, 'optimal' => 800, 'excessive' => 1200,
    );

    private static $C4_SPECIES = array(
        'couch', 'bermuda', 'kikuyu', 'zoysia', 'buffalo',
        'staugustine', 'paspalum', 'tifton', 'tifdwarf',
        'tifeagle', 'tifway', 'tifgrand', 'latitude36',
    );

    /* -----------------------------------------------------------------------
       DLI-BY-HOC MATRIX
       Source: "Lawn Growth Under Artificial Light" Section 14
    ----------------------------------------------------------------------- */

    private static $DLI_BY_HOC = array(
        'c4' => array(
            array( 'label' => 'Ultra-low (10–12mm)', 'hoc_min' => 10, 'hoc_max' => 12,
                   'maintenance' => array( 22, 26 ), 'strengthening' => array( 28, 32 ) ),
            array( 'label' => 'Match (13–17mm)', 'hoc_min' => 13, 'hoc_max' => 17,
                   'maintenance' => array( 18, 22 ), 'strengthening' => array( 22, 28 ) ),
            array( 'label' => 'Maintenance (18–20mm)', 'hoc_min' => 18, 'hoc_max' => 20,
                   'maintenance' => array( 16, 20 ), 'strengthening' => array( 20, 25 ) ),
            array( 'label' => 'Standard (21–30mm)', 'hoc_min' => 21, 'hoc_max' => 30,
                   'maintenance' => array( 14, 18 ), 'strengthening' => array( 18, 22 ) ),
            array( 'label' => 'High (31–50mm)', 'hoc_min' => 31, 'hoc_max' => 50,
                   'maintenance' => array( 12, 16 ), 'strengthening' => array( 16, 20 ) ),
        ),
        'c3' => array(
            array( 'label' => 'Low (15–19mm)', 'hoc_min' => 15, 'hoc_max' => 19,
                   'maintenance' => array( 14, 17 ), 'strengthening' => array( 20, 24 ) ),
            array( 'label' => 'Match (20–25mm)', 'hoc_min' => 20, 'hoc_max' => 25,
                   'maintenance' => array( 12, 13 ), 'strengthening' => array( 18, 20 ) ),
            array( 'label' => 'Maintenance (26–30mm)', 'hoc_min' => 26, 'hoc_max' => 30,
                   'maintenance' => array( 10, 12 ), 'strengthening' => array( 14, 16 ) ),
            array( 'label' => 'High (31–45mm)', 'hoc_min' => 31, 'hoc_max' => 45,
                   'maintenance' => array( 8, 10 ), 'strengthening' => array( 12, 14 ) ),
        ),
    );

    /* -----------------------------------------------------------------------
       PUBLIC — MAIN CALCULATION
    ----------------------------------------------------------------------- */

    /**
     * Calculate composite EUE from environmental parameters.
     *
     * @param array $params {
     *     @type string $species          Turf species key
     *     @type float  $soil_temp_c      Root-zone temperature (°C)
     *     @type float  $air_temp_c       Air/leaf temperature (°C)
     *     @type float  $humidity_pct     Relative humidity (%)
     *     @type float  $wind_speed_ms    Wind speed (m/s)
     *     @type float  $co2_ppm          CO₂ concentration (ppm), null if unknown
     *     @type string $venue_enclosure  Venue enclosure type
     *     @type float  $drainage_rating  Drainage quality 0–1
     *     @type float  $soil_moisture_pct Soil moisture %
     * }
     * @return array EUE result
     */
    public function calculate( array $params ) {
        $pathway = $this->get_pathway( $params['species'] ?? 'couch' );

        // Calculate VPD
        $vpd = null;
        if ( isset( $params['air_temp_c'], $params['humidity_pct'] ) ) {
            $vpd = $this->calculate_vpd( $params['air_temp_c'], $params['humidity_pct'] );
        }

        // Individual factors
        $factors = array(
            'root_zone_temp' => $this->root_zone_temp_efficiency( $params['soil_temp_c'] ?? null, $pathway ),
            'leaf_temp'      => $this->leaf_temp_efficiency( $params['air_temp_c'] ?? null, $pathway ),
            'vpd'            => $this->vpd_efficiency( $vpd ),
            'airflow'        => $this->airflow_efficiency( $params['wind_speed_ms'] ?? null ),
            'co2'            => $this->co2_efficiency(
                $params['co2_ppm'] ?? null,
                $params['venue_enclosure'] ?? 'open',
                $params['wind_speed_ms'] ?? null
            ),
            'rhizosphere'    => $this->rhizosphere_efficiency(
                $params['drainage_rating'] ?? null,
                $params['soil_moisture_pct'] ?? null
            ),
        );

        // Liebig's Law: composite = minimum
        $efficiencies = array_map( fn( $f ) => $f['efficiency'], $factors );
        $composite    = min( $efficiencies );

        // Limiting factors
        $limiting = array_filter( $factors, fn( $f ) => $f['limiting'] ?? false );
        uasort( $limiting, fn( $a, $b ) =>
            $this->severity_order( $a['severity'] ?? 'none' ) - $this->severity_order( $b['severity'] ?? 'none' )
        );

        return array(
            'composite_eue'         => round( $composite, 3 ),
            'factors'               => $factors,
            'limiting_factors'      => $limiting,
            'primary_limiting'      => ! empty( $limiting ) ? array_values( $limiting )[0] : null,
            'wasted_photon_pct'     => round( ( 1 - $composite ) * 100 ),
            'pathway'               => $pathway,
            'venue_readiness'       => $this->classify_readiness( $composite, $limiting ),
        );
    }

    /**
     * Get DLI requirement for species at specific mowing height.
     *
     * @param string $species
     * @param int    $hoc_mm
     * @param string $goal  maintenance|strengthening
     * @return array|null
     */
    public function get_dli_for_hoc( $species, $hoc_mm, $goal = 'maintenance' ) {
        $pathway = $this->get_pathway( $species );
        $bands   = self::$DLI_BY_HOC[ $pathway ] ?? array();

        foreach ( $bands as $band ) {
            if ( $hoc_mm >= $band['hoc_min'] && $hoc_mm <= $band['hoc_max'] ) {
                $range = $band[ $goal ] ?? $band['maintenance'];
                return array(
                    'min'      => $range[0],
                    'max'      => $range[1],
                    'midpoint' => ( $range[0] + $range[1] ) / 2,
                    'band'     => $band['label'],
                    'source'   => 'hoc_matched',
                );
            }
        }

        return null; // HOC outside defined bands
    }

    /**
     * Adjust LED prescription hours for EUE.
     *
     * @param float $deficit_mol  DLI deficit to fill
     * @param float $ppfd         Equipment PPFD at canopy
     * @param float $eue          Composite EUE coefficient
     * @param float $max_hours    Maximum daily operation hours
     * @return array
     */
    public function adjust_prescription( $deficit_mol, $ppfd, $eue, $max_hours = 16.0 ) {
        $mol_per_hour = $ppfd * 3600 / 1e6;

        // Theoretical hours
        $theoretical_hours = $deficit_mol / $mol_per_hour;
        $theoretical_hours = min( $theoretical_hours, $max_hours );

        // Effective hours (EUE-adjusted)
        $effective_mol = $theoretical_hours * $mol_per_hour * $eue;

        // How many hours would actually close the deficit?
        $required_hours = $max_hours;
        if ( $eue > 0.1 ) {
            $required_hours = min( $max_hours, $deficit_mol / ( $mol_per_hour * $eue ) );
        }

        return array(
            'theoretical_hours'   => round( $theoretical_hours, 1 ),
            'effective_hours'     => round( $required_hours, 1 ),
            'effective_mol'       => round( $effective_mol, 1 ),
            'eue_coefficient'     => round( $eue, 3 ),
            'wasted_pct'          => round( ( 1 - $eue ) * 100 ),
            'deficit_addressable' => $required_hours <= $max_hours,
        );
    }

    /* -----------------------------------------------------------------------
       INDIVIDUAL FACTOR FUNCTIONS
    ----------------------------------------------------------------------- */

    private function root_zone_temp_efficiency( $temp, $pathway ) {
        $t = self::$ROOT_ZONE_TEMP[ $pathway ] ?? self::$ROOT_ZONE_TEMP['c4'];
        if ( $temp === null ) {
            return array( 'efficiency' => 0.85, 'source' => 'no_data', 'confidence' => 0.3, 'limiting' => false, 'severity' => 'none' );
        }

        $eff = $this->trapezoidal_response( $temp, $t['dead'], $t['minimum'], $t['reduced'] ?? $t['opt_low'],
                                             $t['opt_low'], $t['opt_high'], $t['stress_high'] );

        return array(
            'efficiency'    => $eff,
            'value'         => $temp,
            'unit'          => '°C',
            'optimal_range' => $t['opt_low'] . '–' . $t['opt_high'] . '°C',
            'source'        => 'measured',
            'confidence'    => 0.9,
            'limiting'      => $eff < 0.6,
            'severity'      => $this->classify_severity( $eff ),
        );
    }

    private function leaf_temp_efficiency( $temp, $pathway ) {
        $t = self::$LEAF_TEMP[ $pathway ] ?? self::$LEAF_TEMP['c4'];
        if ( $temp === null ) {
            return array( 'efficiency' => 0.85, 'source' => 'no_data', 'confidence' => 0.3, 'limiting' => false, 'severity' => 'none' );
        }

        $eff = $this->trapezoidal_response( $temp, $t['dead'], $t['minimum'], $t['opt_low'],
                                             $t['opt_low'], $t['opt_high'], $t['stress_high'] );

        return array(
            'efficiency'    => $eff,
            'value'         => $temp,
            'unit'          => '°C',
            'optimal_range' => $t['opt_low'] . '–' . $t['opt_high'] . '°C',
            'source'        => 'measured',
            'confidence'    => 0.85,
            'limiting'      => $eff < 0.6,
            'severity'      => $this->classify_severity( $eff ),
        );
    }

    private function vpd_efficiency( $vpd ) {
        if ( $vpd === null ) {
            return array( 'efficiency' => 0.85, 'source' => 'no_data', 'confidence' => 0.3, 'limiting' => false, 'severity' => 'none' );
        }

        $t = self::$VPD;
        if ( $vpd < $t['too_low'] ) {
            $eff = 0.7 + 0.3 * ( $vpd / $t['too_low'] );
        } elseif ( $vpd < $t['opt_low'] ) {
            $eff = 0.85 + 0.15 * ( $vpd - $t['too_low'] ) / ( $t['opt_low'] - $t['too_low'] );
        } elseif ( $vpd <= $t['opt_high'] ) {
            $eff = 1.0;
        } elseif ( $vpd <= $t['closure_onset'] ) {
            $eff = 1.0 - 0.3 * ( $vpd - $t['opt_high'] ) / ( $t['closure_onset'] - $t['opt_high'] );
        } elseif ( $vpd <= $t['closure_severe'] ) {
            $eff = 0.7 - 0.4 * ( $vpd - $t['closure_onset'] ) / ( $t['closure_severe'] - $t['closure_onset'] );
        } else {
            $eff = max( 0.1, 0.3 - 0.2 * ( $vpd - $t['closure_severe'] ) / ( $t['acute'] - $t['closure_severe'] ) );
        }

        $eff = max( 0, min( 1, $eff ) );

        return array(
            'efficiency'    => $eff,
            'value'         => round( $vpd, 2 ),
            'unit'          => 'kPa',
            'optimal_range' => '0.5–1.2 kPa',
            'source'        => 'calculated',
            'confidence'    => 0.8,
            'limiting'      => $eff < 0.6,
            'severity'      => $this->classify_severity( $eff ),
        );
    }

    private function airflow_efficiency( $wind ) {
        if ( $wind === null ) {
            return array( 'efficiency' => 0.80, 'source' => 'no_data', 'confidence' => 0.3, 'limiting' => false, 'severity' => 'none' );
        }

        $t = self::$AIRFLOW;
        if ( $wind < $t['stagnant'] ) {
            $eff = 0.4 + 0.3 * ( $wind / $t['stagnant'] );
        } elseif ( $wind < $t['minimum'] ) {
            $eff = 0.7 + 0.3 * ( $wind - $t['stagnant'] ) / ( $t['minimum'] - $t['stagnant'] );
        } elseif ( $wind <= $t['opt_high'] ) {
            $eff = 1.0;
        } elseif ( $wind <= $t['excessive'] ) {
            $eff = 1.0 - 0.3 * ( $wind - $t['opt_high'] ) / ( $t['excessive'] - $t['opt_high'] );
        } else {
            $eff = 0.6;
        }

        return array(
            'efficiency'    => max( 0, min( 1, $eff ) ),
            'value'         => round( $wind, 1 ),
            'unit'          => 'm/s',
            'optimal_range' => '0.3–1.0 m/s',
            'source'        => 'measured',
            'confidence'    => 0.7,
            'limiting'      => $eff < 0.6,
            'severity'      => $this->classify_severity( $eff ),
        );
    }

    private function co2_efficiency( $co2_ppm, $enclosure, $wind ) {
        if ( $co2_ppm !== null && $co2_ppm > 0 ) {
            $t = self::$CO2;
            if ( $co2_ppm < $t['depleted'] ) {
                $eff = 0.3;
            } elseif ( $co2_ppm < $t['sub_optimal'] ) {
                $eff = 0.3 + 0.4 * ( $co2_ppm - $t['depleted'] ) / ( $t['sub_optimal'] - $t['depleted'] );
            } elseif ( $co2_ppm < $t['ambient'] ) {
                $eff = 0.7 + 0.3 * ( $co2_ppm - $t['sub_optimal'] ) / ( $t['ambient'] - $t['sub_optimal'] );
            } else {
                $eff = 1.0;
            }

            return array(
                'efficiency'    => max( 0, min( 1, $eff ) ),
                'value'         => $co2_ppm,
                'unit'          => 'ppm',
                'optimal_range' => '400–800 ppm',
                'source'        => 'measured',
                'confidence'    => 0.9,
                'limiting'      => $eff < 0.7,
                'severity'      => $this->classify_severity( $eff ),
            );
        }

        // Estimate from enclosure type
        $enc = strtolower( $enclosure ?? 'open' );
        $eff = 1.0;
        $est_ppm = 420;

        if ( $enc === 'retractable_closed' ) {
            $eff = 0.80;
            $est_ppm = 380;
            if ( $wind && $wind > 0.5 ) { $eff = min( 1.0, $eff + 0.1 ); $est_ppm = 400; }
        } elseif ( $enc === 'fixed_roof' || $enc === 'enclosed' ) {
            $eff = 0.65;
            $est_ppm = 340;
            if ( $wind && $wind > 0.5 ) { $eff = min( 0.85, $eff + 0.15 ); $est_ppm = 380; }
        } elseif ( $enc === 'enclosed_enriched' ) {
            $eff = 1.0;
            $est_ppm = 700;
        }

        return array(
            'efficiency'    => $eff,
            'value'         => $est_ppm,
            'unit'          => 'ppm (est.)',
            'optimal_range' => '400–800 ppm',
            'source'        => 'estimated_from_venue',
            'confidence'    => 0.4,
            'limiting'      => $eff < 0.7,
            'severity'      => $this->classify_severity( $eff ),
        );
    }

    private function rhizosphere_efficiency( $drainage, $moisture ) {
        if ( $drainage === null ) {
            return array( 'efficiency' => 0.85, 'source' => 'default', 'confidence' => 0.3, 'limiting' => false, 'severity' => 'none' );
        }

        $eff = $drainage;
        if ( $moisture !== null ) {
            if ( $moisture > 90 ) { $eff = min( $eff, 0.4 ); }
            elseif ( $moisture > 80 ) { $eff = min( $eff, 0.6 ); }
            elseif ( $moisture < 20 ) { $eff = min( $eff, 0.7 ); }
        }

        return array(
            'efficiency'    => max( 0, min( 1, $eff ) ),
            'value'         => $drainage,
            'unit'          => 'rating',
            'optimal_range' => 'Well-drained (>0.8)',
            'source'        => 'configured',
            'confidence'    => 0.6,
            'limiting'      => $eff < 0.6,
            'severity'      => $this->classify_severity( $eff ),
        );
    }

    /* -----------------------------------------------------------------------
       UTILITY
    ----------------------------------------------------------------------- */

    private function calculate_vpd( $temp_c, $rh_pct ) {
        $es = 0.6108 * exp( ( 17.27 * $temp_c ) / ( $temp_c + 237.3 ) );
        $ea = $es * ( $rh_pct / 100 );
        return max( 0, $es - $ea );
    }

    private function trapezoidal_response( $val, $dead, $min, $reduced, $opt_low, $opt_high, $stress_high ) {
        if ( $val <= $dead ) return 0.0;
        if ( $val <= $min )  return 0.1 * ( $val - $dead ) / ( $min - $dead );
        if ( $val <= $reduced ) return 0.1 + 0.5 * ( $val - $min ) / ( $reduced - $min );
        if ( $val <= $opt_low ) return 0.6 + 0.4 * ( $val - $reduced ) / ( $opt_low - $reduced );
        if ( $val <= $opt_high ) return 1.0;
        if ( $val <= $stress_high ) return 1.0 - 0.5 * ( $val - $opt_high ) / ( $stress_high - $opt_high );
        return max( 0.1, 0.5 - 0.3 * ( $val - $stress_high ) / 10 );
    }

    private function get_pathway( $species ) {
        $key = strtolower( $species ?? 'couch' );
        foreach ( self::$C4_SPECIES as $c4 ) {
            if ( strpos( $key, $c4 ) !== false ) return 'c4';
        }
        return 'c3';
    }

    private function classify_severity( $eff ) {
        if ( $eff < 0.3 ) return 'critical';
        if ( $eff < 0.6 ) return 'significant';
        if ( $eff < 0.85 ) return 'moderate';
        return 'none';
    }

    private function severity_order( $severity ) {
        $order = array( 'critical' => 0, 'significant' => 1, 'moderate' => 2, 'none' => 3 );
        return $order[ $severity ] ?? 3;
    }

    private function classify_readiness( $eue, $limiting ) {
        $critical   = count( array_filter( $limiting, fn( $f ) => ( $f['severity'] ?? '' ) === 'critical' ) );
        $significant = count( array_filter( $limiting, fn( $f ) => ( $f['severity'] ?? '' ) === 'significant' ) );

        if ( $critical > 0 ) {
            return array( 'status' => 'NOT_READY', 'label' => 'Environment not ready for LED deployment', 'score' => round( $eue * 100 ) );
        }
        if ( $significant > 0 || $eue < 0.6 ) {
            return array( 'status' => 'PARTIALLY_READY', 'label' => 'Environmental constraints limit LED effectiveness', 'score' => round( $eue * 100 ) );
        }
        if ( $eue < 0.85 ) {
            return array( 'status' => 'READY_WITH_NOTES', 'label' => 'Environment supports LED operation with minor constraints', 'score' => round( $eue * 100 ) );
        }
        return array( 'status' => 'READY', 'label' => 'Environment fully supports LED operation', 'score' => round( $eue * 100 ) );
    }
}
