<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migrazione completamente idempotente (sicura su PostgreSQL e MySQL).
 * Utilizza hasTable() e hasColumn() per ogni operazione.
 * Nessun ->after() (non supportato da PostgreSQL).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Ordini di Riassortimento ──────────────────────────────────────────
        if (!Schema::hasTable('restock_orders')) {
            Schema::create('restock_orders', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('store_id');
                $table->unsignedBigInteger('created_by');
                $table->string('order_number')->unique();
                $table->enum('status', ['draft', 'confirmed', 'preparing', 'shipped', 'cancelled'])->default('draft');
                $table->text('notes')->nullable();
                $table->date('expected_delivery_date')->nullable();
                $table->unsignedBigInteger('delivery_note_id')->nullable();
                $table->timestamp('confirmed_at')->nullable();
                $table->timestamp('preparing_at')->nullable();
                $table->timestamp('shipped_at')->nullable();
                $table->timestamps();

                $table->index(['tenant_id', 'store_id']);
                $table->index(['tenant_id', 'status']);
            });
        }

        // ── Righe Ordine Riassortimento ───────────────────────────────────────
        if (!Schema::hasTable('restock_order_items')) {
            Schema::create('restock_order_items', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('restock_order_id');
                $table->unsignedBigInteger('product_variant_id')->nullable();
                $table->string('product_name');
                $table->string('barcode')->nullable();
                $table->string('sku')->nullable();
                $table->integer('requested_qty')->default(1);
                $table->timestamps();

                $table->foreign('restock_order_id')
                    ->references('id')->on('restock_orders')
                    ->onDelete('cascade');
            });
        }

        // ── Colonne extra su delivery_notes ───────────────────────────────────
        if (Schema::hasTable('delivery_notes')) {
            Schema::table('delivery_notes', function (Blueprint $table) {
                if (!Schema::hasColumn('delivery_notes', 'source')) {
                    $table->string('source')->default('manual')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'restock_order_id')) {
                    $table->unsignedBigInteger('restock_order_id')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'prepared_at')) {
                    $table->timestamp('prepared_at')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'shipped_at')) {
                    $table->timestamp('shipped_at')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'verification_started_at')) {
                    $table->timestamp('verification_started_at')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'verification_completed_at')) {
                    $table->timestamp('verification_completed_at')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'has_discrepancy')) {
                    $table->boolean('has_discrepancy')->default(false);
                }
                if (!Schema::hasColumn('delivery_notes', 'brt_api_response')) {
                    $table->json('brt_api_response')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'tracking_number')) {
                    $table->string('tracking_number')->nullable();
                }
                if (!Schema::hasColumn('delivery_notes', 'carrier_status')) {
                    $table->string('carrier_status')->nullable();
                }
            });
        }

        // ── scanned_qty su delivery_note_items ────────────────────────────────
        if (Schema::hasTable('delivery_note_items')) {
            Schema::table('delivery_note_items', function (Blueprint $table) {
                if (!Schema::hasColumn('delivery_note_items', 'scanned_qty')) {
                    $table->integer('scanned_qty')->default(0);
                }
            });
        }

        // ── Credenziali BRT su tenant_settings ────────────────────────────────
        if (Schema::hasTable('tenant_settings')) {
            Schema::table('tenant_settings', function (Blueprint $table) {
                if (!Schema::hasColumn('tenant_settings', 'brt_user_id')) {
                    $table->string('brt_user_id')->nullable();
                }
                if (!Schema::hasColumn('tenant_settings', 'brt_password')) {
                    $table->string('brt_password')->nullable();
                }
                if (!Schema::hasColumn('tenant_settings', 'brt_numeric_sender_id')) {
                    $table->string('brt_numeric_sender_id')->nullable();
                }
                if (!Schema::hasColumn('tenant_settings', 'brt_department')) {
                    $table->string('brt_department')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('restock_order_items');
        Schema::dropIfExists('restock_orders');

        if (Schema::hasTable('delivery_notes')) {
            $cols = ['source', 'restock_order_id', 'prepared_at', 'shipped_at',
                     'verification_started_at', 'verification_completed_at',
                     'has_discrepancy', 'brt_api_response', 'tracking_number', 'carrier_status'];
            $existing = array_filter($cols, fn($c) => Schema::hasColumn('delivery_notes', $c));
            if ($existing) {
                Schema::table('delivery_notes', fn(Blueprint $t) => $t->dropColumn(array_values($existing)));
            }
        }

        if (Schema::hasTable('delivery_note_items') && Schema::hasColumn('delivery_note_items', 'scanned_qty')) {
            Schema::table('delivery_note_items', fn(Blueprint $t) => $t->dropColumn('scanned_qty'));
        }

        if (Schema::hasTable('tenant_settings')) {
            $cols = ['brt_user_id', 'brt_password', 'brt_numeric_sender_id', 'brt_department'];
            $existing = array_filter($cols, fn($c) => Schema::hasColumn('tenant_settings', $c));
            if ($existing) {
                Schema::table('tenant_settings', fn(Blueprint $t) => $t->dropColumn(array_values($existing)));
            }
        }
    }
};
