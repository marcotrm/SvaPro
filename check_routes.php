<?php
$routes = json_decode(file_get_contents('routes_tmp.json'), true);
echo count($routes) . " total routes\n";
$perm = 0;
foreach ($routes as $r) {
    if (strpos($r['middleware'] ?? '', 'permission') !== false) {
        $perm++;
        echo "  PERM: " . $r['method'] . " " . $r['uri'] . " -> " . $r['middleware'] . "\n";
    }
}
echo $perm . " routes with permission middleware\n";
