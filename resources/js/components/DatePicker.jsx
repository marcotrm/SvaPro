/**
 * SvaPro DatePicker — Custom premium calendar
 * Props:
 *   value:       string  "YYYY-MM-DD" (o "")
 *   onChange:    fn(string "YYYY-MM-DD")
 *   label?:      string  label sopra il campo
 *   placeholder?: string
 *   minDate?:    string "YYYY-MM-DD"
 *   maxDate?:    string "YYYY-MM-DD"
 *   style?:      object  stile del trigger
 *   disabled?:   bool
 */
import React, { useState, useEffect, useRef } from 'react';

const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_IT   = ['Lu','Ma','Me','Gi','Ve','Sa','Do'];
const ACCENT      = '#7B6FD0';
const ACCENT_GRAD = 'linear-gradient(135deg,#7B6FD0,#4F46E5)';

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toYMD(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function fmtDisplay(str) {
  const d = parseDate(str);
  if (!d) return '';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DatePicker({
  value = '',
  onChange,
  label,
  placeholder = 'Seleziona data',
  minDate,
  maxDate,
  style = {},
  disabled = false,
}) {
  const selected = parseDate(value);
  const today    = new Date(); today.setHours(0,0,0,0);

  const [open,       setOpen]       = useState(false);
  const [viewYear,   setViewYear]   = useState(selected?.getFullYear()  ?? today.getFullYear());
  const [viewMonth,  setViewMonth]  = useState(selected?.getMonth()     ?? today.getMonth());
  const [yearPicker, setYearPicker] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (selected) { setViewYear(selected.getFullYear()); setViewMonth(selected.getMonth()); }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setYearPicker(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const minD = parseDate(minDate);
  const maxD = parseDate(maxDate);
  const isDisabled = (d) => (minD && d < minD) || (maxD && d > maxD);

  // Calendar grid
  const firstDow  = ((new Date(viewYear, viewMonth, 1).getDay() + 6) % 7); // Mon=0
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({length: totalDays}, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({length: cells.length / 7}, (_, i) => cells.slice(i*7, i*7+7));

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0),  setViewYear(y => y+1)) : setViewMonth(m => m+1);

  const selectDay = (day) => {
    if (!day) return;
    const date = new Date(viewYear, viewMonth, day);
    if (isDisabled(date)) return;
    onChange?.(toYMD(date));
    setOpen(false); setYearPicker(false);
  };

  // Year grid: 12 years centrati
  const yearBase = Math.floor(viewYear / 12) * 12;
  const years = Array.from({length: 12}, (_, i) => yearBase + i);

  const Btn = ({onClick, children, style: s = {}}) => (
    <button type="button" onClick={onClick} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, width:28, height:28, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:14, flexShrink:0, ...s }}>{children}</button>
  );

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block', width:'100%' }}>
      {label && <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{label}</label>}

      {/* ── Trigger ── */}
      <button type="button" onClick={() => { if (!disabled) { setOpen(o => !o); setYearPicker(false); } }}
        style={{ width:'100%', padding:'9px 14px', border:`1.5px solid ${open ? ACCENT : 'var(--color-border,#e5e7eb)'}`, borderRadius:10, background:'var(--color-bg,#fff)', color: value ? 'var(--color-text,#1a1a2e)' : '#9ca3af', fontSize:13, fontWeight: value ? 600 : 400, cursor: disabled ? 'default':'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, outline:'none', transition:'border-color 0.15s', opacity: disabled ? 0.5 : 1, ...style }}>
        <span style={{ flex:1, textAlign:'left' }}>{value ? fmtDisplay(value) : placeholder}</span>
        <span style={{ fontSize:15, color: open ? ACCENT : '#9ca3af', transition:'color 0.15s', flexShrink:0 }}>📅</span>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{ position:'absolute', zIndex:9999, top:'calc(100% + 6px)', left:0, minWidth:290, background:'var(--color-surface,#fff)', border:'1px solid var(--color-border,#e5e7eb)', borderRadius:16, boxShadow:'0 20px 60px rgba(0,0,0,0.16)', overflow:'hidden', animation:'dpIn 0.15s cubic-bezier(0.4,0,0.2,1)' }}>

          {/* Header */}
          <div style={{ background: ACCENT_GRAD, padding:'12px 14px', display:'flex', alignItems:'center', gap:6 }}>
            {yearPicker ? (
              <>
                <Btn onClick={() => setYearPicker(false)}>←</Btn>
                <button type="button" onClick={() => setYearPicker(false)} style={{ flex:1, background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8, padding:'5px 0', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  {yearBase}–{yearBase+11}
                </button>
                <Btn onClick={() => setViewYear(y => y-12)}>‹</Btn>
                <Btn onClick={() => setViewYear(y => y+12)}>›</Btn>
              </>
            ) : (
              <>
                <Btn onClick={prevMonth}>‹</Btn>
                <button type="button" onClick={() => setYearPicker(true)} style={{ flex:1, background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8, padding:'5px 0', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  {MONTHS_IT[viewMonth]} {viewYear}
                </button>
                <Btn onClick={nextMonth}>›</Btn>
              </>
            )}
          </div>

          {/* Year grid */}
          {yearPicker && (
            <div style={{ padding:'12px 14px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
              {years.map(y => {
                const isSel  = selected?.getFullYear() === y;
                const isView = y === viewYear;
                const isNow  = y === today.getFullYear();
                return (
                  <button key={y} type="button" onClick={() => { setViewYear(y); setYearPicker(false); }}
                    style={{ padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight: isSel||isView ? 800 : 500, background: isSel ? ACCENT_GRAD : isView ? 'rgba(123,111,208,0.12)' : isNow ? '#f0fdf4' : 'transparent', color: isSel ? '#fff' : isView ? ACCENT : isNow ? '#16a34a' : 'var(--color-text,#1a1a2e)', transition:'all 0.1s' }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(123,111,208,0.1)'; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isView ? 'rgba(123,111,208,0.12)' : isNow ? '#f0fdf4' : 'transparent'; }}
                  >{y}</button>
                );
              })}
            </div>
          )}

          {/* Calendar */}
          {!yearPicker && (
            <div style={{ padding:'10px 14px 12px' }}>
              {/* Day headers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
                {DAYS_IT.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', padding:'2px 0' }}>{d}</div>)}
              </div>
              {/* Days */}
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px 0' }}>
                  {week.map((day, di) => {
                    if (!day) return <div key={di} />;
                    const dd     = new Date(viewYear, viewMonth, day); dd.setHours(0,0,0,0);
                    const isSel  = selected && dd.getTime() === selected.getTime();
                    const isNow  = dd.getTime() === today.getTime();
                    const isDis  = isDisabled(dd);
                    return (
                      <button key={di} type="button" onClick={() => selectDay(day)} disabled={isDis}
                        style={{ width:'100%', aspectRatio:'1', border:'none', borderRadius:8, cursor: isDis ? 'default':'pointer', fontSize:12, fontWeight: isSel||isNow ? 700 : 400, background: isSel ? ACCENT_GRAD : isNow ? 'rgba(123,111,208,0.08)' : 'transparent', color: isSel ? '#fff' : isDis ? '#d1d5db' : isNow ? ACCENT : 'var(--color-text,#1a1a2e)', outline: isNow && !isSel ? `1.5px solid ${ACCENT}` : 'none', transition:'all 0.1s' }}
                        onMouseEnter={e => { if (!isSel && !isDis) e.currentTarget.style.background = 'rgba(123,111,208,0.1)'; }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isNow ? 'rgba(123,111,208,0.08)' : 'transparent'; }}
                      >{day}</button>
                    );
                  })}
                </div>
              ))}
              {/* Footer */}
              <div style={{ borderTop:'1px solid #f3f4f6', marginTop:8, paddingTop:8, display:'flex', justifyContent:'center', gap:6 }}>
                <button type="button" onClick={() => { onChange?.(toYMD(today)); setOpen(false); }} style={{ background:'rgba(123,111,208,0.09)', border:'none', borderRadius:8, padding:'4px 14px', color: ACCENT, fontWeight:700, fontSize:12, cursor:'pointer' }}>Oggi</button>
                {value && <button type="button" onClick={() => { onChange?.(''); setOpen(false); }} style={{ background:'transparent', border:'none', borderRadius:8, padding:'4px 10px', color:'#9ca3af', fontWeight:600, fontSize:12, cursor:'pointer' }}>✕ Cancella</button>}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes dpIn{from{opacity:0;transform:translateY(-4px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}
