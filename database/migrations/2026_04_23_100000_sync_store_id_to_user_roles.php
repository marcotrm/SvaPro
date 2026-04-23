<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Assegna store_id agli utenti dei negozi che ce l'hanno null in user_roles,
     * usando come riferimento incrociato la tabella employees.
     * Safe: non tocca righe che hanno già store_id valorizzato.
     */
    public function up(): void
    {
        // Prendi tutti i user_roles con store_id NULL
        $nullStoreRoles = DB::table('user_roles as ur')
            ->join('roles as r', 'r.id', '=', 'ur.role_id')
            ->whereNull('ur.store_id')
            ->whereIn('r.code', ['dipendente', 'store_manager', 'admin_cliente'])
            ->select('ur.id as ur_id', 'ur.user_id', 'ur.tenant_id')
            ->get();

        foreach ($nullStoreRoles as $ur) {
            // Cerca lo store_id dalla tabella employees
            $storeId = DB::table('employees')
                ->where('user_id', $ur->user_id)
                ->where('tenant_id', $ur->tenant_id)
                ->whereNotNull('store_id')
                ->value('store_id');

            if ($storeId) {
                DB::table('user_roles')
                    ->where('id', $ur->ur_id)
                    ->update(['store_id' => $storeId]);
            }
        }
    }

    public function down(): void
    {
        // Non revertiamo: troppo rischioso azzerare store_id
    }
};
