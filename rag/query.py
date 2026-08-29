"""Interroga l'indice RAG con una domanda in linguaggio naturale.

    python -m rag.query "come si calcola il fatturato di una riga di fattura?"

Serve per verificare manualmente la Fase 4 (la ricerca semantica trova i
modelli giusti?) prima di collegarla come tool all'agente in Fase 5.
"""

import argparse
from pathlib import Path

import chromadb
import ollama

from rag.build_index import (
    DEFAULT_CHROMA_PATH,
    DEFAULT_COLLECTION,
    DEFAULT_EMBED_MODEL,
)


def search(question: str, chroma_path: Path, collection: str, embed_model: str, n_results: int):
    response = ollama.embed(model=embed_model, input=[question])

    client = chromadb.PersistentClient(path=str(chroma_path))
    coll = client.get_collection(collection)
    return coll.query(
        query_embeddings=response.embeddings,
        n_results=n_results,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("question")
    parser.add_argument("--chroma-path", type=Path, default=DEFAULT_CHROMA_PATH)
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL)
    parser.add_argument("-n", "--n-results", type=int, default=3)
    args = parser.parse_args()

    results = search(
        args.question, args.chroma_path, args.collection, args.embed_model, args.n_results
    )

    ids = results["ids"][0]
    distances = results["distances"][0]
    documents = results["documents"][0]

    for rank, (doc_id, distance, document) in enumerate(zip(ids, distances, documents), start=1):
        print(f"\n#{rank}  {doc_id}  (distanza={distance:.4f})")
        print(document)


if __name__ == "__main__":
    main()
