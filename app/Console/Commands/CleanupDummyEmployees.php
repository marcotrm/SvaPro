<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CleanupDummyEmployees extends Command
{
    protected $signature = 'app:cleanup-dummy-employees';
    protected $description = 'Deletes dummy/orphan employees and all orphan shifts that reference deleted employees';

    public function handle()
    {
        $totalDeleted = 0;

        // ── 1. Delete employees whose name contains a store city/name ───────────
        $stores = DB::table('stores')->get();
        $keywords = ['capodrise']; // always include known bad ones

        foreach ($stores as $store) {
            $name = strtolower(trim($store->name));
            $name = str_replace('negozio ', '', $name);
            $city = strtolower(trim($store->city ?? ''));
            if ($name) $keywords[] = $name;
            if ($city) $keywords[] = $city;
        }
        $keywords = array_unique(array_filter($keywords));

        // Build query: delete employees whose first_name OR last_name match any keyword
        $query = DB::table('employees');
        $first = true;
        foreach ($keywords as $kw) {
            if ($first) {
                $query->whereRaw('LOWER(first_name) LIKE ?', ["%{$kw}%"])
                      ->orWhereRaw('LOWER(last_name) LIKE ?', ["%{$kw}%"]);
                $first = false;
            } else {
                $query->orWhereRaw('LOWER(first_name) LIKE ?', ["%{$kw}%"])
                      ->orWhereRaw('LOWER(last_name) LIKE ?', ["%{$kw}%"]);
            }
        }

        $dummyIds = $query->pluck('id')->toArray();

        if (!empty($dummyIds)) {
            // Delete their shifts first (FK safety)
            if (Schema::hasTable('employee_shifts')) {
                $deletedShifts = DB::table('employee_shifts')->whereIn('employee_id', $dummyIds)->delete();
                $this->info("Deleted {$deletedShifts} shifts belonging to dummy employees.");
            }
            $deleted = DB::table('employees')->whereIn('id', $dummyIds)->delete();
            $this->info("Deleted {$deleted} dummy employees: " . implode(', ', $dummyIds));
            $totalDeleted += $deleted;
        }

        // ── 2. Delete shifts whose employee_id no longer exists ────────────────
        if (Schema::hasTable('employee_shifts')) {
            $validEmpIds = DB::table('employees')->pluck('id');

            $orphanShiftsDeleted = DB::table('employee_shifts')
                ->whereNotIn('employee_id', $validEmpIds)
                ->delete();

            if ($orphanShiftsDeleted > 0) {
                $this->info("Deleted {$orphanShiftsDeleted} orphan shifts (employee no longer exists).");
            }
        }

        // ── 3. Delete shift_templates whose store_id no longer exists ──────────
        if (Schema::hasTable('shift_templates')) {
            $validStoreIds = DB::table('stores')->pluck('id');

            $orphanTemplates = DB::table('shift_templates')
                ->whereNotNull('store_id')
                ->whereNotIn('store_id', $validStoreIds)
                ->delete();

            if ($orphanTemplates > 0) {
                $this->info("Deleted {$orphanTemplates} orphan shift templates.");
            }
        }

        $this->info("✅ Cleanup complete. Total dummy employees deleted: {$totalDeleted}");
    }
}
