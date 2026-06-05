<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewRegistrationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $userEmail,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'New user registration request — Gilba Hub',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.new-registration',
        );
    }
}
