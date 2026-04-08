<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica Email — SvaPro</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #6C63AC, #9B8FD4); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 800; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; color: #1C1B2E; margin-bottom: 16px; }
    .otp-box { background: #f8f6ff; border: 2px solid #9B8FD4; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #6C63AC; font-family: monospace; }
    .otp-label { font-size: 12px; color: #9CA3AF; margin-top: 8px; }
    .note { font-size: 13px; color: #9CA3AF; margin-top: 16px; line-height: 1.6; }
    .footer { background: #f9f9f9; padding: 20px 32px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✉️ Verifica la tua email</h1>
      <p>SvaPro — Gestionale</p>
    </div>
    <div class="body">
      @if($customerName)
        <p class="greeting">Ciao <strong>{{ $customerName }}</strong>,</p>
      @else
        <p class="greeting">Ciao,</p>
      @endif
      <p style="color:#4B5563; font-size:14px; line-height:1.6;">
        Usa il codice qui sotto per verificare il tuo indirizzo email. Il codice è valido per <strong>10 minuti</strong>.
      </p>
      <div class="otp-box">
        <div class="otp-code">{{ $otp }}</div>
        <div class="otp-label">Codice di verifica</div>
      </div>
      <p class="note">
        Se non hai richiesto questa verifica, ignora questa email.<br>
        Non condividere mai questo codice con nessuno.
      </p>
    </div>
    <div class="footer">
      SvaPro — Gestionale Negozio &bull; Inviato automaticamente dal sistema
    </div>
  </div>
</body>
</html>
