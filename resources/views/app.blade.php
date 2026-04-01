<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SvaPro — Gestionale</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="alternate icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/brand-mark.svg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/main.jsx'])
</head>
<body>
    <script>
        window.onerror = function(msg, url, line, col, error) {
            console.error('DIAGNOSTIC ERROR:', msg, url, line, col, error);
            alert('CRITICAL ERROR:\n' + msg + '\nin ' + url + ' @ ' + line + ':' + col + '\nSee console for details.');
            document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: sans-serif;">' +
                '<h1>CRITICAL JS ERROR</h1>' +
                '<p>' + msg + '</p>' +
                '<code>' + url + ':' + line + '</code>' +
                '</div>';
        };
    </script>
    <div id="app"><div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; color:#7b8ba5;">Inizializzazione SvaPro...</div></div>
</body>
</html>
