<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use App\Models\MagicLink;
use App\Models\Site;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Mail\InvitationMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InvitationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['nullable', 'string', 'max:255'],
            'email'    => ['required', 'email', 'max:255'],
            'role'     => ['required', Rule::in(['manager', 'editor', 'viewer'])],
            'site_ids' => ['required', 'array', 'min:1'],
            'site_ids.*' => ['required', 'string', 'exists:sites,id'],
        ]);

        $actor = $request->user();
        $email = strtolower(trim($data['email']));
        $role  = $data['role'];
        $name  = $data['name'] ?? null;

        $sites = Site::query()->findMany($data['site_ids']);

        // Authorisation: actor must be able to manage every selected site
        foreach ($sites as $site) {
            abort_unless($actor->canManageSite($site), 403);
            $this->assertCanGrantRole($actor, $site, $role);
        }

        $existingUser = User::query()->where('email', $email)->first();
        $skipped = [];
        $created = [];

        foreach ($sites as $site) {
            // Already has access
            if ($existingUser && $existingUser->sites()->where('sites.id', $site->id)->exists()) {
                $skipped[] = $site->name . ' (already has access)';
                continue;
            }

            // Duplicate pending invitation
            if (Invitation::query()->where('email', $email)->where('site_id', $site->id)->exists()) {
                $skipped[] = $site->name . ' (invitation already sent)';
                continue;
            }

            Invitation::query()->create([
                'name'       => $name,
                'email'      => $email,
                'role'       => $role,
                'site_id'    => $site->id,
                'invited_by' => $actor->id,
                'created_at' => now(),
            ]);

            $created[] = $site;
        }

        if (empty($created)) {
            $reason = implode('; ', $skipped);
            return response()->json(['message' => "No invitations sent: {$reason}"], 422);
        }

        // One magic link pointing to the first newly-invited site
        MagicLink::query()->where('email', $email)->delete();
        $token = Str::random(64);
        MagicLink::query()->create([
            'token'      => $token,
            'email'      => $email,
            'site_id'    => $created[0]->id,
            'expires_at' => now()->addHours(48),
            'created_at' => now(),
        ]);
        $magicUrl = route('magic.verify', ['token' => $token]);

        $siteNames   = implode(', ', array_map(fn ($s) => $s->name, $created));
        $actorName   = $actor->name;
        $siteLabel   = count($created) === 1 ? $created[0]->name : $siteNames;

        Mail::to($email)->send(new InvitationMail($magicUrl, $actorName, $siteLabel));

        return response()->json(['data' => ['created' => count($created), 'skipped' => $skipped]], 201);
    }

    public function destroy(Request $request, int $invitation): JsonResponse
    {
        $inv  = Invitation::query()->findOrFail($invitation);
        $site = Site::query()->findOrFail($inv->site_id);

        abort_unless($request->user()->canManageSite($site), 403);

        $inv->delete();

        return response()->json(['deleted' => true]);
    }

    private function assertCanGrantRole(User $actor, Site $site, string $targetRole): void
    {
        abort_if($targetRole === 'admin', 403);

        $hierarchy  = ['viewer' => 1, 'editor' => 2, 'manager' => 3];
        $actorLevel = $actor->is_admin ? 3 : ($hierarchy[$actor->roleOnSite($site)] ?? 0);
        $targetLevel = $hierarchy[$targetRole] ?? 0;

        abort_unless($actorLevel >= $targetLevel, 403);
    }
}
