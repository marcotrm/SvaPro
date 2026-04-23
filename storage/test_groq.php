<?php
require 'vendor/autoload.php';
$env = file_get_contents('.env');
preg_match('/GROQ_API_KEY=(.*)/', $env, $m);
$apiKey = trim($m[1]);
$payload = [
    'model' => 'llama3-70b-8192',
    'temperature' => 0,
    'messages' => [['role' => 'user', 'content' => 'Prepara riordino per Napoli']],
    'tools' => [[
        'type' => 'function',
        'function' => [
            'name' => 'proponi_riordino',
            'description' => 'Genera proposta',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'motivazione' => ['type' => 'string'],
                    'ordini' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'from_store_id' => ['type' => 'integer'],
                                'to_store_id' => ['type' => 'integer']
                            ]
                        ]
                    ]
                ],
                'required' => ['motivazione', 'ordini']
            ]
        ]
    ]]
];
$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json']);
$res = curl_exec($ch);
echo $res;
