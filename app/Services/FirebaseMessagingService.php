<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Firebase Cloud Messaging service via FCM HTTP v1 API.
 * Uses Laravel HTTP client + JWT OAuth2 service account auth.
 * No external SDK required.
 *
 * Setup:
 * 1. Create a project on console.firebase.google.com
 * 2. Project settings -> Service accounts -> Generate new private key
 * 3. Place the JSON at: storage/app/private/firebase-credentials.json
 * 4. Set FIREBASE_CREDENTIALS_PATH in .env
 */
class FirebaseMessagingService
{
    protected ?string $projectId = null;
    protected ?string $credentialsPath = null;
    protected ?string $accessToken = null;
    protected ?int $tokenExpiresAt = null;

    public function __construct()
    {
        $path = config('services.firebase.credentials_path');

        if (!$path || !file_exists($path)) {
            return;
        }

        $this->credentialsPath = $path;

        try {
            $credentials = json_decode(file_get_contents($path), true);
            $this->projectId = $credentials['project_id'] ?? null;
        } catch (\Exception $e) {
            Log::error('Firebase credentials parse error: ' . $e->getMessage());
        }
    }

    /**
     * Send a push notification to a single device token
     */
    public function sendNotification(string $deviceToken, array $data): bool
    {
        if (!$this->isEnabled()) {
            return false;
        }

        try {
            $token = $this->getAccessToken();
            if (!$token) {
                return false;
            }

            $response = Http::withToken($token)
                ->post("https://fcm.googleapis.com/v1/projects/{$this->projectId}/messages:send", [
                    'message' => [
                        'token' => $deviceToken,
                        'notification' => [
                            'title' => $data['title'] ?? 'Notifica',
                            'body' => $data['body'] ?? '',
                        ],
                        'data' => array_map('strval', $data['custom_data'] ?? []),
                        'webpush' => [
                            'fcm_options' => [
                                'link' => $data['deep_link'] ?? '',
                            ],
                        ],
                    ],
                ]);

            if ($response->status() === 200) {
                return true;
            }

            if ($response->status() === 404) {
                Log::info("FCM: Device token not found/unregistered: {$deviceToken}");
                return false;
            }

            Log::error('FCM send error ' . $response->status() . ': ' . $response->body());
            return false;
        } catch (\Exception $e) {
            Log::error('FCM exception: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Send push notifications to multiple device tokens
     */
    public function sendToMultipleDevices(array $deviceTokens, array $data): array
    {
        $successCount = 0;
        $failedTokens = [];

        foreach ($deviceTokens as $token) {
            if ($this->sendNotification($token, $data)) {
                $successCount++;
            } else {
                $failedTokens[] = $token;
            }
        }

        return [
            'success_count' => $successCount,
            'failed_tokens' => $failedTokens,
            'failed_count' => count($failedTokens),
        ];
    }

    /**
     * Check if Firebase is configured and ready
     */
    public function isEnabled(): bool
    {
        return $this->credentialsPath !== null && $this->projectId !== null;
    }

    /**
     * Obtain a valid OAuth2 access token via JWT service account assertion.
     * Caches the token until ~1 minute before expiry.
     */
    protected function getAccessToken(): ?string
    {
        if ($this->accessToken && $this->tokenExpiresAt && time() < $this->tokenExpiresAt - 60) {
            return $this->accessToken;
        }

        try {
            $credentials = json_decode(file_get_contents($this->credentialsPath), true);

            $now = time();
            $encodeBase64Url = fn (string $data): string => rtrim(strtr(base64_encode($data), '+/', '-_'), '=');

            $header = $encodeBase64Url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
            $claim = $encodeBase64Url(json_encode([
                'iss' => $credentials['client_email'],
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => 'https://oauth2.googleapis.com/token',
                'iat' => $now,
                'exp' => $now + 3600,
            ]));

            $signingInput = "{$header}.{$claim}";
            openssl_sign($signingInput, $rawSig, $credentials['private_key'], OPENSSL_ALGO_SHA256);
            $jwt = "{$signingInput}." . $encodeBase64Url($rawSig);

            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

            if ($response->ok()) {
                $this->accessToken = $response->json('access_token');
                $this->tokenExpiresAt = $now + (int) $response->json('expires_in', 3600);
                return $this->accessToken;
            }

            Log::error('FCM token request failed: ' . $response->body());
            return null;
        } catch (\Exception $e) {
            Log::error('FCM access token error: ' . $e->getMessage());
            return null;
        }
    }
}
