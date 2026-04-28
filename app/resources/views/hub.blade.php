@extends('layouts.app', ['title' => 'Hub'])

@section('body')
    <main class="content">
        <section class="panel">
            <h1>Gilba Hub</h1>
            <p class="muted">Laravel authentication is active. WordPress hub migration will start from this protected page.</p>

            <div class="grid">
                <a class="card" href="{{ route('field-log') }}">
                    <strong>Field Log</strong>
                    <span class="muted">Placeholder route for observations.</span>
                </a>
                <a class="card" href="{{ route('morning-briefing') }}">
                    <strong>Morning Briefing</strong>
                    <span class="muted">Placeholder route for daily summaries.</span>
                </a>
                <a class="card" href="{{ route('stadium') }}">
                    <strong>Stadium</strong>
                    <span class="muted">Placeholder route for GSSH mode.</span>
                </a>
                <a class="card" href="{{ route('settings') }}">
                    <strong>Settings</strong>
                    <span class="muted">Placeholder route for account and site settings.</span>
                </a>
            </div>
        </section>
    </main>
@endsection
