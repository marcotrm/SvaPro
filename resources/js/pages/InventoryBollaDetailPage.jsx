import React,{useState,useEffect,useRef}from 'react';
import{inventorySessions}from'../api.jsx';
import{useParams,useNavigate}from'react-router-dom';

const STATUS_COLOR={DRAFT:'#6B7280',SENT_TO_STORE:'#3B82F6',IN_PROGRESS:'#F59E0B',CLOSED_BY_STORE:'#8B5CF6',UNDER_REVIEW:'#F59E0B',APPROVED:'#10B981',DISPUTED:'#EF4444',REOPENED:'#F97316'};
const STATUS_LABEL={DRAFT:'Bozza',SENT_TO_STORE:'Inviata',IN_PROGRESS:'In corso',CLOSED_BY_STORE:'Chiusa',UNDER_REVIEW:'In revisione',APPROVED:'Approvata',DISPUTED:'Contestata',REOPENED:'Riaperta'};
const ITEM_DOT={NOT_COUNTED:'#9CA3AF',COUNTED:'#3B82F6',MATCHED:'#10B981',MISMATCHED:'#EF4444',NEEDS_REVIEW:'#F59E0B',EXTRA_PRODUCT:'#F97316',MISSING_PRODUCT:'#DC2626'};

export default function InventoryBollaDetailPage(){
  const{id}=useParams();
  const navigate=useNavigate();
  const[user,setUser]=useState(null);
  const[session,setSession]=useState(null);
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[tab,setTab]=useState('all');
  const[scanFeedback,setScanFeedback]=useState(null);
  const[manualItem,setManualItem]=useState(null);
  const[manualQty,setManualQty]=useState('');
  const[manualNote,setManualNote]=useState('');
  const[closing,setClosing]=useState(false);
  const[comments,setComments]=useState([]);
  const[newComment,setNewComment]=useState('');
  const scanRef=useRef(null);
  const scanInput=useRef('');

  const isAdmin=user&&['superadmin','admin_cliente','magazziniere'].includes(user.role);

  useEffect(()=>{const s=localStorage.getItem('user');if(s)setUser(JSON.parse(s));},[]);
  useEffect(()=>{if(user!==null)load();},[user]);

  const load=async()=>{
    setLoading(true);
    try{
      if(isAdmin){
        const r=await inventorySessions.getOne(id);
        setSession(r.data.data);setItems(r.data.items??[]);
        const cr=await inventorySessions.getComments(id);
        setComments(cr.data.data??[]);
      }else{
        const r=await inventorySessions.storeGetOne(id);
        setSession(r.data.data);setItems(r.data.items??[]);
        const cr=await inventorySessions.getComments(id);
        setComments(cr.data.data??[]);
      }
    }catch(e){console.error(e);}
    setLoading(false);
    setTimeout(()=>scanRef.current?.focus(),200);
  };

  const handleScan=async(bc)=>{
    if(!bc.trim())return;
    try{
      const r=await inventorySessions.storeScan(id,bc.trim());
      setScanFeedback({ok:r.data.success,msg:r.data.message,product:r.data.product});
      if(r.data.success){setItems(prev=>prev.map(i=>i.barcode===bc.trim()||i.sku===bc.trim()?{...i,counted_quantity:r.data.product.counted_quantity,status:'COUNTED'}:i));}
    }catch(e){setScanFeedback({ok:false,msg:e.response?.data?.message??'Errore'});}
    setTimeout(()=>setScanFeedback(null),3000);
    scanInput.current='';
    if(scanRef.current)scanRef.current.value='';
    scanRef.current?.focus();
  };

  const handleManualSave=async()=>{
    if(!manualItem)return;
    try{
      await inventorySessions.storeUpdateCount(manualItem.id,{counted_quantity:parseInt(manualQty)||0,note:manualNote});
      setItems(prev=>prev.map(i=>i.id===manualItem.id?{...i,counted_quantity:parseInt(manualQty)||0,status:'COUNTED'}:i));
      setManualItem(null);setManualQty('');setManualNote('');
    }catch(e){alert(e.response?.data?.message??'Errore');}
  };

  const handleClose=async()=>{
    if(!window.confirm('Confermi la chiusura? Non potrai pi??modificare questa bolla.'))return;
    setClosing(true);
    try{const r=await inventorySessions.storeClose(id);alert(`Bolla chiusa. Allineati: ${r.data.summary.matched}, Differenze: ${r.data.summary.mismatched}`);load();}
    catch(e){alert(e.response?.data?.message??'Errore');}
    setClosing(false);
  };

  const handleApprove=async()=>{
    if(!window.confirm("Confermi l'approvazione della bolla?"))return;
    try{await inventorySessions.approve(id,false);alert('Bolla approvata!');load();}
    catch(e){alert(e.response?.data?.message??'Errore');}
  };

  const handleComment=async()=>{
    if(!newComment.trim())return;
    try{await inventorySessions.addComment(id,{message:newComment});setNewComment('');load();}
    catch(e){alert(e.response?.data?.message??'Errore');}
  };

  const filteredItems=items.filter(i=>{
    if(tab==='todo')return i.status==='NOT_COUNTED';
    if(tab==='done')return i.counted_quantity>0;
    if(tab==='diff')return i.status==='MISMATCHED';
    return true;
  });

  const canScan=session&&['SENT_TO_STORE','IN_PROGRESS','REOPENED'].includes(session.status)&&!isAdmin;
  const canClose=canScan;
  const total=items.length;
  const counted=items.filter(i=>i.counted_quantity>0).length;

  if(loading)return<div style={{padding:60,textAlign:'center',color:'var(--color-text-tertiary)'}}>Caricamento...</div>;
  if(!session)return<div style={{padding:60,textAlign:'center',color:'#EF4444'}}>Bolla non trovata</div>;

  return(
    <div style={{padding:'20px 28px',minHeight:'100vh',background:'var(--color-bg)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
        <button onClick={()=>navigate('/inventory/bolle')} style={{background:'none',border:'1px solid var(--color-border)',borderRadius:10,padding:'8px 14px',cursor:'pointer',color:'var(--color-text-secondary)',fontSize:13,fontWeight:700}}>← Indietro</button>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:800,color:'var(--color-text-tertiary)',fontFamily:'monospace'}}>{session.inventory_number}</div>
          <div style={{fontSize:20,fontWeight:900,color:'var(--color-text)'}}>{session.title}</div>
        </div>
        <span style={{background:STATUS_COLOR[session.status]+'22',color:STATUS_COLOR[session.status],border:`1px solid ${STATUS_COLOR[session.status]}44`,borderRadius:20,padding:'4px 14px',fontSize:12,fontWeight:700}}>{STATUS_LABEL[session.status]??session.status}</span>
        {isAdmin&&session.status==='CLOSED_BY_STORE'&&<button onClick={handleApprove} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#10B981,#059669)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>? Approva</button>}
        {isAdmin&&session.status==='UNDER_REVIEW'&&<button onClick={handleApprove} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#10B981,#059669)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>? Approva</button>}
        {canClose&&<button onClick={handleClose} disabled={closing} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#8B5CF6,#7C3AED)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',opacity:closing?0.6:1}}>{closing?'Chiusura...':'🔒 Chiudi Inventario'}</button>}
      </div>

      {/* Progress bar (store) */}
      {!isAdmin&&(
        <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:14,padding:'16px 20px',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--color-text)'}}>Avanzamento conteggio</span>
            <span style={{fontSize:13,fontWeight:800,color:'var(--color-accent)'}}>{counted}/{total}</span>
          </div>
          <div style={{height:10,borderRadius:6,background:'var(--color-border)',overflow:'hidden'}}>
            <div style={{height:'100%',background:'linear-gradient(90deg,#3B82F6,#10B981)',borderRadius:6,width:`${total>0?counted/total*100:0}%`,transition:'width 0.3s'}}/>
          </div>
        </div>
      )}

      {/* Admin summary */}
      {isAdmin&&session.summary&&(
        <div style={{display:'flex',gap:14,marginBottom:20,flexWrap:'wrap'}}>
          {[['Totale',session.summary.total,'var(--color-text-secondary)'],['Allineati',session.summary.matched,'#10B981'],['Differenze',session.summary.mismatched,'#EF4444'],['Non contati',session.summary.not_counted,'#9CA3AF'],['Accuratezza',`${session.summary.accuracy}%`,'var(--color-accent)']].map(([l,v,c])=>(
            <div key={l} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:14,padding:'14px 20px',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:11,color:'var(--color-text-tertiary)',marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scanner barcode (store only) */}
      {canScan&&(
        <div style={{background:'var(--color-surface)',border:'1.5px solid var(--color-accent)',borderRadius:16,padding:'18px 22px',marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:800,color:'var(--color-text)',marginBottom:10}}>📷 Scanner Barcode</div>
          <input ref={scanRef} defaultValue="" onChange={e=>{scanInput.current=e.target.value;}} onKeyDown={e=>{if(e.key==='Enter'){handleScan(scanInput.current);}}} placeholder="Punta lo scanner o digita il barcode..." style={{width:'100%',padding:'12px 16px',borderRadius:12,border:'2px solid var(--color-accent)',background:'var(--color-bg)',color:'var(--color-text)',fontSize:16,outline:'none',boxSizing:'border-box'}} autoFocus />
          {scanFeedback&&(
            <div style={{marginTop:10,padding:'12px 16px',borderRadius:10,background:scanFeedback.ok?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)',border:`1px solid ${scanFeedback.ok?'#10B981':'#EF4444'}`,color:scanFeedback.ok?'#10B981':'#EF4444',fontSize:14,fontWeight:700}}>
              {scanFeedback.ok?'?':'❌'} {scanFeedback.msg} {scanFeedback.product&&`— ${scanFeedback.product.name} (${scanFeedback.product.counted_quantity} pz)`}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['all','Tutti'],['todo','Da contare'],['done','Contati'],isAdmin&&['diff','Differenze']].filter(Boolean).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:'7px 16px',borderRadius:20,border:`1.5px solid ${tab===k?'var(--color-accent)':'var(--color-border)'}`,background:tab===k?'var(--color-accent)':'transparent',color:tab===k?'#fff':'var(--color-text-secondary)',fontSize:12,fontWeight:700,cursor:'pointer'}}>{l}</button>
        ))}
      </div>

      {/* Items list */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filteredItems.map(item=>(
          <div key={item.id} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:14,padding:'14px 18px',display:'flex',alignItems:'center',gap:16}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:ITEM_DOT[item.status]??'#9CA3AF',flexShrink:0}}/>
            {item.image_url&&<img src={item.image_url} alt="" style={{width:40,height:40,borderRadius:8,objectFit:'cover',flexShrink:0}}/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:'var(--color-text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.product_name}{item.flavor?` — ${item.flavor}`:''}</div>
              <div style={{fontSize:11,color:'var(--color-text-tertiary)',marginTop:3,display:'flex',gap:12,flexWrap:'wrap'}}>
                {item.barcode&&<span>?? {item.barcode}</span>}
                {item.brand&&<span>{item.brand}</span>}
                {item.category&&<span>{item.category}</span>}
              </div>
            </div>
            <div style={{textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:22,fontWeight:900,color:item.counted_quantity>0?'var(--color-accent)':'var(--color-text-tertiary)'}}>{item.counted_quantity}</div>
              <div style={{fontSize:10,color:'var(--color-text-tertiary)'}}>contati</div>
            </div>
            {isAdmin&&(
              <div style={{textAlign:'center',flexShrink:0}}>
                <div style={{fontSize:22,fontWeight:900,color:'var(--color-text-secondary)'}}>{item.theoretical_quantity}</div>
                <div style={{fontSize:10,color:'var(--color-text-tertiary)'}}>teorici</div>
              </div>
            )}
            {isAdmin&&item.status!=='NOT_COUNTED'&&(
              <div style={{textAlign:'center',flexShrink:0}}>
                <div style={{fontSize:22,fontWeight:900,color:item.difference===0?'#10B981':'#EF4444'}}>{item.difference>0?'+':''}{item.difference}</div>
                <div style={{fontSize:10,color:'var(--color-text-tertiary)'}}>diff.</div>
              </div>
            )}
            {canScan&&(
              <button onClick={()=>{setManualItem(item);setManualQty(String(item.counted_quantity));setManualNote('');}} style={{padding:'7px 14px',borderRadius:10,border:'1.5px solid var(--color-border)',background:'var(--color-bg)',color:'var(--color-accent)',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>✏️</button>
            )}
          </div>
        ))}
      </div>

      {/* Manual edit modal */}
      {manualItem&&(
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'var(--color-surface)',borderRadius:20,padding:32,width:'100%',maxWidth:400,border:'1px solid var(--color-border)'}}>
            <div style={{fontSize:16,fontWeight:900,color:'var(--color-text)',marginBottom:20}}>✏️ Inserimento manuale</div>
            <div style={{fontSize:14,color:'var(--color-text-secondary)',marginBottom:16}}>{manualItem.product_name}{manualItem.flavor?` — ${manualItem.flavor}`:''}</div>
            <label style={{fontSize:12,fontWeight:700,color:'var(--color-text-secondary)',display:'block',marginBottom:6}}>QUANTITÀ CONTATA</label>
            <input type="number" min="0" value={manualQty} onChange={e=>setManualQty(e.target.value)} style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'1.5px solid var(--color-border)',background:'var(--color-bg)',color:'var(--color-text)',fontSize:18,fontWeight:800,outline:'none',boxSizing:'border-box',marginBottom:14,textAlign:'center'}} autoFocus/>
            <textarea value={manualNote} onChange={e=>setManualNote(e.target.value)} placeholder="Nota (opzionale)..." rows={2} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1.5px solid var(--color-border)',background:'var(--color-bg)',color:'var(--color-text)',fontSize:13,outline:'none',resize:'vertical',boxSizing:'border-box',marginBottom:16}}/>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setManualItem(null)} style={{padding:'10px 18px',borderRadius:10,border:'1.5px solid var(--color-border)',background:'var(--color-surface)',color:'var(--color-text-secondary)',fontSize:13,fontWeight:700,cursor:'pointer'}}>Annulla</button>
              <button onClick={handleManualSave} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#3B82F6,#2563EB)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* Comments section */}
      <div style={{marginTop:32,background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:16,padding:'20px 24px'}}>
        <div style={{fontSize:15,fontWeight:800,color:'var(--color-text)',marginBottom:16}}>💬 Commenti / Chiarimenti</div>
        {comments.length===0&&<div style={{color:'var(--color-text-tertiary)',fontSize:13,marginBottom:16}}>Nessun commento.</div>}
        {comments.map(c=>(
          <div key={c.id} style={{marginBottom:12,padding:'10px 14px',borderRadius:10,background:'var(--color-bg)',border:'1px solid var(--color-border)'}}>
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:12,fontWeight:800,color:'var(--color-text)'}}>{c.author_name}</span>
              <span style={{fontSize:10,color:'var(--color-text-tertiary)',background:c.author_role==='admin'?'rgba(59,130,246,0.12)':'rgba(16,185,129,0.12)',padding:'2px 8px',borderRadius:10}}>{c.author_role}</span>
              <span style={{fontSize:10,color:'var(--color-text-tertiary)',marginLeft:'auto'}}>{new Date(c.created_at).toLocaleString('it-IT')}</span>
            </div>
            <div style={{fontSize:13,color:'var(--color-text)'}}>{c.message}</div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleComment()} placeholder="Scrivi un commento..." style={{flex:1,padding:'10px 14px',borderRadius:10,border:'1.5px solid var(--color-border)',background:'var(--color-bg)',color:'var(--color-text)',fontSize:13,outline:'none'}}/>
          <button onClick={handleComment} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'var(--color-accent)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>Invia</button>
        </div>
      </div>
    </div>
  );
}
