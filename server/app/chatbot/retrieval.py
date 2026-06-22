from __future__ import annotations

from typing import Any

import numpy as np
import psycopg
import requests

from langchain_core.vectorstores.utils import (
    maximal_marginal_relevance
)

from app.chatbot.config import Settings


class OllamaEmbedder:

    def __init__(
        self,
        settings: Settings
    ) -> None:

        self.settings = settings

    def embed_query(
        self,
        text: str
    ) -> list[float]:

        response = requests.post(
            f"{self.settings.ollama_base_url}/api/embed",
            json={
                "model": self.settings.ollama_embedding_model,
                "input": text
            },
            timeout=60,
        )

        if response.status_code == 404:

            response = requests.post(
                f"{self.settings.ollama_base_url}/api/embeddings",
                json={
                    "model": self.settings.ollama_embedding_model,
                    "prompt": text
                },
                timeout=60,
            )

        response.raise_for_status()

        data = response.json()

        return (
            data.get("embedding")
            or data["embeddings"][0]
        )


class DocumentRetriever:

    def __init__(
        self,
        settings: Settings,
        embedder: OllamaEmbedder
    ) -> None:

        self.settings = settings
        self.embedder = embedder

    def search(
        self,
        query: str,
        sources: list[str],
        top_k: int = 30,
        similarity_threshold: float = 0.4,
        mmr_k: int = 10,
        lambda_mult: float = 0.7,
        period_days: int | None = None,
    ) -> list[dict[str, Any]]:

        if not sources:
            return []

        if period_days is None:
            period_days = 7

        query_embedding = self.embedder.embed_query(
            query
        )

        sql = """
            SELECT
                source,
                source_id,
                chunk_index,
                document_text,
                embedding,
                embedding <=> %s::vector AS distance,
                1 - (embedding <=> %s::vector) AS similarity
            FROM documents_chunking
            WHERE source = ANY(%s)
              AND document_date >= NOW() - (%s * INTERVAL '1 day')
            ORDER BY distance
            LIMIT %s
        """

        params = (
            str(query_embedding),
            str(query_embedding),
            sources,
            period_days,
            top_k
        )

        with psycopg.connect(
            self.settings.database_url
        ) as conn:

            with conn.cursor() as cur:

                cur.execute(
                    sql,
                    params
                )

                results = cur.fetchall()

        # Similarity Threshold
        results = [
            row
            for row in results
            if row[6] >= similarity_threshold
        ]

        if not results:
            return []

        candidate_embeddings = []

        for row in results:

            embedding = row[4]

            if isinstance(
                embedding,
                str
            ):

                embedding = np.array(
                    [
                        float(x)
                        for x in embedding
                        .strip("[]")
                        .split(",")
                    ],
                    dtype=np.float32
                )

            else:

                embedding = np.array(
                    embedding,
                    dtype=np.float32
                )

            candidate_embeddings.append(
                embedding
            )

        candidate_embeddings = np.array(
            candidate_embeddings
        )

        selected_indices = (
            maximal_marginal_relevance(
                np.array(
                    query_embedding
                ).reshape(
                    1,
                    -1
                ),
                candidate_embeddings,
                k=min(
                    mmr_k,
                    len(candidate_embeddings)
                ),
                lambda_mult=lambda_mult
            )
        )

        results = [
            results[i]
            for i in selected_indices
        ]

        return [
            {
                "source": row[0],
                "source_id": row[1],
                "chunk_index": row[2],
                "document_text": row[3],
                "distance": float(row[5]),
                "similarity": float(row[6]),
            }
            for row in results
        ]
