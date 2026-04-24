<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupDummyEmployees extends Command
{
    protected $signature = 'app:cleanup-dummy-employees';
    protected $description = 'Deletes dummy employees that have the same name as a store';

    public function handle()
    {
        $stores = DB::table('stores')->get();
        $totalDeleted = 0;

        foreach ($stores as $store) {
            $storeName = strtolower(trim($store->name));
            // Remove "negozio " from the beginning if present
            $storeName = str_replace('negozio ', '', $storeName);

            $deleted = DB::table('employees')
                ->where(DB::raw('LOWER(first_name)'), 'LIKE', '%' . $storeName . '%')
                ->orWhere(DB::raw('LOWER(last_name)'), 'LIKE', '%' . $storeName . '%')
                ->delete();

            if ($deleted > 0) {
                $this->info("Deleted $deleted dummy employees matching store: $storeName");
                $totalDeleted += $deleted;
            }
        }
        
        // Also explicitly look for "capodrise" just in case
        $deletedCapo = DB::table('employees')
            ->where(DB::raw('LOWER(first_name)'), 'LIKE', '%capodrise%')
            ->orWhere(DB::raw('LOWER(last_name)'), 'LIKE', '%capodrise%')
            ->delete();

        if ($deletedCapo > 0) {
             $this->info("Deleted $deletedCapo dummy employees matching 'capodrise'");
             $totalDeleted += $deletedCapo;
        }

        $this->info("Cleanup complete. Total dummy employees deleted: $totalDeleted");
    }
}
