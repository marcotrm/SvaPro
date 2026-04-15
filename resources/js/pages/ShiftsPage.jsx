import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { attendance, shifts as shiftsApi, stores, clearApiCache } from '../api.jsx';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Loader, Clock, Trash, X, Download, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import ShiftTemplateModal from '../components/ShiftTemplateModal.jsx';

// ── Utility date ─────────────────────────────────────────────────────────────
function getStartOfWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function generateWeekDays(startDate) {
  const days = [];
  const curr = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    days.push({
      dateStr: formatDate(curr),
      label: curr.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }),
      isToday: formatDate(curr) === formatDate(new Date()),
    });
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

// ── Assenze LocalStorage key ──────────────────────────────────────────────────
const ABSENCE_KEY = 'svapro_absences_v1';
function loadAbsences() {
  try { return JSON.parse(localStorage.getItem(ABSENCE_KEY) || '{}'); }
  catch { return {}; }
}
function saveAbsencesToStorage(obj) {
  try { localStorage.setItem(ABSENCE_KEY, JSON.stringify(obj)); } catch {}
}

// ── Popup assenza ─────────────────────────────────────────────────────────────
function AbsenceModal({ emp, existing, onSave, onRemove, onClose }) {
  const today = formatDate(new Date());
  const [type, setType]           = useState(existing?.type     || 'ferie');
  const [from, setFrom]           = useState(existing?.from     || today);
  const [to,   setTo]             = useState(existing?.to       || today);
  const [timeFrom, setTimeFrom]   = useState(existing?.time_from || '09:00');
  const [timeTo,   setTimeTo]     = useState(existing?.time_to   || '13:00');

  const typeOpts = [
    { value: 'ferie',    label: '🌴 Ferie', color: '#3B82F6' },
    { value: 'malattia', label: '🤒 Malattia', color: '#EF4444' },
    { value: 'permesso', label: '📋 Permesso', color: '#F59E0B' },
    { value: 'altro',    label: '⛔ Altro',    color: '#8B5CF6' },
  ];
  const chosen = typeOpts.find(o => o.value === type) || typeOpts[0];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--color-surface)', borderRadius: 20, padding: 28, width: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 2 }}>
              Gestisci indisponibilità
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--color-text)' }}>{emp.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tipo assenza */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
            Tipo
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {typeOpts.map(o => (
              <button
                key={o.value}
                onClick={() => setType(o.value)}
                style={{
                  padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  border: `2px solid ${type === o.value ? o.color : 'var(--color-border)'}`,
                  background: type === o.value ? `${o.color}18` : 'var(--color-bg)',
                  color: type === o.value ? o.color : 'var(--color-text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: type === 'permesso' ? 12 : 24 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Dal
            </label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Al
            </label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => setTo(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {/* Orario permesso (solo per tipo = permesso) */}
        {type === 'permesso' && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>⏰ Orario permesso</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Dalle ore</label>
                <input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #F59E0B80', background: '#FFFBEB', color: '#92400E', fontSize: 16, fontWeight: 700, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Alle ore</label>
                <input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #F59E0B80', background: '#FFFBEB', color: '#92400E', fontSize: 16, fontWeight: 700, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>
          </div>
        )}

        {/* Riepilogo */}
        {from && to && (
          <div style={{ background: `${chosen.color}12`, border: `1px solid ${chosen.color}40`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: chosen.color, fontWeight: 600 }}>
            {chosen.label} dal {from.split('-').reverse().join('/')} al {to.split('-').reverse().join('/')}
            {type === 'permesso' && timeFrom && timeTo && (
              <span> · ⏰ {timeFrom}–{timeTo}</span>
            )}
          </div>
        )}

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 10 }}>
          {existing && (
            <button
              onClick={onRemove}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              🗑 Rimuovi
            </button>
          )}
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Annulla
          </button>
          <button
            onClick={() => {
              if (!from || !to) { toast.error('Imposta le date di inizio e fine'); return; }
              if (from > to)    { toast.error('La data inizio deve precedere la data fine'); return; }
              const data = { type, from, to };
              if (type === 'permesso') { data.time_from = timeFrom; data.time_to = timeTo; }
              onSave(data);
            }}
            style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: chosen.color, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
          >
            ✓ Conferma indisponibilità
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gap detection ─────────────────────────────────────────────────────────────
// Converte HH:MM in minuti (definita qui perché usata anche sotto nell'export)
function _toMins(t) {
  if (!t) return -1;
  const parts = String(t).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
}
function _minsToStr(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function detectGaps(shiftsMap, weekDays) {
  const alerts = [];
  weekDays.forEach(day => {
    const intervals = [];
    Object.entries(shiftsMap).forEach(([key, s]) => {
      // Estrai la data dagli ultimi 10 caratteri della chiave (formato YYYY-MM-DD)
      const keyDate = key.slice(-10);
      if (keyDate !== day.dateStr) return;
      if (!s.start_time || !s.end_time) return;
      const startMins = _toMins(s.start_time);
      const endMins   = _toMins(s.end_time);
      if (startMins < 0 || endMins <= startMins) return;
      intervals.push({ startMins, endMins, startStr: s.start_time });
    });
    if (intervals.length < 2) return;
    // Ordina per ora di inizio (numerica)
    intervals.sort((a, b) => a.startMins - b.startMins);
    let maxEnd = intervals[0].endMins;
    for (let i = 1; i < intervals.length; i++) {
      const { startMins, endMins, startStr } = intervals[i];
      if (startMins > maxEnd) {
        // Buco trovato: da maxEnd a startMins
        alerts.push({ day: day.label, from: _minsToStr(maxEnd), to: startStr });
      }
      if (endMins > maxEnd) maxEnd = endMins;
    }
  });
  return alerts;
}

// ── XLS (HTML) export helper — Excel apre HTML con stili nativi ───────────────
function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function formatHours(mins) {
  if (!mins || mins <= 0) return '0h 0m';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Palette colori stato — sfondo cella
const STATO_BG = {
  Presente:      '#D1FAE5',  // verde chiaro
  Ferie:         '#FEF3C7',  // giallo ambra
  Malattia:      '#FEE2E2',  // rosso pallido
  Permesso:      '#DBEAFE',  // blu chiaro
  Assente:       '#F3F4F6',  // grigio chiaro
  Indisponibile: '#EDE9FE',  // viola pallido
};
const STATO_COLOR = {
  Presente:      '#065F46',
  Ferie:         '#92400E',
  Malattia:      '#991B1B',
  Permesso:      '#1E40AF',
  Assente:       '#6B7280',
  Indisponibile: '#5B21B6',
};
const STATO_EMOJI = {
  Presente:      '✅',
  Ferie:         '🌴',
  Malattia:      '🤒',
  Permesso:      '🕐',
  Assente:       '❌',
  Indisponibile: '⛔',
};

function downloadXLS(htmlContent, filename) {
  const full = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="UTF-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
      <x:ExcelWorksheet><x:Name>Turni</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>
      td, th { border: 1px solid #D1D5DB; padding: 6px 10px; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
      table { border-collapse: collapse; width: 100%; }
    </style>
  </head>
  <body>${htmlContent}</body>
  </html>`;
  const blob = new Blob([full], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fmtTimeStr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// ── ExportModal ───────────────────────────────────────────────────────────────
const DAY_NAMES_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

function ExportModal({ employees, onClose }) {
  const today   = formatDate(new Date());
  const weekAgo = formatDate(new Date(Date.now() - 7 * 86400000));
  const [dateFrom,  setDateFrom]  = useState(weekAgo);
  const [dateTo,    setDateTo]    = useState(today);
  const [selected,  setSelected]  = useState(new Set(employees.map(e => e.id)));
  const [exporting, setExporting] = useState(false);

  const toggleAll = () =>
    setSelected(prev => prev.size === employees.length ? new Set() : new Set(employees.map(e => e.id)));
  const toggle = id =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleExport = async () => {
    if (selected.size === 0) { toast.error('Seleziona almeno un dipendente'); return; }
    if (!dateFrom || !dateTo) { toast.error('Imposta le date'); return; }
    setExporting(true);
    try {
      // ── Genera array di date nel periodo ────────────────────────────────
      const dates = [];
      let curr = new Date(dateFrom + 'T00:00:00');
      const end = new Date(dateTo + 'T00:00:00');
      while (curr <= end) { dates.push(formatDate(curr)); curr.setDate(curr.getDate() + 1); }

      // ── Leggi assenze da localStorage ───────────────────────────────────
      let absenceData = {};
      try { absenceData = JSON.parse(localStorage.getItem('svapro_absences_v1') || '{}'); } catch {}

      // ── Carica turni + timbrature in parallelo ───────────────────────────
      const [shRes, attRes] = await Promise.all([
        shiftsApi.getAll({ start_date: dateFrom, end_date: dateTo }),
        attendance.getHistory({ date_from: dateFrom, date_to: dateTo }),
      ]);
      const shiftList = shRes.data?.data  || [];
      const attList   = attRes.data?.data || [];

      // Indici per lookup O(1)
      const shiftByKey = {};  // `${empId}_${date}` -> shift
      shiftList.forEach(s => { shiftByKey[`${s.employee_id}_${s.date}`] = s; });

      const attByKey = {};    // `${empId}_${date}` -> first attendance record
      attList.forEach(r => {
        const date = (r.checked_in_at || '').split('T')[0] || r.date || '';
        if (!date) return;
        const k = `${r.employee_id}_${date}`;
        if (!attByKey[k]) attByKey[k] = r;
      });

      const getAbsence = (empId, date) => {
        const a = absenceData[empId];
        if (!a || !a.from || !a.to) return null;
        return date >= a.from && date <= a.to ? a : null;
      };

      // ── Costruisci HTML colorato ─────────────────────────────────────────────
      const cell = (content, opts = {}) => {
        const {
          bg = '#fff', color = '#1F2937', bold = false, center = false,
          size = '11pt', colspan = 1, border = true,
        } = opts;
        const bdr = border ? 'border:1px solid #D1D5DB;' : '';
        const align = center ? 'text-align:center;' : '';
        const weight = bold ? 'font-weight:700;' : '';
        const colAttr = colspan > 1 ? ` colspan="${colspan}"` : '';
        return `<td${colAttr} style="background:${bg};color:${color};${weight}${align}${bdr}padding:6px 10px;font-family:Calibri,Arial,sans-serif;font-size:${size};">${content ?? ''}</td>`;
      };

      const COL_COUNT = 10;
      let html = '<table>';

      // Accumulatori per ogni dipendente (devono essere dichiarati prima del loop)
      const totSched    = {};
      const totAct      = {};
      const totFerie    = {};
      const totMalatt   = {};
      const totPerm     = {};
      const totAssente  = {};
      const totPresente = {};

      employees.filter(e => selected.has(e.id)).forEach(emp => {
        totSched[emp.id]    = 0;
        totAct[emp.id]      = 0;
        totFerie[emp.id]    = 0;
        totMalatt[emp.id]   = 0;
        totPerm[emp.id]     = 0;
        totAssente[emp.id]  = 0;
        totPresente[emp.id] = 0;

        // ── Intestazione dipendente ────────────────────────────────────────────
        html += `<tr><td colspan="${COL_COUNT}" style="background:#312E81;color:#fff;font-weight:800;font-size:12pt;padding:10px 14px;font-family:Calibri,Arial,sans-serif;border:1px solid #1E1B4B;letter-spacing:0.02em;">`
             + `👤 ${emp.first_name || ''} ${emp.last_name || ''}`
             + (emp.store_name ? `  <span style="font-size:10pt;font-weight:400;color:#C7D2FE;"> — ${emp.store_name}</span>` : '')
             + `</td></tr>`;

        // ── Intestazione colonne ───────────────────────────────────────────────
        const headerStyle = 'background:#4338CA;color:#fff;font-weight:700;font-size:10pt;padding:7px 10px;font-family:Calibri,Arial,sans-serif;border:1px solid #3730A3;text-align:center;';
        html += '<tr>'
          + `<td style="${headerStyle}">Data</td>`
          + `<td style="${headerStyle}">Giorno</td>`
          + `<td style="${headerStyle}">Turno Prog.</td>`
          + `<td style="${headerStyle}">Entrata</td>`
          + `<td style="${headerStyle}">Uscita</td>`
          + `<td style="${headerStyle}">Ore Lav.</td>`
          + `<td style="${headerStyle}">Stato</td>`
          + `<td style="${headerStyle}">Ferie/Perm.</td>`
          + `<td style="${headerStyle}">Ore Extra</td>`
          + `<td style="${headerStyle}">Note</td>`
          + '</tr>';

        // ── Righe giornaliere ─────────────────────────────────────────────────
        let runningExtra = 0;
        dates.forEach(date => {
          const shift   = shiftByKey[`${emp.id}_${date}`];
          const rec     = attByKey[`${emp.id}_${date}`];
          const absence = getAbsence(emp.id, date);

          const schedMins = shift
            ? Math.max(0, timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time))
            : 0;
          totSched[emp.id] += schedMins;

          let actMins = 0;
          if (rec?.checked_in_at && rec?.checked_out_at) {
            actMins = Math.max(0, Math.round((new Date(rec.checked_out_at) - new Date(rec.checked_in_at)) / 60000));
          }
          totAct[emp.id] += actMins;

          let stato = 'Assente';
          if (absence) {
            if (absence.type === 'ferie')         { stato = 'Ferie';         totFerie[emp.id]++;   }
            else if (absence.type === 'malattia') { stato = 'Malattia';      totMalatt[emp.id]++;  }
            else if (absence.type === 'permesso') { stato = 'Permesso';      totPerm[emp.id]++;    }
            else                                  { stato = 'Indisponibile'; }
          } else if (rec?.checked_in_at) {
            stato = 'Presente';
            totPresente[emp.id]++;
          } else {
            totAssente[emp.id]++;
          }

          const dayExtra = actMins > schedMins ? actMins - schedMins : 0;
          runningExtra += dayExtra;

          const note = absence?.type === 'permesso' && absence.time_from
            ? `${absence.time_from}–${absence.time_to}`
            : '';

          const bg    = STATO_BG[stato]    || '#fff';
          const color = STATO_COLOR[stato] || '#1F2937';
          const emoji = STATO_EMOJI[stato] || '';
          const rowStyle = `background:${bg};`;
          const [y, m, d] = date.split('-');
          const dateIta = `${d}/${m}/${y}`;
          const dayName = DAY_NAMES_IT[new Date(date + 'T00:00:00').getDay()];
          const isWeekend = [0,6].includes(new Date(date + 'T00:00:00').getDay());
          const rowBg = isWeekend && stato === 'Assente' ? '#F9FAFB' : bg;

          html += `<tr style="${rowStyle}">`
            + cell(dateIta,                         { bg: rowBg, bold: isWeekend, color: isWeekend ? '#6B7280' : '#1F2937', center: true })
            + cell(dayName,                         { bg: rowBg, bold: isWeekend, color: isWeekend ? '#9CA3AF' : '#1F2937', center: true })
            + cell(shift ? formatHours(schedMins) : '—', { bg: rowBg, center: true, color: '#374151' })
            + cell(rec?.checked_in_at  ? fmtTimeStr(rec.checked_in_at)  : '—', { bg: rowBg, center: true })
            + cell(rec?.checked_out_at ? fmtTimeStr(rec.checked_out_at) : '—', { bg: rowBg, center: true })
            + cell(actMins > 0 ? formatHours(actMins) : '—',                   { bg: rowBg, center: true, color: actMins > 0 ? '#065F46' : '#9CA3AF' })
            + cell(`${emoji} ${stato}`,             { bg, color, bold: true, center: true })
            + cell(absence?.type ? (absence.type.charAt(0).toUpperCase() + absence.type.slice(1)) : '',  { bg: rowBg, color: '#6B7280', center: true })
            + cell(dayExtra > 0 ? `+${formatHours(dayExtra)}` : '',            { bg: rowBg, center: true, color: '#059669', bold: dayExtra > 0 })
            + cell(note,                            { bg: rowBg, color: '#6B7280' })
            + '</tr>';
        });

        // ── Riga TOTALE dipendente ─────────────────────────────────────────────
        const extra = Math.max(0, totAct[emp.id] - totSched[emp.id]);
        const totStyle = 'background:#0F766E;color:#fff;font-weight:700;font-size:11pt;padding:8px 10px;font-family:Calibri,Arial,sans-serif;border:1px solid #0D9488;';
        html += '<tr>'
          + `<td colspan="2" style="${totStyle}">📊 TOTALE ${emp.first_name} ${emp.last_name}</td>`
          + `<td style="${totStyle}text-align:center;">Prog: ${formatHours(totSched[emp.id])}</td>`
          + `<td colspan="2" style="${totStyle}text-align:center;">Effettive: ${formatHours(totAct[emp.id])}</td>`
          + `<td style="${totStyle}text-align:center;color:${extra > 0 ? '#FDE68A' : '#99F6E4'};">` + (extra > 0 ? `⭐ +${formatHours(extra)}` : '—') + '</td>'
          + `<td style="${totStyle}text-align:center;">✅ ${totPresente[emp.id]}gg</td>`
          + `<td style="${totStyle}text-align:center;">🌴 ${totFerie[emp.id]}  🤒 ${totMalatt[emp.id]}  🕐 ${totPerm[emp.id]}  ❌ ${totAssente[emp.id]}</td>`
          + `<td colspan="2" style="${totStyle}"></td>`
          + '</tr>';

        // ── Riga vuota separatrice ─────────────────────────────────────────────
        html += `<tr><td colspan="${COL_COUNT}" style="background:#F9FAFB;border:none;padding:4px;"></td></tr>`;
      });

      // ── SEZIONE RIEPILOGO FINALE ─────────────────────────────────────────────
      html += `<tr><td colspan="${COL_COUNT}" style="background:#1E1B4B;color:#C7D2FE;font-weight:900;font-size:13pt;padding:12px 14px;font-family:Calibri,Arial,sans-serif;border:1px solid #1E1B4B;letter-spacing:0.05em;">📋 RIEPILOGO TOTALI — ${dateFrom} → ${dateTo}</td></tr>`;

      const rhStyle = 'background:#3730A3;color:#fff;font-weight:700;font-size:10pt;padding:7px 10px;font-family:Calibri,Arial,sans-serif;border:1px solid #312E81;text-align:center;';
      html += '<tr>'
        + `<td colspan="2" style="${rhStyle}">👤 Dipendente</td>`
        + `<td style="${rhStyle}">Ore Prog.</td>`
        + `<td style="${rhStyle}">Ore Effect.</td>`
        + `<td style="${rhStyle}">⭐ ORE EXTRA</td>`
        + `<td style="${rhStyle}">✅ Presenti</td>`
        + `<td style="${rhStyle}">🌴 Ferie</td>`
        + `<td style="${rhStyle}">🤒 Malattia</td>`
        + `<td style="${rhStyle}">🕐 Permessi</td>`
        + `<td style="${rhStyle}">❌ Assenti</td>`
        + '</tr>';

      employees.filter(e => selected.has(e.id)).forEach((emp, idx) => {
        const extra = Math.max(0, totAct[emp.id] - totSched[emp.id]);
        const evenBg = idx % 2 === 0 ? '#EEF2FF' : '#fff';
        const sumStyle = (bg = evenBg, color = '#1F2937', bold = false) =>
          `background:${bg};color:${color};${bold ? 'font-weight:700;' : ''}font-size:11pt;padding:7px 10px;font-family:Calibri,Arial,sans-serif;border:1px solid #C7D2FE;text-align:center;`;
        html += '<tr>'
          + `<td colspan="2" style="${sumStyle(evenBg, '#1F2937', true)}text-align:left;">${emp.first_name} ${emp.last_name}${ emp.store_name ? ' — ' + emp.store_name : ''}</td>`
          + `<td style="${sumStyle()}">` + formatHours(totSched[emp.id]) + '</td>'
          + `<td style="${sumStyle()}">` + formatHours(totAct[emp.id]) + '</td>'
          + `<td style="${sumStyle(extra > 0 ? '#D1FAE5' : evenBg, extra > 0 ? '#065F46' : '#6B7280', true)}">` + (extra > 0 ? `+${formatHours(extra)}` : '0h 0m') + '</td>'
          + `<td style="${sumStyle()}">` + (totPresente[emp.id] || 0) + '</td>'
          + `<td style="${sumStyle(totFerie[emp.id] > 0 ? '#FEF3C7' : evenBg, totFerie[emp.id] > 0 ? '#92400E' : '#6B7280')}">` + (totFerie[emp.id] || 0) + '</td>'
          + `<td style="${sumStyle(totMalatt[emp.id] > 0 ? '#FEE2E2' : evenBg, totMalatt[emp.id] > 0 ? '#991B1B' : '#6B7280')}">` + (totMalatt[emp.id] || 0) + '</td>'
          + `<td style="${sumStyle(totPerm[emp.id] > 0 ? '#DBEAFE' : evenBg, totPerm[emp.id] > 0 ? '#1E40AF' : '#6B7280')}">` + (totPerm[emp.id] || 0) + '</td>'
          + `<td style="${sumStyle(totAssente[emp.id] > 0 ? '#F3F4F6' : evenBg, '#6B7280')}">` + (totAssente[emp.id] || 0) + '</td>'
          + '</tr>';
      });

      html += '</table>';

      downloadXLS(html, `turni_${dateFrom}_${dateTo}.xls`);
      toast.success('File scaricato! Aprilo con Excel.');
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Errore durante l\'esportazione');
    } finally { setExporting(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9100, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'var(--color-surface)', borderRadius:20, padding:28, width:460, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.35)', border:'1px solid var(--color-border)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:'var(--color-text)' }}>📥 Esporta Turni</div>
            <div style={{ fontSize:12, color:'var(--color-text-tertiary)', marginTop:3 }}>Una riga per giorno · ferie/permessi inclusi · riepilogo ore</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-tertiary)' }}><X size={18}/></button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Dal</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:14, boxSizing:'border-box', outline:'none' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 }}>Al</label>
            <input type="date" value={dateTo} min={dateFrom} onChange={e=>setDateTo(e.target.value)} style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text)', fontSize:14, boxSizing:'border-box', outline:'none' }}/>
          </div>
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>Dipendenti ({selected.size}/{employees.length})</span>
          <button onClick={toggleAll} style={{ fontSize:11, fontWeight:700, color:'#6366F1', background:'none', border:'none', cursor:'pointer' }}>
            {selected.size === employees.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
        </div>
        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:16, maxHeight:200 }}>
          {employees.map(e => (
            <label key={e.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, cursor:'pointer', background: selected.has(e.id) ? 'rgba(99,102,241,0.08)' : 'var(--color-bg)', border:`1px solid ${selected.has(e.id) ? '#6366F1' : 'var(--color-border)'}`, transition:'all 0.1s' }}>
              <input type="checkbox" checked={selected.has(e.id)} onChange={()=>toggle(e.id)} style={{ accentColor:'#6366F1', width:16, height:16 }}/>
              <span style={{ fontWeight:700, fontSize:13, color:'var(--color-text)' }}>{e.first_name} {e.last_name}</span>
              <span style={{ fontSize:11, color:'var(--color-text-tertiary)', marginLeft:'auto' }}>{e.store_name || ''}</span>
            </label>
          ))}
        </div>

        <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#4338CA' }}>
          📋 <strong>Colonne nel file:</strong> Nome · Cognome · Data · Giorno · Turno · Entrata · Uscita · Ore lavorate · Stato (Presente/Ferie/Malattia/Permesso/Assente) · Note
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:12, border:'1px solid var(--color-border)', background:'var(--color-bg)', color:'var(--color-text-secondary)', fontWeight:700, fontSize:13, cursor:'pointer' }}>Annulla</button>
          <button onClick={handleExport} disabled={exporting} style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background:'#6366F1', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', opacity:exporting?0.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {exporting ? <Loader size={16} style={{animation:'spin 1s linear infinite'}}/> : <Download size={16}/>}
            {exporting ? 'Generazione...' : `Scarica CSV (${selected.size} dip.)`}
          </button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { selectedStoreId } = useOutletContext?.() || {};
  const [storeId, setStoreId] = useState(selectedStoreId || '');

  const [weekStart, setWeekStart] = useState(() => getStartOfWeek());
  const weekDays = useMemo(() => generateWeekDays(weekStart), [weekStart]);

  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts]       = useState({});
  const [originalShifts, setOriginalShifts] = useState({});
  const [templates, setTemplates]   = useState([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [showExport, setShowExport] = useState(false);  // NEW: Export modal

  // ── Gap detection (ricalcola ogni volta che shifts cambia) ──────────────────
  const gapAlerts = useMemo(() => detectGaps(shifts, weekDays), [shifts, weekDays]);

  // ── Assenze ────────────────────────────────────────────────────
  const [absences, setAbsences]       = useState(() => loadAbsences());
  const [absenceModal, setAbsenceModal] = useState(null); // { emp } | null

  const openAbsenceModal = (emp, e) => {
    e.stopPropagation();
    setAbsenceModal({ emp });
    setActiveCell(null);
  };

  const handleSaveAbsence = (empId, data) => {
    const next = { ...absences, [empId]: data };
    setAbsences(next);
    saveAbsencesToStorage(next);
    toast.success(`Indisponibilità impostata per ${absenceModal.emp.name}`);
    setAbsenceModal(null);
  };

  const handleRemoveAbsence = (empId) => {
    const next = { ...absences };
    delete next[empId];
    setAbsences(next);
    saveAbsencesToStorage(next);
    toast.success('Indisponibilità rimossa');
    setAbsenceModal(null);
  };

  const isAbsent = (empId, dateStr) => {
    const a = absences[empId];
    if (!a || !a.from || !a.to) return null;
    return dateStr >= a.from && dateStr <= a.to ? a : null;
  };

  const absenceColor = type =>
    type === 'ferie' ? '#3B82F6' : type === 'malattia' ? '#EF4444' : type === 'permesso' ? '#F59E0B' : '#8B5CF6';

  const absenceLabel = type =>
    type === 'ferie' ? '🌴 Ferie' : type === 'malattia' ? '🤒 Malattia' : type === 'permesso' ? '📋 Permesso' : '⛔ Indisponibile';
  // ───────────────────────────────────────────────────────────────

  useEffect(() => { if (selectedStoreId) setStoreId(selectedStoreId); }, [selectedStoreId]);

  useEffect(() => {
    if (storeId) loadData();
    else { setEmployees([]); setShifts({}); setOriginalShifts({}); }
  }, [storeId, weekStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      const empRes = await attendance.getEmployeesKiosk({ store_id: storeId });
      setEmployees(empRes.data?.data || []);
      const startDateStr = weekDays[0].dateStr;
      const endDateStr   = weekDays[6].dateStr;
      const shRes = await shiftsApi.getAll({ store_id: storeId, start_date: startDateStr, end_date: endDateStr });
      const shiftsMap = {};
      (shRes.data?.data || []).forEach(s => {
        const key = `${s.employee_id}_${s.date}`;
        shiftsMap[key] = { start_time: s.start_time, end_time: s.end_time, color: s.color };
      });
      setShifts(shiftsMap);
      setOriginalShifts(JSON.parse(JSON.stringify(shiftsMap)));
      const tplRes = await shiftsApi.getTemplates();
      setTemplates(tplRes.data?.data || []);
    } catch {
      toast.error('Errore caricamento dati');
    } finally { setLoading(false); }
  };

  const handlePrevWeek = () => { const n = new Date(weekStart); n.setDate(n.getDate() - 7); setWeekStart(n); };
  const handleNextWeek = () => { const n = new Date(weekStart); n.setDate(n.getDate() + 7); setWeekStart(n); };

  const onCellChange = (empId, dateStr, changes) => {
    const key = `${empId}_${dateStr}`;
    setShifts(prev => {
      const copy = { ...prev };
      if (!copy[key]) copy[key] = { start_time: '', end_time: '', color: '#10B981' };
      copy[key] = { ...copy[key], ...changes };
      return copy;
    });
  };

  const applyTemplate = (empId, dateStr, tpl) => {
    onCellChange(empId, dateStr, { start_time: tpl.start_time, end_time: tpl.end_time, color: tpl.color });
    setActiveCell(null);
  };

  const clearCell = (empId, dateStr) => {
    const key = `${empId}_${dateStr}`;
    setShifts(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
    setActiveCell(null);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const payload = { store_id: storeId, shifts: [], deletions: [] };
      Object.keys(shifts).forEach(key => {
        const [empId, dateStr] = key.split('_');
        payload.shifts.push({ employee_id: empId, date: dateStr, start_time: shifts[key].start_time, end_time: shifts[key].end_time, color: shifts[key].color });
      });
      Object.keys(originalShifts).forEach(key => {
        if (!shifts[key]) {
          const [empId, dateStr] = key.split('_');
          payload.deletions.push({ employee_id: empId, date: dateStr });
        }
      });
      await shiftsApi.bulkSave(payload);
      toast.success('Turni salvati con successo');
      setOriginalShifts(JSON.parse(JSON.stringify(shifts)));
    } catch { toast.error('Errore nel salvataggio'); }
    finally { setSaving(false); }
  };

  const renderCellMenu = (empId, dateStr) => {
    if (!(activeCell?.empId === empId && activeCell?.dateStr === dateStr)) return null;
    return (
      <div style={{ position: 'absolute', top: 5, left: '95%', zIndex: 100, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', width: 220 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Seleziona Turno</div>
          <button onClick={e => { e.stopPropagation(); setActiveCell(null); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}><X size={14} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
          {templates.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '10px 0' }}>Nessun template.</div>
          ) : templates.map(t => (
            <button key={t.id} onClick={() => applyTemplate(empId, dateStr, t)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg)'}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color || '#10B981' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{t.start_time} - {t.end_time}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--color-border)', margin: '10px 0' }} />
        <button onClick={() => clearCell(empId, dateStr)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: 'none', width: '100%', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          <Trash size={14} /> Cancella Turno (Riposo)
        </button>
      </div>
    );
  };

  if (!storeId) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
      <CalendarIcon size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
      <h2>Seleziona un negozio</h2>
      <p>Devi selezionare un punto vendita dalla barra in alto per gestire i turni.</p>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarIcon size={24} color="var(--color-accent)" /> Pianificazione Turni
          </h1>
          <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Clicca sull'avatar di un dipendente per impostare ferie/malattia. Clicca su una cella giorno per assegnare il turno.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowTemplatesModal(true)} style={{ display:'flex', alignItems:'center', gap:8, background:'var(--color-surface)', color:'var(--color-text)', border:'1px solid var(--color-border)', padding:'10px 16px', borderRadius:12, fontWeight:600, cursor:'pointer' }}>
            <Clock size={16} /> Modelli Orari (Template)
          </button>
          <button onClick={() => setShowExport(true)} style={{ display:'flex', alignItems:'center', gap:8, background:'#6366F1', color:'#fff', border:'none', padding:'10px 16px', borderRadius:12, fontWeight:700, cursor:'pointer' }}>
            <Download size={16} /> Esporta Excel
          </button>
          <button onClick={saveChanges} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-accent)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.8 : 1 }}>
            {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} Salva Configurazioni
          </button>
        </div>
      </div>

      {/* Analisi copertura turni — sempre visibile */}
      {(() => {
        const analyzedCount = Object.values(shifts).filter(s => s.start_time && s.end_time).length;
        if (gapAlerts.length > 0) return (
          <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:14, padding:'14px 20px', marginBottom:20, display:'flex', gap:12, alignItems:'flex-start' }}>
            <AlertTriangle size={20} color="#B45309" style={{ flexShrink:0, marginTop:1 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#92400E', marginBottom:4 }}>⚠️ Ore buche rilevate ({analyzedCount} turni analizzati)</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {gapAlerts.map((a, i) => (
                  <span key={i} style={{ background:'rgba(180,83,9,0.12)', color:'#B45309', borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:700 }}>
                    {a.day}: nessuna copertura {a.from}–{a.to}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
        if (analyzedCount > 0) return (
          <div style={{ background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:14, padding:'12px 20px', marginBottom:20, display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:16 }}>✅</span>
            <span style={{ fontWeight:700, fontSize:13, color:'#15803D' }}>Nessun buco di copertura questa settimana</span>
            <span style={{ fontSize:11, color:'#6b7280', marginLeft:4 }}>({analyzedCount} turni analizzati)</span>
          </div>
        );
        return null;
      })()}

      {/* Navigazione settimana */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', padding: '16px 24px', borderRadius: '16px 16px 0 0', border: '1px solid var(--color-border)', borderBottom: 'none' }}>
        <button onClick={handlePrevWeek} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>
          Settimana dal {weekDays[0].dateStr.split('-').reverse().join('/')} al {weekDays[6].dateStr.split('-').reverse().join('/')}
        </div>
        <button onClick={handleNextWeek} style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text)' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Grid Calendario */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0 0 16px 16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '16px 20px', borderBottom: '2px solid var(--color-border)', borderRight: '1px solid var(--color-border)', width: 220, background: 'var(--color-bg)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dipendente</div>
              </th>
              {weekDays.map(day => (
                <th key={day.dateStr} style={{ padding: '12px 8px', borderBottom: '2px solid var(--color-border)', borderRight: '1px solid var(--color-border)', textAlign: 'center', width: `${100/7}%`, background: day.isToday ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: day.isToday ? 'var(--color-accent)' : 'var(--color-text)', textTransform: 'uppercase' }}>{day.label.split(' ')[0]}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: day.isToday ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>{day.label.split(' ')[1]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 60, textAlign: 'center' }}><Loader size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} /></td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Nessun dipendente trovato in questo negozio.</td></tr>
            ) : employees.map(emp => {
              const empAbsence = absences[emp.id];
              return (
                <tr key={emp.id}>
                  {/* Cella dipendente — avatar cliccabile per ferie/malattia */}
                  <td style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Avatar cliccabile */}
                      <button
                        onClick={e => openAbsenceModal(emp, e)}
                        title="Imposta ferie / malattia"
                        style={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          background: empAbsence
                            ? `${absenceColor(empAbsence.type)}20`
                            : 'var(--color-surface)',
                          border: empAbsence
                            ? `2px solid ${absenceColor(empAbsence.type)}60`
                            : '2px solid var(--color-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 800,
                          color: empAbsence ? absenceColor(empAbsence.type) : 'var(--color-text)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        {empAbsence
                          ? (empAbsence.type === 'ferie' ? '🌴' : empAbsence.type === 'malattia' ? '🤒' : empAbsence.type === 'permesso' ? '📋' : '⛔')
                          : emp.name.charAt(0)}
                      </button>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>{emp.name}</div>
                        {empAbsence ? (
                          <div style={{ fontSize: 11, color: absenceColor(empAbsence.type), fontWeight: 700 }}>
                            {absenceLabel(empAbsence.type)}
                            {' · '}{empAbsence.from?.slice(5).split('-').join('/')}→{empAbsence.to?.slice(5).split('-').join('/')}
                            {empAbsence.type === 'permesso' && empAbsence.time_from && (
                              <span> · ⏰ {empAbsence.time_from}–{empAbsence.time_to}</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'capitalize' }}>{emp.role || 'Operatore'}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Celle giorni */}
                  {weekDays.map(day => {
                    const key = `${emp.id}_${day.dateStr}`;
                    const shift = shifts[key];
                    const hasShift = shift && shift.start_time;
                    const absence = isAbsent(emp.id, day.dateStr);

                    // ── Cella ASSENZA ───────────────────────────────────────
                    if (absence) {
                      const c = absenceColor(absence.type);
                      return (
                        <td
                          key={day.dateStr}
                          style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', background: day.isToday ? 'rgba(16,185,129,0.02)' : 'transparent', verticalAlign: 'top' }}
                        >
                          <div style={{
                            height: 60, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                            background: `${c}10`, border: `1px solid ${c}40`,
                          }}>
                            <div style={{ fontSize: 18, lineHeight: 1 }}>
                              {absence.type === 'ferie' ? '🌴' : absence.type === 'malattia' ? '🤒' : absence.type === 'permesso' ? '📋' : '⛔'}
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: c, textAlign: 'center', lineHeight: 1.3 }}>
                              Indisponibile<br />{absence.type}
                              {absence.type === 'permesso' && absence.time_from && (
                                <><br />⏰ {absence.time_from}–{absence.time_to}</>)}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // ── Cella NORMALE ───────────────────────────────────────
                    return (
                      <td
                        key={day.dateStr}
                        style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', position: 'relative', background: day.isToday ? 'rgba(16,185,129,0.02)' : 'transparent', verticalAlign: 'top' }}
                        onClick={() => setActiveCell({ empId: emp.id, dateStr: day.dateStr })}
                      >
                        {hasShift ? (
                          <div style={{ background: `${shift.color}15`, border: `1px solid ${shift.color}40`, borderLeft: `4px solid ${shift.color}`, borderRadius: 8, padding: '8px', cursor: 'pointer', transition: 'all 0.1s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <input type="time" value={shift.start_time || ''} onChange={e => { e.stopPropagation(); onCellChange(emp.id, day.dateStr, { start_time: e.target.value }); }} style={{ flex: 1, width: 0, padding: '4px', fontSize: 12, fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text)' }} />
                              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>-</span>
                              <input type="time" value={shift.end_time || ''} onChange={e => { e.stopPropagation(); onCellChange(emp.id, day.dateStr, { end_time: e.target.value }); }} style={{ flex: 1, width: 0, padding: '4px', fontSize: 12, fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text)' }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', textAlign: 'center', fontWeight: 600 }}>CARTA TURNO (click p. opzioni)</div>
                          </div>
                        ) : (
                          <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--color-border)', borderRadius: 8, color: 'var(--color-text-tertiary)', fontSize: 12, cursor: 'pointer', transition: 'all 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg)'; e.currentTarget.style.color = 'var(--color-text)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}>
                            + Assegna (Riposo)
                          </div>
                        )}

                        {renderCellMenu(emp.id, day.dateStr)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal template */}
      {showTemplatesModal && (
        <ShiftTemplateModal onClose={() => { setShowTemplatesModal(false); loadData(); }} />
      )}

      {/* Modal assenza */}
      {absenceModal && (
        <AbsenceModal
          emp={absenceModal.emp}
          existing={absences[absenceModal.emp.id]}
          onSave={data => handleSaveAbsence(absenceModal.emp.id, data)}
          onRemove={() => handleRemoveAbsence(absenceModal.emp.id)}
          onClose={() => setAbsenceModal(null)}
        />
      )}

      {/* Modal export */}
      {showExport && (
        <ExportModal employees={employees} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
