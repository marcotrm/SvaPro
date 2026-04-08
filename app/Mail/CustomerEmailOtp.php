<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CustomerEmailOtp extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $otp,
        public readonly string $customerName = ''
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Il tuo codice di verifica — SvaPro",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.customer-otp',
        );
    }
}
