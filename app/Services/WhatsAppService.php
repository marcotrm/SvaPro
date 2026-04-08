<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    private ?string $sid;
    private ?string $token;
    private ?string $from;
    private bool $enabled;

    public function __construct()
    {
        $this->sid     = config('services.twilio.sid');
        $this->token   = config('services.twilio.token');
        $this->from    = config('services.twilio.whatsapp_from', 'whatsapp:+14155238886'); // Twilio sandbox default
        $this->enabled = !empty($this->sid) && !empty($this->token);
    }

    /**
     * Invia un messaggio WhatsApp
     *
     * @param string $to  Numero in formato internazionale es. +393401234567
     * @param string $body Corpo del messaggio (max 4096 caratteri)
     */
    public function send(string $to, string $body): bool
    {
        if (!$this->enabled) {
            Log::info('[WhatsApp] Servizio non configurato. Messaggio non inviato.', [
                'to' => $to, 'body' => $body,
            ]);
            return false;
        }

        $toWhatsApp = 'whatsapp:' . $to;

        try {
            $url  = "https://api.twilio.com/2010-04-01/Accounts/{$this->sid}/Messages.json";
            $data = http_build_query([
                'From' => $this->from,
                'To'   => $toWhatsApp,
                'Body' => $body,
            ]);

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $data,
                CURLOPT_USERPWD        => "{$this->sid}:{$this->token}",
                CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_TIMEOUT        => 10,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            $decoded = json_decode($response, true);

            if ($httpCode >= 200 && $httpCode < 300) {
                Log::info('[WhatsApp] Messaggio inviato', ['to' => $to, 'sid' => $decoded['sid'] ?? '']);
                return true;
            }

            Log::error('[WhatsApp] Errore invio', [
                'to' => $to, 'status' => $httpCode, 'response' => $decoded,
            ]);
            return false;

        } catch (\Throwable $e) {
            Log::error('[WhatsApp] Eccezione', ['to' => $to, 'error' => $e->getMessage()]);
            return false;
        }
    }

    /** Messaggio benvenuto dopo primo acquisto */
    public function sendWelcome(string $to, string $nome, int $punti): bool
    {
        $body = "🎉 Benvenuto {$nome}!\n"
              . "Il tuo primo acquisto ti ha fatto guadagnare *{$punti} punti fedeltà*.\n"
              . "Continua ad acquistare per raggiungere il livello Silver e ottenere sconti esclusivi! 💜";
        return $this->send($to, $body);
    }

    /** Messaggio salto tier */
    public function sendTierUpgrade(string $to, string $nome, string $nuovoTier): bool
    {
        $emoji = match(strtolower($nuovoTier)) {
            'silver' => '⭐',
            'gold'   => '🏆',
            'platinum' => '💎',
            default  => '🎯',
        };
        $body = "{$emoji} Complimenti {$nome}!\n"
              . "Hai raggiunto il livello *{$nuovoTier}*!\n"
              . "Da ora hai accesso a vantaggi esclusivi. Grazie per la tua fedeltà! 💜";
        return $this->send($to, $body);
    }

    /** Messaggio compleanno con coupon */
    public function sendBirthday(string $to, string $nome, string $couponCode = ''): bool
    {
        $body = "🎂 Buon compleanno {$nome}!\n"
              . "Ti facciamo gli auguri con un regalo speciale:\n";
        if ($couponCode) {
            $body .= "Usa il codice *{$couponCode}* per avere il 10% di sconto sul tuo prossimo acquisto! 🎁";
        } else {
            $body .= "Vieni a trovarci per un pensiero speciale! 🎁";
        }
        return $this->send($to, $body);
    }

    /** Notifica ordine confermato */
    public function sendOrderConfirm(string $to, string $nome, int $orderId, float $totale): bool
    {
        $body = "✅ Ordine #{$orderId} confermato!\n"
              . "Ciao {$nome}, il tuo ordine da €" . number_format($totale, 2, ',', '.') . " è stato registrato.\n"
              . "Grazie per aver scelto il nostro negozio! 💜";
        return $this->send($to, $body);
    }
}
