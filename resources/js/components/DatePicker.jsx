import { useState, useRef, useEffect, useCallback } from 'react';

const MONTHS_IT = [
    'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
];
const DAYS_IT = ['lu','ma','me','gi','ve','sa','do'];

// value: 'YYYY-MM-DD' | ''
// onChange: (e) => void  — emula un evento nativo con e.target.value
export default function DatePicker({ value, onChange, name, className = '', placeholder = 'Seleziona data', min, max, disabled }) {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(() => {
        if (value) return parseInt(value.split('-')[0]);
        return new Date().getFullYear();
    });
    const [viewMonth, setViewMonth] = useState(() => {
        if (value) return parseInt(value.split('-')[1]) - 1;
        return new Date().getMonth();
    });
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
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const selectDay = useCallback((day) => {
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${viewYear}-${mm}-${dd}`;
        onChange({ target: { name, value: dateStr } });
        setOpen(false);
    }, [viewYear, viewMonth, name, onChange]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    // Giorni del mese
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Giorno della settimana del primo giorno (0=domenica → adattiamo a lun=0)
    let firstDow = new Date(viewYear, viewMonth, 1).getDay();
    firstDow = firstDow === 0 ? 6 : firstDow - 1; // converti a lun-based

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // Label visualizzata nell'input
    const displayValue = value
        ? (() => {
            const [y, m, d] = value.split('-');
            return `${d} ${MONTHS_IT[parseInt(m)-1]} ${y}`;
          })()
        : '';

    return (
        <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            {/* Input trigger */}
            <div
                className={`datepicker-input ${className} ${disabled ? 'datepicker-disabled' : ''}`}
                onClick={() => !disabled && setOpen(o => !o)}
            >
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

            {/* Dropdown calendario */}
            {open && (
                <div className="datepicker-dropdown">
                    {/* Header mese/anno */}
                    <div className="datepicker-header">
                        <button className="datepicker-nav" onClick={prevMonth} type="button">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                        <span className="datepicker-month-label">
                            {MONTHS_IT[viewMonth]} {viewYear}
                        </span>
                        <button className="datepicker-nav" onClick={nextMonth} type="button">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                                <polyline points="9 18 15 12 9 6"/>
                            </svg>
                        </button>
                    </div>

                    {/* Intestazione giorni settimana */}
                    <div className="datepicker-weekdays">
                        {DAYS_IT.map(d => <span key={d}>{d}</span>)}
                    </div>

                    {/* Griglia giorni */}
                    <div className="datepicker-grid">
                        {/* Celle vuote iniziali */}
                        {Array.from({ length: firstDow }).map((_, i) => (
                            <span key={`e${i}`} className="datepicker-cell datepicker-empty"/>
                        ))}
                        {/* Giorni */}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const mm = String(viewMonth + 1).padStart(2, '0');
                            const dd = String(day).padStart(2, '0');
                            const dateStr = `${viewYear}-${mm}-${dd}`;
                            const isSelected = dateStr === value;
                            const isToday = dateStr === todayStr;
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    className={`datepicker-cell datepicker-day ${isSelected ? 'datepicker-selected' : ''} ${isToday && !isSelected ? 'datepicker-today' : ''}`}
                                    onClick={() => selectDay(day)}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer: Oggi / Cancella */}
                    <div className="datepicker-footer">
                        <button type="button" className="datepicker-footer-btn datepicker-clear"
                            onClick={() => { onChange({ target: { name, value: '' } }); setOpen(false); }}>
                            Cancella
                        </button>
                        <button type="button" className="datepicker-footer-btn datepicker-today-btn"
                            onClick={() => { selectDay(today.getDate()); setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }}>
                            Oggi
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
