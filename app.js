'use strict';
const VERSION = '0.0.1';
const $ = s => document.querySelector(s);
const MODEL = 'gemini-flash-latest';
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
$('#btn-scan').onclick = () => {
  if (!load('apiKey', '')) { toast('Inserisci prima la chiave API nelle impostazioni'); $('#dlg-settings').showModal(); return; }
  $('#file').click();
};
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  $('#loading').hidden = false;
  try { showReview(await readReceipt(await shrink(f))); }
  catch (err) { showError(err.message); }
  finally { $('#loading').hidden = true; }
});

async function shrink(file, max = 1800) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

const PROMPT = `Questa è la foto di uno scontrino della spesa italiano. Estrai SOLO i prodotti alimentari e le bevande (ignora detersivi, igiene, sacchetti, sconti, totali).
Per ogni voce espandi le abbreviazioni in un nome chiaro in italiano (es. "LATTE PS UHT 1L" -> "Latte UHT parzialmente scremato").
Quantità: usa il numero di confezioni (unit "pz"), oppure il peso/volume se venduto a peso (unit "kg", "g", "l", "ml").
Se una riga ha moltiplicatore (es. "3 x") usa quel numero di pezzi.
Assegna a ogni prodotto una categoria "cat" tra: pasta (pasta, riso, farine, pane), carne (carne, pesce, salumi), latt (latticini, formaggi, uova), colaz (biscotti da colazione, cereali, caffè, marmellate), ortof (frutta e verdura), cons (conserve, legumi, scatolame), cond (olio, aceto, spezie, salse), bev (acqua, succhi, bibite, vino), dolci (cioccolato, snack, dolci), altro.\nRispondi SOLO con un array JSON, senza testo aggiuntivo: [{"name": string, "qty": number, "unit": "pz"|"kg"|"g"|"l"|"ml", "cat": string}]`;

async function readReceipt(b64) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90000);
  let res;
  try {
    const key = load('apiKey', '').replace(/[^\x21-\x7e]/g, '');
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: b64 } },
          { text: PROMPT },
        ] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 8192 },
      }),
    });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'tempo scaduto (90 s), riprova con una foto più nitida' : `richiesta non riuscita (${err.message})`);
  } finally { clearTimeout(timer); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || '';
    throw new Error(res.status === 429 ? 'limite gratuito raggiunto, riprova più tardi'
      : `Gemini ha risposto ${res.status}${msg ? ': ' + msg.slice(0, 200) : ''}`);
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
  if (!text) throw new Error(`nessuna risposta (${data.promptFeedback?.blockReason || cand?.finishReason || 'vuota'})`);
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { const m = text.match(/\[[\s\S]*\]/); try { parsed = m && JSON.parse(m[0]); } catch {} }
  if (parsed && !Array.isArray(parsed)) parsed = Object.values(parsed).find(Array.isArray);
  if (!Array.isArray(parsed)) throw new Error('risposta non comprensibile: ' + text.slice(0, 120));
  const items = parsed
    .filter(i => i && i.name)
    .map(i => ({ name: String(i.name), qty: Number(i.qty) > 0 ? Number(i.qty) : 1, unit: UNITS.includes(i.unit) ? i.unit : 'pz', cat: catOf(i.cat), checked: true }));
  if (!items.length) throw new Error('nessun prodotto alimentare trovato nella foto');
  return items;
}

// ---------- Impostazioni ----------
$('#btn-settings').onclick = () => { $('#api-key').value = load('apiKey', ''); $('#dlg-settings').showModal(); };
$('#save-settings').onclick = () => save('apiKey', $('#api-key').value.replace(/[^\x21-\x7e]/g, ''));
$('#btn-clear').onclick = () => {
  if (confirm('Svuotare tutta la dispensa?')) { pantry = []; persist(); renderPantry(); $('#dlg-settings').close(); }
};
$('#btn-export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(pantry, null, 2)], { type: 'application/json' }));
  a.download = 'dispensa.json'; a.click();
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
