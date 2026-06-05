<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use App\Models\Site;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class InvitationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in(['manager', 'editor', 'viewer'])],
            'site_id' => ['required', 'string', 'exists:sites,id'],
        ]);

        $user = $request->user();
        $site = Site::query()->findOrFail($data['site_id']);

        abort_unless($user->canManageSite($site), 403);

        // assertCanGrantRole check
        $this->assertCanGrantRole($user, $site, $data['role']);

        $email = strtolower(trim($data['email']));

        // Check if user already has access
        $existingUser = User::query()->where('email', $email)->first();
        if ($existingUser && $existingUser->sites()->where('sites.id', $site->id)->exists()) {
            return response()->json(['message' => 'This user already has access to this site.'], 422);
        }

        // Check for duplicate pending invitation
        $existingInvitation = Invitation::query()
            ->where('email', $email)
            ->where('site_id', $site->id)
            ->exists();

        if ($existingInvitation) {
            return response()->json(['message' => 'A pending invitation already exists for this email.'], 422);
        }

        $invitation = Invitation::query()->create([
            'name' => $data['name'] ?? null,
            'email' => $email,
            'role' => $data['role'],
            'site_id' => $site->id,
            'invited_by' => $user->id,
            'created_at' => now(),
        ]);

        // Send invitation email
        Mail::raw(
            "You've been invited to join {$site->name} on Gilba Hub as {$data['role']}.\n\nSign in at: " . route('login') . "\n\nIf you don't have an account yet, your access will be granted automatically when you first sign in.",
            fn ($message) => $message
                ->to($email)
                ->subject("You've been invited to {$site->name} on Gilba Hub")
        );

        return response()->json([
            'data' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'role' => $invitation->role,
                'site_id' => $invitation->site_id,
                'created_at' => $invitation->created_at?->toISOString(),
            ],
        ], 201);
    }

    public function destroy(Request $request, int $invitation): JsonResponse
    {
        $inv = Invitation::query()->findOrFail($invitation);
        $site = Site::query()->findOrFail($inv->site_id);

        abort_unless($request->user()->canManageSite($site), 403);

        $inv->delete();

        return response()->json(['deleted' => true]);
    }

    private function assertCanGrantRole(User $actor, Site $site, string $targetRole): void
    {
        abort_if($targetRole === 'admin', 403);

        $hierarchy = ['viewer' => 1, 'editor' => 2, 'manager' => 3];
        $actorLevel = $actor->is_admin ? 3 : ($hierarchy[$actor->roleOnSite($site)] ?? 0);
        $targetLevel = $hierarchy[$targetRole] ?? 0;

        abort_unless($actorLevel >= $targetLevel, 403);
    }
}
