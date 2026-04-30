<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AlertController extends Controller
{
    public function check(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_id' => ['required', 'string', 'max:120'],
            'site_name' => ['nullable', 'string', 'max:255'],
            'quiet_hours' => ['nullable', 'boolean'],
            'contacts' => ['required', 'array'],
            'results' => ['required', 'array'],
        ]);

        $fired = [];
        $siteId = trim((string) $data['site_id']);
        $siteName = trim((string) ($data['site_name'] ?? '')) ?: $siteId;
        $quietHours = (bool) ($data['quiet_hours'] ?? false);
        $alerts = $this->evaluateResults((array) $data['results']);

        foreach ($alerts as $alert) {
            foreach ($this->normaliseContacts($data['contacts']) as $contact) {
                if (! in_array($alert['type'], $contact['alerts'], true)) {
                    continue;
                }

                if ($contact['type'] === 'sms' && $quietHours && $this->withinSmsQuietHoursUtc()) {
                    continue;
                }

                $dedupeKey = sprintf(
                    'alerts:%s:%s:%s:%s:%s',
                    $request->user()->id,
                    $siteId,
                    $contact['type'],
                    md5($contact['value']),
                    $alert['type']
                );

                if (Cache::has($dedupeKey)) {
                    continue;
                }

                Cache::put($dedupeKey, true, now()->endOfDay());

                Log::info('Gilba alert fired', [
                    'user_id' => $request->user()->id,
                    'site_id' => $siteId,
                    'site_name' => $siteName,
                    'contact_type' => $contact['type'],
                    'contact_value' => $contact['value'],
                    'alert_type' => $alert['type'],
                    'headline' => $alert['headline'],
                    'message' => $alert['message'],
                ]);

                $fired[] = [
                    'type' => $alert['type'],
                    'channel' => $contact['type'],
                    'target' => $contact['value'],
                    'headline' => $alert['headline'],
                    'message' => $alert['message'],
                    'mode' => 'logged',
                ];
            }
        }

        return response()->json([
            'success' => true,
            'fired' => $fired,
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'in:sms,email'],
            'value' => ['required', 'string', 'max:255'],
        ]);

        if ($data['type'] === 'email') {
            if (! filter_var($data['value'], FILTER_VALIDATE_EMAIL)) {
                return response()->json([
                    'message' => 'Invalid email address',
                ], 422);
            }

            Log::info('Gilba alert test email requested', [
                'user_id' => $request->user()->id,
                'target' => $data['value'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Test email logged for '.$data['value'],
                'mode' => 'logged',
            ]);
        }

        if (! preg_match('/^\+?[0-9][0-9\s\-()]{6,}$/', $data['value'])) {
            return response()->json([
                'message' => 'Invalid SMS number',
            ], 422);
        }

        Log::info('Gilba alert test SMS requested', [
            'user_id' => $request->user()->id,
            'target' => $data['value'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Test SMS logged for '.$data['value'],
            'mode' => 'logged',
        ]);
    }

    /**
     * @return array<int, array{type:string,value:string,alerts:array<int, string>}>
     */
    private function normaliseContacts(array $contacts): array
    {
        $normalised = [];

        foreach ($contacts as $contact) {
            if (! is_array($contact)) {
                continue;
            }

            $type = trim((string) ($contact['type'] ?? ''));
            $value = trim((string) ($contact['value'] ?? ''));
            $alerts = array_values(array_filter(array_map(
                static fn ($alert): string => trim((string) $alert),
                is_array($contact['alerts'] ?? null) ? $contact['alerts'] : []
            )));

            if (! in_array($type, ['sms', 'email'], true) || $value === '' || $alerts === []) {
                continue;
            }

            $normalised[] = [
                'type' => $type,
                'value' => $value,
                'alerts' => $alerts,
            ];
        }

        return $normalised;
    }

    /**
     * @return array<int, array{type:string,headline:string,message:string}>
     */
    private function evaluateResults(array $results): array
    {
        $alerts = [];

        $disease = is_array($results['disease'] ?? null) ? $results['disease'] : null;
        $smithKerns = is_array($results['smithKerns'] ?? null) ? $results['smithKerns'] : null;
        $preEmergent = is_array($results['preEmergent'] ?? null) ? $results['preEmergent'] : null;
        $stress = is_array($results['stress'] ?? null) ? $results['stress'] : null;

        $topThreat = null;
        if ($disease && ! empty($disease['topThreats']) && is_array($disease['topThreats'])) {
            $topThreat = $disease['topThreats'][0] ?? null;
        }

        $overallScore = is_numeric($disease['overallScore'] ?? null) ? (float) $disease['overallScore'] : 0.0;
        $smithKernsRisk = is_numeric($smithKerns['riskIndex'] ?? null) ? (float) $smithKerns['riskIndex'] : 0.0;
        $topThreatScore = is_numeric($topThreat['riskScore'] ?? null) ? (float) $topThreat['riskScore'] : 0.0;

        if ($overallScore >= 70 || $smithKernsRisk >= 70 || $topThreatScore >= 70) {
            $headline = 'Disease alert';
            $message = $topThreat && ! empty($topThreat['displayName'])
                ? sprintf('%s risk is elevated (%.0f).', $topThreat['displayName'], $topThreatScore)
                : sprintf('Disease pressure is elevated (overall %.0f).', $overallScore);

            $alerts[] = [
                'type' => 'disease',
                'headline' => $headline,
                'message' => $message,
            ];
        }

        $preEmergentResults = is_array($preEmergent['results'] ?? null) ? $preEmergent['results'] : [];
        if ($preEmergentResults !== []) {
            $first = $preEmergentResults[0];
            $name = trim((string) ($first['commonName'] ?? $first['name'] ?? 'Pre-emergent window'));
            $status = trim((string) ($first['status'] ?? ''));

            $alerts[] = [
                'type' => 'pre_emergent',
                'headline' => 'Pre-emergent alert',
                'message' => $status !== ''
                    ? $name.' requires attention ('.$status.').'
                    : $name.' requires attention.',
            ];
        }

        $stressSummary = is_array($stress['summary'] ?? null) ? $stress['summary'] : [];
        $stressScore = is_numeric($stressSummary['currentScore'] ?? null) ? (float) $stressSummary['currentScore'] : 0.0;
        $stressLevel = strtoupper(trim((string) ($stressSummary['stressLevel'] ?? '')));

        if ($stressScore >= 70 || in_array($stressLevel, ['HIGH', 'SEVERE', 'CRITICAL'], true)) {
            $alerts[] = [
                'type' => 'stress',
                'headline' => 'Stress alert',
                'message' => $stressLevel !== ''
                    ? 'Stress level is '.$stressLevel.' (score '.round($stressScore).').'
                    : 'Stress level is elevated (score '.round($stressScore).').',
            ];
        }

        return $alerts;
    }

    private function withinSmsQuietHoursUtc(): bool
    {
        $hour = (int) now('UTC')->format('G');

        return $hour >= 22 || $hour < 7;
    }
}
