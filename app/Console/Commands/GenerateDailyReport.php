<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class GenerateDailyReport extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:daily-report';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generates the daily closing report for all stores, saves it as PDF, and sends WhatsApp alert via n8n.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $today = Carbon::today()->format('Y-m-d');
        $startOfDay = Carbon::today()->startOfDay()->format('Y-m-d H:i:s');
        $endOfDay = Carbon::today()->endOfDay()->format('Y-m-d H:i:s');

        $tenants = DB::table('tenants')->get();

        foreach ($tenants as $tenant) {
            $tenantId = $tenant->id;
            
            $stores = DB::table('stores')->where('tenant_id', $tenantId)->get();
            $storeStats = [];
            $totalIncasso = 0;
            $totalScontrini = 0;
            $totalResi = 0;

            foreach ($stores as $store) {
                // Incasso totale e Scontrini
                $salesData = DB::table('sales_orders')
                    ->where('tenant_id', $tenantId)
                    ->where('store_id', $store->id)
                    ->where('status', 'paid')
                    ->whereBetween('created_at', [$startOfDay, $endOfDay])
                    ->select(DB::raw('COUNT(id) as count'), DB::raw('SUM(total_amount) as total'))
                    ->first();

                // Resi
                $returns = DB::table('customer_returns')
                    ->where('tenant_id', $tenantId)
                    ->where('store_id', $store->id)
                    ->whereBetween('created_at', [$startOfDay, $endOfDay])
                    ->count();

                // Dipendente top
                $topEmployeeId = DB::table('sales_orders')
                    ->where('tenant_id', $tenantId)
                    ->where('store_id', $store->id)
                    ->where('status', 'paid')
                    ->whereBetween('created_at', [$startOfDay, $endOfDay])
                    ->whereNotNull('employee_id')
                    ->groupBy('employee_id')
                    ->select('employee_id', DB::raw('SUM(total_amount) as total_sold'))
                    ->orderByDesc('total_sold')
                    ->first();

                $topEmployeeName = 'Nessuno';
                if ($topEmployeeId) {
                    $emp = DB::table('employees')->where('id', $topEmployeeId->employee_id)->first();
                    if ($emp) {
                        $topEmployeeName = $emp->first_name . ' ' . $emp->last_name;
                    }
                }

                $sIncasso = (float)($salesData->total ?? 0);
                $sScontrini = (int)($salesData->count ?? 0);
                
                $totalIncasso += $sIncasso;
                $totalScontrini += $sScontrini;
                $totalResi += $returns;

                $storeStats[] = [
                    'name' => $store->name,
                    'incasso' => $sIncasso,
                    'scontrini' => $sScontrini,
                    'resi' => $returns,
                    'top_employee' => $topEmployeeName,
                ];
            }

            // Dati completi
            $data = [
                'tenant_name' => $tenant->name ?? 'SvaPro',
                'date' => Carbon::now()->format('d/m/Y'),
                'store_stats' => $storeStats,
                'total_incasso' => $totalIncasso,
                'total_scontrini' => $totalScontrini,
                'total_resi' => $totalResi,
            ];

            // Render PDF
            $pdf = Pdf::loadView('reports.daily', $data);
            $fileName = "daily_closing_tenant_{$tenantId}_{$today}.pdf";
            $path = storage_path("app/public/reports/" . $fileName);
            
            // Assicurarsi che la cartella esista
            if (!file_exists(storage_path("app/public/reports"))) {
                mkdir(storage_path("app/public/reports"), 0755, true);
            }
            $pdf->save($path);

            // Inserisci / Aggiorna in employee_notifications
            DB::table('employee_notifications')->updateOrInsert(
                [
                    'tenant_id' => $tenantId,
                    'type' => 'daily_report',
                    'title' => 'Report Serale Pronto',
                ],
                [
                    'employee_id' => 0, // 0 = system-wide
                    'body' => "Il report di chiusura odierno (" . Carbon::now()->format('d/m/Y') . ") è pronto. Incasso netto totale: €" . number_format($totalIncasso, 2, ',', '.') . ".",
                    'is_read' => false,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Webhook a N8N
            $n8nUrl = env('N8N_WEBHOOK_URL');
            $notifyPhone = env('NOTIFICATION_PHONE_NUMBER');

            if ($n8nUrl && $notifyPhone) {
                // Testo per WhatsApp o Telegram
                $messageText = sprintf(
                    "📊 *Report Serale %s*\n\n💰 Incasso Totale: €%s\n🧾 Scontrini emessi: %d\n🔄 Resi totali: %d\n\n_Accedi al gestionale sulla campanella in alto a destra per scaricare e analizzare il PDF completo di tutti i negozi._",
                    Carbon::now()->format('d/m/Y'),
                    number_format($totalIncasso, 2, ',', '.'),
                    $totalScontrini,
                    $totalResi
                );

                try {
                    Http::post($n8nUrl, [
                        'type' => 'daily_closing',
                        'tenant_id' => $tenantId,
                        'phone_number' => $notifyPhone,
                        'message' => $messageText,
                        'reports_url' => url("/api/reports/daily/download?tenant_id={$tenantId}"),
                        'raw_data' => $data
                    ]);
                } catch (\Throwable $e) {
                    $this->error("Errore webhook n8n: " . $e->getMessage());
                }
            }
        }

        $this->info("Daily report generated successfully.");
    }
}
