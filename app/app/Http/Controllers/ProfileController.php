<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $request->user()->forceFill(['name' => $data['name']])->save();

        return response()->json(['updated' => true]);
    }

    public function setPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $trustedReset = $request->session()->pull('password_reset_trusted', false);

        if ($user->password_hash && ! $trustedReset) {
            // Change existing password — require current password
            $data = $request->validate([
                'current_password'      => ['required', 'string'],
                'password'              => ['required', 'string', 'min:8', 'confirmed'],
            ]);

            if (! Hash::check($data['current_password'], $user->password_hash)) {
                return response()->json(['message' => 'Current password is incorrect.'], 422);
            }
        } else {
            // Set new password — no current password required (magic link reset or no password yet)
            $data = $request->validate([
                'password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);
        }

        $user->forceFill([
            'password_hash'         => Hash::make($data['password']),
            'password_prompt_shown' => true,
        ])->save();

        return response()->json(['updated' => true, 'message' => 'Password set. You can now sign in with your password.']);
    }

    public function dismissPasswordPrompt(Request $request): JsonResponse
    {
        $request->user()->forceFill(['password_prompt_shown' => true])->save();

        return response()->json(['dismissed' => true]);
    }
}
