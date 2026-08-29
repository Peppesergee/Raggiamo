# Raggiamo

Data Engineering Agent — progetto didattico per imparare RAG, tool-calling e
LLM API partendo da uno stack dati reale (dbt-core, DuckDB, e in seguito
LangGraph + Chroma + Ollama).

Il contesto completo del progetto (obiettivi, stack, roadmap, stato attuale)
è in [`CLAUDE.md`](./CLAUDE.md).

## Setup ambiente (Fase 1)

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
dbt --version
```

Verifica che l'output mostri sia `Core` che il plugin `duckdb` installati.

## Progetto dbt (Fase 2)

Il progetto dbt vive in [`raggiamo/`](./raggiamo). `profiles.yml` è committato
nel repo (caso particolare: con DuckDB non ci sono credenziali, solo un path
di file locale) e usa `env_var()` per restare configurabile dall'esterno.

```bash
cd raggiamo
export DBT_PROFILES_DIR=.        # dice a dbt dove cercare profiles.yml
dbt debug                        # verifica la connessione al database
```

Per usare un file DuckDB diverso da quello di default (`dev.duckdb`):
```bash
export DBT_DATABASE_PATH=/percorso/tuo.duckdb
```

## Ingestion dati (Fase 3)

Dataset: [Chinook](https://github.com/lerocha/chinook-database) (negozio
musicale — artisti, album, tracce, clienti, fatture), distribuito come file
SQLite. Lo script lo scarica e carica ogni tabella "così com'è" nello schema
`raw` del database target (nessuna trasformazione: quella è compito di dbt).

```bash
python scripts/ingest_chinook.py
```

Usa lo stesso `DBT_DATABASE_PATH` di `profiles.yml`, quindi dbt e ingestion
scrivono/leggono sempre lo stesso file DuckDB.

## Modelli di staging (Fase 2/4)

`raggiamo/models/staging/chinook/` contiene un modello di staging per
ciascuna delle 11 tabelle `raw.*` (rinomina in snake_case + cast dei tipi,
nessun'altra trasformazione), con `source.yml`/`schema.yml` che documentano
sorgenti, colonne e i test (`unique`, `not_null`, `relationships` sulle
foreign key).

```bash
cd raggiamo
DBT_PROFILES_DIR=. dbt build   # materializza i modelli + esegue i test
```

## Modelli intermedi e marts

- `models/intermediate/int_tracks_enriched.sql`: traccia con album/artista/
  genere/media type già joinati — riusato da più marts (view, non serve
  materializzarlo fisicamente).
- `models/marts/`: livello che l'agente interrogherà.
  - `dim_customers`, `dim_tracks`: dimensioni denormalizzate.
  - `fct_invoice_lines`: fatti a grana riga di fattura, con `line_amount`
    (`unit_price * quantity`) e le dimensioni già joinate per query dirette
    (es. fatturato per artista/genere/paese senza altri join).

Materializzati come `table` (a differenza di staging/intermediate, che sono
`view`): sono il livello finale, non ha senso ricalcolare i join a ogni query.

## RAG sulla documentazione dbt (Fase 4)

Richiede [Ollama](https://ollama.com) installato e in esecuzione in locale
(non incluso in questo repo — serve una macchina vera, tipicamente con GPU).

```bash
ollama pull nomic-embed-text     # modello di embedding (~270MB)

cd raggiamo
DBT_PROFILES_DIR=. dbt docs generate   # produce target/manifest.json
cd ..

pip install -r requirements.txt        # se non già fatto
python -m rag.build_index              # indicizza i modelli in Chroma
python -m rag.query "come si calcola il fatturato di una riga di fattura?"
```

`rag/build_index.py` legge `target/manifest.json` (descrizioni, colonne,
lineage — già calcolati da dbt, non li riparsiamo dagli YAML), genera un
embedding per modello con Ollama e li salva in `chroma_db/` (locale,
gitignored, rigenerabile in qualunque momento rilanciando lo script).
