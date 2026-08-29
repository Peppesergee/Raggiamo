"""Fase 4: costruisce l'indice RAG.

Legge target/manifest.json (che dbt genera con `dbt docs generate` o anche
solo `dbt build`/`dbt parse`), trasforma ogni modello in un documento
testuale (rag/manifest_docs.py), lo trasforma in un embedding con Ollama e
lo salva in una collezione Chroma persistita su disco.

Richiede Ollama in esecuzione in locale con il modello di embedding già
scaricato:

    ollama pull nomic-embed-text
    python -m rag.build_index

Rilanciarlo aggiorna l'indice (upsert): comodo dopo aver modificato uno
schema.yml e rilanciato `dbt docs generate`.
"""

import argparse
from pathlib import Path

import chromadb
import ollama

from rag.manifest_docs import load_model_docs

DEFAULT_MANIFEST_PATH = Path("raggiamo/target/manifest.json")
DEFAULT_CHROMA_PATH = Path("chroma_db")
DEFAULT_COLLECTION = "dbt_models"
DEFAULT_EMBED_MODEL = "nomic-embed-text"
DEFAULT_PROJECT_NAME = "raggiamo"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest-path", type=Path, default=DEFAULT_MANIFEST_PATH)
    parser.add_argument("--chroma-path", type=Path, default=DEFAULT_CHROMA_PATH)
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    parser.add_argument("--project-name", default=DEFAULT_PROJECT_NAME)
    args = parser.parse_args()

    if not args.manifest_path.exists():
        raise SystemExit(
            f"Non trovo {args.manifest_path}. Esegui prima 'dbt docs generate' "
            "(o 'dbt build') dentro raggiamo/."
        )

    docs = load_model_docs(args.manifest_path, args.project_name)
    if not docs:
        raise SystemExit("Nessun modello trovato nel manifest: controlla --project-name.")
    print(f"Trovati {len(docs)} modelli da indicizzare.")

    print(f"Genero gli embedding con Ollama (modello '{args.embed_model}')...")
    try:
        response = ollama.embed(
            model=args.embed_model,
            input=[doc.text for doc in docs],
        )
    except Exception as exc:  # connessione rifiutata, modello non scaricato, ecc.
        raise SystemExit(
            f"Chiamata a Ollama fallita ({exc}).\n"
            "Controlla che 'ollama serve' sia attivo e che il modello sia "
            f"scaricato: ollama pull {args.embed_model}"
        ) from exc

    client = chromadb.PersistentClient(path=str(args.chroma_path))
    collection = client.get_or_create_collection(
        name=args.collection,
        metadata={"embedding_model": args.embed_model},
    )
    collection.upsert(
        ids=[doc.id for doc in docs],
        documents=[doc.text for doc in docs],
        embeddings=response.embeddings,
        metadatas=[doc.metadata for doc in docs],
    )

    print(
        f"Indice aggiornato: {collection.count()} documenti nella collezione "
        f"'{args.collection}' ({args.chroma_path}/)."
    )


if __name__ == "__main__":
    main()
