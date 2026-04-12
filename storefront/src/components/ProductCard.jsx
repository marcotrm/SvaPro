import React, { useRef } from 'react';
import gsap from 'gsap';
import { ShoppingCart, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function ProductCard({ product }) {
  const cardRef = useRef(null);
  const { addItem } = useCart();

  const image = product.images?.[0]?.src || 'https://images.unsplash.com/photo-1574871864461-b2a2a5a0ac2b?w=400';
  const hasDiscount = product.regular_price && parseFloat(product.regular_price) > parseFloat(product.price);

  // GSAP 3D Tilt on Mouse Move
  const handleMouseMove = (e) => {
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    gsap.to(card, { rotateX, rotateY, transformPerspective: 800, ease: 'power2.out', duration: 0.3 });
  };

  const handleMouseLeave = () => {
    gsap.to(cardRef.current, { rotateX: 0, rotateY: 0, ease: 'power2.out', duration: 0.5 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.3s ease',
        willChange: 'transform',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 20px 60px rgba(255,51,102,0.15)';
        e.currentTarget.style.borderColor = 'rgba(255,51,102,0.3)';
      }}
    >
      {/* Product Image */}
      <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '1/1' }}>
        <img
          src={image}
          alt={product.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
          onMouseEnter={e => (e.target.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.target.style.transform = 'scale(1)')}
        />
        {hasDiscount && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: '#ff3366', color: '#fff',
            padding: '4px 10px', borderRadius: '100px',
            fontSize: '0.7rem', fontWeight: 800,
          }}>
            OFFERTA
          </div>
        )}
        <button style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '50%', width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#888',
        }}>
          <Heart size={16} />
        </button>
      </div>

      {/* Product Info */}
      <div style={{ padding: '1.2rem' }}>
        {product.categories?.[0] && (
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ff3366', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>
            {product.categories[0].name}
          </div>
        )}
        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', marginBottom: '8px', lineHeight: 1.3 }}>
          {product.name}
        </h3>
        {product.short_description && (
          <p
            style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: product.short_description.replace(/<[^>]*>/g, '').substring(0, 70) + '…' }}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {hasDiscount && (
              <span style={{ fontSize: '0.8rem', color: '#555', textDecoration: 'line-through', marginRight: '6px' }}>
                €{parseFloat(product.regular_price).toFixed(2)}
              </span>
            )}
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
              €{parseFloat(product.price).toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => addItem(product)}
            style={{
              background: '#ff3366',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { background: '#ff1a53', transform: 'scale(1.05)' })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { background: '#ff3366', transform: 'scale(1)' })}
          >
            <ShoppingCart size={14} />
            Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}
