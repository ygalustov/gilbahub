<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabReportParseController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lab_report' => ['required', 'file', 'max:10240'],
        ]);

        $file = $data['lab_report'];
        $ext = strtolower((string) $file->getClientOriginalExtension());

        if (in_array($ext, ['csv', 'xlsx', 'xls'], true)) {
            return response()->json([
                'success' => false,
                'data' => [
                    'message' => 'Spreadsheet imports are handled locally in the browser. Use the Soil, Water, or Tissue import button for CSV/XLSX files.',
                    'code' => 'local_spreadsheet_import',
                ],
            ], 422);
        }

        return response()->json([
            'success' => false,
            'data' => [
                'message' => 'AI lab report parsing for PDF, DOCX, and TXT files is not configured in this Laravel build yet. Use CSV/XLSX import or manual entry for now.',
                'code' => 'lab_report_parser_unavailable',
            ],
        ], 501);
    }
}
