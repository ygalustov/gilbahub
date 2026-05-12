<?php
/**
 * Supplemental Light Shortcodes
 * 
 * Provides shortcodes for embedding light analysis on front-end pages.
 * 
 * Usage:
 * [gssh_light_analysis venue="sample_stadium"]
 * [gssh_light_status venue="sample_stadium"]
 * [gssh_light_schedule venue="sample_stadium"]
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gssh_Stadium_Shortcodes {
    
    /**
     * Register shortcodes
     */
    public static function register() {
        add_shortcode( 'gssh_light_test', [ __CLASS__, 'render_test' ] );
        add_shortcode( 'gssh_light_minimal', [ __CLASS__, 'render_minimal' ] );
        add_shortcode( 'gssh_light_analysis', [ __CLASS__, 'render_analysis' ] );
        add_shortcode( 'gssh_light_status', [ __CLASS__, 'render_status' ] );
        add_shortcode( 'gssh_light_schedule', [ __CLASS__, 'render_schedule' ] );
        add_shortcode( 'gssh_light_zones', [ __CLASS__, 'render_zones' ] );
        
        // Shade visualisation shortcodes
        add_shortcode( 'gssh_shade', [ __CLASS__, 'render_shade_snapshot' ] );
        add_shortcode( 'gssh_shade_series', [ __CLASS__, 'render_shade_series' ] );
        add_shortcode( 'gssh_shade_seasonal', [ __CLASS__, 'render_shade_seasonal' ] );
        add_shortcode( 'gssh_shade_heatmap', [ __CLASS__, 'render_shade_heatmap' ] );
        
        // Unified interactive shade analysis
        add_shortcode( 'gssh_shade_analysis', [ __CLASS__, 'render_shade_analysis' ] );
        
        // Rig placement calculator
        add_shortcode( 'gssh_rig_calculator', [ __CLASS__, 'render_rig_calculator' ] );
        
        // Seasonal planning
        add_shortcode( 'gssh_seasonal_planner', [ __CLASS__, 'render_seasonal_planner' ] );
        
        // Validation/testing
        add_shortcode( 'gssh_venue_check', [ __CLASS__, 'render_venue_check' ] );
    }
    
    /**
     * Simple test shortcode
     * [gssh_light_test]
     */
    public static function render_test( $atts ) {
        return '<div style="background:#90EE90;padding:20px;border:2px solid green;margin:20px 0;"><strong>✅ Gilba Supplemental Light v' . GILBA_LIGHT_VERSION . ' is working!</strong><br>Shortcodes are registered correctly.</div>';
    }
    
    /**
     * Minimal analysis - just raw data, no fancy display
     * [gssh_light_minimal venue="sample_stadium" test="1"]
     */
    public static function render_minimal( $atts ) {
        $atts = shortcode_atts( array(
            'venue' => '',
            'test'  => '5',
        ), $atts );
        
        $test = intval( $atts['test'] );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p style="color:red;">Please specify venue</p>';
        }
        
        // TEST 1: Just get plugin
        $plugin = Gssh_Stadium_Loader::get_instance();
        if ( ! $plugin ) {
            return '<p style="color:red;">Plugin not init</p>';
        }
        if ( $test === 1 ) {
            return '<p style="color:green;">✓ Test 1 passed: Plugin OK</p>';
        }
        
        // TEST 2: Get venue config
        $venue_config = $plugin->get_venue_config( $atts['venue'] );
        if ( ! $venue_config ) {
            return '<p style="color:red;">Venue not found</p>';
        }
        if ( $test === 2 ) {
            return '<p style="color:green;">✓ Test 2 passed: Venue found</p>';
        }
        
        // TEST 3: Get module
        $module = $plugin->get_module();
        if ( ! $module ) {
            return '<p style="color:red;">Module not init</p>';
        }
        if ( $test === 3 ) {
            return '<p style="color:green;">✓ Test 3 passed: Module OK</p>';
        }
        
        // TEST 4: DLI estimator
        if ( $test === 4 ) {
            $climate = new Gssh_Mock_Climate_Module();
            $estimator = new Gssh_Ambient_DLI_Estimator( $climate );
            $location = isset( $venue_config['location'] ) ? $venue_config['location'] : array();
            $dli = $estimator->get_daily_dli( date('Y-m-d'), $location );
            $dli_val = isset( $dli['dli'] ) ? $dli['dli'] : 'null';
            return '<p style="color:green;">✓ Test 4 passed: DLI = ' . esc_html( $dli_val ) . '</p>';
        }
        
        // TEST 5: Check if stress class exists
        if ( $test === 5 ) {
            if ( ! class_exists( 'Gssh_Mock_Stress_Trajectory' ) ) {
                return '<p style="color:red;">Class Gssh_Mock_Stress_Trajectory does not exist</p>';
            }
            return '<p style="color:green;">✓ Test 5 passed: Stress class exists</p>';
        }
        
        // TEST 6: Actually instantiate stress class
        if ( $test === 6 ) {
            $stress = new Gssh_Mock_Stress_Trajectory();
            return '<p style="color:green;">✓ Test 6 passed: Stress class instantiated</p>';
        }
        
        // TEST 7: Call stress method
        if ( $test === 7 ) {
            $stress = new Gssh_Mock_Stress_Trajectory();
            $params = array( 'variety' => 'tiftuf', 'shade_factor' => 0.5 );
            $result = $stress->calculate_trajectory( $params, 14 );
            $days_count = isset( $result['days'] ) ? count( $result['days'] ) : 0;
            return '<p style="color:green;">✓ Test 7 passed: Trajectory calculated, days=' . $days_count . '</p>';
        }
        
        // TEST 8: Check disease class exists
        if ( $test === 8 ) {
            if ( ! class_exists( 'Gssh_Mock_Disease_Engine' ) ) {
                return '<p style="color:red;">Class Gssh_Mock_Disease_Engine does not exist</p>';
            }
            return '<p style="color:green;">✓ Test 8 passed: Disease class exists</p>';
        }
        
        // TEST 9: Instantiate disease class
        if ( $test === 9 ) {
            $disease = new Gssh_Mock_Disease_Engine();
            return '<p style="color:green;">✓ Test 9 passed: Disease class instantiated</p>';
        }
        
        // TEST 10: analyse_venue step 1 (ambient DLI)
        if ( $test === 10 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 1 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 1 failed</p>';
            }
            $dli = isset( $analysis['ambient_dli']['dli'] ) ? $analysis['ambient_dli']['dli'] : 'N/A';
            return '<p style="color:green;">✓ Test 10 passed: Step 1 OK, DLI=' . esc_html( $dli ) . '</p>';
        }
        
        // TEST 11: analyse_venue step 2 (stress forecast)
        if ( $test === 11 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 2 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 2 failed</p>';
            }
            return '<p style="color:green;">✓ Test 11 passed: Step 2 OK (stress forecast)</p>';
        }
        
        // TEST 12: analyse_venue step 3 (disease risk)
        if ( $test === 12 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 3 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 3 failed</p>';
            }
            return '<p style="color:green;">✓ Test 12 passed: Step 3 OK (disease risk)</p>';
        }
        
        // TEST 13: analyse_venue step 4 (recovery status)
        if ( $test === 13 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 4 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 4 failed</p>';
            }
            return '<p style="color:green;">✓ Test 13 passed: Step 4 OK (recovery status)</p>';
        }
        
        // TEST 14: analyse_venue step 5 (enrich zones)
        if ( $test === 14 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 5 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 5 failed</p>';
            }
            $count = isset( $analysis['enriched_zones'] ) ? count( $analysis['enriched_zones'] ) : 0;
            return '<p style="color:green;">✓ Test 14 passed: Step 5 OK (' . $count . ' zones enriched)</p>';
        }
        
        // TEST 15: analyse_venue step 6 (calculate deficits)
        if ( $test === 15 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 6 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 6 failed</p>';
            }
            return '<p style="color:green;">✓ Test 15 passed: Step 6 OK (deficits calculated)</p>';
        }
        
        // TEST 16: analyse_venue step 7 (prescriptions)
        if ( $test === 16 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 7 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 7 failed</p>';
            }
            return '<p style="color:green;">✓ Test 16 passed: Step 7 OK (prescriptions)</p>';
        }
        
        // TEST 17: analyse_venue step 8 (schedule)
        if ( $test === 17 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 8 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Step 8 failed</p>';
            }
            return '<p style="color:green;">✓ Test 17 passed: Step 8 OK (schedule)</p>';
        }
        
        // TEST 18: Full analysis (no stop)
        if ( $test === 18 ) {
            $analysis = $module->analyse_venue( $atts['venue'], $venue_config, date('Y-m-d'), 0 );
            if ( ! $analysis ) {
                return '<p style="color:red;">Full analysis failed</p>';
            }
            return '<p style="color:green;">✓ Test 18 passed: Full analysis complete!</p>';
        }
        
        return '<p>Unknown test: ' . $test . '</p>';
    }
    
    /**
     * Full analysis display
     * 
     * [gssh_light_analysis venue="sample_stadium"]
     */
    public static function render_analysis( $atts ) {
        $atts = shortcode_atts( [
            'venue' => '',
            'date'  => '',
            'debug' => 'false',
        ], $atts );
        
        $debug = ( $atts['debug'] === 'true' );
        
        // Check URL params first (from venue selector), then shortcode attributes
        $selected_venue = '';
        if ( isset( $_GET['gssh_venue'] ) && ! empty( $_GET['gssh_venue'] ) ) {
            $selected_venue = sanitize_text_field( $_GET['gssh_venue'] );
        } elseif ( ! empty( $atts['venue'] ) ) {
            $selected_venue = $atts['venue'];
        }
        
        $selected_date = date( 'Y-m-d' );
        if ( isset( $_GET['gssh_date'] ) && ! empty( $_GET['gssh_date'] ) ) {
            $selected_date = sanitize_text_field( $_GET['gssh_date'] );
        } elseif ( ! empty( $atts['date'] ) ) {
            $selected_date = $atts['date'];
        }
        
        // Enqueue styles
        wp_enqueue_style( 'gssh-light-frontend', GILBA_LIGHT_URL . 'assets/css/frontend.css', [], GILBA_LIGHT_VERSION );
        wp_enqueue_style( 'gssh-light-admin', GILBA_LIGHT_URL . 'assets/css/admin.css', [], GILBA_LIGHT_VERSION );
        
        // Generate unique ID for this instance
        $instance_id = 'gssh-light-' . wp_rand( 1000, 9999 );
        
        ob_start();
        ?>
        <div class="gssh-light-wrap gssh-light-shortcode gssh-light-analysis" id="<?php echo esc_attr( $instance_id ); ?>">
            
            <div class="gssh-light-controls" style="background:#1a1a2e;padding:20px;border-radius:8px;margin-bottom:20px;">
                <div style="display:flex;flex-wrap:wrap;gap:15px;align-items:end;">
                    
                    <div class="gssh-control-group" style="flex:1;min-width:200px;">
                        <label style="display:block;color:#94a3b8;font-size:12px;margin-bottom:5px;">Region</label>
                        <?php 
                        // Detect hemisphere from selected venue
                        $default_hemisphere = 'all';
                        if ( ! empty( $selected_venue ) ) {
                            $venue_data = Gssh_Stadium_Database::get_stadium( $selected_venue );
                            if ( $venue_data && isset( $venue_data['location']['lat'] ) ) {
                                $default_hemisphere = $venue_data['location']['lat'] < 0 ? 'southern' : 'northern';
                            }
                        }
                        ?>
                        <select id="<?php echo esc_attr( $instance_id ); ?>-hemisphere" class="gssh-hemisphere-select" 
                                style="width:100%;padding:10px;background:#27272a;border:1px solid #3f3f46;color:#fff;border-radius:4px;">
                            <option value="all" <?php selected( $default_hemisphere, 'all' ); ?>>All Regions</option>
                            <option value="southern" <?php selected( $default_hemisphere, 'southern' ); ?>>Southern Hemisphere</option>
                            <option value="northern" <?php selected( $default_hemisphere, 'northern' ); ?>>Northern Hemisphere</option>
                        </select>
                    </div>
                    
                    <div class="gssh-control-group" style="flex:2;min-width:250px;">
                        <label style="display:block;color:#94a3b8;font-size:12px;margin-bottom:5px;">Venue</label>
                        <select id="<?php echo esc_attr( $instance_id ); ?>-venue" class="gssh-venue-select"
                                style="width:100%;padding:10px;background:#27272a;border:1px solid #3f3f46;color:#fff;border-radius:4px;">
                            <option value="">-- Select Venue --</option>
                            <?php 
                            $grouped = Gssh_Stadium_Database::get_grouped_stadium_list();
                            foreach ( $grouped as $hemisphere => $countries ) :
                                $hem_label = ucfirst( $hemisphere ) . ' Hemisphere';
                            ?>
                                <optgroup label="<?php echo esc_attr( $hem_label ); ?>" data-hemisphere="<?php echo esc_attr( $hemisphere ); ?>">
                                <?php foreach ( $countries as $country => $states ) : ?>
                                    <?php foreach ( $states as $state => $state_venues ) : ?>
                                        <?php foreach ( $state_venues as $id => $name ) : ?>
                                            <option value="<?php echo esc_attr( $id ); ?>" 
                                                    data-hemisphere="<?php echo esc_attr( $hemisphere ); ?>"
                                                    data-country="<?php echo esc_attr( $country ); ?>"
                                                    <?php selected( $selected_venue, $id ); ?>>
                                                <?php echo esc_html( $name ); ?> (<?php echo esc_html( $state ); ?>)
                                            </option>
                                        <?php endforeach; ?>
                                    <?php endforeach; ?>
                                <?php endforeach; ?>
                                </optgroup>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    
                    <div class="gssh-control-group" style="min-width:150px;">
                        <label style="display:block;color:#94a3b8;font-size:12px;margin-bottom:5px;">Date</label>
                        <input type="date" id="<?php echo esc_attr( $instance_id ); ?>-date" 
                               value="<?php echo esc_attr( $selected_date ); ?>"
                               style="width:100%;padding:10px;background:#27272a;border:1px solid #3f3f46;color:#fff;border-radius:4px;">
                    </div>
                    
                    <div class="gssh-control-group">
                        <button type="button" id="<?php echo esc_attr( $instance_id ); ?>-analyse" 
                                style="padding:10px 25px;background:#22c55e;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">
                            Analyse
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="<?php echo esc_attr( $instance_id ); ?>-output" class="gssh-light-output">
                <?php if ( ! empty( $selected_venue ) ) : ?>
                    <?php echo self::render_venue_analysis( $selected_venue, $selected_date, $debug ); ?>
                <?php else : ?>
                    <div style="text-align:center;padding:60px 20px;background:#1a1a2e;border-radius:8px;color:#94a3b8;">
                        <p style="font-size:18px;margin:0;">Select a venue to view lighting analysis</p>
                        <p style="font-size:14px;margin-top:10px;opacity:0.7;">Choose from 77 international stadiums</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        
        <script>
        (function() {
            const instanceId = '<?php echo esc_js( $instance_id ); ?>';
            const container = document.getElementById(instanceId);
            if (!container) return;
            
            const hemisphereSelect = container.querySelector('.gssh-hemisphere-select');
            const venueSelect = container.querySelector('.gssh-venue-select');
            const dateInput = container.querySelector('input[type="date"]');
            const analyseBtn = document.getElementById(instanceId + '-analyse');
            const output = document.getElementById(instanceId + '-output');
            
            // Filter venues by hemisphere
            hemisphereSelect.addEventListener('change', function() {
                const hemisphere = this.value;
                const options = venueSelect.querySelectorAll('option[data-hemisphere]');
                const optgroups = venueSelect.querySelectorAll('optgroup');
                
                optgroups.forEach(group => {
                    const groupHem = group.dataset.hemisphere;
                    group.style.display = (hemisphere === 'all' || groupHem === hemisphere) ? '' : 'none';
                });
                
                options.forEach(opt => {
                    const optHem = opt.dataset.hemisphere;
                    opt.style.display = (hemisphere === 'all' || optHem === hemisphere) ? '' : 'none';
                });
                
                // Reset selection if current venue is hidden
                const currentOpt = venueSelect.querySelector('option:checked');
                if (currentOpt && currentOpt.style.display === 'none') {
                    venueSelect.value = '';
                }
            });
            
            // Analyse button
            analyseBtn.addEventListener('click', function() {
                const venue = venueSelect.value;
                const date = dateInput.value;
                
                if (!venue) {
                    alert('Please select a venue');
                    return;
                }
                
                output.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;"><p>Loading analysis...</p></div>';
                
                // Reload page with venue parameter (simple approach)
                const url = new URL(window.location.href);
                url.searchParams.set('gssh_venue', venue);
                url.searchParams.set('gssh_date', date);
                window.location.href = url.toString();
            });
            
            // Check URL params on load
            const urlParams = new URLSearchParams(window.location.search);
            const urlVenue = urlParams.get('gssh_venue');
            const urlDate = urlParams.get('gssh_date');
            if (urlVenue) venueSelect.value = urlVenue;
            if (urlDate) dateInput.value = urlDate;
        })();
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Render venue analysis (helper for render_analysis)
     */
    private static function render_venue_analysis( $venue_id, $date, $debug = false ) {
        $stadium = Gssh_Stadium_Database::get_stadium( $venue_id );
        if ( ! $stadium ) {
            return '<div style="color:#f87171;padding:20px;background:#1a1a2e;border-radius:8px;">Venue not found: ' . esc_html( $venue_id ) . '</div>';
        }
        
        // Use shade visualiser for the main display
        $visualiser = new Gssh_Shade_Visualiser();
        
        // Get location from stadium
        $location = Gssh_Stadium_Database::get_location( $venue_id );
        $lat = $location['lat'] ?? -35.28;
        $lng = $location['lng'] ?? 149.13;
        $timezone = $location['timezone'] ?? 'Australia/Sydney';
        
        // Get structure info (always needed for display)
        $structures = $stadium['structures'] ?? [];
        $num_structures = count( $structures );
        $max_height = 0;
        foreach ( $structures as $s ) {
            $height = $s['height'] ?? 0;
            if ( $height > $max_height ) $max_height = $height;
        }
        
        // Calculate solar elevation (always needed for display)
        $day_of_year = (int) date( 'z', strtotime( $date ) ) + 1;
        $declination = 23.45 * sin( deg2rad( (360/365) * ($day_of_year - 81) ) );
        $solar_elevation = 90 - abs( $lat - $declination );
        
        // Currency based on location
        $currency_symbol = '$';
        $currency_code = 'AUD';
        $default_elec_rate = 0.30;
        if ( $lat > 49 && $lat < 61 && $lng > -11 && $lng < 2 ) {
            $currency_symbol = '£';
            $currency_code = 'GBP';
            $default_elec_rate = 0.28;
        } elseif ( $lat > 35 && $lat < 72 && $lng > -10 && $lng < 40 ) {
            $currency_symbol = '€';
            $currency_code = 'EUR';
            $default_elec_rate = 0.25;
        } elseif ( $lat > 24 && $lat < 46 && $lng > 122 && $lng < 154 ) {
            $currency_symbol = '¥';
            $currency_code = 'JPY';
            $default_elec_rate = 30;
        }
        
        // Use Rig Calculator for accurate spatial shade analysis and seasonal costs
        $rig_calculator = new Gssh_Rig_Placement_Calculator();
        $current_month = (int) date( 'n', strtotime( $date ) );
        
        // Always include current month in analysis (critical months are for winter planning,
        // but we need accurate DLI for whatever month the user is viewing)
        $seasonal_data = $rig_calculator->calculate_seasonal_requirements( $venue_id, [
            'variety'   => 'auto',
            'rig_type'  => 'standard',
            'currency'  => $currency_code,
            'elec_rate' => $default_elec_rate,
            'months'    => null,  // Will be merged with current month below
        ]);
        
        // Handle potential errors
        if ( isset( $seasonal_data['error'] ) ) {
            $seasonal_data = [
                'monthly_analysis' => [],
                'target_dli'       => 18,
                'cost_analysis'    => [ 'total_cost' => 0, 'deployment_days' => 0, 'total_kwh' => 0 ],
                'seasonal_summary' => [],
            ];
        }
        
        // If current month wasn't in the critical months, calculate it now
        if ( ! isset( $seasonal_data['monthly_analysis'][ $current_month ] ) ) {
            // Get ambient DLI for current month using the lookup table
            $ambient_dli = self::get_monthly_ambient_dli_for_shortcode( $lat, $current_month );
            
            // Add minimal month analysis for display purposes
            $seasonal_data['monthly_analysis'][ $current_month ] = [
                'month'           => $current_month,
                'month_name'      => date( 'F', strtotime( $date ) ),
                'ambient_dli'     => $ambient_dli,
                'target_dli'      => $seasonal_data['target_dli'] ?? 18,
                'dli_gap'         => max( 0, ( $seasonal_data['target_dli'] ?? 18 ) - $ambient_dli ),
                'severity'        => 'adequate',  // Non-critical month
                'deficit_area_m2' => 0,
                'rigs_required'   => 0,
            ];
        }
        
        $month_analysis = $seasonal_data['monthly_analysis'][ $current_month ] ?? null;
        
        // Calculate field shade from spatial analysis (deficit area / total pitch area)
        $pitch_area = 7000; // Standard pitch m²
        $field_shade = 0;
        $shade_source = 'spatial';
        
        if ( $month_analysis && isset( $month_analysis['deficit_area_m2'] ) ) {
            $field_shade = round( ( $month_analysis['deficit_area_m2'] / $pitch_area ) * 100, 0 );
            $field_shade = min( 100, $field_shade ); // Cap at 100%
        }
        
        // Get ambient DLI from seasonal analysis (more accurate than GHI conversion)
        $ambient_dli = $month_analysis['ambient_dli'] ?? 10;
        
        // Unshaded DLI is what the field would receive with no obstructions
        // This comes from GHI-based calculation or we estimate from ambient + shade percentage
        $unshaded_dli = $month_analysis['unshaded_dli'] ?? ( $field_shade > 0 ? $ambient_dli / ( 1 - $field_shade / 100 ) : $ambient_dli );
        
        // Get variety thresholds from seasonal analysis
        $target_dli = $seasonal_data['target_dli'] ?? 28;
        $stress_dli = round( $target_dli * 0.65 ); // Minimum threshold ~65% of target
        
        // Get active variety info for display
        $active_variety = Gssh_Stadium_Database::get_active_variety( $venue_id );
        $turf_type = $active_variety['variety'] ?? 'perennial_rye';
        
        // Ensure variety name is set
        if ( empty( $active_variety['variety_name'] ) ) {
            $active_variety['variety_name'] = ucwords( str_replace( '_', ' ', $turf_type ) );
        }
        
        $dli_gap = max( 0, $target_dli - $ambient_dli );
        
        // Determine stress severity for Hub modules
        $stress_severity = 'none';
        if ( $ambient_dli < $stress_dli * 0.6 ) {
            $stress_severity = 'critical';
        } elseif ( $ambient_dli < $stress_dli * 0.8 ) {
            $stress_severity = 'severe';
        } elseif ( $ambient_dli < $stress_dli ) {
            $stress_severity = 'moderate';
        } elseif ( $ambient_dli < $target_dli ) {
            $stress_severity = 'light';
        }
        
        // Get cost data from seasonal analysis
        $cost_analysis = $seasonal_data['cost_analysis'] ?? [];
        $seasonal_summary = $seasonal_data['seasonal_summary'] ?? [];
        
        // Current month rigs and hours for daily cost
        $rigs_required = $month_analysis['rigs_required'] ?? 2;
        $hours_per_day = $month_analysis['rig_hours_per_day'] ?? 8;
        $power_kw = 2.4; // Standard rig
        
        // Daily cost for current conditions
        $daily_kwh = $hours_per_day * $power_kw * $rigs_required;
        $daily_cost = $daily_kwh * $default_elec_rate;
        
        // Season cost from accurate monthly calculation
        $season_cost = $cost_analysis['total_cost'] ?? ( $daily_cost * 180 );
        $deployment_days = $cost_analysis['deployment_days'] ?? 180;
        $total_kwh = $cost_analysis['total_kwh'] ?? ( $daily_kwh * $deployment_days );
        
        // Generate unique ID for this instance
        $cost_instance_id = 'gssh-cost-' . wp_rand( 1000, 9999 );
        
        ob_start();
        ?>
        <div class="gssh-venue-analysis gssh-shade-analysis-results" 
             style="background:#1a1a2e;border-radius:8px;overflow:hidden;"
             data-venue-id="<?php echo esc_attr( $venue_id ); ?>"
             data-venue-name="<?php echo esc_attr( $stadium['name'] ); ?>"
             data-lat="<?php echo esc_attr( $lat ); ?>"
             data-lng="<?php echo esc_attr( $lng ); ?>"
             data-hemisphere="<?php echo $lat < 0 ? 'southern' : 'northern'; ?>"
             data-shade-percentage="<?php echo esc_attr( round( $field_shade ) ); ?>"
             data-dli-shaded="<?php echo esc_attr( $ambient_dli ); ?>"
             data-dli-target="<?php echo esc_attr( $target_dli ); ?>"
             data-dli-minimum="<?php echo esc_attr( $stress_dli ); ?>"
             data-dli-deficit="<?php echo esc_attr( round( $dli_gap, 1 ) ); ?>"
             data-stress-severity="<?php echo esc_attr( $stress_severity ); ?>"
             data-species="<?php echo esc_attr( $turf_type ); ?>"
             data-analysis-date="<?php echo esc_attr( $date ); ?>">
            
            <!-- Venue Header -->
            <div style="padding:20px;border-bottom:1px solid #3f3f46;">
                <h3 style="margin:0;color:#fff;font-size:24px;"><?php echo esc_html( $stadium['name'] ); ?></h3>
                <p style="margin:5px 0 0;color:#e2e8f0;font-size:14px;">
                    <?php 
                    $location_parts = array_filter([
                        $location['city'] ?? '',
                        $location['state'] ?? ''
                    ]);
                    if ( ! empty( $location_parts ) ) {
                        echo esc_html( implode( ', ', $location_parts ) ) . ' • ';
                    }
                    echo esc_html( date( 'l, j F Y', strtotime( $date ) ) ); 
                    ?>
                </p>
            </div>
            
            <!-- Key Metrics -->
            <?php 
            $margin_above_min = $ambient_dli - $stress_dli;
            $status_color = $margin_above_min >= 0 ? '#22c55e' : '#f87171';
            $status_prefix = $margin_above_min >= 0 ? '+' : '';
            
            // Calculate supplemental lighting requirements
            $dli_deficit_to_optimal = max( 0, $target_dli - $ambient_dli );
            $dli_deficit_to_minimum = max( 0, $stress_dli - $ambient_dli );
            
            // Standard rig specs (SGL MU460 as reference)
            $rig_mol_per_hour = 1.15;
            $rig_coverage_m2 = 240;
            $max_hours_per_day = 16;
            
            // Calculate hours needed for display
            $hours_to_minimum = $dli_deficit_to_minimum > 0 ? ceil( $dli_deficit_to_minimum / $rig_mol_per_hour ) : 0;
            $hours_to_optimal = $dli_deficit_to_optimal > 0 ? ceil( $dli_deficit_to_optimal / $rig_mol_per_hour ) : 0;
            $hours_to_minimum = min( $hours_to_minimum, $max_hours_per_day );
            $hours_to_optimal = min( $hours_to_optimal, $max_hours_per_day );
            
            // Rigs needed from seasonal analysis (more accurate than simple area calculation)
            $rigs_needed = $rigs_required;
            ?>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:#3f3f46;">
                <div style="background:#1a1a2e;padding:20px;text-align:center;">
                    <div style="font-size:28px;font-weight:700;color:<?php echo $ambient_dli < $stress_dli ? '#f87171' : '#22c55e'; ?>;">
                        <?php echo esc_html( $ambient_dli ); ?>
                    </div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:5px;">Ambient DLI<br>(mol/m²/d)</div>
                </div>
                <div style="background:#1a1a2e;padding:20px;text-align:center;">
                    <div style="font-size:28px;font-weight:700;color:#fbbf24;"><?php echo esc_html( $stress_dli ); ?></div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:5px;">Minimum DLI<br>(stress threshold)</div>
                </div>
                <div style="background:#1a1a2e;padding:20px;text-align:center;">
                    <div style="font-size:28px;font-weight:700;color:#3b82f6;"><?php echo esc_html( $target_dli ); ?></div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:5px;">Target DLI<br>(optimal growth)</div>
                </div>
                <div style="background:#1a1a2e;padding:20px;text-align:center;">
                    <div style="font-size:28px;font-weight:700;color:<?php echo esc_attr( $status_color ); ?>;">
                        <?php echo esc_html( $status_prefix . round( $margin_above_min, 1 ) ); ?>
                    </div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:5px;">Margin vs<br>Minimum</div>
                </div>
                <div style="background:#1a1a2e;padding:20px;text-align:center;">
                    <div style="font-size:28px;font-weight:700;color:#94a3b8;">~<?php echo esc_html( round( $field_shade ) ); ?>%</div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:5px;">Shade<br>Coverage</div>
                </div>
            </div>
            
            <!-- DLI Visual Bar -->
            <div style="padding:20px;">
                <div style="margin-bottom:10px;display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;">
                    <span>0</span>
                    <span>Survival (<?php echo round($stress_dli * 0.6); ?>)</span>
                    <span>Minimum (<?php echo $stress_dli; ?>)</span>
                    <span>Optimal (<?php echo $target_dli; ?>)</span>
                    <span><?php echo $target_dli + 10; ?>+</span>
                </div>
                <div style="position:relative;height:30px;background:linear-gradient(to right, #450a0a 0%, #7f1d1d 20%, #fbbf24 40%, #22c55e 70%, #22c55e 100%);border-radius:4px;">
                    <?php 
                    $bar_max = $target_dli + 10;
                    $marker_pos = min( 100, ($ambient_dli / $bar_max) * 100 );
                    ?>
                    <div style="position:absolute;left:<?php echo $marker_pos; ?>%;top:-5px;transform:translateX(-50%);">
                        <div style="width:4px;height:40px;background:#fff;border-radius:2px;"></div>
                        <div style="position:absolute;top:45px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;color:#fff;font-weight:600;">
                            <?php echo $ambient_dli; ?> mol/m²/d
                        </div>
                    </div>
                </div>
            </div>
            
            <?php 
            // Only show supplemental lighting section if below optimal
            $needs_supplemental = $ambient_dli < $stress_dli;
            $below_optimal = $ambient_dli < $target_dli && $ambient_dli >= $stress_dli;
            
            if ( $needs_supplemental ) : ?>
            <!-- Supplemental Light Recommendation - CRITICAL -->
            <div style="padding:20px;border-top:1px solid #3f3f46;background:#3a1e1e;">
                <h4 style="color:#f87171;margin:0 0 15px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:24px;">⚠️</span> Supplemental Lighting Required
                </h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:15px;">
                    <div style="background:#1a1a2e;padding:15px;border-radius:8px;border-left:4px solid #f87171;">
                        <div style="font-size:28px;font-weight:700;color:#f87171;"><?php echo $hours_to_minimum; ?>h</div>
                        <div style="color:#94a3b8;font-size:11px;">Daily hours to<br><strong style="color:#fff;">minimum</strong></div>
                    </div>
                    <div style="background:#1a1a2e;padding:15px;border-radius:8px;border-left:4px solid #3b82f6;">
                        <div style="font-size:28px;font-weight:700;color:#3b82f6;"><?php echo $hours_to_optimal; ?>h</div>
                        <div style="color:#94a3b8;font-size:11px;">Daily hours to<br><strong style="color:#fff;">optimal</strong></div>
                    </div>
                    <div style="background:#1a1a2e;padding:15px;border-radius:8px;border-left:4px solid #fbbf24;">
                        <div style="font-size:28px;font-weight:700;color:#fbbf24;"><?php echo $rigs_needed; ?></div>
                        <div style="color:#94a3b8;font-size:11px;">Rigs needed<br><strong style="color:#fff;">(coverage)</strong></div>
                    </div>
                    <div style="background:#1a1a2e;padding:15px;border-radius:8px;border-left:4px solid #22c55e;">
                        <div id="<?php echo esc_attr( $cost_instance_id ); ?>-daily" style="font-size:28px;font-weight:700;color:#22c55e;"><?php echo esc_html( $currency_symbol ); ?><?php echo number_format( $daily_cost, 0 ); ?></div>
                        <div style="color:#94a3b8;font-size:11px;">Est. daily cost<br><strong style="color:#fff;">(<span id="<?php echo esc_attr( $cost_instance_id ); ?>-kwh"><?php echo round($daily_kwh); ?></span> kWh)</strong></div>
                    </div>
                    <div style="background:#1a1a2e;padding:15px;border-radius:8px;border-left:4px solid #a855f7;">
                        <div id="<?php echo esc_attr( $cost_instance_id ); ?>-annual" style="font-size:28px;font-weight:700;color:#a855f7;"><?php echo esc_html( $currency_symbol ); ?><?php echo number_format( $season_cost, 0 ); ?></div>
                        <div style="color:#94a3b8;font-size:11px;">Est. season cost<br><strong style="color:#fff;">(~<?php echo $deployment_days; ?> days)</strong></div>
                    </div>
                </div>
                
                <!-- Electricity Rate Input -->
                <div style="margin-top:20px;padding:15px;background:#1a1a2e;border-radius:8px;">
                    <div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;">
                        <label style="color:#94a3b8;font-size:13px;white-space:nowrap;">
                            ⚡ Electricity rate:
                        </label>
                        <div style="display:flex;align-items:center;gap:5px;">
                            <span style="color:#fff;font-weight:bold;"><?php echo esc_html( $currency_symbol ); ?></span>
                            <input type="number" 
                                   id="<?php echo esc_attr( $cost_instance_id ); ?>-rate" 
                                   value="<?php echo esc_attr( $default_elec_rate ); ?>" 
                                   step="0.01" 
                                   min="0" 
                                   style="width:80px;padding:8px;background:#27272a;border:1px solid #3f3f46;border-radius:4px;color:#fff;font-size:14px;"
                            />
                            <span style="color:#94a3b8;font-size:12px;">/kWh</span>
                        </div>
                        <span style="color:#71717a;font-size:11px;">
                            (<?php echo esc_html( $currency_code ); ?> default)
                        </span>
                    </div>
                </div>
                
                <p style="color:#94a3b8;margin:15px 0 0;font-size:13px;">
                    💡 Based on SGL MU460 rigs (<?php echo $rig_mol_per_hour; ?> mol/h, <?php echo $rig_coverage_m2; ?>m² coverage, <?php echo $power_kw; ?>kW). 
                    Use the <strong style="color:#fff;">Rig Calculator</strong> shortcode for detailed placement analysis.
                </p>
            </div>
            
            <!-- Cost calculation script -->
            <script>
            (function() {
                var instanceId = '<?php echo esc_js( $cost_instance_id ); ?>';
                var dailyKwh = <?php echo $daily_kwh; ?>;
                var totalSeasonKwh = <?php echo $total_kwh; ?>; // From seasonal analysis
                var defaultRate = <?php echo $default_elec_rate; ?>;
                var currencySymbol = '<?php echo esc_js( $currency_symbol ); ?>';
                
                var rateInput = document.getElementById(instanceId + '-rate');
                var dailyDisplay = document.getElementById(instanceId + '-daily');
                var annualDisplay = document.getElementById(instanceId + '-annual');
                
                if (rateInput && dailyDisplay && annualDisplay) {
                    var updateCosts = function() {
                        var rate = parseFloat(rateInput.value) || 0;
                        var dailyCost = dailyKwh * rate;
                        var seasonCost = totalSeasonKwh * rate; // Use actual seasonal kWh
                        
                        // Format with thousands separator
                        dailyDisplay.textContent = currencySymbol + Math.round(dailyCost).toLocaleString();
                        annualDisplay.textContent = currencySymbol + Math.round(seasonCost).toLocaleString();
                    };
                    
                    rateInput.addEventListener('input', updateCosts);
                    rateInput.addEventListener('change', updateCosts);
                }
            })();
            </script>
            
            <?php elseif ( $below_optimal ) : ?>
            <!-- Below optimal but adequate -->
            <div style="padding:20px;border-top:1px solid #3f3f46;background:#1e2a3a;">
                <h4 style="color:#60a5fa;margin:0 0 15px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:24px;">ℹ️</span> Adequate Light - Optional Supplementation
                </h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;">
                    <div style="background:#1a1a2e;padding:15px;border-radius:8px;border-left:4px solid #22c55e;">
                        <div style="font-size:32px;font-weight:700;color:#22c55e;">0h</div>
                        <div style="color:#94a3b8;font-size:12px;">Required hours<br><strong style="color:#fff;">(above minimum)</strong></div>
                    </div>
                    <div style="background:#1a1a2e;padding:15px;border-radius:8px;border-left:4px solid #3b82f6;">
                        <div style="font-size:32px;font-weight:700;color:#3b82f6;"><?php echo $hours_to_optimal; ?>h</div>
                        <div style="color:#94a3b8;font-size:12px;">Optional hours for<br><strong style="color:#fff;">optimal growth</strong></div>
                    </div>
                </div>
                <p style="color:#94a3b8;margin:15px 0 0;font-size:13px;">
                    Turf health will be maintained at current light levels. Supplemental lighting is optional but would improve growth rate and recovery.
                </p>
            </div>
            
            <?php else : ?>
            <!-- Meeting or exceeding optimal -->
            <div style="padding:20px;border-top:1px solid #3f3f46;background:#1e3a2f;">
                <h4 style="color:#22c55e;margin:0 0 10px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:24px;">✓</span> Optimal Light Conditions
                </h4>
                <p style="color:#94a3b8;margin:0;">
                    Ambient DLI of <?php echo esc_html( $ambient_dli ); ?> meets or exceeds the optimal requirement of <?php echo esc_html( $target_dli ); ?> mol/m²/d.
                    <strong style="color:#22c55e;">No supplemental lighting needed.</strong>
                </p>
            </div>
            <?php endif; ?>
            
            <!-- Turf Info (compact) -->
            <div style="padding:15px 20px;border-top:1px solid #3f3f46;display:flex;flex-wrap:wrap;gap:20px;font-size:13px;">
                <div>
                    <span style="color:#94a3b8;">Turf:</span>
                    <span style="color:#fff;margin-left:5px;"><?php echo esc_html( $active_variety['variety_name'] ?? ucwords( str_replace( '_', ' ', $turf_type ) ) ); ?></span>
                </div>
                <div>
                    <span style="color:#94a3b8;">Structures:</span>
                    <span style="color:#fff;margin-left:5px;"><?php echo esc_html( $num_structures ); ?> stands (max <?php echo round($max_height); ?>m)</span>
                </div>
                <div>
                    <span style="color:#94a3b8;">Solar elevation:</span>
                    <span style="color:#fff;margin-left:5px;"><?php echo round($solar_elevation); ?>° at noon</span>
                </div>
            </div>
            
        </div>
        
        <!-- Dispatch shade data to Hub for disease/irrigation/PGR/wear integration -->
        <script>
        (function() {
            var shadeData = {
                venue_id: '<?php echo esc_js( $venue_id ); ?>',
                venue_name: '<?php echo esc_js( $stadium["name"] ); ?>',
                lat: <?php echo floatval( $lat ); ?>,
                lng: <?php echo floatval( $lng ); ?>,
                hemisphere: '<?php echo $lat < 0 ? "southern" : "northern"; ?>',
                shade_percentage: <?php echo round( $field_shade ); ?>,
                dli_shaded: <?php echo floatval( $ambient_dli ); ?>,
                dli_actual: <?php echo floatval( $ambient_dli ); ?>,
                dli_unshaded: <?php echo round( $unshaded_dli, 1 ); ?>,
                dli_target: <?php echo floatval( $target_dli ); ?>,
                dli_minimum: <?php echo floatval( $stress_dli ); ?>,
                dli_deficit: <?php echo round( $dli_gap, 1 ); ?>,
                deficit_percentage: <?php echo $target_dli > 0 ? round( ($dli_gap / $target_dli) * 100, 1 ) : 0; ?>,
                stress_severity: '<?php echo esc_js( $stress_severity ); ?>',
                below_stress: <?php echo $ambient_dli < $stress_dli ? "true" : "false"; ?>,
                species: '<?php echo esc_js( $turf_type ); ?>',
                analysis_date: '<?php echo esc_js( $date ); ?>',
                thresholds: {
                    survival: <?php echo floatval( $stress_dli * 0.6 ); ?>,
                    stress: <?php echo floatval( $stress_dli ); ?>,
                    target: <?php echo floatval( $target_dli ); ?>
                }
            };
            
            // Store globally so Hub can access it even if event fires before Hub is ready
            window.GILBA_SHADE_DATA = shadeData;
            
            // Function to dispatch shade data
            function dispatchShadeData() {
                document.dispatchEvent(new CustomEvent('gssh:shadeAnalysisComplete', {
                    detail: shadeData,
                    bubbles: true
                }));
                document.dispatchEvent(new CustomEvent('gssh:stadiumShadeData', {
                    detail: shadeData,
                    bubbles: true
                }));
                console.log('[StadiumLight] Shade data dispatched to Hub:', shadeData);
            }
            
            // Dispatch immediately
            dispatchShadeData();
            
            // Also listen for Hub requesting shade data (in case Hub loads after Stadium Light)
            document.addEventListener('gssh:requestShadeData', function() {
                console.log('[StadiumLight] Hub requested shade data, re-dispatching...');
                dispatchShadeData();
            });
        })();
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Simple status summary
     * 
     * [gssh_light_status venue="sample_stadium"]
     */
    public static function render_status( $atts ) {
        $atts = shortcode_atts( [
            'venue' => '',
        ], $atts );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p class="gssh-error">Please specify a venue.</p>';
        }
        
        $plugin = Gssh_Stadium_Loader::get_instance();
        $venue_config = $plugin->get_venue_config( $atts['venue'] );
        
        if ( ! $venue_config ) {
            return '<p class="gssh-error">Venue not found.</p>';
        }
        
        $module = $plugin->get_module();
        $analysis = $module->analyse_venue( $atts['venue'], $venue_config );
        
        wp_enqueue_style( 'gssh-light-frontend', GILBA_LIGHT_URL . 'assets/css/frontend.css', [], GILBA_LIGHT_VERSION );
        
        $venue = $analysis['venue_analysis'];
        $dli = $analysis['ambient_dli'];
        $formatter = new Gssh_Currency_Formatter( $venue_config['currency']['code'] ?? 'AUD' );
        
        ob_start();
        ?>
        <div class="gssh-light-shortcode gssh-light-status">
            <div class="status-header">
                <h4><?php echo esc_html( $venue_config['venue_name'] ); ?></h4>
                <span class="status-date"><?php echo esc_html( date( 'j M Y' ) ); ?></span>
            </div>
            
            <div class="status-grid">
                <div class="status-item">
                    <span class="status-value"><?php echo esc_html( $dli['dli'] ); ?></span>
                    <span class="status-label">Ambient DLI</span>
                </div>
                <div class="status-item <?php echo $venue['zones_at_risk'] > 0 ? 'warning' : 'ok'; ?>">
                    <span class="status-value"><?php echo esc_html( $venue['zones_at_risk'] ); ?></span>
                    <span class="status-label">Zones at Risk</span>
                </div>
                <div class="status-item">
                    <span class="status-value"><?php echo esc_html( round( $analysis['total_prescribed_hours'], 1 ) ); ?>h</span>
                    <span class="status-label">Light Prescribed</span>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Today's schedule
     * 
     * [gssh_light_schedule venue="sample_stadium"]
     */
    public static function render_schedule( $atts ) {
        $atts = shortcode_atts( [
            'venue' => '',
        ], $atts );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p class="gssh-error">Please specify a venue.</p>';
        }
        
        $plugin = Gssh_Stadium_Loader::get_instance();
        $venue_config = $plugin->get_venue_config( $atts['venue'] );
        
        if ( ! $venue_config ) {
            return '<p class="gssh-error">Venue not found.</p>';
        }
        
        $module = $plugin->get_module();
        $analysis = $module->analyse_venue( $atts['venue'], $venue_config );
        $schedule = $analysis['recommended_schedule'];
        
        wp_enqueue_style( 'gssh-light-frontend', GILBA_LIGHT_URL . 'assets/css/frontend.css', [], GILBA_LIGHT_VERSION );
        
        $formatter = new Gssh_Currency_Formatter( $venue_config['currency']['code'] ?? 'AUD' );
        
        ob_start();
        ?>
        <div class="gssh-light-shortcode gssh-light-schedule">
            <div class="schedule-header">
                <h4>Today's Light Schedule</h4>
                <span class="schedule-date"><?php echo esc_html( date( 'l j M' ) ); ?></span>
            </div>
            
            <?php if ( empty( $schedule['sessions'] ) ) : ?>
                <p class="no-sessions">No supplemental light required today.</p>
            <?php else : ?>
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Zone</th>
                            <th>Duration</th>
                            <th>Delivery</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $schedule['sessions'] as $session ) : ?>
                            <tr>
                                <td><?php echo esc_html( $session['start_time'] . ' – ' . $session['end_time'] ); ?></td>
                                <td><?php echo esc_html( $session['zone_id'] ); ?></td>
                                <td><?php echo esc_html( $session['duration_hours'] ); ?>h</td>
                                <td><?php echo esc_html( $session['mol_delivered'] ); ?> mol/m²</td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                
                <div class="schedule-totals">
                    <span>Total: <?php echo esc_html( $schedule['total_hours'] ); ?> hours</span>
                    <span><?php echo esc_html( $schedule['estimated_kwh'] ); ?> kWh</span>
                    <?php if ( $schedule['estimated_cost'] > 0 ) : ?>
                        <span><?php echo esc_html( $formatter->format( $schedule['estimated_cost'] ) ); ?></span>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Zone status cards
     * 
     * [gssh_light_zones venue="sample_stadium"]
     */
    public static function render_zones( $atts ) {
        $atts = shortcode_atts( [
            'venue' => '',
            'show'  => 'all', // all, at_risk, adequate
        ], $atts );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p class="gssh-error">Please specify a venue.</p>';
        }
        
        $plugin = Gssh_Stadium_Loader::get_instance();
        $venue_config = $plugin->get_venue_config( $atts['venue'] );
        
        if ( ! $venue_config ) {
            return '<p class="gssh-error">Venue not found.</p>';
        }
        
        $module = $plugin->get_module();
        $analysis = $module->analyse_venue( $atts['venue'], $venue_config );
        
        wp_enqueue_style( 'gssh-light-frontend', GILBA_LIGHT_URL . 'assets/css/frontend.css', [], GILBA_LIGHT_VERSION );
        
        $zones = $analysis['venue_analysis']['zones'];
        
        // Filter zones if requested
        if ( $atts['show'] === 'at_risk' ) {
            $zones = array_filter( $zones, fn( $z ) => $z['severity'] !== 'adequate' );
        } elseif ( $atts['show'] === 'adequate' ) {
            $zones = array_filter( $zones, fn( $z ) => $z['severity'] === 'adequate' );
        }
        
        ob_start();
        ?>
        <div class="gssh-light-shortcode gssh-light-zones">
            <?php foreach ( $zones as $zone ) : ?>
                <div class="zone-card severity-<?php echo esc_attr( $zone['severity'] ); ?>">
                    <div class="zone-header">
                        <span class="zone-name"><?php echo esc_html( $zone['zone_name'] ); ?></span>
                        <span class="zone-severity"><?php echo esc_html( ucfirst( $zone['severity'] ) ); ?></span>
                    </div>
                    <div class="zone-metrics">
                        <div class="metric">
                            <span class="value"><?php echo esc_html( $zone['actual_dli'] ); ?></span>
                            <span class="label">Actual DLI</span>
                        </div>
                        <div class="metric">
                            <span class="value"><?php echo esc_html( $zone['target_dli'] ); ?></span>
                            <span class="label">Target DLI</span>
                        </div>
                        <div class="metric">
                            <span class="value"><?php echo esc_html( $zone['deficit'] ); ?></span>
                            <span class="label">Deficit</span>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <?php
        return ob_get_clean();
    }
    
    // =========================================================================
    // SHADE VISUALISATION SHORTCODES
    // =========================================================================
    
    /**
     * Single shade snapshot
     * 
     * [gssh_shade venue="adelaide_oval"]
     * [gssh_shade venue="mcg" date="2025-06-21" time="12:00"]
     * 
     * @param array $atts Shortcode attributes
     *   - venue: Stadium ID (required)
     *   - date: Date in Y-m-d format (default: today)
     *   - time: Time in H:i format (default: 12:00)
     *   - width: SVG width in pixels (default: 600)
     *   - height: SVG height in pixels (default: 450)
     */
    public static function render_shade_snapshot( $atts ) {
        $atts = shortcode_atts( [
            'venue'  => '',
            'date'   => date( 'Y-m-d' ),
            'time'   => '12:00',
            'width'  => 600,
            'height' => 450,
        ], $atts );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p class="gssh-error">Please specify a venue. Example: [gssh_shade venue="adelaide_oval"]</p>';
        }
        
        $datetime = $atts['date'] . 'T' . $atts['time'] . ':00';
        
        $visualiser = new Gssh_Shade_Visualiser();
        $svg = $visualiser->generate_snapshot( $atts['venue'], $datetime, [
            'width'      => intval( $atts['width'] ),
            'height'     => intval( $atts['height'] ),
            'show_title' => true,
        ]);
        
        return '<div class="gssh-shade-shortcode">' . $svg . '</div>';
    }
    
    /**
     * Time series of shade snapshots through the day
     * 
     * [gssh_shade_series venue="adelaide_oval"]
     * [gssh_shade_series venue="mcg" date="2025-06-21"]
     * 
     * @param array $atts Shortcode attributes
     *   - venue: Stadium ID (required)
     *   - date: Date in Y-m-d format (default: today)
     *   - times: Comma-separated times (default: auto-calculated key times)
     */
    public static function render_shade_series( $atts ) {
        $atts = shortcode_atts( [
            'venue' => '',
            'date'  => date( 'Y-m-d' ),
            'times' => '',
        ], $atts );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p class="gssh-error">Please specify a venue. Example: [gssh_shade_series venue="adelaide_oval"]</p>';
        }
        
        $times = null;
        if ( ! empty( $atts['times'] ) ) {
            $times = array_map( 'trim', explode( ',', $atts['times'] ) );
        }
        
        $visualiser = new Gssh_Shade_Visualiser();
        $html = $visualiser->generate_time_series( $atts['venue'], $atts['date'], $times );
        
        return '<div class="gssh-shade-shortcode">' . $html . '</div>';
    }
    
    /**
     * Seasonal comparison (solstices and equinoxes)
     * 
     * [gssh_shade_seasonal venue="adelaide_oval"]
     * [gssh_shade_seasonal venue="mcg" time="14:00"]
     * 
     * @param array $atts Shortcode attributes
     *   - venue: Stadium ID (required)
     *   - time: Time of day to compare (default: 12:00)
     *   - year: Year for dates (default: current year)
     */
    public static function render_shade_seasonal( $atts ) {
        $atts = shortcode_atts( [
            'venue' => '',
            'time'  => '12:00',
            'year'  => date( 'Y' ),
        ], $atts );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p class="gssh-error">Please specify a venue. Example: [gssh_shade_seasonal venue="adelaide_oval"]</p>';
        }
        
        $visualiser = new Gssh_Shade_Visualiser();
        $html = $visualiser->generate_seasonal_comparison( 
            $atts['venue'], 
            $atts['time'], 
            intval( $atts['year'] ) 
        );
        
        return '<div class="gssh-shade-shortcode">' . $html . '</div>';
    }
    
    /**
     * Shade heatmap showing cumulative daily shade
     * 
     * [gssh_shade_heatmap venue="adelaide_oval"]
     * [gssh_shade_heatmap venue="mcg" date="2025-06-21" resolution="3"]
     * 
     * @param array $atts Shortcode attributes
     *   - venue: Stadium ID (required)
     *   - date: Date in Y-m-d format (default: today)
     *   - resolution: Grid resolution in metres (default: 5)
     *   - width: SVG width (default: 800)
     *   - height: SVG height (default: 600)
     */
    public static function render_shade_heatmap( $atts ) {
        $atts = shortcode_atts( [
            'venue'      => '',
            'date'       => date( 'Y-m-d' ),
            'resolution' => 5,
            'width'      => 800,
            'height'     => 600,
        ], $atts );
        
        if ( empty( $atts['venue'] ) ) {
            return '<p class="gssh-error">Please specify a venue. Example: [gssh_shade_heatmap venue="adelaide_oval"]</p>';
        }
        
        $visualiser = new Gssh_Shade_Visualiser();
        $svg = $visualiser->generate_shade_heatmap( $atts['venue'], $atts['date'], [
            'resolution' => intval( $atts['resolution'] ),
            'width'      => intval( $atts['width'] ),
            'height'     => intval( $atts['height'] ),
        ]);
        
        return '<div class="gssh-shade-shortcode">' . $svg . '</div>';
    }
    
    /**
     * Unified interactive shade analysis
     * 
     * [gssh_shade_analysis venue="adelaide_oval"]
     * [gssh_shade_analysis] - shows venue selector
     * 
     * Provides full interactive interface with:
     * - Venue selector (if not specified)
     * - Date picker
     * - View mode tabs (Time Series, Seasonal, Heatmap, Animation)
     * - Live visualisation
     * - Key statistics
     * 
     * @param array $atts Shortcode attributes
     *   - venue: Stadium ID (optional - shows selector if omitted)
     *   - date: Initial date (default: today)
     *   - mode: Initial view mode (default: series)
     *   - show_controls: Show date/mode controls (default: true)
     *   - show_stats: Show statistics panel (default: true)
     *   - show_venue_info: Show venue details (default: true)
     */
    public static function render_shade_analysis( $atts ) {
        $atts = shortcode_atts( [
            'venue'           => '',
            'date'            => date( 'Y-m-d' ),
            'mode'            => 'series',
            'show_controls'   => 'true',
            'show_stats'      => 'true',
            'show_venue_info' => 'true',
        ], $atts );
        
        $show_controls   = filter_var( $atts['show_controls'], FILTER_VALIDATE_BOOLEAN );
        $show_stats      = filter_var( $atts['show_stats'], FILTER_VALIDATE_BOOLEAN );
        $show_venue_info = filter_var( $atts['show_venue_info'], FILTER_VALIDATE_BOOLEAN );
        
        // Get all available venues
        $venue_ids = Gssh_Stadium_Database::get_stadium_ids();
        $venues = [];
        foreach ( $venue_ids as $id ) {
            $v = Gssh_Stadium_Database::get_stadium( $id );
            if ( $v ) {
                $venues[ $id ] = $v;
            }
        }
        
        // Generate unique ID for this instance
        $instance_id = 'gssh-shade-' . wp_rand( 1000, 9999 );
        
        $selected_venue = ! empty( $atts['venue'] ) ? $atts['venue'] : '';
        $selected_date  = $atts['date'];
        $selected_mode  = $atts['mode'];
        
        ob_start();
        ?>
        <div class="gssh-shade-analysis" id="<?php echo esc_attr( $instance_id ); ?>" 
             data-venue="<?php echo esc_attr( $selected_venue ); ?>"
             data-date="<?php echo esc_attr( $selected_date ); ?>"
             data-mode="<?php echo esc_attr( $selected_mode ); ?>">
            
            <?php if ( $show_controls ) : ?>
            <div class="gssh-shade-controls">
                <div class="gssh-control-group">
                    <label for="<?php echo esc_attr( $instance_id ); ?>-hemisphere">Region</label>
                    <select id="<?php echo esc_attr( $instance_id ); ?>-hemisphere" class="gssh-hemisphere-select">
                        <option value="all">All Regions</option>
                        <option value="southern" selected>Southern Hemisphere</option>
                        <option value="northern">Northern Hemisphere</option>
                    </select>
                </div>
                
                <?php if ( empty( $atts['venue'] ) ) : ?>
                <div class="gssh-control-group">
                    <label for="<?php echo esc_attr( $instance_id ); ?>-venue">Venue</label>
                    <select id="<?php echo esc_attr( $instance_id ); ?>-venue" class="gssh-venue-select">
                        <option value="">-- Select Venue --</option>
                        <?php 
                        $grouped = Gssh_Stadium_Database::get_grouped_stadium_list();
                        foreach ( $grouped as $hemisphere => $countries ) :
                            $hem_label = ucfirst( $hemisphere ) . ' Hemisphere';
                        ?>
                            <optgroup label="<?php echo esc_attr( $hem_label ); ?>" data-hemisphere="<?php echo esc_attr( $hemisphere ); ?>">
                            <?php foreach ( $countries as $country => $states ) : ?>
                                <?php foreach ( $states as $state => $state_venues ) : ?>
                                    <?php foreach ( $state_venues as $id => $name ) : ?>
                                        <option value="<?php echo esc_attr( $id ); ?>" 
                                                data-hemisphere="<?php echo esc_attr( $hemisphere ); ?>"
                                                data-country="<?php echo esc_attr( $country ); ?>"
                                                <?php selected( $selected_venue, $id ); ?>>
                                            <?php echo esc_html( $name ); ?> (<?php echo esc_html( $state ); ?>)
                                        </option>
                                    <?php endforeach; ?>
                                <?php endforeach; ?>
                            <?php endforeach; ?>
                            </optgroup>
                        <?php endforeach; ?>
                    </select>
                </div>
                <?php endif; ?>
                
                <div class="gssh-control-group">
                    <label for="<?php echo esc_attr( $instance_id ); ?>-date">Date</label>
                    <input type="date" id="<?php echo esc_attr( $instance_id ); ?>-date" 
                           class="gssh-date-select"
                           value="<?php echo esc_attr( $selected_date ); ?>">
                </div>
                
                <div class="gssh-control-group gssh-mode-tabs">
                    <button type="button" class="gssh-mode-btn <?php echo $selected_mode === 'series' ? 'active' : ''; ?>" 
                            data-mode="series">Time Series</button>
                    <button type="button" class="gssh-mode-btn <?php echo $selected_mode === 'seasonal' ? 'active' : ''; ?>" 
                            data-mode="seasonal">Seasonal</button>
                    <button type="button" class="gssh-mode-btn <?php echo $selected_mode === 'heatmap' ? 'active' : ''; ?>" 
                            data-mode="heatmap">Heatmap</button>
                    <button type="button" class="gssh-mode-btn <?php echo $selected_mode === 'animated' ? 'active' : ''; ?>" 
                            data-mode="animated">Animation</button>
                </div>
            </div>
            <?php endif; ?>
            
            <div class="gssh-shade-output">
                <?php
                if ( ! empty( $selected_venue ) ) {
                    $visualiser = new Gssh_Shade_Visualiser();
                    
                    switch ( $selected_mode ) {
                        case 'seasonal':
                            echo $visualiser->generate_seasonal_comparison( $selected_venue, '12:00' );
                            break;
                        case 'heatmap':
                            echo $visualiser->generate_shade_heatmap( $selected_venue, $selected_date );
                            break;
                        case 'animated':
                            echo $visualiser->generate_daily_animation( $selected_venue, $selected_date );
                            break;
                        case 'series':
                        default:
                            echo $visualiser->generate_time_series( $selected_venue, $selected_date );
                    }
                } else {
                    echo '<div class="gssh-shade-placeholder">';
                    echo '<p>Select a venue to view shade analysis</p>';
                    echo '</div>';
                }
                ?>
            </div>
            
            <?php if ( $show_stats && ! empty( $selected_venue ) ) : 
                $stadium = Gssh_Stadium_Database::get_stadium( $selected_venue );
                $shade_engine = new Gssh_Shade_Engine();
                
                // Calculate some key stats
                $winter_date = date( 'Y' ) . '-06-21';
                $winter_noon = $shade_engine->calculate_shadows( $selected_venue, $winter_date . 'T12:00:00' );
                $summer_date = date( 'Y' ) . '-12-21';
                $summer_noon = $shade_engine->calculate_shadows( $selected_venue, $summer_date . 'T12:00:00' );
                
                $winter_coverage = isset( $winter_noon['field_shade_percentage'] ) ? $winter_noon['field_shade_percentage'] : 0;
                $summer_coverage = isset( $summer_noon['field_shade_percentage'] ) ? $summer_noon['field_shade_percentage'] : 0;
            ?>
            <div class="gssh-shade-stats">
                <div class="gssh-stat">
                    <span class="gssh-stat-value"><?php echo esc_html( round( $winter_coverage ) ); ?>%</span>
                    <span class="gssh-stat-label">Winter Noon Shade</span>
                </div>
                <div class="gssh-stat">
                    <span class="gssh-stat-value"><?php echo esc_html( round( $summer_coverage ) ); ?>%</span>
                    <span class="gssh-stat-label">Summer Noon Shade</span>
                </div>
                <div class="gssh-stat">
                    <span class="gssh-stat-value"><?php echo count( $stadium['structures'] ?? [] ); ?></span>
                    <span class="gssh-stat-label">Structures</span>
                </div>
                <div class="gssh-stat">
                    <span class="gssh-stat-value"><?php 
                        $max_height = 0;
                        foreach ( $stadium['structures'] ?? [] as $s ) {
                            $max_height = max( $max_height, $s['height'] ?? 0 );
                        }
                        echo esc_html( round( $max_height ) );
                    ?>m</span>
                    <span class="gssh-stat-label">Max Height</span>
                </div>
            </div>
            <?php endif; ?>
            
            <?php if ( $show_venue_info && ! empty( $selected_venue ) ) : 
                $stadium = Gssh_Stadium_Database::get_stadium( $selected_venue );
            ?>
            <div class="gssh-venue-info">
                <h4><?php echo esc_html( $stadium['name'] ); ?></h4>
                <p>
                    <strong>Location:</strong> 
                    <?php echo esc_html( $stadium['location']['city'] ?? '' ); ?>
                    <?php if ( ! empty( $stadium['location']['state'] ) ) : ?>
                        , <?php echo esc_html( $stadium['location']['state'] ); ?>
                    <?php endif; ?>
                    (<?php echo esc_html( round( $stadium['location']['lat'], 4 ) ); ?>°, 
                    <?php echo esc_html( round( $stadium['location']['lng'], 4 ) ); ?>°)
                </p>
                <p>
                    <strong>Field:</strong> 
                    <?php echo esc_html( ucfirst( $stadium['field']['type'] ?? 'Unknown' ) ); ?>
                    <?php echo esc_html( $stadium['field']['length'] ?? 0 ); ?>m × 
                    <?php echo esc_html( $stadium['field']['width'] ?? 0 ); ?>m
                </p>
                <?php if ( ! empty( $stadium['notes'] ) ) : ?>
                    <p><strong>Notes:</strong> <?php echo esc_html( $stadium['notes'] ); ?></p>
                <?php endif; ?>
            </div>
            <?php endif; ?>
        </div>
        
        <style>
            .gssh-shade-analysis {
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 8px;
                overflow: hidden;
                margin: 20px 0;
            }
            .gssh-shade-controls {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                align-items: center;
                padding: 15px;
                background: #f6f7f7;
                border-bottom: 1px solid #ddd;
            }
            .gssh-control-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .gssh-control-group label {
                font-size: 12px;
                font-weight: 600;
                color: #50575e;
            }
            .gssh-control-group select,
            .gssh-control-group input {
                padding: 8px 12px;
                border: 1px solid #8c8f94;
                border-radius: 4px;
                font-size: 14px;
            }
            .gssh-mode-tabs {
                flex-direction: row;
                margin-left: auto;
            }
            .gssh-mode-btn {
                padding: 8px 16px;
                border: 1px solid #8c8f94;
                background: #fff;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.15s;
            }
            .gssh-mode-btn:first-child { border-radius: 4px 0 0 4px; }
            .gssh-mode-btn:last-child { border-radius: 0 4px 4px 0; }
            .gssh-mode-btn:not(:first-child) { border-left: none; }
            .gssh-mode-btn:hover { background: #f0f0f1; }
            .gssh-mode-btn.active {
                background: #2271b1;
                color: #fff;
                border-color: #2271b1;
            }
            .gssh-shade-output {
                padding: 20px;
                background: #1d2327;
                min-height: 300px;
            }
            .gssh-shade-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 300px;
                color: #a7aaad;
            }
            .gssh-shade-stats {
                display: flex;
                justify-content: space-around;
                padding: 15px;
                background: #2c3338;
                border-top: 1px solid #3c4349;
            }
            .gssh-stat {
                text-align: center;
            }
            .gssh-stat-value {
                display: block;
                font-size: 24px;
                font-weight: 700;
                color: #72aee6;
            }
            .gssh-stat-label {
                font-size: 11px;
                color: #a7aaad;
                text-transform: uppercase;
            }
            .gssh-venue-info {
                padding: 15px 20px;
                background: #f0f6fc;
                border-top: 1px solid #c5d9ed;
            }
            .gssh-venue-info h4 {
                margin: 0 0 10px;
                color: #1d2327;
            }
            .gssh-venue-info p {
                margin: 5px 0;
                font-size: 13px;
                color: #50575e;
            }
            @media (max-width: 782px) {
                .gssh-shade-controls {
                    flex-direction: column;
                    align-items: stretch;
                }
                .gssh-mode-tabs {
                    margin-left: 0;
                    flex-wrap: wrap;
                }
                .gssh-shade-stats {
                    flex-wrap: wrap;
                    gap: 15px;
                }
                .gssh-stat {
                    flex: 1 1 40%;
                }
            }
        </style>
        
        <script>
        (function() {
            var container = document.getElementById('<?php echo esc_js( $instance_id ); ?>');
            if (!container) return;
            
            var hemisphereSelect = container.querySelector('.gssh-hemisphere-select');
            var venueSelect = container.querySelector('.gssh-venue-select');
            var dateSelect = container.querySelector('.gssh-date-select');
            var modeBtns = container.querySelectorAll('.gssh-mode-btn');
            
            // Hemisphere filtering
            if (hemisphereSelect && venueSelect) {
                hemisphereSelect.addEventListener('change', function() {
                    var selectedHemisphere = this.value;
                    var options = venueSelect.querySelectorAll('option[data-hemisphere]');
                    var optgroups = venueSelect.querySelectorAll('optgroup[data-hemisphere]');
                    
                    // Show/hide optgroups
                    optgroups.forEach(function(og) {
                        var hem = og.getAttribute('data-hemisphere');
                        if (selectedHemisphere === 'all' || hem === selectedHemisphere) {
                            og.style.display = '';
                        } else {
                            og.style.display = 'none';
                        }
                    });
                    
                    // Show/hide options
                    options.forEach(function(opt) {
                        var hem = opt.getAttribute('data-hemisphere');
                        if (selectedHemisphere === 'all' || hem === selectedHemisphere) {
                            opt.style.display = '';
                            opt.disabled = false;
                        } else {
                            opt.style.display = 'none';
                            opt.disabled = true;
                        }
                    });
                    
                    // Reset venue selection if current selection is now hidden
                    if (venueSelect.value) {
                        var selectedOption = venueSelect.querySelector('option[value="' + venueSelect.value + '"]');
                        if (selectedOption && selectedOption.disabled) {
                            venueSelect.value = '';
                        }
                    }
                });
                
                // Trigger initial filter
                hemisphereSelect.dispatchEvent(new Event('change'));
            }
            
            function updateView() {
                var venue = venueSelect ? venueSelect.value : container.dataset.venue;
                var date = dateSelect ? dateSelect.value : container.dataset.date;
                var mode = container.dataset.mode;
                
                if (!venue) return;
                
                // Build URL for AJAX request
                var url = '<?php echo admin_url( 'admin-ajax.php' ); ?>';
                var params = new URLSearchParams({
                    action: 'gssh_shade_render',
                    venue: venue,
                    date: date,
                    mode: mode,
                    nonce: (window.GSSH_HUB_CONFIG || {}).nonce || ''
                });
                
                var output = container.querySelector('.gssh-shade-output');
                output.innerHTML = '<div class="gssh-shade-placeholder"><p>Loading...</p></div>';
                
                fetch(url + '?' + params.toString())
                    .then(function(response) { return response.text(); })
                    .then(function(html) {
                        output.innerHTML = html;
                    })
                    .catch(function(err) {
                        output.innerHTML = '<div class="gssh-shade-placeholder"><p>Error loading: ' + err + '</p></div>';
                    });
            }
            
            if (venueSelect) {
                venueSelect.addEventListener('change', updateView);
            }
            
            if (dateSelect) {
                dateSelect.addEventListener('change', updateView);
            }
            
            modeBtns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    modeBtns.forEach(function(b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    container.dataset.mode = btn.dataset.mode;
                    updateView();
                });
            });
        })();
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Rig Placement Calculator
     * 
     * Interactive tool to calculate LED grow light rig requirements.
     * 
     * [gssh_rig_calculator]
     * [gssh_rig_calculator venue="mcg" variety="tiftuf"]
     */
    public static function render_rig_calculator( $atts ) {
        $atts = shortcode_atts( [
            'venue'      => '',
            'variety'    => 'perennial_rye',
            'rig_type'   => 'sgl_mu460',
            'target_dli' => '',
            'days'       => 14,
            'hub_mode'   => 'auto', // auto, true, false
        ], $atts );
        
        // Load required classes
        if ( ! class_exists( 'Gssh_Rig_Placement_Calculator' ) ) {
            require_once dirname( __FILE__ ) . '/class-rig-placement-calculator.php';
        }
        if ( ! class_exists( 'Gssh_Rig_Placement_Visualiser' ) ) {
            require_once dirname( __FILE__ ) . '/class-rig-placement-visualiser.php';
        }
        
        $instance_id = 'gssh-rig-calc-' . wp_rand( 1000, 9999 );
        $rig_manufacturers = Gssh_Rig_Placement_Calculator::get_rig_manufacturers();
        
        // Check if Hub is providing venue (via URL param or shortcode attr)
        $hub_venue = '';
        if ( isset( $_GET['gssh_venue'] ) && ! empty( $_GET['gssh_venue'] ) ) {
            $hub_venue = sanitize_text_field( $_GET['gssh_venue'] );
        } elseif ( ! empty( $atts['venue'] ) ) {
            $hub_venue = $atts['venue'];
        }
        
        // Determine if we're in Hub mode
        $is_hub_mode = false;
        if ( $atts['hub_mode'] === 'true' || ( $atts['hub_mode'] === 'auto' && ! empty( $hub_venue ) ) ) {
            $is_hub_mode = true;
        }
        
        // Get venue name if we have one
        $hub_venue_name = '';
        if ( $hub_venue ) {
            $venue_data = Gssh_Stadium_Database::get_stadium( $hub_venue );
            $hub_venue_name = $venue_data['name'] ?? $hub_venue;
        }
        
        $current_month = (int) date( 'n' );
        
        ob_start();
        ?>
        <div class="gssh-rig-calculator" id="<?php echo esc_attr( $instance_id ); ?>" 
             data-venue="<?php echo esc_attr( $hub_venue ); ?>"
             data-hub-mode="<?php echo $is_hub_mode ? 'true' : 'false'; ?>">
            <style>
                .gssh-rig-calculator { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                .gssh-rig-controls { background: #27272a; padding: 20px; border-radius: 8px 8px 0 0; }
                .gssh-rig-controls-inner { display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end; }
                .gssh-rig-control { display: flex; flex-direction: column; gap: 5px; }
                .gssh-rig-control label { font-size: 12px; font-weight: 600; color: #a1a1aa; }
                .gssh-rig-control select { padding: 8px 12px; background: #3f3f46; border: 1px solid #52525b; color: #fff; border-radius: 4px; font-size: 14px; }
                .gssh-rig-control .rig-spec-hint { font-size: 10px; color: #71717a; margin-top: 2px; }
                .gssh-rig-btn { padding: 10px 24px; background: #22c55e; color: #000; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px; }
                .gssh-rig-btn:hover { background: #16a34a; }
                .gssh-rig-btn:disabled { background: #71717a; cursor: not-allowed; }
                .gssh-rig-results { background: #1a1a2e; border-radius: 0 0 8px 8px; min-height: 300px; }
                .gssh-rig-placeholder { display: flex; align-items: center; justify-content: center; min-height: 300px; color: #71717a; text-align: center; padding: 20px; }
                .gssh-rig-loading { text-align: center; padding: 40px; color: #71717a; }
                .gssh-hub-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #1e3a5f; border: 1px solid #3b82f6; border-radius: 6px; color: #60a5fa; font-size: 13px; }
                @media (max-width: 782px) {
                    .gssh-rig-controls-inner { flex-direction: column; }
                    .gssh-rig-control { width: 100%; }
                }
            </style>
            
            <div class="gssh-rig-controls">
                <div class="gssh-rig-controls-inner">
                    <?php if ( $is_hub_mode ) : ?>
                    <!-- Hub Mode: Simplified controls -->
                    <div class="gssh-rig-control">
                        <div class="gssh-hub-badge">
                            🔗 Synced with Hub
                            <strong class="hub-venue-display"><?php echo $hub_venue_name ? '- ' . esc_html( $hub_venue_name ) : ''; ?></strong>
                        </div>
                    </div>
                    <?php else : ?>
                    <!-- Standalone Mode: Full venue selector -->
                    <div class="gssh-rig-control">
                        <label>Venue</label>
                        <select id="<?php echo esc_attr( $instance_id ); ?>-venue" class="gssh-venue-select">
                            <option value="">-- Select Venue --</option>
                            <?php 
                            $grouped_venues = Gssh_Stadium_Database::get_grouped_stadium_list();
                            foreach ( $grouped_venues as $hemisphere => $countries ) : ?>
                                <optgroup label="<?php echo esc_attr( ucfirst( $hemisphere ) ); ?> Hemisphere">
                                <?php foreach ( $countries as $country => $states ) : ?>
                                    <?php foreach ( $states as $state => $state_venues ) : ?>
                                        <?php foreach ( $state_venues as $id => $name ) : ?>
                                            <option value="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $name ); ?> (<?php echo esc_html( $state ); ?>)</option>
                                        <?php endforeach; ?>
                                    <?php endforeach; ?>
                                <?php endforeach; ?>
                                </optgroup>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <?php endif; ?>
                    
                    <div class="gssh-rig-control">
                        <label>Light Rig</label>
                        <select id="<?php echo esc_attr( $instance_id ); ?>-rig-type">
                            <?php foreach ( $rig_manufacturers as $key => $spec ) : 
                                if ( $key === 'custom' ) continue;
                                $display_name = $spec['manufacturer'] . ' ' . $spec['model'];
                            ?>
                                <option value="<?php echo esc_attr( $key ); ?>" 
                                        data-mol="<?php echo esc_attr( $spec['mol_per_hour'] ); ?>"
                                        data-coverage="<?php echo esc_attr( $spec['coverage_m2'] ); ?>"
                                        <?php selected( $atts['rig_type'], $key ); ?>>
                                    <?php echo esc_html( $display_name ); ?> (<?php echo $spec['coverage_m2']; ?>m²)
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <div class="rig-spec-hint">Output: <span class="rig-mol">1.15</span> mol/h</div>
                    </div>
                    
                    <div class="gssh-rig-control">
                        <label>Analysis Month</label>
                        <select id="<?php echo esc_attr( $instance_id ); ?>-month">
                            <?php 
                            $months = [ 1=>'Jan', 2=>'Feb', 3=>'Mar', 4=>'Apr', 5=>'May', 6=>'Jun',
                                        7=>'Jul', 8=>'Aug', 9=>'Sep', 10=>'Oct', 11=>'Nov', 12=>'Dec' ];
                            foreach ( $months as $num => $name ) : ?>
                                <option value="<?php echo $num; ?>" <?php selected( $current_month, $num ); ?>><?php echo $name; ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    
                    <div class="gssh-rig-control">
                        <button type="button" id="<?php echo esc_attr( $instance_id ); ?>-calculate" class="gssh-rig-btn">
                            Calculate Requirements
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="gssh-rig-results" id="<?php echo esc_attr( $instance_id ); ?>-results">
                <div class="gssh-rig-placeholder">
                    <p><?php echo $is_hub_mode ? 'Click "Calculate Requirements" to analyse rig placement for ' . esc_html( $hub_venue_name ) : 'Select a venue and click "Calculate Requirements"'; ?></p>
                </div>
            </div>
        </div>
        
        <script>
        (function() {
            var container = document.getElementById('<?php echo esc_js( $instance_id ); ?>');
            if (!container) return;
            
            var isHubMode = container.dataset.hubMode === 'true';
            var venueSelect = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-venue');
            var rigTypeSelect = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-rig-type');
            var monthSelect = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-month');
            var calculateBtn = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-calculate');
            var resultsDiv = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-results');
            var hubVenueDisplay = container.querySelector('.hub-venue-display');
            
            // Update rig spec hint
            function updateRigHint() {
                var opt = rigTypeSelect.options[rigTypeSelect.selectedIndex];
                var hint = container.querySelector('.rig-mol');
                if (hint && opt) hint.textContent = opt.dataset.mol || '1.15';
            }
            rigTypeSelect.addEventListener('change', updateRigHint);
            updateRigHint();
            
            // Listen for Hub venue updates
            document.addEventListener('gssh:venueSelect', function(e) {
                if (e.detail && e.detail.venue_id) {
                    container.dataset.venue = e.detail.venue_id;
                    if (hubVenueDisplay) {
                        hubVenueDisplay.textContent = e.detail.venue_name ? '- ' + e.detail.venue_name : '';
                    }
                }
            });
            
            // Calculate button
            calculateBtn.addEventListener('click', function() {
                var venue = container.dataset.venue || (venueSelect ? venueSelect.value : '');
                if (!venue) {
                    alert('Please select a venue first');
                    return;
                }
                
                calculateBtn.disabled = true;
                calculateBtn.textContent = 'Calculating...';
                resultsDiv.innerHTML = '<div class="gssh-rig-loading"><p>Analysing shade patterns and calculating optimal rig placements...</p></div>';
                
                var params = new URLSearchParams({
                    action: 'gssh_rig_calculate',
                    venue: venue,
                    variety: 'auto',
                    rig_type: rigTypeSelect.value,
                    month: monthSelect.value,
                    nonce: (window.GSSH_HUB_CONFIG || {}).nonce || ''
                });
                
                fetch('<?php echo admin_url( 'admin-ajax.php' ); ?>?' + params.toString())
                    .then(function(r) { 
                        if (!r.ok) {
                            throw new Error('Server returned ' + r.status);
                        }
                        return r.text(); 
                    })
                    .then(function(html) {
                        if (!html || html.trim() === '' || html.trim() === '0') {
                            resultsDiv.innerHTML = '<div class="gssh-rig-placeholder"><p>No data returned. Check AJAX handler.</p></div>';
                        } else {
                            resultsDiv.innerHTML = html;
                        }
                        calculateBtn.disabled = false;
                        calculateBtn.textContent = 'Calculate Requirements';
                    })
                    .catch(function(err) {
                        console.error('[RigCalculator] AJAX error:', err);
                        resultsDiv.innerHTML = '<div class="gssh-rig-placeholder"><p>Error: ' + err.message + '</p></div>';
                        calculateBtn.disabled = false;
                        calculateBtn.textContent = 'Calculate Requirements';
                    });
            });
        })();
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Seasonal Planner Shortcode
     * [gssh_seasonal_planner]
     * 
     * Comprehensive seasonal analysis with monthly breakdown, rotation schedules,
     * and deployment recommendations.
     */
    public static function render_seasonal_planner( $atts ) {
        $atts = shortcode_atts( [
            'venue'         => '',
            'variety'       => 'auto',
            'rig_type'      => 'standard',
            'rotation_days' => 5,
            'hub_mode'      => 'auto',
        ], $atts );
        
        $instance_id = 'gssh-seasonal-' . uniqid();
        
        // Check if Hub is providing venue
        $hub_venue = '';
        if ( isset( $_GET['gssh_venue'] ) && ! empty( $_GET['gssh_venue'] ) ) {
            $hub_venue = sanitize_text_field( $_GET['gssh_venue'] );
        } elseif ( ! empty( $atts['venue'] ) ) {
            $hub_venue = $atts['venue'];
        }
        
        $is_hub_mode = ( $atts['hub_mode'] === 'true' || ( $atts['hub_mode'] === 'auto' && ! empty( $hub_venue ) ) );
        
        // Get venue name
        $hub_venue_name = '';
        if ( $hub_venue ) {
            $venue_data = Gssh_Stadium_Database::get_stadium( $hub_venue );
            $hub_venue_name = $venue_data['name'] ?? $hub_venue;
        }
        
        // Get rig types
        $rig_types = Gssh_Rig_Placement_Calculator::get_rig_types();
        
        ob_start();
        ?>
        <div id="<?php echo esc_attr( $instance_id ); ?>" class="gssh-seasonal-planner" 
             data-venue="<?php echo esc_attr( $hub_venue ); ?>"
             data-hub-mode="<?php echo $is_hub_mode ? 'true' : 'false'; ?>"
             style="background: #18181b; color: #fff; padding: 24px; border-radius: 12px; font-family: system-ui, -apple-system, sans-serif;">
            
            <h3 style="margin: 0 0 20px; color: #fff; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                🗓️ Seasonal Supplemental Light Planner
            </h3>
            
            <div class="gssh-seasonal-controls" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; padding: 15px; background: #27272a; border-radius: 8px; align-items: flex-end;">
                
                <?php if ( $is_hub_mode ) : ?>
                <!-- Hub Mode: Show synced venue -->
                <div class="gssh-control">
                    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: #1e3a5f; border: 1px solid #3b82f6; border-radius: 6px; color: #60a5fa; font-size: 13px;">
                        🔗 Synced with Hub
                        <strong class="hub-venue-display"><?php echo $hub_venue_name ? '- ' . esc_html( $hub_venue_name ) : ''; ?></strong>
                    </div>
                </div>
                <?php else : ?>
                <!-- Standalone: Show venue dropdown -->
                <div class="gssh-control" style="flex: 1; min-width: 200px;">
                    <label style="display: block; font-size: 12px; color: #a1a1aa; margin-bottom: 5px;">Venue</label>
                    <select id="<?php echo esc_attr( $instance_id ); ?>-venue" class="gssh-venue-select" style="width: 100%; padding: 10px; background: #3f3f46; border: 1px solid #52525b; color: #fff; border-radius: 6px;">
                        <option value="">-- Select Venue --</option>
                        <?php 
                        $venues = Gssh_Stadium_Database::get_all_stadiums();
                        $grouped_venues = self::group_venues_by_region( $venues );
                        foreach ( $grouped_venues as $hemisphere => $countries ) : ?>
                            <optgroup label="<?php echo esc_attr( ucfirst( $hemisphere ) ); ?> Hemisphere">
                            <?php foreach ( $countries as $country => $states ) : ?>
                                <?php foreach ( $states as $state => $state_venues ) : ?>
                                    <?php foreach ( $state_venues as $id => $name ) : ?>
                                        <option value="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $name ); ?> (<?php echo esc_html( $state ); ?>)</option>
                                    <?php endforeach; ?>
                                <?php endforeach; ?>
                            <?php endforeach; ?>
                            </optgroup>
                        <?php endforeach; ?>
                    </select>
                </div>
                <?php endif; ?>
                
                <div class="gssh-control" style="flex: 0 0 140px;">
                    <label style="display: block; font-size: 12px; color: #a1a1aa; margin-bottom: 5px;">Rig Size</label>
                    <select id="<?php echo esc_attr( $instance_id ); ?>-rig-type" style="width: 100%; padding: 10px; background: #3f3f46; border: 1px solid #52525b; color: #fff; border-radius: 6px;">
                        <?php foreach ( $rig_types as $key => $spec ) : ?>
                            <option value="<?php echo esc_attr( $key ); ?>" <?php selected( $atts['rig_type'], $key ); ?>>
                                <?php echo esc_html( $spec['name'] ); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="gssh-control" style="flex: 0 0 110px;">
                    <label style="display: block; font-size: 12px; color: #a1a1aa; margin-bottom: 5px;">Rotation</label>
                    <select id="<?php echo esc_attr( $instance_id ); ?>-rotation" style="width: 100%; padding: 10px; background: #3f3f46; border: 1px solid #52525b; color: #fff; border-radius: 6px;">
                        <option value="3">3 days</option>
                        <option value="5" selected>5 days</option>
                        <option value="7">7 days</option>
                    </select>
                </div>
                
                <div class="gssh-control" style="flex: 0 0 100px;">
                    <label style="display: block; font-size: 12px; color: #a1a1aa; margin-bottom: 5px;">Currency</label>
                    <select id="<?php echo esc_attr( $instance_id ); ?>-currency" style="width: 100%; padding: 10px; background: #3f3f46; border: 1px solid #52525b; color: #fff; border-radius: 6px;">
                        <option value="GBP" data-symbol="£" data-rate="0.35">£ GBP</option>
                        <option value="AUD" data-symbol="$" data-rate="0.30">$ AUD</option>
                        <option value="USD" data-symbol="$" data-rate="0.15">$ USD</option>
                        <option value="EUR" data-symbol="€" data-rate="0.25">€ EUR</option>
                        <option value="JPY" data-symbol="¥" data-rate="25">¥ JPY</option>
                    </select>
                </div>
                
                <div class="gssh-control" style="flex: 0 0 130px;">
                    <label style="display: block; font-size: 12px; color: #a1a1aa; margin-bottom: 5px;">Electricity Rate</label>
                    <div style="display: flex; align-items: center;">
                        <span id="<?php echo esc_attr( $instance_id ); ?>-currency-symbol" style="padding: 10px; background: #52525b; border: 1px solid #52525b; border-right: none; color: #fff; border-radius: 6px 0 0 6px;">£</span>
                        <input type="number" id="<?php echo esc_attr( $instance_id ); ?>-elec-rate" 
                               value="0.35" min="0" step="0.01" 
                               style="width: 70px; padding: 10px; background: #3f3f46; border: 1px solid #52525b; color: #fff; border-radius: 0 6px 6px 0; -moz-appearance: textfield;">
                        <span style="padding: 10px; color: #71717a; font-size: 11px;">/kWh</span>
                    </div>
                </div>
                
                <div class="gssh-control">
                    <button type="button" id="<?php echo esc_attr( $instance_id ); ?>-analyse" 
                            style="padding: 10px 24px; background: #22c55e; color: #000; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
                        Generate Plan
                    </button>
                </div>
            </div>
            
            <div id="<?php echo esc_attr( $instance_id ); ?>-results">
                <div class="gssh-seasonal-placeholder" style="text-align: center; padding: 40px 20px; background: #27272a; border-radius: 8px; color: #71717a;">
                    <p style="margin: 0;"><?php echo $is_hub_mode ? 'Click "Generate Plan" to see seasonal requirements for ' . esc_html( $hub_venue_name ) : 'Select a venue and click "Generate Plan"'; ?></p>
                </div>
            </div>
            
        </div>
        
        <script>
        (function() {
            var container = document.getElementById('<?php echo esc_js( $instance_id ); ?>');
            var isHubMode = container.dataset.hubMode === 'true';
            var venueSelect = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-venue');
            var rigTypeSelect = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-rig-type');
            var rotationSelect = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-rotation');
            var currencySelect = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-currency');
            var elecRateInput = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-elec-rate');
            var currencySymbol = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-currency-symbol');
            var analyseBtn = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-analyse');
            var resultsDiv = container.querySelector('#<?php echo esc_js( $instance_id ); ?>-results');
            var hubVenueDisplay = container.querySelector('.hub-venue-display');
            
            // Update currency symbol and default rate when currency changes
            currencySelect.addEventListener('change', function() {
                var selected = currencySelect.options[currencySelect.selectedIndex];
                var symbol = selected.dataset.symbol || '£';
                var defaultRate = selected.dataset.rate || '0.25';
                currencySymbol.textContent = symbol;
                elecRateInput.value = defaultRate;
            });
            
            // Listen for Hub venue updates
            document.addEventListener('gssh:venueSelect', function(e) {
                if (e.detail && e.detail.venue_id) {
                    container.dataset.venue = e.detail.venue_id;
                    if (hubVenueDisplay) {
                        hubVenueDisplay.textContent = e.detail.venue_name ? '- ' + e.detail.venue_name : '';
                    }
                }
            });
            
            analyseBtn.addEventListener('click', function() {
                var venue = container.dataset.venue || (venueSelect ? venueSelect.value : '');
                if (!venue) {
                    alert('Please select a venue first');
                    return;
                }
                
                analyseBtn.disabled = true;
                analyseBtn.textContent = 'Analysing...';
                resultsDiv.innerHTML = '<div style="text-align: center; padding: 40px; background: #27272a; border-radius: 8px; color: #a1a1aa;">Calculating seasonal requirements...</div>';
                
                // Get variety from Hub context if available (otherwise use auto)
                var hubVariety = 'auto';
                if (window.GSSH_CONTEXT && window.GSSH_CONTEXT.species) {
                    var speciesMap = {
                        'Perennial Ryegrass': 'perennial_rye',
                        'Bermudagrass': 'tiftuf',
                        'Couch': 'tiftuf',
                        'TifTuf': 'tiftuf',
                        'Kikuyu': 'kikuyu',
                        'Buffalo': 'st_augustine',
                        'Zoysia': 'zoysia',
                        'Bentgrass': 'bentgrass',
                        'Creeping Bentgrass': 'bentgrass',
                        'Tall Fescue': 'tall_fescue',
                        'Kentucky Bluegrass': 'kentucky_blue'
                    };
                    hubVariety = speciesMap[window.GSSH_CONTEXT.species] || 'auto';
                    console.log('[SeasonalPlanner] Using Hub species: ' + window.GSSH_CONTEXT.species + ' → ' + hubVariety);
                }
                
                var params = new URLSearchParams({
                    action: 'gssh_seasonal_plan',
                    venue: venue,
                    variety: hubVariety,
                    rig_type: rigTypeSelect.value,
                    rotation_days: rotationSelect.value,
                    currency: currencySelect.value,
                    elec_rate: elecRateInput.value,
                    nonce: (window.GSSH_HUB_CONFIG || {}).nonce || ''
                });
                
                fetch('<?php echo admin_url( 'admin-ajax.php' ); ?>?' + params.toString())
                    .then(function(r) { 
                        if (!r.ok) {
                            throw new Error('Server returned ' + r.status);
                        }
                        return r.text(); 
                    })
                    .then(function(html) {
                        if (!html || html.trim() === '' || html.trim() === '0') {
                            resultsDiv.innerHTML = '<div style="text-align: center; padding: 40px; background: #27272a; border-radius: 8px; color: #f87171;">No data returned from server. Check if AJAX handler is registered.</div>';
                        } else {
                            resultsDiv.innerHTML = html;
                        }
                        analyseBtn.disabled = false;
                        analyseBtn.textContent = 'Generate Plan';
                    })
                    .catch(function(err) {
                        console.error('[SeasonalPlanner] AJAX error:', err);
                        resultsDiv.innerHTML = '<div style="text-align: center; padding: 40px; background: #27272a; border-radius: 8px; color: #f87171;">Error: ' + err.message + '<br><small style="color:#71717a;">Check browser console for details</small></div>';
                        analyseBtn.disabled = false;
                        analyseBtn.textContent = 'Generate Plan';
                    });
            });
        })();
        </script>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Group venues by region for dropdown display
     * 
     * @param array $venues All venues from database
     * @return array Grouped by hemisphere > country > state
     */
    private static function group_venues_by_region( array $venues ): array {
        $grouped = [
            'southern' => [],
            'northern' => []
        ];
        
        foreach ( $venues as $id => $venue ) {
            $lat = $venue['location']['lat'] ?? $venue['lat'] ?? 0;
            $hemisphere = $lat >= 0 ? 'northern' : 'southern';
            $country = $venue['location']['country'] ?? $venue['country'] ?? 'Unknown';
            $state = $venue['location']['state'] ?? $venue['state'] ?? $venue['region'] ?? 'Unknown';
            $name = $venue['name'] ?? $id;
            
            if ( ! isset( $grouped[ $hemisphere ][ $country ] ) ) {
                $grouped[ $hemisphere ][ $country ] = [];
            }
            if ( ! isset( $grouped[ $hemisphere ][ $country ][ $state ] ) ) {
                $grouped[ $hemisphere ][ $country ][ $state ] = [];
            }
            
            $grouped[ $hemisphere ][ $country ][ $state ][ $id ] = $name;
        }
        
        // Sort venues within each state alphabetically
        foreach ( $grouped as $hemisphere => &$countries ) {
            foreach ( $countries as $country => &$states ) {
                foreach ( $states as $state => &$state_venues ) {
                    asort( $state_venues );
                }
            }
        }
        
        return $grouped;
    }
    
    /**
     * Get monthly ambient DLI for shortcode display
     * 
     * Mirrors the lookup table in Gssh_Rig_Placement_Calculator::get_monthly_ambient_dli()
     * to provide accurate DLI values for non-critical months.
     * 
     * @param float $lat Latitude
     * @param int   $month Month number (1-12)
     * @return float Ambient DLI in mol/m²/day
     */
    private static function get_monthly_ambient_dli_for_shortcode( float $lat, int $month ): float {
        $is_northern = $lat >= 0;
        $abs_lat = abs( $lat );
        
        // Define seasonal patterns by latitude band (matches rig calculator)
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
                // Mid-latitude Southern (Sydney, Melbourne, Campbelltown)
                $pattern = [ 1 => 45, 2 => 40, 3 => 32, 4 => 24, 5 => 18, 6 => 15,
                             7 => 16, 8 => 20, 9 => 28, 10 => 35, 11 => 42, 12 => 48 ];
            } else {
                // Subtropical Southern (Brisbane, Gold Coast)
                $pattern = [ 1 => 42, 2 => 40, 3 => 36, 4 => 30, 5 => 25, 6 => 22,
                             7 => 24, 8 => 28, 9 => 34, 10 => 38, 11 => 40, 12 => 42 ];
            }
        }
        
        return $pattern[ $month ] ?? 25;
    }
}
