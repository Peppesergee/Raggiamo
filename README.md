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
