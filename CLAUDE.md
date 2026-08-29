# Progetto: Data Engineering Agent (learning project)

## Chi sono
Data Engineer (Giuseppe) con background in dbt, PySpark, Databricks, Delta Lake,
Airflow, AWS, SQL. Obiettivo: diventare competente in AI/agenti (RAG, LLM API,
prompt engineering, tool-calling) per orientare la carriera verso ruoli AI,
partendo da esperienza reale invece che da esempi giocattolo.

**Importante**: voglio capire ogni scelta tecnica, non solo vedere il codice
funzionare. Spiega il *perché* prima del *come*, un pezzo alla volta. Non
saltare avanti finché non ho confermato di aver capito il pezzo precedente.

## Obiettivo del progetto
Un agente AI che risponde in linguaggio naturale su una pipeline dati (dbt):
cerca nella documentazione dei modelli (RAG) e/o esegue query SQL vere sul
database (tool-calling), spiegando dipendenze, lineage, problemi nei dati.

## Vincoli
- **Niente Databricks o infrastruttura del cliente** — tutto il progetto è
  personale, from scratch, open source, eseguibile in locale.
- **Adattabile a qualsiasi database**, non solo quello di sviluppo.
- Codice pubblico su GitHub, pensato perché altri possano clonarlo e farlo
  girare con il proprio database in pochi minuti.
- Hardware disponibile: PC locale con GPU NVIDIA RTX 4060 (per LLM locali via
  Ollama).

## Stack scelto (e perché)
- **dbt-core** (non Databricks): stesso linguaggio di trasformazione già
  padroneggiato, ma gira ovunque tramite adapter separati per ogni database
  (`dbt-duckdb`, `dbt-postgres`, `dbt-snowflake`, ...). Il codice SQL dei
  modelli non cambia mai — cambia solo l'adapter e `profiles.yml`.
- **DuckDB** come database di default: zero setup, gira su file locali, ideale
  per chi clona il repo e vuole provarlo subito.
- **Config esterna**: connessione al DB sempre in `profiles.yml` / `.env`, mai
  hardcoded nel codice.
- **Chroma**: vector DB locale per indicizzare schema/documentazione dei
  modelli dbt (RAG).
- **LangGraph**: orchestrazione dell'agente con tool-calling (un tool cerca
  nel RAG, un tool esegue SQL reale via SQLAlchemy — agnostico rispetto al
  database).
- **Ollama**: LLM locale sulla RTX 4060, con possibilità di switch a un'API
  cloud per confronto qualità/costi.
- **Docker Compose**: profilo di default con DuckDB pronto all'uso.

## Roadmap (5 fasi)
1. **Setup ambiente** — venv Python, Ollama, repo git
2. **dbt-core + DuckDB** — primo modello, `profiles.yml`, capire l'astrazione
   tramite adapter (è il cuore della portabilità multi-DB)
3. **Ingestion dati** — script Python che scarica un dataset pubblico
4. **RAG** — indicizzazione schema/doc in Chroma, embeddings, ricerca semantica
5. **Agente** — LangGraph con due tool (RAG + query SQL), tool-calling

## Stato attuale
**Fase 1 completata** (tranne Ollama, rimandato a quando si lavora in
locale con GPU): venv con `dbt-core` 1.12.3 + `dbt-duckdb` 1.11.0.

**Fase 2 completata**: progetto dbt generato in `raggiamo/` (`dbt init`).
`raggiamo/profiles.yml` committato (nessuna credenziale, solo path DuckDB
via `env_var()`), verificato con `dbt debug`. Modelli di esempio rimossi.

**Fase 3 completata**: dataset scelto **Chinook** (negozio musicale:
artisti, album, tracce, clienti, fatture — relazionale, buono per lineage
multi-tabella). `scripts/ingest_chinook.py` scarica il file SQLite
ufficiale e carica ogni tabella in DuckDB nello schema `raw` (via
SQLAlchemy + `duckdb-engine`), idempotente (`if_exists="replace"`).

**Fase 2/4 (staging)**: `raggiamo/models/staging/chinook/` — un modello
1:1 per ciascuna delle 11 tabelle `raw.*` (rinomina snake_case + cast,
niente logica di business), con `source.yml` e test (`unique`, `not_null`,
`relationships` sulle FK). `dbt build`: 11 view + 30 test, tutti verdi
(dataset pulito, nessuna anomalia nelle FK).
Prossimo passo: modelli intermedi/marts (es. fatturato per cliente/artista,
o una tabella "denormalizzata" comoda da far interrogare all'agente) —
Fase 4 vera e propria inizia dopo, con RAG sulla documentazione di questi
modelli.

## Stile di lavoro richiesto
- Risposte sintetiche e precise, linguaggio comprensibile anche a chi non è
  esperto del singolo argomento.
- Ancorare le spiegazioni a esperienza/codice reale, non esempi ipotetici.
- Confermare la comprensione di un concetto prima di passare al successivo.
