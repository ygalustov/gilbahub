<?php

namespace App\Http\Controllers;

use App\Support\GilbaRuntimeBootstrap;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InterpretationController extends Controller
{
    public function soil(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'soil_output' => ['required', 'array'],
        ]);

        GilbaRuntimeBootstrap::loadInterpretationClasses();

        $interpreter = new \Gilba_Soil_Interpretation();
        $result = $interpreter->interpret($payload['soil_output']);

        return $this->legacyInterpretationResponse($result);
    }

    public function water(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'water_output' => ['required', 'array'],
        ]);

        GilbaRuntimeBootstrap::loadInterpretationClasses();

        $interpreter = new \Gilba_Water_Interpretation();
        $result = $interpreter->interpret($payload['water_output']);

        return $this->legacyInterpretationResponse($result);
    }

    public function synthesis(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'synthesis_data' => ['required', 'array'],
        ]);

        GilbaRuntimeBootstrap::loadInterpretationClasses();

        $interpreter = new \Gilba_Synthesis_Interpretation();
        $result = $interpreter->interpret($payload['synthesis_data']);

        return $this->legacyInterpretationResponse($result);
    }

    private function legacyInterpretationResponse(array $result): JsonResponse
    {
        if (! ($result['success'] ?? false)) {
            return response()->json([
                'success' => false,
                'data' => [
                    'message' => (string) ($result['error'] ?? 'Interpretation failed'),
                ],
            ]);
        }

        unset($result['success']);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }
}
