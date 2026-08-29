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
