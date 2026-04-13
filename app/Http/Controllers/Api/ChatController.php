<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChatController extends Controller
{
    /** GET /chat/messages — messaggi del negozio (con polling) */
    public function index(Request $request)
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;
        $storeId  = $request->query('store_id');

        // Enforcement Sicurezza
        if ($user->role === 'dipendente' && $user->employee_store_id) {
            $storeId = $user->employee_store_id;
        }

        $since = $request->query('since');
        $priority = $request->query('priority', 'normal');

        $query = DB::table('chat_messages as cm')
            ->leftJoin('stores as st', 'st.id', '=', 'cm.store_id')
            ->where('cm.tenant_id', $tenantId)
            ->where('cm.priority', $priority)
            ->orderBy('cm.created_at', 'asc')
            ->select('cm.*', 'st.name as store_name')
            ->limit(100);

        // Filtra per negozio o messaggi broadcast (store_id null)
        if ($storeId) {
            $query->where(function ($q) use ($storeId) {
                $q->where('cm.store_id', $storeId)->orWhereNull('cm.store_id');
            });
        }

        if ($since) {
            $query->where('cm.created_at', '>', $since);
        }

        $messages = $query->get();

        // Conta non letti
        $unreadCount = DB::table('chat_messages')
            ->where('tenant_id', $tenantId)
            ->where('priority', $priority)
            ->whereNull('read_at')
            ->where('sender_user_id', '!=', $request->user()->id)
            ->when($storeId, fn($q) => $q->where(fn($q2) => $q2->where('store_id', $storeId)->orWhereNull('store_id')))
            ->count();

        return response()->json([
            'data'         => $messages,
            'unread_count' => $unreadCount,
        ]);
    }

    /** POST /chat/messages — invia messaggio */
    public function store(Request $request)
    {
        $data = $request->validate([
            'message'       => 'required|string|max:1000',
            'store_id'      => 'nullable|integer',
            'priority'      => 'nullable|in:normal,urgent',
            'operator_name' => 'nullable|string|max:100',
            'operator_code' => 'nullable|string|max:100',
        ]);
        $priority = $data['priority'] ?? 'normal';

        $user = $request->user();

        // Ottieni ruolo dell'utente
        $role = DB::table('user_roles as ur')
            ->join('roles as r', 'r.id', '=', 'ur.role_id')
            ->where('ur.user_id', $user->id)
            ->value('r.code') ?? 'unknown';

        // Enforcement Sicurezza: un dipendente può mandare messaggi solo al suo store
        $storeId = $data['store_id'] ?? null;
        if ($role === 'dipendente' && $user->employee_store_id) {
            $storeId = $user->employee_store_id;
        }

        // Risolvi nome mittente: prova name, poi first+last da employees
        $senderName = trim($user->name ?? '');
        if (!$senderName) {
            $emp = DB::table('employees')
                ->where('user_id', $user->id)
                ->first(['first_name', 'last_name']);
            if ($emp) {
                $senderName = trim(($emp->first_name ?? '') . ' ' . ($emp->last_name ?? ''));
            }
        }
        if (!$senderName) {
            $senderName = $user->email ?? 'Operatore';
        }
        // Il frontend può passare il nome risolto dal barcode
        if (!empty($data['operator_name'])) {
            $senderName = $data['operator_name'];
        }

        // Nome negozio del mittente
        $storeName = $storeId ? DB::table('stores')->where('id', $storeId)->value('name') : null;

        $id = DB::table('chat_messages')->insertGetId([
            'tenant_id'      => $user->tenant_id,
            'store_id'       => $storeId,
            'sender_user_id' => $user->id,
            'sender_name'    => $senderName,
            'sender_role'    => $role,
            'message'        => $data['message'],
            'priority'       => $priority,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $msg = DB::table('chat_messages')->where('id', $id)->first();

        return response()->json(['data' => $msg], 201);
    }

    /** POST /chat/messages/read — segna come letti */
    public function markRead(Request $request)
    {
        $user     = $request->user();
        $storeId  = $request->input('store_id');

        $query = DB::table('chat_messages')
            ->where('tenant_id', $user->tenant_id)
            ->whereNull('read_at')
            ->where('sender_user_id', '!=', $user->id);

        if ($storeId) {
            $query->where(fn($q) => $q->where('store_id', $storeId)->orWhereNull('store_id'));
        }

        $query->update(['read_at' => now(), 'read_by' => $user->id, 'updated_at' => now()]);

        return response()->json(['message' => 'Messaggi segnati come letti.']);
    }
}
