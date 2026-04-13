import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, Banknote, Printer, FileText, Gift, Zap, ArrowLeftRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

export default function PosCheckoutModal({ cartTotal, onComplete, onCancel }) {
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [cashAmount, setCashAmount] = useState(() => cartTotal > 0 ? cartTotal.toFixed(2) : '');
  const [cardAmount, setCardAmount] = useState('');
  const [receiptType, setReceiptType] = useState('fiscale');
  const [isProcessing, setIsProcessing] = useState(false);

  // Compute final total based on discounts  — deve stare PRIMA dello useEffect
  const finalTotal = useMemo(() => {
    let t = cartTotal;
    if (discountType === 'value') {
      t = Math.max(0, t - (parseFloat(discountValue) || 0));
    } else if (discountType === 'percent') {
      const p = parseFloat(discountValue) || 0;
      t = Math.max(0, t - (t * (p / 100)));
    } else if (discountType === 'total_override') {
      if (discountValue !== '') {
        t = parseFloat(discountValue) || 0;
      }
    }
    return t;
  }, [cartTotal, discountType, discountValue]);

  // Aggiorna pre-compilazione contanti quando cambia il totale (es. dopo sconto)
  useEffect(() => {
    if (!cardAmount) setCashAmount(finalTotal > 0 ? finalTotal.toFixed(2) : '');
  }, [finalTotal]);

  const discountAmount = useMemo(() => {
    return Math.max(0, cartTotal - finalTotal);
  }, [cartTotal, finalTotal]);

  // Handle smart auto-fill of payments
  const handlePaymentFocus = (type) => {
    const cash = parseFloat(cashAmount) || 0;
    const card = parseFloat(cardAmount) || 0;
    
    if (type === 'cash' && cash === 0) {
      setCashAmount(Math.max(0, finalTotal - card).toFixed(2));
    } else if (type === 'card' && card === 0) {
      setCardAmount(Math.max(0, finalTotal - cash).toFixed(2));
    }
  };

  const totalPaid = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0);
  const change = Math.max(0, totalPaid - finalTotal);
  const remaining = Math.max(0, finalTotal - totalPaid);
  const isPaid = remaining < 0.005; // tolleranza floating point

  const handleSubmit = async () => {
    if (!isPaid) {
      return toast.error(`Mancano €${remaining.toFixed(2)} per completare il pagamento`);
    }

    setIsProcessing(true);
    
    // Build payments array
    const payments = [];
    const cash = parseFloat(cashAmount) || 0;
    const card = parseFloat(cardAmount) || 0;

    // Se c'è resto, decurtalo dai contanti (assumendo che diamo resto in contanti)
    let netCash = cash;
    if (change > 0 && cash > 0) {
      netCash = Math.max(0, cash - change);
    }

    if (netCash > 0) payments.push({ method: 'cash', amount: netCash });
    if (card > 0) payments.push({ method: 'card', amount: card });

    const payload = {
      payments,
      order_discount_amount: discountAmount > 0 ? discountAmount : undefined,
      receipt_type: receiptType
    };

    try {
      await onComplete(payload);
    } catch (err) {
      // onComplete gestisce già il toast dell'errore internamente
      console.error('Checkout error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--color-surface)', width: '100%', maxWidth: 700,
        borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh'
      }} className="sp-animate-in">
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Termina Pagamento</h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', gap: 32, flex: 1, overflowY: 'auto' }}>
          
          {/* Left panel: Total and Discounts */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: 'var(--color-bg)', padding: 20, borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Totale da Pagare</div>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>{fmt(finalTotal)}</div>
              {discountAmount > 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-success)', marginTop: 8 }}>
                  Sconto applicato: -{fmt(discountAmount)}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Applica Sconto / Modifica Totale</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                <button className={`sp-chip ${discountType === 'none' ? 'active' : ''}`} onClick={() => { setDiscountType('none'); setDiscountValue(''); }}>Nessuno</button>
                <button className={`sp-chip ${discountType === 'percent' ? 'active' : ''}`} onClick={() => setDiscountType('percent')}>Sconto %</button>
                <button className={`sp-chip ${discountType === 'value' ? 'active' : ''}`} onClick={() => setDiscountType('value')}>Sconto €</button>
                <button className={`sp-chip ${discountType === 'total_override' ? 'active' : ''}`} onClick={() => setDiscountType('total_override')}>Forza Totale</button>
              </div>
              
              {discountType !== 'none' && (
                <input 
                  type="number"
                  className="sp-input"
                  placeholder={discountType === 'percent' ? '% di sconto' : discountType === 'value' ? 'Euro di sconto' : 'Nuovo totale €'}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  style={{ fontSize: 16, padding: '12px 16px' }}
                  autoFocus
                />
              )}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Tipo di Stampa</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <label className="sp-radio-card" style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: receiptType === 'fiscale' ? 'var(--color-primary-light)' : 'transparent', borderColor: receiptType === 'fiscale' ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <input type="radio" value="fiscale" checked={receiptType === 'fiscale'} onChange={() => setReceiptType('fiscale')} style={{ margin: 0 }} />
                  <Printer size={16} style={{ color: receiptType === 'fiscale' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Fiscale (Epson)</span>
                </label>
                <label className="sp-radio-card" style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: receiptType === 'cortesia' ? 'var(--color-primary-light)' : 'transparent', borderColor: receiptType === 'cortesia' ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <input type="radio" value="cortesia" checked={receiptType === 'cortesia'} onChange={() => setReceiptType('cortesia')} style={{ margin: 0 }} />
                  <Gift size={16} style={{ color: receiptType === 'cortesia' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Cortesia (Regalo)</span>
                </label>
                <label className="sp-radio-card" style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: receiptType === 'preconto' ? 'var(--color-primary-light)' : 'transparent', borderColor: receiptType === 'preconto' ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <input type="radio" value="preconto" checked={receiptType === 'preconto'} onChange={() => setReceiptType('preconto')} style={{ margin: 0 }} />
                  <FileText size={16} style={{ color: receiptType === 'preconto' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Preconto / Nessuna</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{ width: 1, background: 'var(--color-border)' }}></div>

          {/* Right panel: Payment methods */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Split payment indicator */}
            {(parseFloat(cashAmount) > 0 && parseFloat(cardAmount) > 0) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
                border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 700, color: '#1d4ed8'
              }}>
                <ArrowLeftRight size={14} />
                Pagamento Misto Attivo
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Metodi di Pagamento</div>
            
            {/* Contanti */}
            <div
              onClick={() => {
                // Click sulla card = switch tutto su contanti
                if (parseFloat(cardAmount) > 0 && parseFloat(cashAmount) === 0) {
                  setCashAmount(finalTotal.toFixed(2));
                  setCardAmount('');
                }
              }}
              style={{ background: 'var(--color-bg)', padding: '16px', borderRadius: 12, border: '1.5px solid transparent', transition: 'border-color 0.15s, box-shadow 0.15s', cursor: 'pointer', ...(parseFloat(cashAmount) > 0 ? { borderColor: '#86efac', boxShadow: '0 0 0 3px rgba(16,185,129,0.07)' } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#10B98120', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <Banknote size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Contanti</div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, fontSize: 15, fontWeight: 600, color: 'var(--color-text-tertiary)' }}>€</span>
                    <input 
                      type="number"
                      className="sp-input"
                      value={cashAmount}
                      onChange={e => setCashAmount(e.target.value)}
                      onFocus={() => handlePaymentFocus('cash')}
                      style={{ fontSize: 18, fontWeight: 700, paddingLeft: 30, background: '#fff' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setCashAmount(Math.max(0, finalTotal - (parseFloat(cardAmount) || 0)).toFixed(2)); }}
                  style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, background: '#10B98115', color: '#10B981', border: '1px solid #10B98130', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  title="Autofill contanti"
                >
                  <Zap size={12} />
                </button>
              </div>
              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUICK_AMOUNTS.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setCashAmount(amt.toFixed(2))}
                    style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 700,
                      background: parseFloat(cashAmount) === amt ? '#10B981' : 'var(--color-surface)',
                      color: parseFloat(cashAmount) === amt ? '#fff' : 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)', borderRadius: 20, cursor: 'pointer',
                      transition: 'all 0.12s'
                    }}
                  >
                    €{amt}
                  </button>
                ))}
                <button
                  onClick={() => setCashAmount(Math.ceil(finalTotal / 5) * 5 + '.00')}
                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)', borderRadius: 20, cursor: 'pointer' }}
                  title="Arrotonda all'importo superiore (banconota)"
                >
                  ↑ Arrot.
                </button>
              </div>
            </div>

            {/* Carta */}
            <div
              onClick={() => {
                // Click sulla card = switch tutto su carta
                if (parseFloat(cashAmount) > 0 && parseFloat(cardAmount) === 0) {
                  setCardAmount(finalTotal.toFixed(2));
                  setCashAmount('');
                }
              }}
              style={{ background: 'var(--color-bg)', padding: '16px', borderRadius: 12, border: '1.5px solid transparent', transition: 'border-color 0.15s, box-shadow 0.15s', cursor: 'pointer', ...(parseFloat(cardAmount) > 0 ? { borderColor: '#93c5fd', boxShadow: '0 0 0 3px rgba(59,130,246,0.07)' } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#3B82F620', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <CreditCard size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>POS / Carta / Satispay</div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, fontSize: 15, fontWeight: 600, color: 'var(--color-text-tertiary)' }}>€</span>
                    <input 
                      type="number"
                      className="sp-input"
                      value={cardAmount}
                      onChange={e => setCardAmount(e.target.value)}
                      onFocus={() => handlePaymentFocus('card')}
                      style={{ fontSize: 18, fontWeight: 700, paddingLeft: 30, background: '#fff' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setCardAmount(Math.max(0, finalTotal - (parseFloat(cashAmount) || 0)).toFixed(2)); }}
                  style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  title="Autofill carta"
                >
                  <Zap size={12} />
                </button>
              </div>
            </div>

            {/* Status indicators */}
            <div style={{ marginTop: 'auto', padding: 16, borderRadius: 12, background: remaining > 0 ? 'var(--color-warning-light)' : 'var(--color-success-light)' }}>
              {remaining > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-warning)' }}>
                  <span style={{ fontWeight: 600 }}>Da pagare:</span>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{fmt(remaining)}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                  <span style={{ fontWeight: 600 }}>Resto da consegnare:</span>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{fmt(change)}</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="sp-btn sp-btn-ghost" onClick={onCancel} disabled={isProcessing}>
            Annulla
          </button>
          <button 
            className="sp-btn sp-btn-primary" 
            style={{ minWidth: 200, fontSize: 16, fontWeight: 700 }}
            onClick={handleSubmit} 
            disabled={isProcessing || !isPaid}
          >
            {isProcessing ? 'Elaborazione...' : `Conferma e Paga`}
          </button>
        </div>
      </div>
    </div>
  );
}

