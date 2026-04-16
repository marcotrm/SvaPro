<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DailyReportController extends Controller
{
    public function getLatest(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        
        $notif = DB::table('employee_notifications')
            ->where('tenant_id', $tenantId)
            ->where('type', 'daily_report')
            ->whereDate('created_at', Carbon::today())
            ->first();

        if ($notif) {
            return response()->json([
                'available' => true,
                'message' => $notif->body,
                'date' => Carbon::parse($notif->created_at)->format('Y-m-d')
            ]);
        }

        return response()->json([
            'available' => false
        ]);
    }

    public function download(Request $request)
    {
        $tenantId = $request->attributes->get('tenant_id');
        $date = Carbon::today()->format('Y-m-d');
        
        $fileName = "daily_closing_tenant_{$tenantId}_{$date}.pdf";
        $path = storage_path("app/public/reports/" . $fileName);

        if (!file_exists($path)) {
            return response()->json(['message' => 'Report non trovato.'], 404);
        }

        return response()->download($path, "Chiusura_SvaPro_{$date}.pdf", [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
