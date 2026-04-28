(function (global) {
    'use strict';

    if ((global.jspdf && global.jspdf.jsPDF) || global.jsPDF) {
        return;
    }

    var MM_TO_PT = 72 / 25.4;
    var PAGE_WIDTH_MM = 210;
    var PAGE_HEIGHT_MM = 297;
    var PAGE_WIDTH_PT = PAGE_WIDTH_MM * MM_TO_PT;
    var PAGE_HEIGHT_PT = PAGE_HEIGHT_MM * MM_TO_PT;

    function escapePdfText(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');
    }

    function mmToPt(value) {
        return Number(value || 0) * MM_TO_PT;
    }

    function clampChannel(value) {
        var n = Number(value);
        if (!isFinite(n)) {
            return 0;
        }
        return Math.max(0, Math.min(255, n));
    }

    function SimpleJsPDF() {
        this.pages = [[]];
        this.currentPage = 0;
        this.fontSize = 16;
        this.fontStyle = 'normal';
        this.textColor = [0, 0, 0];
        this.internal = {
            pageSize: {
                getWidth: function () {
                    return PAGE_WIDTH_MM;
                },
                getHeight: function () {
                    return PAGE_HEIGHT_MM;
                }
            }
        };
    }

    SimpleJsPDF.prototype._pageCommands = function () {
        return this.pages[this.currentPage];
    };

    SimpleJsPDF.prototype._lineHeightMm = function () {
        return Math.max(4.2, this.fontSize * 0.42);
    };

    SimpleJsPDF.prototype.setFontSize = function (size) {
        this.fontSize = Number(size) || this.fontSize;
        return this;
    };

    SimpleJsPDF.prototype.setFont = function (_family, style) {
        this.fontStyle = style || 'normal';
        return this;
    };

    SimpleJsPDF.prototype.setTextColor = function (r, g, b) {
        this.textColor = [clampChannel(r), clampChannel(g), clampChannel(b)];
        return this;
    };

    SimpleJsPDF.prototype.addPage = function () {
        this.pages.push([]);
        this.currentPage = this.pages.length - 1;
        return this;
    };

    SimpleJsPDF.prototype.splitTextToSize = function (text, maxWidth) {
        var source = String(text == null ? '' : text).replace(/\r/g, '');
        if (!source) {
            return [''];
        }

        var paragraphs = source.split('\n');
        var lines = [];
        var approxCharWidthMm = Math.max(1.2, this.fontSize * 0.18);
        var maxChars = Math.max(8, Math.floor(Number(maxWidth || 0) / approxCharWidthMm));

        paragraphs.forEach(function (paragraph) {
            var words = paragraph.split(/\s+/).filter(Boolean);
            if (!words.length) {
                lines.push('');
                return;
            }

            var current = words.shift();
            words.forEach(function (word) {
                var candidate = current + ' ' + word;
                if (candidate.length <= maxChars) {
                    current = candidate;
                } else {
                    lines.push(current);
                    current = word;
                }
            });
            lines.push(current);
        });

        return lines;
    };

    SimpleJsPDF.prototype.text = function (content, x, y) {
        var lines = Array.isArray(content) ? content : [content];
        var commands = this._pageCommands();
        var fontSizePt = mmToPt(this.fontSize * 0.352777778);
        var lineHeightMm = this._lineHeightMm();
        var color = this.textColor.map(function (channel) {
            return (channel / 255).toFixed(3);
        }).join(' ');

        for (var i = 0; i < lines.length; i += 1) {
            var line = escapePdfText(lines[i] == null ? '' : lines[i]);
            var xPt = mmToPt(x);
            var yPt = PAGE_HEIGHT_PT - mmToPt(y + (i * lineHeightMm));
            commands.push('BT');
            commands.push('/F1 ' + fontSizePt.toFixed(2) + ' Tf');
            commands.push(color + ' rg');
            commands.push('1 0 0 1 ' + xPt.toFixed(2) + ' ' + yPt.toFixed(2) + ' Tm');
            commands.push('(' + line + ') Tj');
            commands.push('ET');
        }

        return this;
    };

    SimpleJsPDF.prototype.save = function (filename) {
        var objects = [];

        function addObject(body) {
            objects.push(body);
            return objects.length;
        }

        var fontObjectId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
        var pageIds = [];
        var contentIds = [];

        for (var i = 0; i < this.pages.length; i += 1) {
            var stream = this.pages[i].join('\n');
            var contentId = addObject('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
            contentIds.push(contentId);
            pageIds.push(addObject(''));
        }

        var kids = pageIds.map(function (id) {
            return id + ' 0 R';
        }).join(' ');
        var pagesObjectId = addObject('<< /Type /Pages /Kids [' + kids + '] /Count ' + pageIds.length + ' >>');
        var catalogObjectId = addObject('<< /Type /Catalog /Pages ' + pagesObjectId + ' 0 R >>');

        for (var p = 0; p < pageIds.length; p += 1) {
            objects[pageIds[p] - 1] =
                '<< /Type /Page /Parent ' + pagesObjectId + ' 0 R /MediaBox [0 0 ' + PAGE_WIDTH_PT.toFixed(2) + ' ' + PAGE_HEIGHT_PT.toFixed(2) + '] ' +
                '/Resources << /Font << /F1 ' + fontObjectId + ' 0 R >> >> /Contents ' + contentIds[p] + ' 0 R >>';
        }

        var pdf = '%PDF-1.4\n';
        var offsets = [0];

        for (var index = 0; index < objects.length; index += 1) {
            offsets.push(pdf.length);
            pdf += (index + 1) + ' 0 obj\n' + objects[index] + '\nendobj\n';
        }

        var xrefOffset = pdf.length;
        pdf += 'xref\n0 ' + (objects.length + 1) + '\n';
        pdf += '0000000000 65535 f \n';

        for (var o = 1; o < offsets.length; o += 1) {
            pdf += String(offsets[o]).padStart(10, '0') + ' 00000 n \n';
        }

        pdf += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogObjectId + ' 0 R >>\n';
        pdf += 'startxref\n' + xrefOffset + '\n%%EOF';

        var blob = new Blob([pdf], { type: 'application/pdf' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename || 'document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
        return this;
    };

    global.jspdf = global.jspdf || {};
    global.jspdf.jsPDF = SimpleJsPDF;
    global.jsPDF = SimpleJsPDF;
})(window);
