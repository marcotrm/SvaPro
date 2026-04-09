import { useState, useRef, useEffect, useCallback } from 'react';

const MONTHS_IT = [
    'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
];
const MONTHS_IT_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const DAYS_IT = ['lu','ma','me','gi','ve','sa','do'];

// Genera range anni: currentYear - 80 → currentYear + 20
const THIS_YEAR = new Date().getFullYear();
const YEAR_RANGE = Array.from({ length: 101 }, (_, i) => THIS_YEAR - 80 + i);

// value: 'YYYY-MM-DD' | ''
// onChange: (e) => void  — emula un evento nativo con e.target.value
export default function DatePicker({ value, onChange, name, className = '', placeholder = 'Seleziona data', min, max, disabled }) {
    const [open, setOpen]         = useState(false);
    // 'days' | 'months' | 'years'
    const [view, setView]         = useState('days');
    const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split('-')[0]) : THIS_YEAR);
    const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth());
    // Scroll alla riga anno corrente nella vista anni
    const yearsRef = useRef(null);
    const ref = useRef(null);

    // Sincronizza la vista col valore esterno
    useEffect(() => {
        if (value) {
            setViewYear(parseInt(value.split('-')[0]));
            setViewMonth(parseInt(value.split('-')[1]) - 1);
        }
    }, [value]);

    // Chiudi cliccando fuori
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setView('days'); } };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Auto-scroll al anno corrente nella vista anni
    useEffect(() => {
        if (view === 'years' && yearsRef.current) {
            const el = yearsRef.current.querySelector('.datepicker-year-active');
            if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [view]);

    const selectDay = useCallback((day) => {
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        onChange({ target: { name, value: `${viewYear}-${mm}-${dd}` } });
        setOpen(false);
        setView('days');
    }, [viewYear, viewMonth, name, onChange]);

    const prevMonth = (e) => {
        e.stopPropagation();
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = (e) => {
        e.stopPropagation();
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    // Giorni del mese
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    let firstDow = new Date(viewYear, viewMonth, 1).getDay();
    firstDow = firstDow === 0 ? 6 : firstDow - 1;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const displayValue = value
        ? (() => { const [y, m, d] = value.split('-'); return `${d} ${MONTHS_IT[parseInt(m)-1]} ${y}`; })()
        : '';

    const openCalendar = () => { if (!disabled) { setOpen(o => !o); setView('days'); } };

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            {/* Input trigger */}
            <div className={`datepicker-input ${className} ${disabled ? 'datepicker-disabled' : ''}`} onClick={openCalendar}>
                <span className={displayValue ? 'datepicker-value' : 'datepicker-placeholder'}>
                    {displayValue || placeholder}
                </span>
                <svg className="datepicker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
            </div>

            {open && (
                <div className="datepicker-dropdown">

                    {/* ── Header ── */}
                    <div className="datepicker-header">
                        {view === 'days' && (
                            <button className="datepicker-nav" onClick={prevMonth} type="button">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                        )}

                        <div className="datepicker-header-labels">
                            {/* Click mese → vista mesi */}
                            <button
                                type="button"
                                className={`datepicker-label-btn ${view === 'months' ? 'active' : ''}`}
                                onClick={() => setView(v => v === 'months' ? 'days' : 'months')}
                            >
                                {MONTHS_IT[viewMonth]}
                            </button>
                            {/* Click anno → vista anni */}
                            <button
                                type="button"
                                className={`datepicker-label-btn datepicker-year-btn ${view === 'years' ? 'active' : ''}`}
                                onClick={() => setView(v => v === 'years' ? 'days' : 'years')}
                            >
                                {viewYear}
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10" style={{ marginLeft: 2 }}>
                                    <polyline points={view === 'years' ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
                                </svg>
                            </button>
                        </div>

                        {view === 'days' && (
                            <button className="datepicker-nav" onClick={nextMonth} type="button">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        )}
                    </div>

                    {/* ── Vista Anni ── */}
                    {view === 'years' && (
                        <div className="datepicker-year-grid" ref={yearsRef}>
                            {YEAR_RANGE.map(y => (
                                <button
                                    key={y}
                                    type="button"
                                    className={`datepicker-year-cell ${y === viewYear ? 'datepicker-year-active' : ''} ${y === THIS_YEAR ? 'datepicker-year-today' : ''}`}
                                    onClick={() => { setViewYear(y); setView('months'); }}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Vista Mesi ── */}
                    {view === 'months' && (
                        <div className="datepicker-month-grid">
                            {MONTHS_IT_SHORT.map((m, i) => (
                                <button
                                    key={m}
                                    type="button"
                                    className={`datepicker-month-cell ${i === viewMonth ? 'datepicker-month-active' : ''}`}
                                    onClick={() => { setViewMonth(i); setView('days'); }}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Vista Giorni ── */}
                    {view === 'days' && (
                        <>
                            <div className="datepicker-weekdays">
                                {DAYS_IT.map(d => <span key={d}>{d}</span>)}
                            </div>
                            <div className="datepicker-grid">
                                {Array.from({ length: firstDow }).map((_, i) => (
                                    <span key={`e${i}`} className="datepicker-cell datepicker-empty"/>
                                ))}
                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                    const mm  = String(viewMonth + 1).padStart(2, '0');
                                    const dd  = String(day).padStart(2, '0');
                                    const dateStr   = `${viewYear}-${mm}-${dd}`;
                                    const isSelected = dateStr === value;
                                    const isToday    = dateStr === todayStr;
                                    return (
                                        <button
                                            key={day} type="button"
                                            className={`datepicker-cell datepicker-day ${isSelected ? 'datepicker-selected' : ''} ${isToday && !isSelected ? 'datepicker-today' : ''}`}
                                            onClick={() => selectDay(day)}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* ── Footer ── */}
                    <div className="datepicker-footer">
                        <button type="button" className="datepicker-footer-btn datepicker-clear"
                            onClick={() => { onChange({ target: { name, value: '' } }); setOpen(false); setView('days'); }}>
                            Cancella
                        </button>
                        <button type="button" className="datepicker-footer-btn datepicker-today-btn"
                            onClick={() => {
                                setViewMonth(today.getMonth());
                                setViewYear(today.getFullYear());
                                setView('days');
                                selectDay(today.getDate());
                            }}>
                            Oggi
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
