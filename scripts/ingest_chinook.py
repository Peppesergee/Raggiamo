"""Ingestion: scarica il dataset pubblico Chinook e lo carica come tabelle
"raw" nel database di destinazione.

Perche' questo script e' separato da dbt:
- dbt (Fase 2) trasforma dati che sono GIA' nel database (source -> modelli).
  Non scarica nulla da internet e non parla con sistemi esterni: e' lo
  strumento sbagliato per "prendere un file da qualche parte e caricarlo".
- Un ingestion script si occupa di Extract (scarica/legge dalla sorgente,
  qui un file SQLite) e Load (scrive le tabelle "cosi' come sono" nel
  database target, senza pulirle o modellarle: quello lo fara' dbt dopo,
  leggendo queste tabelle tramite source()).
- La sorgente (sqlite3, libreria standard di Python) e il target
  (SQLAlchemy) sono scelti apposta per essere agnostici rispetto al
  database di destinazione: per puntare a Postgres invece che DuckDB basta
  cambiare la connection string passata a create_engine(), il resto dello
  script non cambia.

Uso:
    python scripts/ingest_chinook.py
    DBT_DATABASE_PATH=raggiamo/altro.duckdb python scripts/ingest_chinook.py
"""

import argparse
import os
import sqlite3
import urllib.request
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

CHINOOK_SOURCE_URL = (
    "https://raw.githubusercontent.com/lerocha/chinook-database/master/"
    "ChinookDatabase/DataSources/Chinook_Sqlite.sqlite"
)
DEFAULT_CACHE_PATH = Path(".cache/chinook/Chinook_Sqlite.sqlite")
DEFAULT_SCHEMA = "raw"


def download_source(url: str, cache_path: Path, force: bool = False) -> Path:
    """Scarica il file SQLite sorgente una volta sola e lo tiene in cache
    locale (fuori da git): rilanciare lo script non deve richiedere ogni
    volta una chiamata di rete.
    """
    if cache_path.exists() and not force:
        print(f"Sorgente gia' in cache: {cache_path}")
        return cache_path

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Scarico {url} -> {cache_path}")
    urllib.request.urlretrieve(url, cache_path)
    return cache_path


def list_tables(sqlite_path: Path) -> list[str]:
    with sqlite3.connect(sqlite_path) as con:
        rows = con.execute(
            "select name from sqlite_master where type='table' order by name"
        ).fetchall()
    return [name for (name,) in rows]


def load_into_target(sqlite_path: Path, database_path: Path, schema: str) -> None:
    """Copia ogni tabella della sorgente SQLite nel database target, in uno
    schema dedicato (`raw`) che segnala chiaramente: "dati cosi' come sono
    arrivati dalla fonte, non ancora trasformati".
    """
    engine = create_engine(f"duckdb:///{database_path}")
    tables = list_tables(sqlite_path)

    with sqlite3.connect(sqlite_path) as source_con, engine.begin() as target_con:
        target_con.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
        for table in tables:
            df = pd.read_sql_query(f'SELECT * FROM "{table}"', source_con)
            df.to_sql(
                table.lower(),
                target_con,
                schema=schema,
                if_exists="replace",
                index=False,
            )
            print(f"  {schema}.{table.lower():<15} {len(df):>6} righe")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-url", default=CHINOOK_SOURCE_URL)
    parser.add_argument("--cache-path", type=Path, default=DEFAULT_CACHE_PATH)
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument(
        "--database-path",
        type=Path,
        default=Path(os.environ.get("DBT_DATABASE_PATH", "raggiamo/dev.duckdb")),
        help="Path del database DuckDB target (default: stessa var d'ambiente "
        "usata da raggiamo/profiles.yml, cosi' dbt e ingestion puntano sempre "
        "allo stesso file).",
    )
    parser.add_argument("--schema", default=DEFAULT_SCHEMA)
    args = parser.parse_args()

    sqlite_path = download_source(args.source_url, args.cache_path, args.force_download)
    print(f"Carico le tabelle in {args.database_path} (schema '{args.schema}')")
    load_into_target(sqlite_path, args.database_path, args.schema)
    print("Fatto.")


if __name__ == "__main__":
    main()
