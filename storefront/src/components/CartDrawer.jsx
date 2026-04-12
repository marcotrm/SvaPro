import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { X, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function CartDrawer({ isOpen, onClose }) {
  const drawerRef = useRef(null);
  const { items, removeItem, updateQuantity, totalPrice, totalItems } = useCart();

  useEffect(() => {
    if (isOpen) {
      gsap.to(drawerRef.current, { x: 0, duration: 0.4, ease: 'power3.out' });
    } else {
      gsap.to(drawerRef.current, { x: '100%', duration: 0.3, ease: 'power3.in' });
    }
  }, [isOpen]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)', zIndex: 200,
          }}
        />
      )}

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(420px, 100vw)',
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          zIndex: 300,
          transform: 'translateX(100%)',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Outfit, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag size={20} color="#ff3366" />
            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>
              Carrello ({totalItems})
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#555' }}>
              <ShoppingBag size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>Il tuo carrello è vuoto.</p>
            </div>
          ) : (
            items.map(({ key, product, quantity }) => (
              <div key={key} style={{
                display: 'flex', gap: '12px', alignItems: 'center',
                padding: '12px', marginBottom: '8px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <img
                  src={product.images?.[0]?.src || 'https://images.unsplash.com/photo-1574871864461-b2a2a5a0ac2b?w=100'}
                  alt={product.name}
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.name}
                  </div>
                  <div style={{ color: '#ff3366', fontWeight: 800, fontSize: '0.9rem', marginTop: 2 }}>
                    €{parseFloat(product.price).toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => updateQuantity(key, quantity - 1)} style={qtyBtnStyle}>-</button>
                  <span style={{ color: '#fff', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{quantity}</span>
                  <button onClick={() => updateQuantity(key, quantity + 1)} style={qtyBtnStyle}>+</button>
                </div>
                <button onClick={() => removeItem(key)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', marginLeft: 4 }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: '#888', fontWeight: 600 }}>Totale</span>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.3rem' }}>€{totalPrice.toFixed(2)}</span>
            </div>
            <button style={{
              width: '100%', padding: '1rem',
              background: '#ff3366', border: 'none', borderRadius: '14px',
              color: '#fff', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
              fontFamily: 'inherit', letterSpacing: '0.5px',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#ff1a53'}
              onMouseLeave={e => e.currentTarget.style.background = '#ff3366'}
            >
              Procedi al Checkout →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const qtyBtnStyle = {
  background: 'rgba(255,255,255,0.08)',
  border: 'none', borderRadius: 8,
  width: 28, height: 28,
  color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontWeight: 700, fontSize: '1rem',
};
