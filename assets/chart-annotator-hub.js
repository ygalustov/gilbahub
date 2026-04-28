/**
 * chart-annotator-hub.js
 * Gilba Agronomic Intelligence Hub — Chart Annotator Modal Integration
 *
 * Public API:
 *   GilbaAnnotator.open(svgElement, title)   — open modal with an SVG chart
 *   GilbaAnnotator.openFromDataURL(dataURL, title) — open with existing PNG/dataURL
 *
 * Usage (from any hub chart section):
 *   var svg = container.querySelector('svg.gilba-chart');
 *   GilbaAnnotator.open(svg, 'Disease Risk — Fairway 3');
 *
 * Adds an "Annotate" button to every .gaip-chart-header found on the page.
 * Call GilbaAnnotator.attachButtons() after dynamic chart renders.
 *
 * v1.0.0 — 2026-03-08
 */

var GilbaAnnotator = (function () {
    'use strict';

    // ── Namespace prefix for all IDs to avoid hub DOM collisions ──────────────
    var NS = 'gilba-ann-';

    // ── State ─────────────────────────────────────────────────────────────────
    var _injected = false;
    var _state = {
        tool: 'pen',
        color: '#dc2626',
        strokeWidth: 2,
        opacity: 1.0,
        drawing: false,
        startX: 0, startY: 0,
        lastX: 0, lastY: 0,
        history: [],
        redoStack: [],
        annotationCount: 0,
        textLabel: 'Apply here',
        fontSize: 16,
        chartTitle: ''
    };
    var _snapshot = null;

    // ── SVG → Canvas rasteriser (mirrors word-export.js approach) ─────────────
    function svgToDataURL(svgEl) {
        return new Promise(function (resolve, reject) {
            try {
                var clone = svgEl.cloneNode(true);
                if (!clone.getAttribute('xmlns')) {
                    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                }

                // Resolve viewBox dimensions
                var vb = svgEl.getAttribute('viewBox');
                var width, height;
                if (vb) {
                    var parts = vb.split(/[\s,]+/);
                    width = parseFloat(parts[2]);
                    height = parseFloat(parts[3]);
                } else {
                    var rect = svgEl.getBoundingClientRect();
                    width = rect.width || 640;
                    height = rect.height || 280;
                }

                var svgData = new XMLSerializer().serializeToString(clone);
                var canvas = document.createElement('canvas');
                var scale = 2;
                canvas.width = width * scale;
                canvas.height = height * scale;
                var ctx = canvas.getContext('2d');
                ctx.scale(scale, scale);
                ctx.fillStyle = 'var(--gaip-surface)';
                ctx.fillRect(0, 0, width, height);

                var img = new Image();
                var blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                var url = URL.createObjectURL(blob);

                img.onload = function () {
                    ctx.drawImage(img, 0, 0, width, height);
                    URL.revokeObjectURL(url);
                    resolve({ dataURL: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height });
                };
                img.onerror = function () {
                    URL.revokeObjectURL(url);
                    reject(new Error('[GilbaAnnotator] SVG rasterisation failed'));
                };
                img.src = url;
            } catch (e) {
                reject(e);
            }
        });
    }

    // ── Modal HTML ────────────────────────────────────────────────────────────
    var MODAL_HTML = [
        '<div id="' + NS + 'overlay" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:none;align-items:center;justify-content:center;">',
        '  <div id="' + NS + 'modal" style="',
        '    width:96vw;max-width:1100px;height:92vh;',
        '    background:var(--gaip-surface-muted);border-radius:12px;',
        '    display:flex;flex-direction:column;overflow:hidden;',
        '    box-shadow:0 24px 64px rgba(0,0,0,0.5);',
        '    font-family:\'DM Sans\',system-ui,sans-serif;">',

        // ── Top bar ──
        '    <div id="' + NS + 'topbar" style="',
        '      height:52px;background:var(--gaip-text);display:flex;align-items:center;',
        '      padding:0 16px;gap:12px;flex-shrink:0;border-radius:12px 12px 0 0;',
        '      border-bottom:1px solid var(--gaip-text);">',
        '      <span style="color:#10b981;font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px;">',
        '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
        '        </svg>Annotate',
        '      </span>',
        '      <div style="width:1px;height:22px;background:var(--gaip-text);"></div>',
        '      <span id="' + NS + 'chart-label" style="',
        '        font-size:12px;color:var(--gaip-text-muted);background:#2d3748;',
        '        padding:3px 10px;border-radius:4px;font-family:monospace;max-width:40%;',
        '        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>',
        '      <div style="margin-left:auto;display:flex;gap:8px;">',
        '        <button id="' + NS + 'btn-clear" style="',
        '          background:transparent;color:var(--gaip-text-muted);border:1px solid var(--gaip-text);',
        '          padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">Clear</button>',
        '        <button id="' + NS + 'btn-export" style="',
        '          background:transparent;color:var(--gaip-text-muted);border:1px solid var(--gaip-text);',
        '          padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">Export PNG</button>',
        '        <button id="' + NS + 'btn-copy" style="',
        '          background:#059669;color:var(--gaip-surface);border:none;',
        '          padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;">Copy for Word</button>',
        '        <button id="' + NS + 'btn-close" style="',
        '          background:transparent;color:var(--gaip-text-muted);border:1px solid var(--gaip-text);',
        '          padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">✕ Close</button>',
        '      </div>',
        '    </div>',

        // ── Body ──
        '    <div style="display:flex;flex:1;overflow:hidden;">',

        // Sidebar
        '      <div id="' + NS + 'sidebar" style="',
        '        width:200px;background:var(--gaip-surface);border-right:1px solid var(--gaip-border);',
        '        display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;">',

        // Tools
        '        <div style="padding:12px 10px 8px;border-bottom:1px solid var(--gaip-border);">',
        '          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-muted);margin-bottom:8px;">Tool</div>',
        '          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;" id="' + NS + 'tools">',
        _toolBtn('pen', 'Pen', '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/>'),
        _toolBtn('arrow', 'Arrow', '<line x1="5" y1="19" x2="19" y2="5"/><polyline points="12 5 19 5 19 12"/>'),
        _toolBtn('rect', 'Box', '<rect x="3" y="3" width="18" height="18" rx="2"/>'),
        _toolBtn('ellipse', 'Circle', '<ellipse cx="12" cy="12" rx="10" ry="7"/>'),
        _toolBtn('text', 'Text', '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
        _toolBtn('eraser', 'Eraser', '<path d="M20 20H7L3 16l13-13 8 8-4 9z"/><line x1="6" y1="20" x2="20" y2="20"/>'),
        '          </div>',
        '        </div>',

        // Colours
        '        <div style="padding:12px 10px 8px;border-bottom:1px solid var(--gaip-border);">',
        '          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-muted);margin-bottom:8px;">Colour</div>',
        '          <div id="' + NS + 'colors" style="display:flex;flex-wrap:wrap;gap:6px;">',
        _swatch('#dc2626', 'Red', true),
        _swatch('#d97706', 'Amber'),
        _swatch('#059669', 'Green'),
        _swatch('#2563eb', 'Blue'),
        _swatch('#7c3aed', 'Purple'),
        _swatch('var(--gaip-text)', 'Black'),
        _swatch('#f59e0b', 'Yellow'),
        _swatch('var(--gaip-surface)', 'White'),
        '          </div>',
        '        </div>',

        // Stroke
        '        <div style="padding:12px 10px 8px;border-bottom:1px solid var(--gaip-border);">',
        '          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-muted);margin-bottom:8px;">Stroke</div>',
        '          <div id="' + NS + 'strokes" style="display:flex;gap:6px;align-items:center;">',
        _strokeBtn(2, true), _strokeBtn(4), _strokeBtn(7), _strokeBtn(14),
        '          </div>',
        '        </div>',

        // Opacity
        '        <div style="padding:12px 10px 8px;border-bottom:1px solid var(--gaip-border);">',
        '          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-muted);margin-bottom:6px;">Opacity</div>',
        '          <div style="display:flex;gap:8px;align-items:center;">',
        '            <input type="range" id="' + NS + 'opacity" min="10" max="100" value="100" style="flex:1;">',
        '            <span id="' + NS + 'opacity-val" style="font-size:11px;color:var(--gaip-text);width:34px;text-align:right;">100%</span>',
        '          </div>',
        '        </div>',

        // Text input (hidden until text tool active)
        '        <div id="' + NS + 'text-section" style="padding:12px 10px 8px;border-bottom:1px solid var(--gaip-border);display:none;">',
        '          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-muted);margin-bottom:6px;">Label text</div>',
        '          <input type="text" id="' + NS + 'text-input" value="Apply here" style="',
        '            width:100%;padding:5px 8px;border:1px solid var(--gaip-border);border-radius:5px;font-size:12px;margin-bottom:6px;">',
        '          <select id="' + NS + 'font-size" style="width:100%;padding:5px;border:1px solid var(--gaip-border);border-radius:5px;font-size:12px;">',
        '            <option value="12">Small (12px)</option>',
        '            <option value="16" selected>Medium (16px)</option>',
        '            <option value="22">Large (22px)</option>',
        '            <option value="30">XL (30px)</option>',
        '          </select>',
        '        </div>',

        // History
        '        <div style="padding:12px 10px 8px;">',
        '          <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--gaip-text-muted);margin-bottom:8px;">History</div>',
        '          <div style="display:flex;gap:6px;margin-bottom:8px;">',
        '            <button id="' + NS + 'undo" disabled style="flex:1;padding:5px;border:1px solid var(--gaip-border);border-radius:5px;font-size:11px;cursor:pointer;">↩ Undo</button>',
        '            <button id="' + NS + 'redo" disabled style="flex:1;padding:5px;border:1px solid var(--gaip-border);border-radius:5px;font-size:11px;cursor:pointer;">Redo ↪</button>',
        '          </div>',
        '        </div>',

        '      </div>', // end sidebar

        // Canvas area
        '      <div id="' + NS + 'canvas-area" data-tool="pen" style="',
        '        flex:1;overflow:auto;background:var(--gaip-border);display:flex;',
        '        align-items:flex-start;justify-content:center;padding:16px;">',
        '        <div id="' + NS + 'canvas-wrapper" style="position:relative;display:inline-block;box-shadow:0 4px 20px rgba(0,0,0,0.15);">',
        '          <canvas id="' + NS + 'bg"></canvas>',
        '          <canvas id="' + NS + 'ann" style="position:absolute;top:0;left:0;"></canvas>',
        '        </div>',
        '      </div>',

        '    </div>', // end body

        // Status bar
        '    <div style="',
        '      height:28px;background:var(--gaip-text);display:flex;align-items:center;',
        '      padding:0 14px;gap:16px;font-size:11px;color:var(--gaip-text-muted);',
        '      border-radius:0 0 12px 12px;border-top:1px solid var(--gaip-text);flex-shrink:0;">',
        '      <span>Tool: <span id="' + NS + 'st-tool" style="color:var(--gaip-border);">Pen</span></span>',
        '      <span>Colour: <span id="' + NS + 'st-color" style="color:var(--gaip-border);">#dc2626</span></span>',
        '      <span>Stroke: <span id="' + NS + 'st-stroke" style="color:var(--gaip-border);">2px</span></span>',
        '      <span>Annotations: <span id="' + NS + 'st-count" style="color:var(--gaip-border);">0</span></span>',
        '      <span id="' + NS + 'st-coords" style="margin-left:auto;">x: — y: —</span>',
        '    </div>',

        // Toast
        '    <div id="' + NS + 'toast" style="',
        '      position:absolute;bottom:48px;left:50%;transform:translateX(-50%) translateY(8px);',
        '      background:var(--gaip-text);color:var(--gaip-surface);padding:8px 18px;border-radius:20px;',
        '      font-size:12px;opacity:0;transition:all .25s;pointer-events:none;',
        '      border:1px solid #059669;white-space:nowrap;z-index:10;"></div>',

        '  </div>', // end modal
        '</div>'    // end overlay
    ].join('\n');

    function _toolBtn(id, label, iconPath) {
        return '<button id="' + NS + 'tool-' + id + '" data-tool="' + id + '" style="' +
            'display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;' +
            'border-radius:7px;border:1.5px solid var(--gaip-border);background:var(--gaip-surface);cursor:pointer;' +
            'font-size:10px;color:var(--gaip-text);font-weight:500;transition:all .1s;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            iconPath + '</svg>' + label + '</button>';
    }

    function _swatch(color, label, active) {
        var extra = color === 'var(--gaip-surface)' ? 'border:1.5px solid var(--gaip-border);' : '';
        var outline = active ? 'outline:2.5px solid var(--gaip-text);outline-offset:2px;' : '';
        return '<div data-color="' + color + '" title="' + label + '" style="' +
            'width:24px;height:24px;border-radius:50%;background:' + color + ';cursor:pointer;' +
            'flex-shrink:0;transition:transform .1s;' + extra + outline + '"></div>';
    }

    function _strokeBtn(size, active) {
        var h = Math.min(size, 8);
        var outline = active ? 'border-color:#059669;' : '';
        return '<div data-size="' + size + '" style="' +
            'display:flex;align-items:center;justify-content:center;' +
            'width:32px;height:32px;border-radius:6px;border:1.5px solid var(--gaip-border);cursor:pointer;' + outline + '">' +
            '<span style="display:block;width:16px;height:' + h + 'px;background:var(--gaip-text);border-radius:2px;"></span>' +
            '</div>';
    }

    // ── Inject modal once ─────────────────────────────────────────────────────
    function _inject() {
        if (_injected) return;
        var div = document.createElement('div');
        div.innerHTML = MODAL_HTML;
        document.body.appendChild(div.firstElementChild);
        _bindEvents();
        _injected = true;
    }

    // ── DOM helpers ───────────────────────────────────────────────────────────
    function $id(id) { return document.getElementById(NS + id); }

    // ── Canvas references (resolved after inject) ─────────────────────────────
    function _bg() { return $id('bg'); }
    function _ann() { return $id('ann'); }
    function _bgCtx() { return _bg().getContext('2d'); }
    function _annCtx() { return _ann().getContext('2d', { willReadFrequently: true }); }

    // ── Resize ────────────────────────────────────────────────────────────────
    function _resize(w, h) {
        _bg().width = w; _bg().height = h;
        _ann().width = w; _ann().height = h;
        var wr = $id('canvas-wrapper');
        wr.style.width = w + 'px';
        wr.style.height = h + 'px';
    }

    // ── Load image into bg canvas ─────────────────────────────────────────────
    function _loadDataURL(dataURL, w, h) {
        _resize(w, h);
        var img = new Image();
        img.onload = function () {
            _bgCtx().drawImage(img, 0, 0, w, h);
            _annCtx().clearRect(0, 0, w, h);
            _state.history = [];
            _state.redoStack = [];
            _saveHistory();
        };
        img.src = dataURL;
    }

    // ── History ───────────────────────────────────────────────────────────────
    function _saveHistory() {
        var ctx = _annCtx();
        _state.history.push(ctx.getImageData(0, 0, _ann().width, _ann().height));
        if (_state.history.length > 50) _state.history.shift();
        _state.redoStack = [];
        _updateHistoryBtns();
    }

    function _updateHistoryBtns() {
        $id('undo').disabled = _state.history.length <= 1;
        $id('redo').disabled = _state.redoStack.length === 0;
    }

    // ── Composite (bg + annotations) ─────────────────────────────────────────
    function _getComposite() {
        var out = document.createElement('canvas');
        out.width = _ann().width; out.height = _ann().height;
        var oc = out.getContext('2d');
        oc.drawImage(_bg(), 0, 0);
        oc.drawImage(_ann(), 0, 0);
        return out;
    }

    // ── Toast ─────────────────────────────────────────────────────────────────
    function _toast(msg) {
        var t = $id('toast');
        t.textContent = msg;
        t.style.opacity = '1';
        t.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(function () {
            t.style.opacity = '0';
            t.style.transform = 'translateX(-50%) translateY(8px)';
        }, 2200);
    }

    // ── Drawing ───────────────────────────────────────────────────────────────
    function _getPos(e) {
        var rect = _ann().getBoundingClientRect();
        var src = e.touches ? e.touches[0] : e;
        // scale back from display size to canvas resolution
        var scaleX = _ann().width / rect.width;
        var scaleY = _ann().height / rect.height;
        return {
            x: (src.clientX - rect.left) * scaleX,
            y: (src.clientY - rect.top) * scaleY
        };
    }

    function _startDraw(e) {
        var p = _getPos(e);
        _state.drawing = true;
        _state.startX = p.x; _state.startY = p.y;
        _state.lastX = p.x; _state.lastY = p.y;
        var ctx = _annCtx();

        if (_state.tool === 'text') {
            var label = $id('text-input').value || 'Label';
            var size = parseInt($id('font-size').value);
            ctx.save();
            ctx.globalAlpha = _state.opacity;
            ctx.fillStyle = _state.color;
            ctx.font = 'bold ' + size + 'px DM Sans, system-ui, sans-serif';
            ctx.fillText(label, p.x, p.y);
            ctx.beginPath(); ctx.arc(p.x - 4, p.y + 4, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            _saveHistory();
            _countAnnotations();
            _state.drawing = false;
            return;
        }
        if (_state.tool === 'pen' || _state.tool === 'eraser') {
            ctx.save();
            if (_state.tool === 'eraser') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.globalAlpha = 1;
            } else {
                ctx.globalAlpha = _state.opacity;
            }
            ctx.strokeStyle = _state.color;
            ctx.lineWidth = _state.tool === 'eraser' ? _state.strokeWidth * 4 : _state.strokeWidth;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(p.x, p.y);
            ctx.restore();
        } else {
            _snapshot = ctx.getImageData(0, 0, _ann().width, _ann().height);
        }
    }

    function _draw(e) {
        if (!_state.drawing) return;
        var p = _getPos(e);
        var ctx = _annCtx();

        if (_state.tool === 'pen') {
            ctx.save();
            ctx.globalAlpha = _state.opacity;
            ctx.strokeStyle = _state.color;
            ctx.lineWidth = _state.strokeWidth;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(_state.lastX, _state.lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.restore();
            _state.lastX = p.x; _state.lastY = p.y;
            return;
        }
        if (_state.tool === 'eraser') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = _state.strokeWidth * 4;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(_state.lastX, _state.lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
            ctx.restore();
            _state.lastX = p.x; _state.lastY = p.y;
            return;
        }
        // Shape preview
        ctx.putImageData(_snapshot, 0, 0);
        ctx.save();
        ctx.globalAlpha = _state.opacity;
        ctx.strokeStyle = _state.color;
        ctx.lineWidth = _state.strokeWidth;
        ctx.lineCap = 'round';
        var dx = p.x - _state.startX, dy = p.y - _state.startY;
        if (_state.tool === 'rect') {
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(_state.startX, _state.startY, dx, dy, 3) :
                ctx.rect(_state.startX, _state.startY, dx, dy);
            ctx.stroke();
        } else if (_state.tool === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse(_state.startX + dx / 2, _state.startY + dy / 2, Math.abs(dx / 2), Math.abs(dy / 2), 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (_state.tool === 'arrow') {
            _drawArrow(ctx, _state.startX, _state.startY, p.x, p.y);
        }
        ctx.restore();
    }

    function _endDraw() {
        if (!_state.drawing) return;
        _state.drawing = false;
        if (_state.tool !== 'text') _saveHistory();
        _countAnnotations();
    }

    function _drawArrow(ctx, x1, y1, x2, y2) {
        var angle = Math.atan2(y2 - y1, x2 - x1);
        var headLen = Math.max(14, _state.strokeWidth * 5);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = _state.color;
        ctx.globalAlpha = _state.opacity;
        ctx.fill();
    }

    function _countAnnotations() {
        var data = _annCtx().getImageData(0, 0, _ann().width, _ann().height).data;
        var px = 0;
        for (var i = 3; i < data.length; i += 4) if (data[i] > 10) px++;
        _state.annotationCount = Math.round(px / 50);
        $id('st-count').textContent = _state.annotationCount;
    }

    // ── Tool / colour / stroke setters ────────────────────────────────────────
    function _setTool(tool) {
        _state.tool = tool;
        document.querySelectorAll('[id^="' + NS + 'tool-"]').forEach(function (b) {
            var active = b.dataset.tool === tool;
            b.style.borderColor = active ? '#059669' : 'var(--gaip-border)';
            b.style.background = active ? 'var(--gaip-good-bg)' : 'var(--gaip-surface)';
            b.style.color = active ? '#059669' : 'var(--gaip-text)';
        });
        $id('canvas-area').dataset.tool = tool;
        $id('st-tool').textContent = tool.charAt(0).toUpperCase() + tool.slice(1);
        $id('text-section').style.display = tool === 'text' ? 'block' : 'none';
    }

    function _setColor(color) {
        _state.color = color;
        document.querySelectorAll('#' + NS + 'colors [data-color]').forEach(function (s) {
            s.style.outline = s.dataset.color === color ? '2.5px solid var(--gaip-text)' : 'none';
            s.style.outlineOffset = '2px';
        });
        $id('st-color').textContent = color;
    }

    function _setStroke(size) {
        _state.strokeWidth = size;
        document.querySelectorAll('#' + NS + 'strokes [data-size]').forEach(function (b) {
            b.style.borderColor = parseInt(b.dataset.size) === size ? '#059669' : 'var(--gaip-border)';
        });
        $id('st-stroke').textContent = size + 'px';
    }

    // ── Bind all events ───────────────────────────────────────────────────────
    function _bindEvents() {
        // Close button & overlay click
        $id('btn-close').addEventListener('click', close);
        $id('overlay').addEventListener('click', function (e) {
            if (e.target === $id('overlay')) close();
        });
        // Keyboard ESC
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && $id('overlay').style.display !== 'none') close();
        });

        // Tools
        document.querySelectorAll('[id^="' + NS + 'tool-"]').forEach(function (btn) {
            btn.addEventListener('click', function () { _setTool(this.dataset.tool); });
        });

        // Colours
        document.querySelectorAll('#' + NS + 'colors [data-color]').forEach(function (sw) {
            sw.addEventListener('click', function () { _setColor(this.dataset.color); });
        });

        // Strokes
        document.querySelectorAll('#' + NS + 'strokes [data-size]').forEach(function (btn) {
            btn.addEventListener('click', function () { _setStroke(parseInt(this.dataset.size)); });
        });

        // Opacity
        $id('opacity').addEventListener('input', function () {
            _state.opacity = this.value / 100;
            $id('opacity-val').textContent = this.value + '%';
        });

        // Undo / Redo
        $id('undo').addEventListener('click', function () {
            if (_state.history.length <= 1) return;
            _state.redoStack.push(_state.history.pop());
            _annCtx().putImageData(_state.history[_state.history.length - 1], 0, 0);
            _updateHistoryBtns();
            _countAnnotations();
        });
        $id('redo').addEventListener('click', function () {
            if (!_state.redoStack.length) return;
            var snap = _state.redoStack.pop();
            _state.history.push(snap);
            _annCtx().putImageData(snap, 0, 0);
            _updateHistoryBtns();
        });

        // Clear
        $id('btn-clear').addEventListener('click', function () {
            _annCtx().clearRect(0, 0, _ann().width, _ann().height);
            _saveHistory();
            _state.annotationCount = 0;
            $id('st-count').textContent = '0';
        });

        // Export PNG
        $id('btn-export').addEventListener('click', function () {
            var out = _getComposite();
            var link = document.createElement('a');
            link.download = (_state.chartTitle || 'gilba-chart').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-annotated.png';
            link.href = out.toDataURL('image/png');
            link.click();
            _toast('PNG downloaded');
        });

        // Copy for Word
        $id('btn-copy').addEventListener('click', function () {
            var out = _getComposite();
            out.toBlob(function (blob) {
                if (navigator.clipboard && navigator.clipboard.write) {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                        .then(function () { _toast('Copied — paste into Word export'); })
                        .catch(function () { _toast('Copy failed — use Export PNG instead'); });
                } else {
                    _toast('Clipboard API not available — use Export PNG');
                }
            });
        });

        // Canvas drawing events (bound via delegation on canvas-wrapper)
        var ann = $id('ann');
        ann.addEventListener('mousedown', _startDraw);
        ann.addEventListener('mousemove', _draw);
        ann.addEventListener('mouseup', _endDraw);
        ann.addEventListener('mouseleave', _endDraw);
        ann.addEventListener('touchstart', function (e) { e.preventDefault(); _startDraw(e); }, { passive: false });
        ann.addEventListener('touchmove', function (e) { e.preventDefault(); _draw(e); }, { passive: false });
        ann.addEventListener('touchend', function (e) { e.preventDefault(); _endDraw(e); }, { passive: false });
        ann.addEventListener('mousemove', function (e) {
            var p = _getPos(e);
            $id('st-coords').textContent = 'x: ' + Math.round(p.x) + '  y: ' + Math.round(p.y);
        });
    }

    // ── Public: open with SVG element ─────────────────────────────────────────
    function open(svgEl, title) {
        _inject();
        _state.chartTitle = title || '';
        $id('chart-label').textContent = title || 'Hub Chart';
        $id('overlay').style.display = 'flex';

        svgToDataURL(svgEl).then(function (result) {
            _loadDataURL(result.dataURL, result.width, result.height);
        }).catch(function (err) {
            console.error('[GilbaAnnotator]', err);
            _toast('Could not load chart — try Export PNG from hub first');
        });
    }

    // ── Public: open with existing dataURL ────────────────────────────────────
    function openFromDataURL(dataURL, title, w, h) {
        _inject();
        _state.chartTitle = title || '';
        $id('chart-label').textContent = title || 'Hub Chart';
        $id('overlay').style.display = 'flex';
        _loadDataURL(dataURL, w || 640, h || 320);
    }

    // ── Public: close ─────────────────────────────────────────────────────────
    function close() {
        if (!_injected) return;
        $id('overlay').style.display = 'none';
    }

    // ── html2canvas lazy loader ───────────────────────────────────────────────
    var _h2cPromise = null;
    function _loadHtml2Canvas() {
        if (_h2cPromise) return _h2cPromise;
        _h2cPromise = new Promise(function (resolve, reject) {
            if (typeof html2canvas !== 'undefined') { resolve(html2canvas); return; }
            var s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            s.onload = function () { resolve(html2canvas); };
            s.onerror = function () { reject(new Error('html2canvas failed to load')); };
            document.head.appendChild(s);
        });
        return _h2cPromise;
    }

    // ── Open annotator from a DOM element (uses html2canvas) ─────────────────
    function openFromElement(el, title) {
        _inject();
        var t = title || 'Hub Chart';
        _loadHtml2Canvas().then(function (h2c) {
            _toast('Capturing chart…');
            h2c(el, {
                backgroundColor: 'var(--gaip-surface)',
                scale: window.devicePixelRatio || 1,
                useCORS: true,
                logging: false
            }).then(function (canvas) {
                openFromDataURL(canvas.toDataURL('image/png'), t, canvas.width, canvas.height);
            }).catch(function (err) {
                console.error('[GilbaAnnotator] html2canvas error:', err);
                _toast('Screenshot failed — try a single chart');
            });
        }).catch(function (err) {
            console.error('[GilbaAnnotator] html2canvas load error:', err);
            _toast('Could not load screenshot library');
        });
    }

    // ── Button factory ────────────────────────────────────────────────────────
    function _makeAnnotateBtn(title, svgFinder) {
        var btn = document.createElement('button');
        btn.className = 'gilba-annotate-btn';
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg> Annotate';
        btn.style.cssText = [
            'display:inline-flex;align-items:center;gap:4px;',
            'padding:3px 9px;border-radius:5px;',
            'background:transparent;border:1px solid var(--gaip-text-muted);',
            'color:var(--gaip-text-secondary);font-size:11px;cursor:pointer;',
            'font-family:inherit;transition:all .12s;',
            'margin-left:8px;flex-shrink:0;'
        ].join('');
        btn.addEventListener('mouseenter', function () {
            btn.style.borderColor = '#059669'; btn.style.color = '#059669';
        });
        btn.addEventListener('mouseleave', function () {
            btn.style.borderColor = 'var(--gaip-text-muted)'; btn.style.color = 'var(--gaip-text-secondary)';
        });
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var svg = svgFinder();
            if (svg) {
                open(svg, title);
            } else {
                _inject();
                _toast('No chart found — run analysis first');
            }
        });
        return btn;
    }

    // Pick widest SVG in a container, skipping icon-sized ones
    function _widestSVG(container) {
        var best = null, bestW = 0;
        container.querySelectorAll('svg').forEach(function (s) {
            var wAttr = parseFloat(s.getAttribute('width'));
            var vb = s.getAttribute('viewBox') || '';
            var vbW = vb ? parseFloat(vb.split(/[\s,]+/)[2]) : 0;
            var w = wAttr || vbW || s.getBoundingClientRect().width;
            if (w > 50 && w > bestW) { bestW = w; best = s; }
        });
        return best;
    }

    // ── Public: attach annotate buttons to soil/water/tissue charts ───────────
    function attachButtons() {
        // 1. Soil nutrition — MSO grid, screenshot whole #gaip-mso-soil container
        // #gaip-mso-soil ID absent in DOM; find all .gaip-mso-header elements and walk up
        document.querySelectorAll('.gaip-mso-header').forEach(function (msoHeader) {
            if (msoHeader.querySelector('.gilba-annotate-btn')) return;
            var msoSoil = msoHeader.parentElement;
            var soilBtn = document.createElement('button');
            soilBtn.className = 'gilba-annotate-btn';
            soilBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg> Annotate';
            soilBtn.style.cssText = [
                'display:inline-flex;align-items:center;gap:4px;',
                'padding:3px 9px;border-radius:5px;',
                'background:transparent;border:1px solid var(--gaip-text-muted);',
                'color:var(--gaip-text-secondary);font-size:11px;cursor:pointer;',
                'font-family:inherit;transition:all .12s;',
                'margin-left:8px;flex-shrink:0;float:right;'
            ].join('');
            soilBtn.addEventListener('mouseenter', function () {
                soilBtn.style.borderColor = '#059669'; soilBtn.style.color = '#059669';
            });
            soilBtn.addEventListener('mouseleave', function () {
                soilBtn.style.borderColor = 'var(--gaip-text-muted)'; soilBtn.style.color = 'var(--gaip-text-secondary)';
            });
            soilBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var grid = msoSoil.querySelector('.gaip-mso-grid') || msoSoil;
                openFromElement(grid, 'Soil Nutrition — All Sources');
            });
            msoHeader.appendChild(soilBtn);
        });

        // 2. Water — SVG inside .gaip-water-body
        document.querySelectorAll('.gaip-water-body').forEach(function (body) {
            if (body.querySelector('.gilba-annotate-btn')) return;
            var svg = _widestSVG(body);
            if (!svg) return;
            var anchor = body.querySelector('.gaip-section-title, .gaip-result-title, h3, h4') ||
                         body.parentElement.querySelector('.gaip-section-title, h3, h4');
            if (!anchor) return;
            var title = anchor.textContent.trim().slice(0, 50) || 'Water Chart';
            var btn = _makeAnnotateBtn(title, function () { return _widestSVG(body); });
            btn.style.float = 'right';
            anchor.appendChild(btn);
        });

        // 3. Tissue — SVG inside .gaip-tissue-body
        document.querySelectorAll('.gaip-tissue-body, .gaip-result-body.gaip-tissue-result').forEach(function (body) {
            if (body.querySelector('.gilba-annotate-btn')) return;
            var svg = _widestSVG(body);
            if (!svg) return;
            var anchor = body.querySelector('.gaip-section-title, .gaip-result-title, h3, h4') ||
                         body.parentElement.querySelector('.gaip-section-title, h3, h4');
            if (!anchor) return;
            var title = anchor.textContent.trim().slice(0, 50) || 'Tissue Chart';
            var btn = _makeAnnotateBtn(title, function () { return _widestSVG(body); });
            btn.style.float = 'right';
            anchor.appendChild(btn);
        });
    }

    // ── Auto-attach on DOM ready and after MutationObserver ──────────────────
    function _autoAttach() {
        attachButtons();

        // Re-attach after every analysis run (MSO DOM gets rebuilt)
        document.addEventListener('gaip:analysis-complete', function () {
            setTimeout(attachButtons, 400);
        });

        if (typeof MutationObserver !== 'undefined') {
            var debounce = null;
            var obs = new MutationObserver(function (mutations) {
                var relevant = mutations.some(function (m) {
                    return Array.from(m.addedNodes).some(function (n) {
                        if (n.nodeType !== 1) return false;
                        var cls = (n.className && typeof n.className === 'string') ? n.className : '';
                        return cls.indexOf('gaip-mso') !== -1 ||
                               cls.indexOf('gaip-water') !== -1 ||
                               cls.indexOf('gaip-tissue') !== -1 ||
                               (n.querySelector && (
                                   n.querySelector('#gaip-mso-soil, .gaip-water-body, .gaip-tissue-body')
                               ));
                    });
                });
                if (relevant) {
                    clearTimeout(debounce);
                    debounce = setTimeout(attachButtons, 300);
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _autoAttach);
    } else {
        setTimeout(_autoAttach, 0);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        open: open,
        openFromDataURL: openFromDataURL,
        openFromElement: openFromElement,
        close: close,
        attachButtons: attachButtons
    };

}());
