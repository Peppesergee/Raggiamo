'use strict';
const $ = s => document.querySelector(s);
const MODEL = 'claude-haiku-5-5';
const UNITS = ['pz', 'kg', 'g', 'l', 'ml'];

// ---------- Archivio (localStorage) ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let pantry = load('pantry', []);   // [{id, name, qty, unit}]
const persist = () => save('pantry', pantry);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => t.hidden = true, 3000);
}

// ---------- Dispensa ----------
function addToPantry(name, qty, unit) {
  const existing = pantry.find(p => norm(p.name) === norm(name) && p.unit === unit);
  if (existing) existing.qty += qty;
  else pantry.push({ id: uid(), name: name.trim(), qty, unit });
}

function renderPantry() {
  const q = norm($('#search').value);
  const items = pantry.filter(p => norm(p.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  $('#pantry-empty').hidden = pantry.length > 0;
  $('#pantry-list').innerHTML = items.map(p => `
    <li data-id="${p.id}">
      <span class="name">${esc(p.name)}</span>
      <span class="qty">${fmt(p.qty)} ${p.unit}</span>
      <button class="secondary" data-act="consume">Consuma</button>
    </li>`).join('');
}

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
function reviewRow(it = { name: '', qty: 1, unit: 'pz', checked: true }) {
  const li = document.createElement('li');
  li.innerHTML = `
    <input type="checkbox" ${it.checked !== false ? 'checked' : ''}>
    <input class="n" value="${esc(it.name)}" placeholder="Prodotto">
    <input class="q" type="number" min="0" step="any" inputmode="decimal" value="${it.qty}">
    <select class="u">${UNITS.map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>`;
  $('#review-list').append(li);
}
function showReview(items) {
  $('#review-list').innerHTML = '';
  items.forEach(reviewRow);
  $('#view-pantry').hidden = true; $('#fab').hidden = true; $('#view-review').hidden = false;
}
function hideReview() { $('#view-review').hidden = true; $('#view-pantry').hidden = false; $('#fab').hidden = false; }
$('#review-add-row').onclick = () => reviewRow();
$('#review-cancel').onclick = hideReview;
$('#review-confirm').onclick = () => {
  let n = 0;
  for (const li of $('#review-list').children) {
    const [chk, name, qty, unit] = li.querySelectorAll('input,select');
    const q = parseFloat(qty.value.replace(',', '.'));
    if (chk.checked && name.value.trim() && q > 0) { addToPantry(name.value, q, unit.value); n++; }
  }
  persist(); renderPantry(); hideReview(); toast(`${n} prodotti aggiunti`);
};
$('#btn-manual').onclick = () => showReview([{ name: '', qty: 1, unit: 'pz' }]);

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
  catch (err) { toast('Errore: ' + err.message); }
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
Rispondi SOLO con un array JSON, senza testo aggiuntivo: [{"name": string, "qty": number, "unit": "pz"|"kg"|"g"|"l"|"ml"}]`;

async function readReceipt(b64) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': load('apiKey', ''),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 4000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
        { type: 'text', text: PROMPT },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'chiave API non valida' : `servizio non disponibile (${res.status})`);
  const text = (await res.json()).content.map(b => b.text || '').join('');
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('risposta non comprensibile');
  const items = JSON.parse(m[0])
    .filter(i => i && i.name)
    .map(i => ({ name: String(i.name), qty: Number(i.qty) > 0 ? Number(i.qty) : 1, unit: UNITS.includes(i.unit) ? i.unit : 'pz', checked: true }));
  if (!items.length) throw new Error('nessun prodotto trovato');
  return items;
}

// ---------- Impostazioni ----------
$('#btn-settings').onclick = () => { $('#api-key').value = load('apiKey', ''); $('#dlg-settings').showModal(); };
$('#save-settings').onclick = () => save('apiKey', $('#api-key').value.trim());
$('#btn-clear').onclick = () => {
  if (confirm('Svuotare tutta la dispensa?')) { pantry = []; persist(); renderPantry(); $('#dlg-settings').close(); }
};
$('#btn-export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(pantry, null, 2)], { type: 'application/json' }));
  a.download = 'dispensa.json'; a.click();
};

// ---------- Avvio ----------
renderPantry();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
