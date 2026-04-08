/**
 * Algoritmo completo di calcolo del Codice Fiscale italiano
 * Implementazione pura JS, nessuna dipendenza esterna
 */

const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';
const VOWELS = 'AEIOU';

const MONTH_CODES = 'ABCDEHLMPRST';

const ODD_TABLE = {
  '0':1,'1':0,'2':5,'3':7,'4':9,'5':13,'6':15,'7':17,'8':19,'9':21,
  'A':1,'B':0,'C':5,'D':7,'E':9,'F':13,'G':15,'H':17,'I':19,'J':21,
  'K':2,'L':4,'M':18,'N':20,'O':11,'P':3,'Q':6,'R':8,'S':12,'T':14,
  'U':16,'V':10,'W':22,'X':25,'Y':24,'Z':23
};

const EVEN_TABLE = {
  '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
  'A':0,'B':1,'C':2,'D':3,'E':4,'F':5,'G':6,'H':7,'I':8,'J':9,
  'K':10,'L':11,'M':12,'N':13,'O':14,'P':15,'Q':16,'R':17,'S':18,'T':19,
  'U':20,'V':21,'W':22,'X':23,'Y':24,'Z':25
};

function extractChars(str, type) {
  const normalized = str.toUpperCase().replace(/[^A-Z]/g, '');
  const result = [];
  if (type === 'consonants') {
    for (const c of normalized) if (CONSONANTS.includes(c)) result.push(c);
    for (const c of normalized) if (VOWELS.includes(c)) result.push(c);
  } else {
    for (const c of normalized) if (VOWELS.includes(c)) result.push(c);
    for (const c of normalized) if (CONSONANTS.includes(c)) result.push(c);
  }
  while (result.length < 3) result.push('X');
  return result.slice(0, 3).join('');
}

function cognomeCode(cognome) {
  return extractChars(cognome, 'consonants');
}

function nomeCode(nome) {
  const normalized = nome.toUpperCase().replace(/[^A-Z]/g, '');
  const consonants = [];
  for (const c of normalized) if (CONSONANTS.includes(c)) consonants.push(c);
  
  if (consonants.length >= 4) {
    // Prende 1a, 3a, 4a consonante
    return [consonants[0], consonants[2], consonants[3]].join('');
  }
  return extractChars(nome, 'consonants');
}

function dataCode(dataNascita, sesso) {
  // dataNascita: "YYYY-MM-DD"
  const [year, month, day] = dataNascita.split('-').map(Number);
  const yy = String(year).slice(-2);
  const mm = MONTH_CODES[month - 1];
  const dd = sesso === 'F' ? String(day + 40).padStart(2, '0') : String(day).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function checkChar(code15) {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = code15[i].toUpperCase();
    sum += i % 2 === 0 ? ODD_TABLE[ch] : EVEN_TABLE[ch];
  }
  return String.fromCharCode(65 + (sum % 26)); // A=0, B=1, ...
}

/**
 * Calcola il codice fiscale
 * @param {string} cognome
 * @param {string} nome
 * @param {string} dataNascita - "YYYY-MM-DD"
 * @param {string} sesso - "M" o "F"
 * @param {string} codiceBelfiore - codice catastale del comune (es. "H501" per Roma)
 * @returns {string} codice fiscale di 16 caratteri
 */
export function calcolaCodiceFiscale(cognome, nome, dataNascita, sesso, codiceBelfiore) {
  if (!cognome || !nome || !dataNascita || !sesso || !codiceBelfiore) return '';
  
  try {
    const c = cognomeCode(cognome);
    const n = nomeCode(nome);
    const d = dataCode(dataNascita, sesso.toUpperCase());
    const b = codiceBelfiore.toUpperCase();
    const code15 = `${c}${n}${d}${b}`;
    const ctrl = checkChar(code15);
    return `${code15}${ctrl}`;
  } catch {
    return '';
  }
}

/**
 * Cerca comuni italiani per nome
 * Usa l'API open di comuni.json (offline-first con lista locale semplificata)
 */
export async function cercaComune(query) {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://comuni-dati.vercel.app/api?nome=${encodeURIComponent(query)}&limit=8`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(c => ({
      label: `${c.nome} (${c.provincia?.sigla || c.sigla_provincia || ''})`,
      value: c.codice_belfiore || c.codiceCatastale,
      nome: c.nome,
    }));
  } catch {
    // Fallback: lista comuni principali
    const comuni = [
      { label: 'Roma (RM)', value: 'H501', nome: 'Roma' },
      { label: 'Milano (MI)', value: 'F205', nome: 'Milano' },
      { label: 'Napoli (NA)', value: 'F839', nome: 'Napoli' },
      { label: 'Torino (TO)', value: 'L219', nome: 'Torino' },
      { label: 'Palermo (PA)', value: 'G273', nome: 'Palermo' },
      { label: 'Genova (GE)', value: 'D969', nome: 'Genova' },
      { label: 'Bologna (BO)', value: 'A944', nome: 'Bologna' },
      { label: 'Firenze (FI)', value: 'D612', nome: 'Firenze' },
      { label: 'Bari (BA)', value: 'A662', nome: 'Bari' },
      { label: 'Catania (CT)', value: 'C351', nome: 'Catania' },
      { label: 'Venezia (VE)', value: 'L736', nome: 'Venezia' },
      { label: 'Verona (VR)', value: 'L781', nome: 'Verona' },
    ];
    const q = query.toLowerCase();
    return comuni.filter(c => c.nome.toLowerCase().startsWith(q));
  }
}
