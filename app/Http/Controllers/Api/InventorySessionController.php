<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventorySessionController extends Controller
{
    // Helper: genera numero bolla
    private function nextNumber(int $tenantId): string {
        $count = DB::table('inventory_sessions')->where('tenant_id',$tenantId)->count() + 1;
        return 'INV-'.date('Y').'-'.str_pad($count,4,'0',STR_PAD_LEFT);
    }

    // Helper: log audit
    private function auditLog(int $tenantId, int $userId, string $action, ?int $sessionId=null, ?int $itemId=null, $old=null, $new=null, ?string $note=null): void {
        DB::table('inventory_audit_logs')->insert(['tenant_id'=>$tenantId,'user_id'=>$userId,'action'=>$action,'inventory_session_id'=>$sessionId,'inventory_item_id'=>$itemId,'old_value'=>$old?json_encode($old):null,'new_value'=>$new?json_encode($new):null,'note'=>$note,'created_at'=>now()]);
    }

    // --- ADMIN: lista bolle ---
    public function index(Request $request) {
        $tid    = (int)$request->attributes->get('tenant_id');
        $userId = $request->user()->id;

        // Determina i ruoli dell'utente
        $roleCodes = DB::table('user_roles')
            ->join('roles','roles.id','=','user_roles.role_id')
            ->where('user_roles.user_id', $userId)
            ->pluck('roles.code')->all();
        $isSuperAdmin = in_array('superadmin', $roleCodes);

        // Se l'utente non è superadmin e ha uno store assegnato in user_roles, filtra automaticamente
        $forcedStoreId = null;
        if (!$isSuperAdmin) {
            $forcedStoreId = DB::table('user_roles')
                ->where('user_id', $userId)
                ->whereNotNull('store_id')
                ->value('store_id');
        }

        $q = DB::table('inventory_sessions as s')
            ->leftJoin('stores as st','st.id','=','s.store_id')
            ->where('s.tenant_id',$tid)
            ->select('s.*','st.name as store_name');

        // Filtro store: forzato (admin negozio) oppure opzionale (superadmin/admin_centrale)
        if ($forcedStoreId) {
            $q->where('s.store_id', $forcedStoreId);
        } elseif ($request->filled('store_id')) {
            $q->where('s.store_id', $request->integer('store_id'));
        }

        if($request->filled('status'))    $q->where('s.status',$request->input('status'));
        if($request->filled('date_from')) $q->where('s.created_at','>=',$request->input('date_from'));
        if($request->filled('date_to'))   $q->where('s.created_at','<=',$request->input('date_to'));

        $sessions = $q->orderByDesc('s.id')->paginate(50);
        $ids = collect($sessions->items())->pluck('id')->toArray();
        $counts = DB::table('inventory_items')->whereIn('inventory_session_id',$ids)
            ->selectRaw('inventory_session_id, COUNT(*) as total, SUM(CASE WHEN status=\'MATCHED\' THEN 1 ELSE 0 END) as matched, SUM(CASE WHEN status=\'MISMATCHED\' THEN 1 ELSE 0 END) as mismatched, SUM(CASE WHEN status=\'NOT_COUNTED\' THEN 1 ELSE 0 END) as not_counted')
            ->groupBy('inventory_session_id')->get()->keyBy('inventory_session_id');
        $data = collect($sessions->items())->map(function($s) use($counts){
            $c = $counts->get($s->id);
            $s->summary = ['total'=>$c?$c->total:0,'matched'=>$c?$c->matched:0,'mismatched'=>$c?$c->mismatched:0,'not_counted'=>$c?$c->not_counted:0,'accuracy'=>($c&&$c->total>0)?round($c->matched/$c->total*100,1):0];
            return $s;
        });
        return response()->json(['data'=>$data,'meta'=>['total'=>$sessions->total(),'last_page'=>$sessions->lastPage()]]);
    }

    // --- ADMIN: crea bolla ---
    public function store(Request $request) {
        $tid = (int)$request->attributes->get('tenant_id');
        $userId = $request->user()->id;
        $request->validate(['title'=>'required|string|max:255','store_id'=>'required|integer','due_date'=>'nullable|date']);
        $storeId = $request->integer('store_id');
        if(!DB::table('stores')->where('tenant_id',$tid)->where('id',$storeId)->exists())
            return response()->json(['message'=>'Store non valido'],422);
        // Warehouse del negozio
        $whId = DB::table('warehouses')->where('tenant_id',$tid)->where('store_id',$storeId)->value('id');
        // Filtri prodotti — brands/categories sono tabelle separate, cost_price è su product_variants
        $filters = $request->input('filters',[]) ?? [];
        if (is_string($filters)) $filters = json_decode($filters, true) ?? [];
        $pq = DB::table('product_variants as pv')
            ->join('products as p','p.id','=','pv.product_id')
            ->leftJoin('brands as br','br.id','=','p.brand_id')
            ->leftJoin('categories as cat','cat.id','=','p.category_id')
            ->where('p.tenant_id',$tid)->where('p.is_active',true)
            ->select('pv.id','p.name as product_name','br.name as brand_name','cat.name as category_name',
                     'pv.barcode','p.sku as sku','pv.flavor','pv.cost_price','p.image_url','p.product_type');
        if (!empty($filters['brand_id']))      $pq->where('p.brand_id', (int)$filters['brand_id']);
        if (!empty($filters['category_id']))   $pq->where('p.category_id', (int)$filters['category_id']);
        if (!empty($filters['product_type']))  $pq->where('p.product_type', $filters['product_type']);
        if (!empty($filters['product_variant_id'])) $pq->where('pv.id', (int)$filters['product_variant_id']);
        if (!empty($filters['name']))          $pq->where(function($q) use($filters) {
            $q->where('p.name','ilike','%'.$filters['name'].'%')
              ->orWhere('p.sku','ilike','%'.$filters['name'].'%')
              ->orWhere('pv.barcode','ilike','%'.$filters['name'].'%')
              ->orWhere('p.barcode','ilike','%'.$filters['name'].'%');
        });
        $variants = $pq->get();
        // Stock teorico per ogni variante
        $stockMap = [];
        if($whId){
            $stocks = DB::table('stock_items')->where('warehouse_id',$whId)->whereIn('product_variant_id',$variants->pluck('id')->toArray())->pluck('on_hand','product_variant_id');
            $stockMap = $stocks->toArray();
        }
        DB::beginTransaction();
        try {
            $sessionId = DB::table('inventory_sessions')->insertGetId(['tenant_id'=>$tid,'inventory_number'=>$this->nextNumber($tid),'title'=>$request->input('title'),'description'=>$request->input('description'),'store_id'=>$storeId,'status'=>'SENT_TO_STORE','created_by'=>$userId,'opened_at'=>now(),'due_date'=>$request->input('due_date'),'notes_internal'=>$request->input('notes_internal'),'priority'=>$request->integer('priority',0),'filters'=>json_encode($filters),'created_at'=>now(),'updated_at'=>now()]);
            $onlyPositive = !empty($filters['only_positive_stock']);
            $rows = [];
            foreach($variants as $v){
                $qty = (int)($stockMap[$v->id]??0);
                if($onlyPositive && $qty<=0) continue;
                $rows[] = ['tenant_id'=>$tid,'inventory_session_id'=>$sessionId,'product_variant_id'=>$v->id,'theoretical_quantity'=>$qty,'counted_quantity'=>0,'status'=>'NOT_COUNTED','created_at'=>now(),'updated_at'=>now()];
            }
            if(empty($rows)){DB::rollBack();return response()->json(['message'=>'Nessun prodotto trovato con i filtri selezionati'],422);}
            foreach(array_chunk($rows,100) as $chunk) DB::table('inventory_items')->insert($chunk);
            $this->auditLog($tid,$userId,'create_session',$sessionId,null,null,['title'=>$request->input('title'),'items'=>count($rows)]);
            DB::commit();
            // Notifica store (employee notifications)
            try {
                $storeUsers = DB::table('users')->where('tenant_id',$tid)->where('store_id',$storeId)->pluck('id');
                foreach($storeUsers as $uid){
                    DB::table('employee_notifications')->insert(['tenant_id'=>$tid,'user_id'=>$uid,'type'=>'inventory','title'=>'Nuova bolla inventario','body'=>"Bolla \"{$request->input('title')}\" assegnata al tuo negozio.",'read_at'=>null,'created_at'=>now(),'updated_at'=>now()]);
                }
            }catch(\Exception $e){}
            return response()->json(['message'=>'Bolla creata','session_id'=>$sessionId,'items_count'=>count($rows)],201);
        } catch(\Exception $e){DB::rollBack();return response()->json(['message'=>'Errore: '.$e->getMessage()],500);}
    }

    // --- ADMIN: dettaglio bolla (con teorico) ---
    public function show(Request $request, int $id) {
        $tid = (int)$request->attributes->get('tenant_id');
        $session = DB::table('inventory_sessions as s')->leftJoin('stores as st','st.id','=','s.store_id')->where('s.tenant_id',$tid)->where('s.id',$id)->select('s.*','st.name as store_name')->first();
        if(!$session) return response()->json(['message'=>'Non trovata'],404);
        $items = DB::table('inventory_items as ii')
            ->join('product_variants as pv','pv.id','=','ii.product_variant_id')
            ->join('products as p','p.id','=','pv.product_id')
            ->leftJoin('brands as br','br.id','=','p.brand_id')
            ->leftJoin('categories as cat','cat.id','=','p.category_id')
            ->where('ii.inventory_session_id',$id)
            ->select('ii.*','p.name as product_name','br.name as brand_name','cat.name as category_name',
                     'pv.cost_price','pv.barcode','p.sku as sku','pv.flavor','p.image_url','p.product_type')
            ->orderBy('ii.status')->orderBy('p.name')->get()
            ->map(function($i) {
                $i->difference = $i->counted_quantity - $i->theoretical_quantity;
                $i->value_difference = round($i->difference * ($i->cost_price ?? 0), 2);
                return $i;
            });
        $total=$items->count(); $matched=$items->where('status','MATCHED')->count(); $mismatched=$items->where('status','MISMATCHED')->count();
        $session->summary=['total'=>$total,'matched'=>$matched,'mismatched'=>$mismatched,'not_counted'=>$items->where('status','NOT_COUNTED')->count(),'accuracy'=>$total>0?round($matched/$total*100,1):0,'difference_value'=>round($items->sum('value_difference'),2)];
        return response()->json(['data'=>$session,'items'=>$items]);
    }

    // --- ADMIN: aggiorna stato bolla ---
    public function updateStatus(Request $request, int $id) {
        $tid = (int)$request->attributes->get('tenant_id');
        $request->validate(['status'=>'required|string']);
        $session = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('id',$id)->first();
        if(!$session) return response()->json(['message'=>'Non trovata'],404);
        $old = $session->status;
        $upd = ['status'=>$request->input('status'),'updated_at'=>now()];
        if($request->input('status')==='APPROVED') $upd['approved_at']=now();
        if($request->input('status')==='UNDER_REVIEW') $upd['reviewed_at']=now();
        DB::table('inventory_sessions')->where('id',$id)->update($upd);
        $this->auditLog($tid,$request->user()->id,'status_change',$id,null,['status'=>$old],['status'=>$request->input('status')]);
        return response()->json(['message'=>'Stato aggiornato']);
    }

    // --- ADMIN: approva bolla ---
    public function approve(Request $request, int $id) {
        $tid = (int)$request->attributes->get('tenant_id');
        $session = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('id',$id)->first();
        if(!$session) return response()->json(['message'=>'Non trovata'],404);
        DB::table('inventory_sessions')->where('id',$id)->update(['status'=>'APPROVED','approved_at'=>now(),'updated_at'=>now()]);
        // Opzionale: applica rettifiche giacenze
        if($request->boolean('apply_stock_adjustments')) {
            $items = DB::table('inventory_items as ii')->join('product_variants as pv','pv.id','=','ii.product_variant_id')->where('ii.inventory_session_id',$id)->where('ii.status','MISMATCHED')->select('ii.*')->get();
            $whId = DB::table('warehouses')->where('tenant_id',$tid)->where('store_id',$session->store_id)->value('id');
            if($whId) foreach($items as $item){
                DB::table('stock_items')->where('warehouse_id',$whId)->where('product_variant_id',$item->product_variant_id)->update(['on_hand'=>$item->counted_quantity,'updated_at'=>now()]);
                DB::table('stock_movements')->insert(['tenant_id'=>$tid,'warehouse_id'=>$whId,'product_variant_id'=>$item->product_variant_id,'movement_type'=>'inventory_adjustment','qty'=>$item->counted_quantity-$item->theoretical_quantity,'reference_type'=>'inventory_session','reference_id'=>$id,'occurred_at'=>now(),'created_at'=>now(),'updated_at'=>now()]);
            }
        }
        $this->auditLog($tid,$request->user()->id,'approve',$id);
        return response()->json(['message'=>'Bolla approvata']);
    }

    // --- ADMIN: elimina bolla (solo DRAFT o CANCELLED) ---
    public function destroy(Request $request, int $id) {
        $tid    = (int)$request->attributes->get('tenant_id');
        $userId = $request->user()->id;
        $session = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('id',$id)->first();
        if (!$session) return response()->json(['message'=>'Bolla non trovata'],404);
        if (in_array($session->status, ['APPROVED','CLOSED_BY_STORE','UNDER_REVIEW'])) {
            return response()->json(['message'=>'Non puoi eliminare una bolla già chiusa o approvata'],422);
        }
        DB::beginTransaction();
        try {
            DB::table('inventory_scans')->where('inventory_session_id',$id)->delete();
            DB::table('inventory_items')->where('inventory_session_id',$id)->delete();
            DB::table('inventory_audit_logs')->where('inventory_session_id',$id)->delete();
            DB::table('inventory_sessions')->where('id',$id)->delete();
            DB::commit();
            $this->auditLog($tid,$userId,'delete',$id);
            return response()->json(['message'=>'Bolla eliminata']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message'=>'Errore: '.$e->getMessage()],500);
        }
    }

    // --- STORE: lista bolle assegnate ---
    public function storeIndex(Request $request) {
        $tid     = (int)$request->attributes->get('tenant_id');
        $storeId = (int)$request->attributes->get('store_id');
        if (!$storeId) return response()->json(['message'=>'Nessun negozio associato a questo account'],403);
        $sessions = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('store_id',$storeId)->whereNotIn('status',['DRAFT','CANCELLED'])->orderByDesc('id')->get();
        $ids = $sessions->pluck('id')->toArray();
        $counts = DB::table('inventory_items')->whereIn('inventory_session_id',$ids)
            ->selectRaw('inventory_session_id, COUNT(*) as total, SUM(CASE WHEN counted_quantity>0 THEN 1 ELSE 0 END) as counted')
            ->groupBy('inventory_session_id')->get()->keyBy('inventory_session_id');
        $data = $sessions->map(function($s) use($counts){
            $c = $counts->get($s->id);
            $s->total_items = $c?$c->total:0; $s->counted_items = $c?$c->counted:0;
            unset($s->notes_internal,$s->filters);
            return $s;
        });
        return response()->json(['data'=>$data]);
    }

    // --- STORE: dettaglio bolla (SENZA teorico) ---
    public function storeShow(Request $request, int $id) {
        $tid     = (int)$request->attributes->get('tenant_id');
        $storeId = (int)$request->attributes->get('store_id');
        if (!$storeId) return response()->json(['message'=>'Nessun negozio associato'],403);
        $session = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('id',$id)->where('store_id',$storeId)->first();
        if(!$session) return response()->json(['message'=>'Non trovata'],404);
        if(in_array($session->status,['DRAFT','CANCELLED'])) return response()->json(['message'=>'Non disponibile'],403);
        // Segna IN_PROGRESS se era SENT_TO_STORE
        if($session->status==='SENT_TO_STORE') DB::table('inventory_sessions')->where('id',$id)->update(['status'=>'IN_PROGRESS','updated_at'=>now()]);
        $items = DB::table('inventory_items as ii')
            ->join('product_variants as pv','pv.id','=','ii.product_variant_id')
            ->join('products as p','p.id','=','pv.product_id')
            ->leftJoin('brands as br','br.id','=','p.brand_id')
            ->leftJoin('categories as cat','cat.id','=','p.category_id')
            ->where('ii.inventory_session_id',$id)
            // IMPORTANTE: theoretical_quantity NON incluso — store non deve vederlo
            ->select('ii.id','ii.counted_quantity','ii.status','ii.store_note','ii.last_counted_at',
                     'p.name as product_name','br.name as brand_name','cat.name as category_name',
                     'p.image_url','p.product_type','pv.barcode','p.sku as sku','pv.flavor')
            ->orderBy('ii.status')->orderBy('p.name')->get();
        // Risposta senza theoretical_quantity, cost_price, difference
        $resp = (object)['id'=>$session->id,'inventory_number'=>$session->inventory_number,'title'=>$session->title,'status'=>$session->status,'due_date'=>$session->due_date,'notes_store'=>$session->notes_store];
        return response()->json(['data'=>$resp,'items'=>$items]);
    }

    // --- STORE: scansione barcode ---
    public function scan(Request $request, int $id) {
        $tid     = (int)$request->attributes->get('tenant_id');
        $storeId = (int)$request->attributes->get('store_id');
        $userId  = $request->user()->id;
        if (!$storeId) return response()->json(['message'=>'Nessun negozio associato'],403);
        $request->validate(['barcode'=>'required|string|max:150']);
        $session = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('id',$id)->where('store_id',$storeId)->first();
        if(!$session) return response()->json(['message'=>'Bolla non trovata'],404);
        if(!in_array($session->status,['SENT_TO_STORE','IN_PROGRESS','REOPENED'])) return response()->json(['message'=>'Bolla non modificabile'],422);
        $bc = $request->input('barcode');
        // Trova variante per barcode
        $variant = DB::table('product_variants as pv')->join('products as p','p.id','=','pv.product_id')->where('p.tenant_id',$tid)->where(function($q)use($bc){$q->where('pv.barcode',$bc)->orWhere('p.barcode',$bc)->orWhere('p.sku',$bc);})->select('pv.id','p.name')->first();
        if(!$variant){
            DB::table('inventory_scans')->insert(['tenant_id'=>$tid,'inventory_session_id'=>$id,'barcode'=>$bc,'scanned_by'=>$userId,'is_unexpected'=>true,'source'=>'BARCODE','created_at'=>now(),'updated_at'=>now()]);
            return response()->json(['success'=>false,'type'=>'NOT_IN_CATALOG','message'=>'Prodotto non trovato nel catalogo']);
        }
        // Cerca nella bolla
        $item = DB::table('inventory_items')->where('inventory_session_id',$id)->where('product_variant_id',$variant->id)->first();
        if(!$item){
            DB::table('inventory_scans')->insert(['tenant_id'=>$tid,'inventory_session_id'=>$id,'product_variant_id'=>$variant->id,'barcode'=>$bc,'scanned_by'=>$userId,'is_unexpected'=>true,'source'=>'BARCODE','created_at'=>now(),'updated_at'=>now()]);
            return response()->json(['success'=>false,'type'=>'NOT_IN_SESSION','message'=>'Prodotto non presente in questa bolla','product'=>['name'=>$variant->name]]);
        }
        $newQty = $item->counted_quantity + 1;
        DB::table('inventory_items')->where('id',$item->id)->update(['counted_quantity'=>$newQty,'status'=>'COUNTED','last_counted_at'=>now(),'updated_at'=>now()]);
        DB::table('inventory_scans')->insert(['tenant_id'=>$tid,'inventory_session_id'=>$id,'inventory_item_id'=>$item->id,'product_variant_id'=>$variant->id,'barcode'=>$bc,'scanned_by'=>$userId,'source'=>'BARCODE','quantity_delta'=>1,'created_at'=>now(),'updated_at'=>now()]);
        if($session->status==='SENT_TO_STORE') DB::table('inventory_sessions')->where('id',$id)->update(['status'=>'IN_PROGRESS','updated_at'=>now()]);
        return response()->json(['success'=>true,'message'=>'Prodotto conteggiato','product'=>['name'=>$variant->name,'barcode'=>$bc,'counted_quantity'=>$newQty]]);
    }

    // --- STORE: aggiornamento manuale quantità ---
    public function updateCount(Request $request, int $itemId) {
        $tid     = (int)$request->attributes->get('tenant_id');
        $userId  = $request->user()->id;
        $storeId = (int)$request->attributes->get('store_id');
        if (!$storeId) return response()->json(['message'=>'Nessun negozio associato'],403);
        $request->validate(['counted_quantity'=>'required|integer|min:0']);
        $item = DB::table('inventory_items as ii')->join('inventory_sessions as s','s.id','=','ii.inventory_session_id')->where('ii.id',$itemId)->where('s.tenant_id',$tid)->where('s.store_id',$storeId)->select('ii.*','s.status as session_status','s.id as session_id')->first();
        if(!$item) return response()->json(['message'=>'Riga non trovata'],404);
        if(!in_array($item->session_status,['SENT_TO_STORE','IN_PROGRESS','REOPENED'])) return response()->json(['message'=>'Bolla non modificabile'],422);
        $old = $item->counted_quantity; $new = $request->integer('counted_quantity');
        DB::table('inventory_items')->where('id',$itemId)->update(['counted_quantity'=>$new,'status'=>'COUNTED','last_counted_at'=>now(),'store_note'=>$request->input('note'),'updated_at'=>now()]);
        DB::table('inventory_scans')->insert(['tenant_id'=>$tid,'inventory_session_id'=>$item->session_id,'inventory_item_id'=>$itemId,'product_variant_id'=>$item->product_variant_id,'barcode'=>'','scanned_by'=>$userId,'source'=>'MANUAL','quantity_delta'=>$new-$old,'note'=>$request->input('note'),'created_at'=>now(),'updated_at'=>now()]);
        $this->auditLog($tid,$userId,'manual_count',$item->session_id,$itemId,['qty'=>$old],['qty'=>$new],$request->input('note'));
        return response()->json(['message'=>'Quantità aggiornata','counted_quantity'=>$new]);
    }

    // --- STORE: chiusura bolla ---
    public function close(Request $request, int $id) {
        $tid     = (int)$request->attributes->get('tenant_id');
        $storeId = (int)$request->attributes->get('store_id');
        $userId  = $request->user()->id;
        if (!$storeId) return response()->json(['message'=>'Nessun negozio associato'],403);
        $session = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('id',$id)->where('store_id',$storeId)->first();
        if(!$session) return response()->json(['message'=>'Non trovata'],404);
        if(!in_array($session->status,['IN_PROGRESS','SENT_TO_STORE','REOPENED'])) return response()->json(['message'=>'Non chiudibile'],422);
        DB::beginTransaction();
        try {
            $items = DB::table('inventory_items')->where('inventory_session_id',$id)->get();
            $matched=0; $mismatched=0;
            foreach($items as $item){
                $diff = $item->counted_quantity - $item->theoretical_quantity;
                $status = $diff===0?'MATCHED':'MISMATCHED';
                if($status==='MATCHED') $matched++; else $mismatched++;
                DB::table('inventory_items')->where('id',$item->id)->update(['status'=>$status,'updated_at'=>now()]);
            }
            $overallStatus = $mismatched>0?'UNDER_REVIEW':'APPROVED';
            DB::table('inventory_sessions')->where('id',$id)->update(['status'=>'CLOSED_BY_STORE','closed_by_store_at'=>now(),'updated_at'=>now()]);
            $this->auditLog($tid,$userId,'close_session',$id,null,null,['matched'=>$matched,'mismatched'=>$mismatched]);
            // Notifica admin
            try {
                $admins = DB::table('users')->where('tenant_id',$tid)->whereIn('role',['superadmin','admin_cliente','magazziniere'])->pluck('id');
                foreach($admins as $uid) DB::table('employee_notifications')->insert(['tenant_id'=>$tid,'user_id'=>$uid,'type'=>'inventory','title'=>'Bolla chiusa dallo store','body'=>"La bolla \"{$session->title}\" è stata chiusa. Differenze: {$mismatched}.",'read_at'=>null,'created_at'=>now(),'updated_at'=>now()]);
            }catch(\Exception $e){}
            DB::commit();
            return response()->json(['message'=>'Bolla chiusa','summary'=>['total'=>count($items),'matched'=>$matched,'mismatched'=>$mismatched,'accuracy'=>count($items)>0?round($matched/count($items)*100,1):0]]);
        }catch(\Exception $e){DB::rollBack();return response()->json(['message'=>'Errore: '.$e->getMessage()],500);}
    }

    // --- COMMENTI ---
    public function addComment(Request $request, int $id) {
        $tid = (int)$request->attributes->get('tenant_id');
        $userId = $request->user()->id;
        $request->validate(['message'=>'required|string']);
        $session = DB::table('inventory_sessions')->where('tenant_id',$tid)->where('id',$id)->first();
        if(!$session) return response()->json(['message'=>'Non trovata'],404);
        $role = $request->user()->role;
        $cid = DB::table('inventory_comments')->insertGetId(['tenant_id'=>$tid,'inventory_session_id'=>$id,'inventory_item_id'=>$request->input('inventory_item_id'),'author_id'=>$userId,'author_role'=>$role,'message'=>$request->input('message'),'created_at'=>now(),'updated_at'=>now()]);
        return response()->json(['message'=>'Commento aggiunto','id'=>$cid],201);
    }

    public function comments(Request $request, int $id) {
        $tid = (int)$request->attributes->get('tenant_id');
        $comments = DB::table('inventory_comments as ic')->leftJoin('users as u','u.id','=','ic.author_id')->where('ic.tenant_id',$tid)->where('ic.inventory_session_id',$id)->select('ic.*','u.name as author_name')->orderBy('ic.created_at')->get();
        return response()->json(['data'=>$comments]);
    }

    // --- PREVIEW prodotti per filtri (prima della creazione) ---
    public function preview(Request $request) {
        $tid = (int)$request->attributes->get('tenant_id');
        $storeId = $request->integer('store_id');
        $filters = $request->input('filters',[]) ?? [];
        if (is_string($filters)) $filters = json_decode($filters, true) ?? [];
        $whId = DB::table('warehouses')->where('tenant_id',$tid)->where('store_id',$storeId)->value('id');
        $pq = DB::table('product_variants as pv')
            ->join('products as p','p.id','=','pv.product_id')
            ->leftJoin('brands as br','br.id','=','p.brand_id')
            ->leftJoin('categories as cat','cat.id','=','p.category_id')
            ->where('p.tenant_id',$tid)->where('p.is_active',true)->where('pv.is_active',true)
            ->select('pv.id');
        if (!empty($filters['brand_id']))     $pq->where('p.brand_id', (int)$filters['brand_id']);
        if (!empty($filters['category_id']))  $pq->where('p.category_id', (int)$filters['category_id']);
        if (!empty($filters['product_type'])) $pq->where('p.product_type', $filters['product_type']);
        if (!empty($filters['only_positive_stock']) && $whId) {
            $pq->join('stock_items as si', function($j) use($whId) {
                $j->on('si.product_variant_id','=','pv.id')->where('si.warehouse_id', $whId);
            })->where('si.on_hand','>',0);
        }
        $count = $pq->count();
        return response()->json(['count'=>$count,'store_id'=>$storeId,'warehouse_id'=>$whId]);
    }

    // --- FILTRI disponibili per il form creazione bolla ---
    public function filterOptions(Request $request) {
        $tid = (int)$request->attributes->get('tenant_id');

        // Stores — tabella senza is_active, filtra solo per tenant
        try { $stores = DB::table('stores')->where('tenant_id',$tid)->orderBy('name')->select('id','name')->get(); }
        catch (\Exception $e) { $stores = collect(); }

        // Brands — tabella separata
        try { $brands = DB::table('brands')->where('tenant_id',$tid)->orderBy('name')->select('id','name')->get(); }
        catch (\Exception $e) { $brands = collect(); }

        // Categories — tabella separata
        try { $categories = DB::table('categories')->where('tenant_id',$tid)->orderBy('name')->select('id','name')->get(); }
        catch (\Exception $e) { $categories = collect(); }

        // Product types — distinct dalla colonna reale product_type
        try {
            $productTypes = DB::table('products')->where('tenant_id',$tid)->where('is_active',true)
                ->distinct()->pluck('product_type')->filter()->values();
        } catch (\Exception $e) { $productTypes = collect(); }

        \Log::info('InventorySessionController@filterOptions', [
            'tenant_id' => $tid,
            'stores' => $stores->count(),
            'brands' => $brands->count(),
            'categories' => $categories->count(),
            'product_types' => $productTypes->count(),
        ]);

        return response()->json([
            'stores'        => $stores,
            'brands'        => $brands,
            'categories'    => $categories,
            'product_types' => $productTypes,
        ]);
    }

    // --- KPI DASHBOARD ---
    public function kpi(Request $request) {
        $tid = (int)$request->attributes->get('tenant_id');
        $q = DB::table('inventory_sessions')->where('tenant_id',$tid);
        return response()->json(['data'=>['open'=>(clone $q)->where('status','SENT_TO_STORE')->count(),'in_progress'=>(clone $q)->where('status','IN_PROGRESS')->count(),'closed'=>(clone $q)->where('status','CLOSED_BY_STORE')->count(),'approved'=>(clone $q)->where('status','APPROVED')->count(),'under_review'=>(clone $q)->where('status','UNDER_REVIEW')->count(),'total'=>(clone $q)->count()]]);
    }
}
