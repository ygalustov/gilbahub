<?php
/**
 * Gilba Lab Report Parser
 * 
 * Extracts soil, water, and tissue test results from uploaded PDF/DOCX documents
 * using the Claude API. Returns structured data matching GAIP Hub field schemas.
 * 
 * @package Gilba_Hub
 * @version 1.0.0
 * @since 10.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Gilba_Lab_Parser {
    
    /** @var string Claude API endpoint */
    private $api_url = 'https://api.anthropic.com/v1/messages';
    
    /** @var string API key */
    private $api_key;
    
    /** @var int Max file size in bytes (10MB) */
    private $max_file_size = 10485760;
    
    /** @var array Allowed MIME types */
    private $allowed_types = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'text/csv'
    ];
    
    public function __construct() {
        $this->api_key = defined( 'GILBA_CLAUDE_API_KEY' ) ? GILBA_CLAUDE_API_KEY : '';
    }
    
    public function is_configured() {
        return ! empty( $this->api_key );
    }
    
    /**
     * Parse uploaded file and extract lab results
     * 
     * @param array $file $_FILES entry
     * @return array Parsed results or error
     */
    public function parse_file( $file ) {
        
        if ( ! $this->is_configured() ) {
            return [ 'success' => false, 'error' => 'Claude API key not configured' ];
        }
        
        // Validate file
        if ( $file['size'] > $this->max_file_size ) {
            return [ 'success' => false, 'error' => 'File too large (max 10MB)' ];
        }
        
        $mime = $file['type'];
        $ext = strtolower( pathinfo( $file['name'], PATHINFO_EXTENSION ) );
        
        // Extract text content based on file type
        $text_content = '';
        $is_pdf = false;
        
        if ( $ext === 'pdf' || $mime === 'application/pdf' ) {
            $is_pdf = true;
            // Read PDF as base64 for Claude vision
            $file_data = file_get_contents( $file['tmp_name'] );
            if ( $file_data === false ) {
                return [ 'success' => false, 'error' => 'Could not read uploaded file' ];
            }
        } elseif ( $ext === 'docx' || strpos( $mime, 'wordprocessing' ) !== false ) {
            $text_content = $this->extract_docx_text( $file['tmp_name'] );
            if ( empty( $text_content ) ) {
                return [ 'success' => false, 'error' => 'Could not extract text from DOCX' ];
            }
        } elseif ( $ext === 'doc' || $mime === 'application/msword' ) {
            return [ 'success' => false, 'error' => 'Old .doc format not supported. Please save as .docx or PDF.' ];
        } elseif ( $ext === 'csv' || $ext === 'txt' ) {
            $text_content = file_get_contents( $file['tmp_name'] );
            // b35fix118b: schema validation — detect import type from headers and
            // reject files with wrong/missing required columns before hitting Claude.
            $csv_validation = $this->validate_csv_schema( $text_content, $file['name'] );
            if ( ! $csv_validation['valid'] ) {
                return [
                    'success' => false,
                    'error'   => $csv_validation['error'],
                    'hint'    => $csv_validation['hint'] ?? '',
                ];
            }
        } else {
            return [ 'success' => false, 'error' => 'Unsupported file type: ' . $ext ];
        }
        
        // Build and send extraction prompt
        $prompt = $this->build_extraction_prompt();
        
        if ( $is_pdf ) {
            $response = $this->call_claude_with_pdf( $file_data, $prompt );
        } else {
            $response = $this->call_claude_with_text( $text_content, $prompt, $file['name'] );
        }
        
        if ( is_wp_error( $response ) ) {
            return [ 'success' => false, 'error' => $response->get_error_message() ];
        }
        
        // Parse Claude's JSON response
        $raw_text = $response['content'][0]['text'] ?? '';
        $parsed = $this->extract_json( $raw_text );
        
        if ( ! $parsed ) {
            return [ 
                'success' => false, 
                'error' => 'Could not parse extraction results',
                'raw' => $raw_text 
            ];
        }
        
        // Validate and normalize
        $result = $this->normalize_results( $parsed );
        $result['success'] = true;
        $result['filename'] = $file['name'];
        
        return $result;
    }
    
    /**
     * Build the extraction prompt with exact field schemas
     */
    private function build_extraction_prompt() {
        return <<<'PROMPT'
You are a lab report data extraction engine for a turf agronomic decision-support system.

Extract ALL soil test, water quality, and tissue test results from the document. Return ONLY valid JSON, no markdown fences, no commentary.

IMPORTANT RULES:
- Extract numeric values only. Do not include units in values.
- If a value is "<0.01" or similar detection-limit notation, use 0 (or omit).
- If a value is not present, omit the key entirely (do not use null or 0).
- If multiple samples/dates exist, return each as a separate entry in the arrays.
- Soil nutrients must be in mg/kg (ppm). If reported in meq/100g, multiply: K×391, Ca×200, Mg×121.5, Na×230.
- Water ions must be in mg/L (ppm). ALWAYS use the ppm column, not meq/L.
  If only meq/L available, multiply: Ca×20.04, Mg×12.15, Na×23.0, K×39.1, Cl×35.45, SO4×48.03, HCO3×61.02, CO3×30.0.
- CRITICAL: Many Australian/NZ labs report "Sulphate (S)" meaning sulphur as sulphate, NOT sulphate as SO4.
  If reported as S or SO4-S: multiply by 3.0 to get SO4 (e.g., S=25.1 → SO4=75.3).
  If clearly labelled "SO4" or "Sulphate as SO4", use the value directly.
  State which conversion you applied in "notes".
- Tissue macros must be in % dry weight. Traces in mg/kg (ppm).
- pH: report pH_water and pH_CaCl2 separately if both available.
- EC: report as dS/m. mS/cm = dS/m (same value). If in µS/cm, divide by 1000.
- For each result, include a confidence score (0-100) for your extraction accuracy.
- Look for data in tables, grids, spreadsheet-style layouts, and narrative text.
- If the document is a consulting report (not a raw lab report), it may contain interpreted results alongside raw data. Extract the RAW lab values, not calculated indices.

REQUIRED JSON STRUCTURE:
{
  "document_info": {
    "lab_name": "string or null",
    "report_date": "YYYY-MM-DD or null",
    "client_name": "string or null",
    "site_name": "string or null"
  },
  "soil": [
    {
      "label": "Human-readable sample name (e.g. 'Green 1', 'Fairway 3', 'Bore Water'). For Hill Labs NZ: use the Sample Name field (column 2 of data rows), NOT the internal job reference code. If the report shows both a client description and a lab code, use the client description.",
      "date": "YYYY-MM-DD",
      "zone": "green/fairway/tee/approach/surrounds or null",
      "pH_water": 6.2,
      "pH_CaCl2": 5.8,
      "EC1_5": 0.12,
      "CEC": 8.5,
      "OM": 2.1,
      "LOI_0_2": null,
      "LOI_2_4": null,
      "LOI_4_6": null,
      "texture": "sand/loam/clay/sandy loam",
      "K": 45, "P": 12, "Ca": 680, "Mg": 85, "S": 15,
      "Fe": 120, "Mn": 8.5, "Cu": 1.2, "Zn": 3.4, "B": 0.8, "Na": 25,
      "confidence": 95,
      "notes": "any extraction notes or unit conversions applied"
    }
  ],
  "water": [
    {
      "label": "Human-readable sample name — prefer client-supplied name over lab internal code",
      "date": "YYYY-MM-DD",
      "source": "bore/dam/recycled/mains or null",
      "pH": 7.2,
      "EC": 0.85,
      "Ca": 40, "Mg": 18, "Na": 95, "K": 5,
      "Cl": 120, "SO4": 45, "HCO3": 180, "CO3": 0,
      "B": 0.3, "Fe": 0.1, "Mn": 0.02, "NO3": 5, "PO4": 0.5,
      "confidence": 90,
      "notes": ""
    }
  ],
  "tissue": [
    {
      "label": "Human-readable sample name — prefer client-supplied name over lab internal code",
      "date": "YYYY-MM-DD",
      "species": "species name if mentioned",
      "N": 4.2, "P": 0.35, "K": 2.8, "Ca": 0.45, "Mg": 0.25, "S": 0.35,
      "Fe": 150, "Mn": 45, "Zn": 28, "Cu": 8, "B": 10, "Na": 200,
      "Mo": null, "Cl": null,
      "confidence": 85,
      "notes": ""
    }
  ],
  "extraction_notes": "Any overall notes about the extraction, e.g. unit conversions applied, ambiguous values"
}

If a category (soil/water/tissue) has no results in the document, return an empty array for that category.

KNOWN AUSTRALIAN/NZ LAB FORMATS:
- Westgate Labs: "Sulphate (S)" in ppm = sulphur, multiply ×3.0 for SO4. Cations/Anions shown in ppm and meq/L columns. Use the ppm column.
- SWEP Analytical: Reports soil nutrients in mg/kg. EC as dS/m. May include "Colwell P" (= P in ppm).
- Hill Labs (NZ) — STANDARD TURF (S-codes other than S78): Uses "Olsen P" for phosphorus. Ammonium acetate extraction for K/Ca/Mg/Na. Units clearly labelled. Sample names appear in column 2 of the data table (e.g. "Green 1", "Green 13") — use these as labels, NOT the internal lab codes (e.g. "Soil_1_o5a5") which appear as the sample ID in column 1.
- Hill Labs (NZ) — TURF COTULA (Sample Type Code S78): This is a SPECIAL CASE requiring different field names.
  The report will show "Sample Type: TURF Cotula (S78)" or "TURF Cotula" in the sample type field.
  DO NOT convert values to ppm. Output them in THEIR REPORTED UNITS using these field names:
    "is_cotula_s78": true,
    "pH": [value in pH units],
    "P_olsen": [Olsen Phosphorus in mg/L — exactly as reported],
    "K_pct_bs": [Potassium %BS value],
    "K_me": [Potassium me/100g value],
    "Ca_pct_bs": [Calcium %BS value],
    "Ca_me": [Calcium me/100g value],
    "Mg_pct_bs": [Magnesium %BS value],
    "Mg_me": [Magnesium me/100g value],
    "Na_pct_bs": [Sodium %BS value],
    "Na_me": [Sodium me/100g value],
    "CEC": [CEC me/100g],
    "TBS": [Total Base Saturation %],
    "VW": [Volume Weight g/mL],
    "K_Mg_ratio": [K/Mg Ratio — dimensionless],
    "sample_depth_mm": [e.g. 75 for 0-75mm depth],
    "soil_type": ["Sedimentary" or as reported]
  Do NOT populate the standard ppm K/Ca/Mg/Na/P fields for cotula S78 samples.
  Set zone to "cotula_bowling_green" for all S78 samples.
- STRI (UK): Mehlich 3 extraction. Units in mg/L (equivalent to ppm for soil tests). "Loss on Ignition" = OM%.
- CSBP (WA): Colwell P, Colwell K, KCl extractable S. EC 1:5 in dS/m.
- Consultant reports (like Gilba Solutions): May contain raw lab data within narrative. Look for tables with nutrient values.
PROMPT;
    }
    
    /**
     * Call Claude with PDF document (using document type)
     */
    private function call_claude_with_pdf( $file_data, $prompt ) {
        $base64 = base64_encode( $file_data );
        
        $body = [
            'model' => 'claude-sonnet-4-5-20250929',
            'max_tokens' => 4096,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'document',
                            'source' => [
                                'type' => 'base64',
                                'media_type' => 'application/pdf',
                                'data' => $base64
                            ]
                        ],
                        [
                            'type' => 'text',
                            'text' => $prompt
                        ]
                    ]
                ]
            ]
        ];
        
        return $this->send_request( $body );
    }
    
    /**
     * Call Claude with text content
     */
    private function call_claude_with_text( $text_content, $prompt, $filename ) {
        // Truncate very long docs to avoid token limits
        if ( strlen( $text_content ) > 100000 ) {
            $text_content = substr( $text_content, 0, 100000 ) . "\n\n[Document truncated at 100KB]";
        }
        
        $body = [
            'model' => 'claude-sonnet-4-5-20250929',
            'max_tokens' => 4096,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt . "\n\n---\nDOCUMENT FILENAME: {$filename}\n\nDOCUMENT CONTENT:\n\n" . $text_content
                ]
            ]
        ];
        
        return $this->send_request( $body );
    }
    
    /**
     * Send request to Claude API
     */
    private function send_request( $body ) {
        $response = wp_remote_post( $this->api_url, [
            'timeout' => 60,
            'headers' => [
                'Content-Type'      => 'application/json',
                'x-api-key'         => $this->api_key,
                'anthropic-version' => '2023-06-01',
            ],
            'body' => wp_json_encode( $body ),
        ]);
        
        if ( is_wp_error( $response ) ) {
            error_log( '[Gilba Lab Parser] API error: ' . $response->get_error_message() );
            return $response;
        }
        
        $code = wp_remote_retrieve_response_code( $response );
        $result = json_decode( wp_remote_retrieve_body( $response ), true );
        
        if ( $code !== 200 ) {
            $error_msg = $result['error']['message'] ?? "API returned status {$code}";
            error_log( '[Gilba Lab Parser] API error: ' . $error_msg );
            return new WP_Error( 'claude_api_error', $error_msg );
        }
        
        return $result;
    }
    
    /**
     * Extract text from DOCX file
     */
    private function extract_docx_text( $filepath ) {
        $zip = new ZipArchive();
        if ( $zip->open( $filepath ) !== true ) {
            return '';
        }
        
        $xml = $zip->getFromName( 'word/document.xml' );
        $zip->close();
        
        if ( empty( $xml ) ) {
            return '';
        }
        
        // Strip XML tags, preserve structure with newlines
        $text = preg_replace( '/<w:p[^>]*>/', "\n", $xml );
        $text = preg_replace( '/<w:tab[^>]*\/>/', "\t", $text );
        $text = strip_tags( $text );
        $text = html_entity_decode( $text, ENT_QUOTES, 'UTF-8' );
        
        // Also try to extract tables from document.xml
        $tables = $this->extract_docx_tables( $xml );
        if ( ! empty( $tables ) ) {
            $text .= "\n\n=== TABLES ===\n" . $tables;
        }
        
        return trim( $text );
    }
    
    /**
     * Extract table data from DOCX XML
     */
    private function extract_docx_tables( $xml ) {
        $output = '';
        
        // Match table rows
        preg_match_all( '/<w:tr\b[^>]*>(.*?)<\/w:tr>/s', $xml, $rows );
        
        if ( empty( $rows[1] ) ) {
            return '';
        }
        
        foreach ( $rows[1] as $row ) {
            preg_match_all( '/<w:tc\b[^>]*>(.*?)<\/w:tc>/s', $row, $cells );
            
            if ( ! empty( $cells[1] ) ) {
                $cell_values = [];
                foreach ( $cells[1] as $cell ) {
                    $val = strip_tags( $cell );
                    $val = html_entity_decode( $val, ENT_QUOTES, 'UTF-8' );
                    $cell_values[] = trim( $val );
                }
                $output .= implode( "\t", $cell_values ) . "\n";
            }
        }
        
        return $output;
    }
    
    /**
     * Extract JSON from Claude response (handles markdown fences)
     */
    private function extract_json( $text ) {
        // Try direct parse first
        $parsed = json_decode( $text, true );
        if ( $parsed && is_array( $parsed ) ) {
            return $parsed;
        }
        
        // Strip markdown code fences
        $text = preg_replace( '/^```(?:json)?\s*/m', '', $text );
        $text = preg_replace( '/\s*```\s*$/m', '', $text );
        $text = trim( $text );
        
        $parsed = json_decode( $text, true );
        if ( $parsed && is_array( $parsed ) ) {
            return $parsed;
        }
        
        // Try to find JSON block in response
        if ( preg_match( '/\{[\s\S]*\}/', $text, $match ) ) {
            $parsed = json_decode( $match[0], true );
            if ( $parsed && is_array( $parsed ) ) {
                return $parsed;
            }
        }
        
        return null;
    }
    
    /**
     * Normalize extracted results to match GAIP field schemas
     */
    private function normalize_results( $parsed ) {
        $result = [
            'document_info' => $parsed['document_info'] ?? [],
            'soil' => [],
            'water' => [],
            'tissue' => [],
            'extraction_notes' => $parsed['extraction_notes'] ?? ''
        ];
        
        // Normalize soil samples
        foreach ( ($parsed['soil'] ?? []) as $sample ) {
            $normalized = [
                'label' => $sample['label'] ?? 'Soil Sample',
                'date' => $sample['date'] ?? null,
                'zone' => $sample['zone'] ?? null,
                'confidence' => $sample['confidence'] ?? 50,
                'notes' => $sample['notes'] ?? '',
                'values' => []
            ];
            
            // Map to GAIP soil field keys
            $soil_keys = [
                'pH_water' => 'pH_Water', 'pH_CaCl2' => 'pH_CaCl2',
                'EC1_5' => 'EC1_5', 'CEC' => 'CEC_meq100g',
                'OM' => 'OM_Percent', 'texture' => 'Texture',
                'LOI_0_2' => 'LOI_0_2', 'LOI_2_4' => 'LOI_2_4', 'LOI_4_6' => 'LOI_4_6',
                'K' => 'K', 'P' => 'P', 'Ca' => 'Ca', 'Mg' => 'Mg', 'S' => 'S',
                'Fe' => 'Fe', 'Mn' => 'Mn', 'Cu' => 'Cu', 'Zn' => 'Zn',
                'B' => 'B', 'Na' => 'Na'
            ];
            
            foreach ( $soil_keys as $src => $dst ) {
                if ( isset( $sample[ $src ] ) && $sample[ $src ] !== null ) {
                    $normalized['values'][ $dst ] = $sample[ $src ];
                }
            }
            
            $result['soil'][] = $normalized;
        }
        
        // Normalize water samples
        foreach ( ($parsed['water'] ?? []) as $sample ) {
            $normalized = [
                'label' => $sample['label'] ?? 'Water Sample',
                'date' => $sample['date'] ?? null,
                'source' => $sample['source'] ?? null,
                'confidence' => $sample['confidence'] ?? 50,
                'notes' => $sample['notes'] ?? '',
                'values' => []
            ];
            
            $water_keys = [
                'pH' => 'pH', 'EC' => 'EC',
                'Ca' => 'Ca', 'Mg' => 'Mg', 'Na' => 'Na', 'K' => 'K',
                'Cl' => 'Cl', 'SO4' => 'SO4', 'HCO3' => 'HCO3', 'CO3' => 'CO3',
                'B' => 'B', 'Fe' => 'Fe', 'Mn' => 'Mn', 'NO3' => 'NO3', 'PO4' => 'PO4'
            ];
            
            foreach ( $water_keys as $src => $dst ) {
                if ( isset( $sample[ $src ] ) && $sample[ $src ] !== null ) {
                    $normalized['values'][ $dst ] = $sample[ $src ];
                }
            }
            
            $result['water'][] = $normalized;
        }
        
        // Normalize tissue samples
        foreach ( ($parsed['tissue'] ?? []) as $sample ) {
            $normalized = [
                'label' => $sample['label'] ?? 'Tissue Sample',
                'date' => $sample['date'] ?? null,
                'species' => $sample['species'] ?? null,
                'confidence' => $sample['confidence'] ?? 50,
                'notes' => $sample['notes'] ?? '',
                'values' => []
            ];
            
            $tissue_keys = [
                'N' => 'N', 'P' => 'P', 'K' => 'K',
                'Ca' => 'Ca', 'Mg' => 'Mg', 'S' => 'S',
                'Fe' => 'Fe', 'Mn' => 'Mn', 'Zn' => 'Zn', 'Cu' => 'Cu',
                'B' => 'B', 'Na' => 'Na', 'Mo' => 'Mo', 'Cl' => 'Cl'
            ];
            
            foreach ( $tissue_keys as $src => $dst ) {
                if ( isset( $sample[ $src ] ) && $sample[ $src ] !== null ) {
                    $normalized['values'][ $dst ] = $sample[ $src ];
                }
            }
            
            $result['tissue'][] = $normalized;
        }
        
        return $result;
    }

    /**
     * b35fix118b: Validate CSV header schema before sending to Claude.
     *
     * Detects import type (soil / tissue / water) from the first-row headers,
     * checks required columns are present, and returns a user-visible error
     * with a specific list of missing columns if validation fails.
     *
     * Required sets are intentionally minimal — enough to confirm the user
     * uploaded the right template, without rejecting custom lab exports that
     * include extra columns.
     *
     * @param  string $csv_text  Raw CSV text content.
     * @param  string $filename  Original filename (for error context).
     * @return array  { valid: bool, type: string|null, error: string, hint: string }
     */
    private function validate_csv_schema( $csv_text, $filename ) {

        // Parse first line only — enough for header detection.
        $lines = preg_split( '/\r\n|\r|\n/', trim( $csv_text ) );
        if ( empty( $lines ) || empty( $lines[0] ) ) {
            return [
                'valid' => false,
                'type'  => null,
                'error' => 'CSV file appears to be empty.',
                'hint'  => 'Download a template from the Lab Import panel and re-export from your lab software into that format.',
            ];
        }

        // Normalise headers: lowercase, strip quotes and extra whitespace.
        $raw_headers = str_getcsv( $lines[0] );
        $headers     = array_map( function( $h ) {
            return strtolower( trim( str_replace( [ '"', "'" ], '', $h ) ) );
        }, $raw_headers );

        if ( count( $headers ) < 3 ) {
            return [
                'valid' => false,
                'type'  => null,
                'error' => 'CSV has fewer than 3 columns. Check the file is comma-separated and not empty.',
                'hint'  => 'Open the file in a text editor and confirm columns are separated by commas.',
            ];
        }

        $hset = array_flip( $headers ); // O(1) lookup

        // ── Type detection ────────────────────────────────────────────────────
        // Water:   contains hco3 or so4 (distinctive water-quality markers)
        // Tissue:  contains 'n' column but NOT 'hco3'/'so4' and NOT 'cec'
        // Soil:    everything else with 'ph' and 'ec'

        $has_hco3 = isset( $hset['hco3'] );
        $has_so4  = isset( $hset['so4'] );
        $has_n    = isset( $hset['n'] );
        $has_cec  = isset( $hset['cec'] );
        $has_ph   = isset( $hset['ph'] );

        if ( $has_hco3 || $has_so4 ) {
            $type = 'water';
        } elseif ( $has_n && ! $has_cec ) {
            $type = 'tissue';
        } elseif ( $has_ph || $has_cec ) {
            $type = 'soil';
        } else {
            // Cannot identify type — still let Claude try, but warn.
            return [
                'valid' => true,
                'type'  => 'unknown',
                'error' => '',
                'hint'  => '',
            ];
        }

        // ── Required column sets ──────────────────────────────────────────────
        $required = [
            'soil'    => [ 'sample id', 'date', 'ph', 'ec', 'k', 'ca', 'mg' ],
            'tissue'  => [ 'sample id', 'date', 'n', 'p', 'k', 'ca', 'mg' ],
            'water'   => [ 'sample id', 'date', 'ph', 'ec', 'ca', 'mg', 'na', 'cl' ],
        ];

        // Accept 'sample id' OR 'sample_id' OR 'sampleid' OR 'id' as the identifier.
        $id_aliases = [ 'sample id', 'sample_id', 'sampleid', 'id', 'sample name', 'label' ];

        $req_cols  = $required[ $type ] ?? [];
        $missing   = [];

        foreach ( $req_cols as $col ) {
            if ( $col === 'sample id' ) {
                // Check any accepted ID alias.
                $found = false;
                foreach ( $id_aliases as $alias ) {
                    if ( isset( $hset[ $alias ] ) ) { $found = true; break; }
                }
                if ( ! $found ) $missing[] = 'Sample ID';
            } elseif ( ! isset( $hset[ $col ] ) ) {
                $missing[] = strtoupper( $col );
            }
        }

        if ( ! empty( $missing ) ) {
            $type_label = ucfirst( $type );
            return [
                'valid' => false,
                'type'  => $type,
                'error' => sprintf(
                    'This looks like a %s import but is missing required column(s): %s.',
                    $type_label,
                    implode( ', ', $missing )
                ),
                'hint'  => sprintf(
                    'Download the %s template from the Lab Import panel. Required columns are: %s.',
                    $type_label,
                    implode( ', ', array_map( 'strtoupper', $req_cols ) )
                ),
            ];
        }

        // ── Row count sanity check ────────────────────────────────────────────
        $data_rows = count( $lines ) - 1; // exclude header
        if ( $data_rows < 1 ) {
            return [
                'valid' => false,
                'type'  => $type,
                'error' => ucfirst( $type ) . ' CSV has no data rows (header only).',
                'hint'  => 'Add at least one sample row below the header.',
            ];
        }

        return [
            'valid' => true,
            'type'  => $type,
            'error' => '',
            'hint'  => '',
        ];
    }
}
