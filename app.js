'use strict';
const VERSION = '0.0.5';
const $ = s => document.querySelector(s);
const MODELS = { veloce: 'gemini-flash-lite-latest', preciso: 'gemini-flash-latest' };
const model = () => MODELS[load('model', 'veloce')] || MODELS.veloce;
const UNITS = ['pz', 'kg', 'g', 'l', 'ml'];
const CATS = {
  pasta: ['🍝', 'Pasta e riso'], carne: ['🥩', 'Carne e pesce'], latt: ['🥛', 'Latticini e uova'],
  colaz: ['🥣', 'Colazione'], ortof: ['🥬', 'Frutta e verdura'], cons: ['🥫', 'Conserve e legumi'],
  cond: ['🫒', 'Condimenti'], bev: ['🧃', 'Bevande'], dolci: ['🍪', 'Dolci e snack'], altro: ['🛒', 'Altro'],
};
const catOf = c => (c in CATS ? c : 'altro');

// ---------- Archivio (localStorage) ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let pantry = load('pantry', []).map(p => ({ ...p, cat: catOf(p.cat) }));   // [{id, name, qty, unit, cat}]
let filter = 'all';
const persist = () => save('pantry', pantry);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showError(msg) {
  $('#error-text').textContent = msg; $('#dlg-error').showModal();
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => t.hidden = true, 3000);
}

// ---------- Dispensa ----------
function addToPantry(name, qty, unit, cat) {
  const existing = pantry.find(p => norm(p.name) === norm(name) && p.unit === unit);
  if (existing) existing.qty += qty;
  else pantry.push({ id: uid(), name: name.trim(), qty, unit, cat: catOf(cat) });
}

function renderPantry() {
  const q = norm($('#search').value);
  const present = Object.keys(CATS).filter(k => pantry.some(p => p.cat === k));
  if (filter !== 'all' && !present.includes(filter)) filter = 'all';
  $('#chips').hidden = pantry.length === 0;
  $('#chips').innerHTML = ['all', ...present].map(k =>
    `<button class="chip" aria-pressed="${filter === k}" data-f="${k}">${k === 'all' ? 'Tutte' : CATS[k][0] + ' ' + CATS[k][1]}</button>`).join('');
  $('#pantry-empty').hidden = pantry.length > 0;
  let html = '';
  for (const k of present) {
    if (filter !== 'all' && filter !== k) continue;
    const list = pantry.filter(p => p.cat === k && norm(p.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'it'));
    if (!list.length) continue;
    html += `<li class="gh">${CATS[k][1]}</li>` + list.map(p => `
      <li data-id="${p.id}">
        <span class="name">${esc(p.name)}</span>
        <span class="qty">${fmt(p.qty)} ${p.unit}</span>
        <button class="secondary" data-act="consume">Consuma</button>
      </li>`).join('');
  }
  if (!html && pantry.length) html = '<li class="empty">Nessun prodotto trovato</li>';
  $('#pantry-list').innerHTML = html;
}
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  filter = b.dataset.f; renderPantry();
});

let consumeId = null;
$('#pantry-list').addEventListener('click', e => {
  if (e.target.dataset.act !== 'consume') return;
  const p = pantry.find(x => x.id === e.target.closest('li').dataset.id);
  consumeId = p.id;
  $('#consume-title').textContent = p.name;
  $('#consume-qty').value = p.unit === 'pz' ? 1 : '';
  $('#consume-qty').placeholder = p.unit;
  $('#dlg-consume').showModal();
});
function consume(amount) {
  const p = pantry.find(x => x.id === consumeId);
  if (!p) return;
  p.qty = Math.round((p.qty - amount) * 1000) / 1000;
  if (p.qty <= 0) pantry = pantry.filter(x => x !== p);
  persist(); renderPantry();
}
$('#dlg-consume').addEventListener('close', e => {
  const v = parseFloat($('#consume-qty').value.replace(',', '.'));
  if (e.target.returnValue === 'ok' && v > 0) consume(v);
  e.target.returnValue = '';
});
$('#consume-all').onclick = () => { const p = pantry.find(x => x.id === consumeId); $('#dlg-consume').close(); if (p) consume(p.qty); };
$('#search').addEventListener('input', renderPantry);

// ---------- Revisione ----------
function reviewRow(it = { name: '', qty: 1, unit: 'pz', cat: 'altro', checked: true }) {
  const li = document.createElement('li');
  li.innerHTML = `
    <input type="checkbox" ${it.checked !== false ? 'checked' : ''}>
    <input class="n" value="${esc(it.name)}" placeholder="Prodotto">
    <input class="q" type="number" min="0" step="any" inputmode="decimal" value="${it.qty}">
    <select class="u">${UNITS.map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
    <select class="c">${Object.entries(CATS).map(([k, [e, n]]) => `<option value="${k}" ${k === catOf(it.cat) ? 'selected' : ''}>${e} ${n}</option>`).join('')}</select>`;
  $('#review-list').append(li);
}
function showReview(items) {
  $('#review-list').innerHTML = '';
  items.forEach(reviewRow);
  $('#view-pantry').hidden = true; $('#fab').style.display = 'none'; $('#view-review').hidden = false;
}
function hideReview() { $('#view-review').hidden = true; $('#view-pantry').hidden = false; $('#fab').style.display = ''; }
$('#review-add-row').onclick = () => reviewRow();
$('#review-cancel').onclick = hideReview;
$('#review-confirm').onclick = () => {
  let n = 0;
  for (const li of $('#review-list').children) {
    const [chk, name, qty, unit, cat] = li.querySelectorAll('input,select');
    const q = parseFloat(qty.value.replace(',', '.'));
    if (chk.checked && name.value.trim() && q > 0) { addToPantry(name.value, q, unit.value, cat.value); n++; }
  }
  persist(); renderPantry(); hideReview(); toast(`${n} prodotti aggiunti`);
};
$('#btn-manual').onclick = () => showReview([{ name: '', qty: 1, unit: 'pz', cat: 'altro' }]);

// ---------- Scansione scontrino ----------
const needKey = () => {
  if (load('apiKey', '')) return false;
  toast('Inserisci prima la chiave API nelle impostazioni'); $('#dlg-settings').showModal(); return true;
};
$('#btn-scan').onclick = () => { if (!needKey()) $('#file').click(); };
$('#btn-gallery').onclick = () => { if (!needKey()) $('#file-gallery').click(); };
const onPhoto = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  $('#loading').hidden = false;
  try { showReview(await readReceipt(await shrink(f), s => $('#loading p').textContent = s)); }
  catch (err) { showError(err.message); }
  finally { $('#loading').hidden = true; $('#loading p').textContent = 'Leggo lo scontrino…'; }
};
$('#file').addEventListener('change', onPhoto);
$('#file-gallery').addEventListener('change', onPhoto);

async function shrink(file, max = 1400) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch {
    // Alcuni formati (es. HEIC) si leggono solo tramite <img>.
    bmp = await new Promise((ok, ko) => {
      const img = new Image(); img.onload = () => ok(img);
      img.onerror = () => ko(new Error('formato immagine non supportato'));
      img.src = URL.createObjectURL(file);
    });
  }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75).split(',')[1];
}

const PROMPT = `Questa è la foto di uno scontrino della spesa italiano. Estrai SOLO i prodotti alimentari e le bevande (ignora detersivi, igiene, sacchetti, sconti, totali).
Per ogni voce espandi le abbreviazioni in un nome chiaro in italiano (es. "LATTE PS UHT 1L" -> "Latte UHT parzialmente scremato").
Quantità:
- Prodotti confezionati: usa il NUMERO DI CONFEZIONI con unit "pz". Il formato della confezione (es. 500G, 700G, 1L, 250G) NON è la quantità: mettilo nel nome (es. "Passata di pomodoro 700 g", qty 1, unit "pz").
- Solo i prodotti venduti a peso variabile (frutta, verdura, carne, formaggi al banco, con il peso indicato in KG sulla riga) usano il peso: unit "kg".
- Se una riga ha un moltiplicatore (es. "3 x 1,29") usa quel numero di confezioni. Se lo stesso prodotto compare su più righe, uniscile sommando le confezioni.
Assegna a ogni prodotto una categoria "cat" tra: pasta (pasta, riso, farine, pane), carne (carne, pesce, salumi), latt (latticini, formaggi, uova), colaz (biscotti da colazione, cereali, caffè, marmellate), ortof (frutta e verdura), cons (conserve, legumi, scatolame), cond (olio, aceto, spezie, salse), bev (acqua, succhi, bibite, vino), dolci (cioccolato, snack, dolci), altro.\nRispondi SOLO con un array JSON, senza testo aggiuntivo: [{"name": string, "qty": number, "unit": "pz"|"kg"|"g"|"l"|"ml", "cat": string}]`;

// Chiamata a Gemini in streaming: il testo arriva a pezzi, così la connessione non resta muta.
async function gemini(parts, onProgress = () => {}, idleMs = 60000) {
  const key = load('apiKey', '').replace(/[^\x21-\x7e]/g, '');
  const ctl = new AbortController();
  let timer; const arm = () => { clearTimeout(timer); timer = setTimeout(() => ctl.abort(), idleMs); };
  const t0 = Date.now();
  const tick = setInterval(() => onProgress(`Leggo lo scontrino… ${Math.round((Date.now() - t0) / 1000)} s`), 1000);
  arm();
  try {
    let res;
    // Se il modello scelto è sovraccarico (503/500) si prova l'altro.
    for (const m of [model(), ...Object.values(MODELS).filter(x => x !== model())]) {
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
          method: 'POST', signal: ctl.signal, headers: { 'content-type': 'text/plain' },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, maxOutputTokens: 8192 } }),
        });
      } catch (err) {
        throw new Error(err.name === 'AbortError' ? `nessuna risposta da Gemini in ${idleMs / 1000} s` : `richiesta bloccata (${err.message})`);
      }
      if (res.status !== 503 && res.status !== 500) break;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data.error?.message || (Array.isArray(data) && data[0]?.error?.message) || '';
      throw new Error(res.status === 429 ? 'limite gratuito raggiunto, riprova più tardi'
        : `Gemini ha risposto ${res.status}${msg ? ': ' + msg.slice(0, 200) : ''}`);
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', finish = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        arm();
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          try {
            const d = JSON.parse(line.slice(5));
            const c = d.candidates?.[0];
            text += (c?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
            finish = c?.finishReason || d.promptFeedback?.blockReason || finish;
          } catch {}
        }
      }
    } catch (err) {
      throw new Error(err.name === 'AbortError' ? `Gemini si è fermato per ${idleMs / 1000} s` : `connessione interrotta (${err.message})`);
    }
    if (!text) throw new Error(`nessuna risposta (${finish || 'vuota'})`);
    return text;
  } finally { clearTimeout(timer); clearInterval(tick); }
}

async function readReceipt(b64, onProgress) {
  const text = await gemini([
    { inline_data: { mime_type: 'image/jpeg', data: b64 } },
    { text: PROMPT },
  ], onProgress);
  let parsed;
  const m = text.match(/\[[\s\S]*\]/);
  try { parsed = JSON.parse(m ? m[0] : text); } catch {}
  if (parsed && !Array.isArray(parsed)) parsed = Object.values(parsed).find(Array.isArray);
  if (!Array.isArray(parsed)) throw new Error('risposta non comprensibile: ' + text.slice(0, 120));
  const items = parsed
    .filter(i => i && i.name)
    .map(i => ({ name: String(i.name), qty: Number(i.qty) > 0 ? Number(i.qty) : 1, unit: UNITS.includes(i.unit) ? i.unit : 'pz', cat: catOf(i.cat), checked: true }));
  if (!items.length) throw new Error('nessun prodotto alimentare trovato nella foto');
  return items;
}

// ---------- Impostazioni ----------
$('#btn-settings').onclick = () => { $('#api-key').value = load('apiKey', ''); $('#model').value = load('model', 'veloce'); $('#dlg-settings').showModal(); };
$('#save-settings').onclick = () => { save('apiKey', $('#api-key').value.replace(/[^\x21-\x7e]/g, '')); save('model', $('#model').value); };
$('#btn-clear').onclick = () => {
  if (confirm('Svuotare tutta la dispensa?')) { pantry = []; persist(); renderPantry(); $('#dlg-settings').close(); }
};
$('#btn-export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(pantry, null, 2)], { type: 'application/json' }));
  a.download = 'dispensa.json'; a.click();
};

// ---------- Test connessione ----------
function sampleImage() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 120;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 320, 120);
  g.fillStyle = '#000'; g.font = '20px monospace';
  g.fillText('LATTE PS UHT 1L   1,29', 10, 40); g.fillText('PENNE RIGATE 500G 0,89', 10, 80);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}
$('#btn-test').onclick = async () => {
  const out = $('#test-out'); out.hidden = false;
  const typed = $('#api-key').value.replace(/[^\x21-\x7e]/g, '');
  if (typed) save('apiKey', typed);
  const key = load('apiKey', '');
  const steps = [
    ['1. Raggiungo Google', async () => {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
      if (!r.ok) throw new Error(r.status + ' ' + ((await r.json().catch(() => ({}))).error?.message || ''));
    }],
    ['2. Risposta di testo', () => gemini([{ text: 'Rispondi solo: ok' }])],
    ['3. Lettura di un\'immagine', () => gemini([{ inline_data: { mime_type: 'image/jpeg', data: sampleImage() } }, { text: 'Trascrivi il testo.' }])],
  ];
  const lines = [];
  for (const [label, run] of steps) {
    const t0 = Date.now();
    lines.push(label + ': …'); out.textContent = lines.join('\n');
    try { await run(); lines[lines.length - 1] = `${label}: ✅ ${((Date.now() - t0) / 1000).toFixed(1)} s`; }
    catch (err) { lines[lines.length - 1] = `${label}: ❌ ${err.message}`; out.textContent = lines.join('\n'); break; }
    out.textContent = lines.join('\n');
  }
};

// ---------- Avvio ----------
$('#version').textContent = 'v' + VERSION;
$('#btn-update').onclick = async () => {
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  } catch {}
  location.reload();
};
renderPantry();
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); });
}
