# Raggiamo 🧺

App web installabile (PWA) per tenere aggiornata la dispensa: scansioni lo scontrino della spesa e i prodotti vengono aggiunti da soli. Ciò che consumi lo scarichi a mano.

## Come funziona
1. **Scansiona** lo scontrino (fotocamera del telefono).
2. Un modello di IA (Claude) legge le righe e le trasforma in prodotti (scarta detersivi, sacchetti, ecc.).
3. **Controlli e correggi** l'elenco, poi lo aggiungi alla dispensa.
4. Quando consumi qualcosa premi **Consuma** e indichi la quantità.

I dati restano sul tuo dispositivo (nessun server). Nessuna data di scadenza.

## Avvio
Nessuna installazione: sono file statici.

```bash
python3 -m http.server 8000   # poi apri http://localhost:8000
```

Per usarla dal telefono serve HTTPS (es. GitHub Pages: Settings → Pages → branch `main`, cartella root), poi "Aggiungi a schermata Home".

Alla prima scansione inserisci la tua **chiave API Anthropic** in ⚙️ Impostazioni (salvata solo nel browser).

## File
- `index.html`, `style.css`, `app.js`: l'app
- `sw.js`, `manifest.webmanifest`: funzionamento offline e installazione
