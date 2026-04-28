@extends('layouts.app', ['title' => $title])

@section('body')
    <main class="content">
        <section class="panel">
            <h1>{{ $title }}</h1>
            <p class="muted">This protected page is ready for the WordPress feature lift-out.</p>
        </section>
    </main>
@endsection
