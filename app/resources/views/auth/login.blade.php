@extends('layouts.app', ['title' => 'Login'])

@section('body')
    <main class="auth-wrap">
        <section class="panel">
            <h1>Sign In</h1>
            <p class="muted">Use your Gilba account to access the standalone hub.</p>

            <form method="POST" action="{{ route('login.store') }}">
                @csrf

                <label for="email">Email</label>
                <input id="email" name="email" type="email" value="{{ old('email') }}" autocomplete="email" autofocus required>
                @error('email')
                    <div class="error">{{ $message }}</div>
                @enderror

                <label for="password">Password</label>
                <input id="password" name="password" type="password" autocomplete="current-password" required>
                @error('password')
                    <div class="error">{{ $message }}</div>
                @enderror

                <label class="check-row">
                    <input name="remember" type="checkbox" value="1">
                    <span>Remember me</span>
                </label>

                <button class="primary" type="submit">Sign in</button>
            </form>
        </section>
    </main>
@endsection
