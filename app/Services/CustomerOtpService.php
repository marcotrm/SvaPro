<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class CustomerOtpService
{
    private const CODE_LENGTH = 6;
    private const EXPIRY_MINUTES = 10;

    public function sendOtp(int $tenantId, int $customerId, string $channel): array
    {
        $customer = DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->first();

        if (! $customer) {
            return ['success' => false, 'message' => 'Cliente non trovato.'];
        }

        if ($channel === 'email' && empty($customer->email)) {
            return ['success' => false, 'message' => 'Il cliente non ha un indirizzo email.'];
        }

        if ($channel === 'sms' && empty($customer->phone)) {
            return ['success' => false, 'message' => 'Il cliente non ha un numero di telefono.'];
        }

        // Invalida OTP precedenti non verificati
        DB::table('customer_otp_codes')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->where('channel', $channel)
            ->where('verified', false)
            ->delete();

        $code = $this->generateCode();
        $now = now();

        DB::table('customer_otp_codes')->insert([
            'tenant_id' => $tenantId,
            'customer_id' => $customerId,
            'channel' => $channel,
            'code' => $code,
            'verified' => false,
            'expires_at' => $now->copy()->addMinutes(self::EXPIRY_MINUTES),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->dispatchCode($customer, $channel, $code);

        return ['success' => true, 'message' => 'Codice OTP inviato.'];
    }

    public function verifyOtp(int $tenantId, int $customerId, string $channel, string $code): array
    {
        $otp = DB::table('customer_otp_codes')
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customerId)
            ->where('channel', $channel)
            ->where('code', $code)
            ->where('verified', false)
            ->where('expires_at', '>', now())
            ->first();

        if (! $otp) {
            return ['success' => false, 'message' => 'Codice non valido o scaduto.'];
        }

        $now = now();

        DB::table('customer_otp_codes')
            ->where('id', $otp->id)
            ->update([
                'verified' => true,
                'verified_at' => $now,
                'updated_at' => $now,
            ]);

        // Segna il campo come verificato sul cliente
        $updateField = $channel === 'email' ? 'email_verified' : 'phone_verified';

        DB::table('customers')
            ->where('tenant_id', $tenantId)
            ->where('id', $customerId)
            ->update([
                $updateField => true,
                'updated_at' => $now,
            ]);

        return ['success' => true, 'message' => 'Verifica completata.'];
    }

    private function generateCode(): string
    {
        return str_pad((string) random_int(0, 999999), self::CODE_LENGTH, '0', STR_PAD_LEFT);
    }

    private function dispatchCode(object $customer, string $channel, string $code): void
    {
        if ($channel === 'email' && ! empty($customer->email)) {
            try {
                Mail::raw(
                    "Il tuo codice di verifica SvaPro e: {$code}\nScade tra " . self::EXPIRY_MINUTES . " minuti.",
                    function ($message) use ($customer) {
                        $message->to($customer->email)
                            ->subject('SvaPro - Codice di verifica');
                    }
                );
            } catch (\Throwable $e) {
                Log::warning('OTP email dispatch failed', [
                    'customer_id' => $customer->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($channel === 'sms') {
            // SMS gateway placeholder — da implementare con provider specifico
            Log::info('OTP SMS dispatch', [
                'customer_id' => $customer->id,
                'phone' => $customer->phone,
                'code' => $code,
            ]);
        }
    }
}
