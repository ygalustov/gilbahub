/**
 * Gilba Supplemental Light - Admin JS
 */
jQuery(document).ready(function($) {
    
    // ==========================================================================
    // Toggle Panels (Zone Details, Schedule Details, Forecast Details)
    // ==========================================================================
    
    $(document).on('click', '.toggle-btn', function() {
        var $btn = $(this);
        var $panel = $btn.closest('.zone-card, .schedule-section, .forecast-section')
                        .find('.zone-details-panel, .schedule-details-panel, .forecast-details-panel');
        
        // If button is inside a toggle container, find the next sibling panel
        if ($panel.length === 0) {
            $panel = $btn.parent().next('[class$="-panel"]');
        }
        
        var isExpanded = $btn.attr('aria-expanded') === 'true';
        
        $btn.attr('aria-expanded', !isExpanded);
        $btn.find('.toggle-text').text(isExpanded ? 'Show Details' : 'Hide Details');
        
        if (isExpanded) {
            $panel.attr('hidden', true);
        } else {
            $panel.removeAttr('hidden');
        }
    });
    
    // ==========================================================================
    // Zone Filter Buttons
    // ==========================================================================
    
    $(document).on('click', '.filter-btn', function() {
        var $btn = $(this);
        var filter = $btn.data('filter');
        
        // Update active state
        $btn.siblings('.filter-btn').removeClass('active');
        $btn.addClass('active');
        
        // Filter zone cards
        var $cards = $('.zone-card');
        
        if (filter === 'all') {
            $cards.show();
        } else if (filter === 'at-risk') {
            $cards.each(function() {
                var status = $(this).data('status');
                $(this).toggle(status === 'at-risk');
            });
        } else if (filter === 'adequate') {
            $cards.each(function() {
                var status = $(this).data('status');
                $(this).toggle(status === 'adequate');
            });
        }
    });
    
    // ==========================================================================
    // Session Block Tooltips/Click Interactions
    // ==========================================================================
    
    $(document).on('click', '.session-block', function() {
        var sessionData = $(this).data('session');
        if (sessionData) {
            // Could show a modal or expanded details
            console.log('Session details:', sessionData);
        }
    });
    
    // ==========================================================================
    // Chart Bar Hover Effects
    // ==========================================================================
    
    $(document).on('mouseenter', '.chart-bar', function() {
        $(this).find('.bar-value').css('font-weight', '700');
    }).on('mouseleave', '.chart-bar', function() {
        $(this).find('.bar-value').css('font-weight', '600');
    });
    
    // ==========================================================================
    // Tab switching
    // ==========================================================================
    
    $('.tab-btn').on('click', function() {
        var tab = $(this).data('tab');
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        $('.config-panel').removeClass('active');
        $('#panel-' + tab).addClass('active');
    });
    
    // ==========================================================================
    // Modal handling
    // ==========================================================================
    
    function openModal(modalId) {
        $('#' + modalId).show();
    }
    
    function closeModal(modalId) {
        $('#' + modalId).hide();
    }
    
    $('.modal-close').on('click', function() {
        $(this).closest('.modal').hide();
    });
    
    // Close modal on backdrop click
    $(document).on('click', '.modal', function(e) {
        if ($(e.target).hasClass('modal')) {
            $(this).hide();
        }
    });
    
    // Close modal on Escape key
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('.modal:visible').hide();
        }
    });
    
    // ==========================================================================
    // Zone form
    // ==========================================================================
    
    $('#add-zone-btn').on('click', function() {
        $('#zone-modal-title').text('Add Zone');
        $('#zone-form')[0].reset();
        $('#zone_id').val('zone_' + Date.now());
        $('#delete-zone-btn').hide();
        openModal('zone-modal');
    });
    
    $(document).on('click', '.edit-zone-btn', function() {
        var $item = $(this).closest('.zone-item');
        var zoneId = $item.data('zone-id');
        $('#zone-modal-title').text('Edit Zone');
        $('#zone_id').val(zoneId);
        $('#delete-zone-btn').show();
        // Load zone data via AJAX here if needed
        openModal('zone-modal');
    });
    
    // ==========================================================================
    // Equipment form
    // ==========================================================================
    
    $('#add-equipment-btn').on('click', function() {
        $('#equipment-modal-title').text('Add Equipment');
        $('#equipment-form')[0].reset();
        $('#rig_id').val('rig_' + Date.now());
        $('#delete-equipment-btn').hide();
        openModal('equipment-modal');
    });
    
    $(document).on('click', '.edit-equipment-btn', function() {
        var $item = $(this).closest('.equipment-item');
        var rigId = $item.data('rig-id');
        $('#equipment-modal-title').text('Edit Equipment');
        $('#rig_id').val(rigId);
        $('#delete-equipment-btn').show();
        openModal('equipment-modal');
    });
    
    // ==========================================================================
    // Shade factor slider
    // ==========================================================================
    
    $('#manual_shade_factor').on('input', function() {
        var val = Math.round($(this).val() * 100);
        $('#shade-factor-output').text(val + '%');
    });
    
    // Rating slider
    $('#obs_visual_rating').on('input', function() {
        $('#rating-output').text($(this).val());
    });
    
    // ==========================================================================
    // Venue form submit
    // ==========================================================================
    
    $('#venue-form').on('submit', function(e) {
        e.preventDefault();
        var $form = $(this);
        var venueId = $('#venue_id').val();
        
        $.ajax({
            url: gsshLight.ajaxUrl,
            method: 'POST',
            data: {
                action: 'gssh_light_save_venue',
                nonce: gsshLight.nonce,
                venue_id: venueId,
                venue: {
                    venue_name: $('#venue_name').val(),
                    location_lat: $('#location_lat').val(),
                    location_lng: $('#location_lng').val(),
                    location_timezone: $('#location_timezone').val(),
                    currency_code: $('#currency_code').val(),
                    primary_variety: $('#primary_variety').val()
                }
            },
            success: function(response) {
                if (response.success) {
                    alert('Venue saved successfully');
                    if (!$('#gssh-light-config').data('venue-id')) {
                        window.location.href = window.location.href + '&venue=' + venueId;
                    }
                } else {
                    alert('Error: ' + response.data.message);
                }
            }
        });
    });
    
    // ==========================================================================
    // Zone form submit
    // ==========================================================================
    
    $('#zone-form').on('submit', function(e) {
        e.preventDefault();
        var venueId = $('#gssh-light-config').data('venue-id');
        
        $.ajax({
            url: gsshLight.ajaxUrl,
            method: 'POST',
            data: {
                action: 'gssh_light_save_zone',
                nonce: gsshLight.nonce,
                venue_id: venueId,
                zone: {
                    zone_id: $('#zone_id').val(),
                    zone_name: $('#zone_name').val(),
                    zone_type: $('#zone_type').val(),
                    variety: $('#zone_variety').val(),
                    shade_source: $('#shade_source').val(),
                    manual_shade_factor: $('#manual_shade_factor').val(),
                    assigned_rig_id: $('#assigned_rig_id').val(),
                    rig_priority: $('#rig_priority').val(),
                    target_mode: $('#target_mode').val(),
                    enabled: $('#zone_enabled').is(':checked'),
                    notes: $('#zone_notes').val()
                }
            },
            success: function(response) {
                if (response.success) {
                    closeModal('zone-modal');
                    location.reload();
                } else {
                    alert('Error: ' + response.data.message);
                }
            }
        });
    });
    
    // ==========================================================================
    // Equipment form submit
    // ==========================================================================
    
    $('#equipment-form').on('submit', function(e) {
        e.preventDefault();
        var venueId = $('#gssh-light-config').data('venue-id');
        
        $.ajax({
            url: gsshLight.ajaxUrl,
            method: 'POST',
            data: {
                action: 'gssh_light_save_equipment',
                nonce: gsshLight.nonce,
                venue_id: venueId,
                equipment: {
                    rig_id: $('#rig_id').val(),
                    rig_name: $('#rig_name').val(),
                    manufacturer: $('#manufacturer').val(),
                    model: $('#model').val(),
                    ppfd_at_canopy: $('#ppfd_at_canopy').val(),
                    uniformity_factor: $('#uniformity_factor').val(),
                    coverage_area_sqm: $('#coverage_area_sqm').val(),
                    max_daily_operation: $('#max_daily_operation').val(),
                    power_draw_kw: $('#power_draw_kw').val(),
                    energy_cost_per_kwh: $('#energy_cost_per_kwh').val()
                }
            },
            success: function(response) {
                if (response.success) {
                    closeModal('equipment-modal');
                    location.reload();
                } else {
                    alert('Error: ' + response.data.message);
                }
            }
        });
    });
    
    // ==========================================================================
    // Constraints form submit
    // ==========================================================================
    
    $('#constraints-form').on('submit', function(e) {
        e.preventDefault();
        var venueId = $('#gssh-light-config').data('venue-id');
        
        $.ajax({
            url: gsshLight.ajaxUrl,
            method: 'POST',
            data: {
                action: 'gssh_light_save_constraints',
                nonce: gsshLight.nonce,
                venue_id: venueId,
                constraints: {
                    energy_tariff: {
                        peak_rate: $('#peak_rate').val(),
                        off_peak_rate: $('#off_peak_rate').val(),
                        peak_hours: {
                            start: $('#peak_hours_start').val(),
                            end: $('#peak_hours_end').val()
                        },
                        optimise_for_cost: $('#optimise_for_cost').is(':checked')
                    },
                    noise_restrictions: {
                        enabled: $('#noise_enabled').is(':checked'),
                        quiet_hours_start: $('#quiet_hours_start').val(),
                        quiet_hours_end: $('#quiet_hours_end').val()
                    }
                }
            },
            success: function(response) {
                if (response.success) {
                    alert('Constraints saved');
                } else {
                    alert('Error: ' + response.data.message);
                }
            }
        });
    });
    
    // ==========================================================================
    // Observation form
    // ==========================================================================
    
    $('#log-observation-btn').on('click', function() {
        $('#observation-form-section').show();
    });
    
    $('#cancel-observation-btn').on('click', function() {
        $('#observation-form-section').hide();
    });
    
    $('#observation-form').on('submit', function(e) {
        e.preventDefault();
        var venueId = $('input[name="venue_id"]').val();
        
        $.ajax({
            url: gsshLight.ajaxUrl,
            method: 'POST',
            data: {
                action: 'gssh_light_log_observation',
                nonce: gsshLight.nonce,
                venue_id: venueId,
                observation: {
                    zone_id: $('#obs_zone_id').val(),
                    date: $('#obs_date').val(),
                    visual_rating: $('#obs_visual_rating').val(),
                    notes: $('#obs_notes').val()
                }
            },
            success: function(response) {
                if (response.success) {
                    alert('Observation logged');
                    location.reload();
                } else {
                    alert('Error: ' + response.data.message);
                }
            }
        });
    });
    
    // ==========================================================================
    // Delete handlers
    // ==========================================================================
    
    $('#delete-zone-btn').on('click', function() {
        if (!confirm('Delete this zone?')) return;
        var venueId = $('#gssh-light-config').data('venue-id');
        var zoneId = $('#zone_id').val();
        
        $.ajax({
            url: gsshLight.ajaxUrl,
            method: 'POST',
            data: {
                action: 'gssh_light_delete_zone',
                nonce: gsshLight.nonce,
                venue_id: venueId,
                zone_id: zoneId
            },
            success: function(response) {
                if (response.success) {
                    closeModal('zone-modal');
                    location.reload();
                }
            }
        });
    });
    
    $('#delete-equipment-btn').on('click', function() {
        if (!confirm('Delete this equipment?')) return;
        var venueId = $('#gssh-light-config').data('venue-id');
        var rigId = $('#rig_id').val();
        
        $.ajax({
            url: gsshLight.ajaxUrl,
            method: 'POST',
            data: {
                action: 'gssh_light_delete_equipment',
                nonce: gsshLight.nonce,
                venue_id: venueId,
                rig_id: rigId
            },
            success: function(response) {
                if (response.success) {
                    closeModal('equipment-modal');
                    location.reload();
                }
            }
        });
    });
    
    // ==========================================================================
    // Auto-refresh analysis (optional - every 5 minutes)
    // ==========================================================================
    
    // Uncomment to enable auto-refresh
    // setInterval(function() {
    //     if ($('.gssh-analysis-display').length) {
    //         location.reload();
    //     }
    // }, 300000);
});
