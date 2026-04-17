import React, { useState, useEffect, useMemo } from 'react';
import { X, CreditCard, Banknote, Printer, FileText, Gift, Zap, Check, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

const fmt = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v || 0);

export default function PosCheckoutModal({ cartTotal, cartLines = [], onComplete, onCancel, lockDiscount = false }) {
  const [discountType, setDiscountType]   = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [cashAmount, setCashAmount]       = useState(() => cartTotal > 0 ? cartTotal.toFixed(2) : '');
  const [cardAmount, setCardAmount]       = useState('');
  const [receiptType, setReceiptType]     = useState('fiscale');
  const [isProcessing, setIsProcessing]   = useState(false);

  /* ── Totale finale dopo sconto ── */
  const finalTotal = useMemo(() => {
    let t = cartTotal;
    if (discountType === 'value')          t = Math.max(0, t - (parseFloat(discountValue) || 0));
    else if (discountType === 'percent')   t = Math.max(0, t - t * ((parseFloat(discountValue) || 0) / 100));
    else if (discountType === 'total_override' && discountValue !== '') t = parseFloat(discountValue) || 0;
    return t;
  }, [cartTotal, discountType, discountValue]);

  useEffect(() => {
    if (!cardAmount) setCashAmount(finalTotal > 0 ? finalTotal.toFixed(2) : '');
  }, [finalTotal]);

  const discountAmount = useMemo(() => Math.max(0, cartTotal - finalTotal), [cartTotal, finalTotal]);
  const totalPaid      = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0);
  const change         = Math.max(0, totalPaid - finalTotal);
  const remaining      = Math.max(0, finalTotal - totalPaid);
  const isPaid         = remaining < 0.005;

  const handleSubmit = async () => {
    if (!isPaid) return toast.error(`Mancano ${fmt(remaining)} per completare il pagamento`);
    setIsProcessing(true);
    const payments = [];
    const cash = parseFloat(cashAmount) || 0;
    const card = parseFloat(cardAmount) || 0;
    const netCash = (change > 0 && cash > 0) ? Math.max(0, cash - change) : cash;
    if (netCash > 0) payments.push({ method: 'cash', amount: netCash });
    if (card > 0)    payments.push({ method: 'card', amount: card });
    try {
      await onComplete({ payments, order_discount_amount: discountAmount > 0 ? discountAmount : undefined, receipt_type: receiptType });
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: 'var(--color-surface)', width: '100%', maxWidth: 860,
        borderRadius: 20, boxShadow: '0 32px 64px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', maxHeight: '94vh',
        border: '1px solid var(--color-border)',
      }} className="sp-animate-in">

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Riepilogo e Pagamento</h2>
            <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: '2px 0 0' }}>{cartLines.length} articol{cartLines.length === 1 ? 'o' : 'i'} nel carrello</p>
          </div>
          <button onClick={onCancel} style={{ background: 'var(--color-bg)', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Body: 2 colonne ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── COLONNA SINISTRA: Riepilogo ── */}
          <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', overflowY: 'auto' }}>

            {/* Lista articoli */}
            <div style={{ padding: '16px 20px', flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Articoli</div>
              {cartLines.map((line, i) => (
                <div key={line.product_variant_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: i < cartLines.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                      {fmt(line.price)} × {line.qty}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)', flexShrink: 0, marginLeft: 12 }}>
                    {fmt(line.price * line.qty)}
                  </div>
                </div>
              ))}
            </div>

            {/* Totali */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                <span>Subtotale</span>
                <span style={{ fontWeight: 700 }}>{fmt(cartTotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#10B981', marginBottom: 6 }}>
                  <span>Sconto</span>
                  <span style={{ fontWeight: 700 }}>-{fmt(discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1.5px solid var(--color-border)', marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Totale</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-accent)' }}>{fmt(finalTotal)}</span>
              </div>
            </div>

            {/* Sconto (se non dipendente) */}
            {!lockDiscount && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Applica Sconto</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: discountType !== 'none' ? 10 : 0 }}>
                  {[
                    { key: 'none',           label: 'Nessuno' },
                    { key: 'percent',        label: 'Sconto %' },
                    { key: 'value',          label: 'Sconto €' },
                    { key: 'total_override', label: 'Forza Totale' },
                  ].map(opt => (
                    <button key={opt.key}
                      onClick={() => { setDiscountType(opt.key); setDiscountValue(''); }}
                      style={{
                        padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer', border: 'none',
                        background: discountType === opt.key ? 'var(--color-accent)' : 'var(--color-bg)',
                        color: discountType === opt.key ? '#fff' : 'var(--color-text-secondary)',
                        transition: 'all 0.12s',
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
                {discountType !== 'none' && (
                  <input type="number" className="sp-input"
                    autoFocus
                    placeholder={discountType === 'percent' ? '% di sconto' : discountType === 'value' ? 'Euro di sconto' : 'Nuovo totale'}
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    style={{ fontSize: 15, padding: '10px 14px' }}
                  />
                )}
              </div>
            )}

            {/* Tipo stampa */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tipo Ricevuta</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'fiscale',  label: 'Fiscale',  Icon: Printer },
                  { key: 'cortesia', label: 'Cortesia', Icon: Gift },
                  { key: 'preconto', label: 'Preconto', Icon: FileText },
                ].map(({ key, label, Icon }) => (
                  <button key={key}
                    onClick={() => setReceiptType(key)}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '8px 4px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid',
                      borderColor: receiptType === key ? 'var(--color-accent)' : 'var(--color-border)',
                      background: receiptType === key ? 'var(--color-accent-light)' : 'var(--color-bg)',
                      color: receiptType === key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      transition: 'all 0.12s',
                    }}
                  >
                    <Icon size={16} />
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── COLONNA DESTRA: Pagamento ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

            <div style={{ padding: '16px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Metodo: Contanti */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                    <Banknote size={16} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Contanti</span>
                  <button
                    onClick={() => setCashAmount(Math.max(0, finalTotal - (parseFloat(cardAmount) || 0)).toFixed(2))}
                    style={{ marginLeft: 'auto', padding: '3px 8px', fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  ><Zap size={11} /> Autofill</button>
                </div>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: 'var(--color-text-tertiary)' }}>€</span>
                  <input type="number" className="sp-input"
                    value={cashAmount}
                    onChange={e => {
                      setCashAmount(e.target.value);
                      const cash = parseFloat(e.target.value) || 0;
                      const rem = Math.max(0, finalTotal - cash);
                      setCardAmount(rem > 0 ? rem.toFixed(2) : '');
                    }}
                    style={{ fontSize: 22, fontWeight: 800, paddingLeft: 36, paddingTop: 12, paddingBottom: 12, borderColor: parseFloat(cashAmount) > 0 ? '#10B981' : undefined, boxShadow: parseFloat(cashAmount) > 0 ? '0 0 0 3px rgba(16,185,129,0.12)' : undefined }}
                  />
                </div>
                {/* Quick amounts */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {QUICK_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => setCashAmount(amt.toFixed(2))}
                      style={{
                        padding: '5px 12px', fontSize: 12, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
                        background: parseFloat(cashAmount) === amt ? '#10B981' : 'var(--color-bg)',
                        color: parseFloat(cashAmount) === amt ? '#fff' : 'var(--color-text-secondary)',
                        border: `1px solid ${parseFloat(cashAmount) === amt ? '#10B981' : 'var(--color-border)'}`,
                        transition: 'all 0.12s',
                      }}
                    >€{amt}</button>
                  ))}
                  <button onClick={() => setCashAmount((Math.ceil(finalTotal / 5) * 5).toFixed(2))}
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 700, borderRadius: 20, cursor: 'pointer', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
                  >Arrotonda</button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)' }}>oppure</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              {/* Metodo: Carta / POS */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                    <CreditCard size={16} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>POS / Carta / Satispay</span>
                  <button
                    onClick={() => setCardAmount(Math.max(0, finalTotal - (parseFloat(cashAmount) || 0)).toFixed(2))}
                    style={{ marginLeft: 'auto', padding: '3px 8px', fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  ><Zap size={11} /> Autofill</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, fontWeight: 700, color: 'var(--color-text-tertiary)' }}>€</span>
                  <input type="number" className="sp-input"
                    value={cardAmount}
                    onChange={e => {
                      setCardAmount(e.target.value);
                      const card = parseFloat(e.target.value) || 0;
                      const rem = Math.max(0, finalTotal - card);
                      setCashAmount(rem > 0 ? rem.toFixed(2) : '');
                    }}
                    style={{ fontSize: 22, fontWeight: 800, paddingLeft: 36, paddingTop: 12, paddingBottom: 12, borderColor: parseFloat(cardAmount) > 0 ? '#3B82F6' : undefined, boxShadow: parseFloat(cardAmount) > 0 ? '0 0 0 3px rgba(59,130,246,0.10)' : undefined }}
                  />
                </div>
              </div>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Stato pagamento */}
              <div style={{
                borderRadius: 14, padding: '16px 20px',
                background: isPaid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.07)',
                border: `1.5px solid ${isPaid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
              }}>
                {isPaid ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={18} color="#10B981" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>Resto da consegnare</span>
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#10B981' }}>{fmt(change)}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertCircle size={18} color="#EF4444" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#EF4444' }}>Mancano</span>
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#EF4444' }}>{fmt(remaining)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer con bottone */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button className="sp-btn sp-btn-ghost" onClick={onCancel} disabled={isProcessing} style={{ flex: '0 0 auto' }}>
                Annulla
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing || !isPaid}
                style={{
                  flex: 1, height: 54, borderRadius: 14, border: 'none', fontSize: 16, fontWeight: 800,
                  background: isPaid ? 'linear-gradient(135deg, #7B6FD0, #5B50B0)' : 'var(--color-bg)',
                  color: isPaid ? '#fff' : 'var(--color-text-tertiary)',
                  cursor: isPaid ? 'pointer' : 'not-allowed',
                  boxShadow: isPaid ? '0 8px 24px rgba(123,111,208,0.35)' : 'none',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {isProcessing ? (
                  <><span style={{ fontSize: 14 }}>Elaborazione...</span></>
                ) : (
                  <><Check size={20} /> Conferma e Paga — {fmt(finalTotal)}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
