<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class EmployeeNotificationService
{
    public function notifySaleConfirmed(int $tenantId, int $employeeId, int $orderId, float $amount, int $pointsEarned): void
    {
        DB::table('employee_notifications')->insert([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
            'type' => 'sale_confirmed',
            'title' => 'Vendita confermata',
            'body' => 'Ordine #' . $orderId . ' — € ' . number_format($amount, 2, ',', '.') . ' — +' . $pointsEarned . ' punti',
            'reference_type' => 'order',
            'reference_id' => $orderId,
            'is_read' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function notifyPointsEarned(int $tenantId, int $employeeId, int $points, string $source): void
    {
        DB::table('employee_notifications')->insert([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
            'type' => 'points_earned',
            'title' => 'Punti guadagnati',
            'body' => '+' . $points . ' punti da ' . $source,
            'reference_type' => 'points',
            'reference_id' => null,
            'is_read' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function getUnread(int $tenantId, int $employeeId, int $limit = 20): array
    {
        return DB::table('employee_notifications')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('is_read', false)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->all();
    }

    public function markAsRead(int $tenantId, int $employeeId, int $notificationId): bool
    {
        return DB::table('employee_notifications')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('id', $notificationId)
            ->update([
                'is_read' => true,
                'read_at' => now(),
                'updated_at' => now(),
            ]) > 0;
    }

    public function markAllAsRead(int $tenantId, int $employeeId): int
    {
        return DB::table('employee_notifications')
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
                'updated_at' => now(),
            ]);
    }
}
