# Worlds API: Many Worlds at the Edge for Neuro-Symbolic Agents

**Author**: Ethan Davidson (https://github.com/EthanThatOneKid)\
**Date**: December 2025\
**Institution**: FartLabs Research

---

## Abstract

Large Language Models (LLMs) have demonstrated remarkable capabilities in
natural language understanding and generation, yet they suffer from a
fundamental limitation: capability is not equivalent to knowledge. While
Retrieval-Augmented Generation (RAG) using vector databases attempts to bridge
this gap, it often fails to capture the intricate structural relationships
required for complex reasoning. This paper introduces **Worlds API™**, a novel
infrastructure layer that acts as a "detachable hippocampus" for AI agents. By
combining an in-memory SPARQL 1.1 store (Oxigraph) with edge-distributed SQLite,
Worlds API enables agents to maintain mutable, structured knowledge graphs. This
system implements a hybrid search architecture—fusing vector similarity,
full-text search, and graph querying via Reciprocal Rank Fusion (RRF)—to support
low-latency, neuro-symbolic reasoning at the edge.

---

## 1. Introduction

### 1.1 The Context: The Ephemeral Nature of LLMs

The rise of Transformer-based models has revolutionized artificial intelligence,
providing agents with fluent communication skills and broad "world knowledge"
frozen in their weights. However, these models are fundamentally stateless. Once
a context window closes, the "thought" is lost. For an AI agent to operate
autonomously over long periods, it requires persistent memory that is both
accessible and mutable.

### 1.2 The Problem: The Reasoning Gap

Current industry standards rely heavily on Vector Databases to provide long-term
memory. This approach, known as Retrieval-Augmented Generation (RAG), converts
text into high-dimensional embedding vectors. While effective for semantic
similarity (e.g., finding documents _about_ "cats"), vector search struggles
with precise logical queries (e.g., "Who is the owner of the cat that chased the
mouse?"). Vectors compress meaning into continuous space, losing the discrete
edges and nodes that define relationships. This creates a "Reasoning Gap," where
agents can retrieve related information but cannot reason over it fundamentally.

### 1.3 The Solution: Worlds API

We propose **Worlds API**, a system designed to provide malleable knowledge
within arm's reach of the AI agent. Unlike static knowledge bases, "Worlds" are
dynamic, graph-based environments that agents can query, update, and reason over
in real-time.

### 1.4 Thesis

By integrating a standards-compliant RDF store with an edge-first architecture,
Worlds API successfully bridges the gap between neural processing and symbolic
reasoning, enabling the development of Neuro-Symbolic agents capable of
maintaining complex, evolving world models.

---

## 2. Methodology

### 2.1 System Architecture

The Worlds API architecture follows a segregated **Client-Server** model
designed specifically for edge deployment (e.g., Deno Deploy, Cloudflare
Workers). This ensures that knowledge is "always hot," retrievable in
milliseconds to minimize agent latency.

- **The Agent (Client)**: Acts as the "Cortex." It uses the `@fartlabs/worlds`
  SDK to interact with the world via standard HTTP/Fetch protocols. This
  decouples the agent's logic from its memory, allowing for a "Detachable
  Hippocampus" pattern where contexts can be swapped seamlessly.
- **The Interface (Control Plane)**: A Next.js 14 application managed by Vercel.
  It handles authentication (via WorkOS), rate limiting, and administrative
  dashboards, ensuring secure access to the underlying data.
- **The World (Data Plane)**: A self-contained, portable unit of knowledge. Each
  "World" operates as an isolated service, ensuring data sovereignty and
  preventing context pollution between different agent tasks.

### 2.2 Storage Engine: The Universal Container

To achieve both semantic flexibility and structural precision while maintaining
**portability**, we employ a "Matryoshka" storage strategy where a single SQLite
file (`world.db`) acts as the physical container.

**The Physical Layer (Persistence)** The database schema is normalized to ensure
referential integrity, efficient storage, and atomic consistency:

1. **`kb_terms`**: The central dictionary table acting as the bridge. It stores
   unique RDF Terms (URIs, Literals, Blank Nodes) with full type fidelity
   (language tags, datatypes), assigning each a stable integer ID.
2. **`kb_statements`**: The Graph Source of Truth. It stores RDF quads as
   foreign keys (`subject_id`, `predicate_id`, `object_id`, `graph_id`) pointing
   to `kb_terms`. This normalization reduces reliable storage size and ensures
   graph consistency.
3. **`kb_chunks`**: Stores unstructured text fragments and their metadata.
   Crucially, each chunk is linked via `term_id` to a specific entity in
   `kb_terms`, physically grounding the unstructured data in the structured
   graph.
4. **`kb_chunks_vec` & `kb_chunks_fts`**: Virtual tables powered by `sqlite-vec`
   (vector search) and `FTS5` (full-text search). These are kept in sync with
   `kb_chunks` via automatic SQL triggers, ensuring the search index never
   drifts from the data.

```sql
-- "Matryoshka" Schema: Linking Unstructured Data to the Graph
CREATE TABLE kb_chunks (
    id INTEGER PRIMARY KEY,
    term_id INTEGER, -- Foreign Key to Knowledge Graph Entity
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(term_id) REFERENCES kb_terms(id)
);

-- Triggers ensure zero-drift between Data and Index
CREATE TRIGGER kb_chunks_ai AFTER INSERT ON kb_chunks BEGIN
  INSERT INTO kb_chunks_fts(rowid, text) VALUES (new.id, new.text);
END;
```

**The Logical Layer (Performance)** On top of this physical storage, we layer
specialized engines for real-time access:

1. **Oxigraph (In-Memory)**: Upon "waking" a world, the `kb_statements` are
   hydrated into Oxigraph, a high-performance SPARQL engine (~345k quads/sec
   read). This allows for complex, recursive graph queries (e.g., transitive
   closure, property paths) impossible with SQL or vectors alone.
2. **Hybrid Search (Neuro-Symbolic)**: We implement **Reciprocal Rank Fusion
   (RRF)** directly in SQL to combine the strengths of dense retrieval (vectors)
   and sparse retrieval (keywords).
   $$ \text{score} = \sum \frac{1}{k + \text{rank}(\text{vector})} + \frac{1}{k + \text{rank}(\text{fts})} $$
   This fusion allows the system to understand both "concept" (vectors) and
   "keywords" (FTS), returning a `RankedResult` that links back to the Graph via
   `term_id`.

```sql
-- Hybrid Search (RRF) Logic linked to Graph Entities
SELECT 
    c.id,
    c.term_id, -- The critical link to the Knowledge Graph
    c.text,
    SUM(s.score) as rrf_score
FROM combined_scores s
JOIN kb_chunks c ON s.rowid = c.id
GROUP BY c.id
ORDER BY rrf_score DESC;
```

**Transaction Safety**: To guarantee data integrity in this multi-modal system,
all write operations are wrapped in **Interactive Transactions**
(`BEGIN IMMEDIATE`). This ensures that a "fact" is only committed if its Terms,
Statements, Chunks, and Embeddings are all successfully written, preventing
improper states (e.g., "dangling vectors" or "orphan terms").

```typescript
// Atomic Ingestion Pattern
const txn = await this.client.transaction("write");
try {
  // 1. Insert/Get Term IDs (Graph Nodes)
  const oId = await this._insertTerm(object, graphId, txn);

  // 2. Insert Statement (Graph Edge)
  await txn.execute({
    sql: insertStatementSql,
    args: [sId, pId, oId, graphId],
  });

  // 3. Insert Vector Chunk (Neuro-Symbolic Link)
  await txn.execute({ sql: insertChunkVecSql, args: [chunkId, vector] });

  await txn.commit();
} catch (e) {
  txn.rollback(); // Rollback ALL data if vector insertion fails
  throw e;
}
```

### 2.3 Data Model: Malleable Knowledge

Unlike rigid SQL or LPG schemas, RDF allows for schema-less data evolution. The
fundamental unit of data is the **RDF Statement** (Subject, Predicate, Object).

**Standards Compliance**: We strictly adhere to **RDF 1.1** standards ensuring
interoperability with the global Semantic Web.

- **Entities (Named Nodes)**: All entities are identified by stable, globally
  unique URIs (e.g., `https://id.example.com/alice`).
- **Reasoning Gap Solution**: By linking vector chunks to these stable URIs, we
  solve the "Reasoning Gap". A search for "spicy food" returns a chunk described
  as "spicy", which is linked to the Entity `<#Kimchi>`. The agent can then
  traverse the Graph from `<#Kimchi>` to find it `isType` `FermentedFood`,
  essentially "reasoning" from a fuzzy query to a structured fact.
- **Ontologies**: We leverage standard vocabularies (Schema.org, SKOS) to
  maximize compatibility.

**Why not Labeled Property Graphs (LPG)?**: While LPGs (e.g., Neo4j, SurrealDB)
offer similar advantages, they often result in isolated silos. By choosing RDF,
we ensure that a "World" is not just a database, but a participant in the
"Internet of Value".

---

## 3. Results

### 3.1 Preliminary Benchmarks

Early testing of the `Oxigraph` integration on Deno 2.x shows promising
throughput for serialization and store operations:

| Benchmark                | Time/Iter (Avg) | Iter/s      |
| :----------------------- | :-------------- | :---------- |
| **encodeStore (nq)**     | **2.9 µs**      | **345,100** |
| **encodeStore (trig)**   | **3.1 µs**      | **318,700** |
| **encodeStore (jsonld)** | **4.6 µs**      | **219,400** |

_(Benchmarks run on Deno 2.5.6, Intel i7-1280P)_

### 3.2 Functional Capabilities

The primary result of this architecture is the unified access to structured and
unstructured data. Where a traditional vector store might return a document
chunk based on keyword overlap, Worlds API can answer composite queries such as:

> Find all entities that are _located in_ 'New York' AND are _types of_ 'Italian
> Restaurant' AND have a description semantically similar to 'cozy romantic
> dinner'.

This query leverages the Graph (location, type) and the Vector Store (semantic
description) simultaneously, a capability absent in purely vector-based systems.

### 3.2 Developer Experience & Tooling

To facilitate adoption, we developed the `@fartlabs/worlds` SDK, which abstracts
the complexity of SPARQL. The system exposes standard "AI SDK" tools, allowing
models (like GPT or Gemini) to interact with the graph using natural language
function calls. This verified the "Detachable Hippocampus" design pattern:
agents could successfully store facts, recall them in later sessions, and
navigate relationships without explicit training on graph query languages.

---

## 4. Discussion

### 4.1 Neuro-Symbolic AI Implications

Worlds API represents a practical implementation of Neuro-Symbolic AI. It
acknowledges that Neural Networks (System 1 thinking - fast, intuitive,
approximate) benefit significantly from access to Symbolic Systems (System 2
thinking - slow, logical, precise). By offloading the memory and reasoning
burden to the World, the Agent is free to focus on synthesis and communication.

### 4.2 Calm Technology

A key design philosophy was "Calm Technology." Managing a knowledge graph is
traditionally complex. By automating the "RDF Statement Store management" and
providing a zero-config Deno task (`deno task start`), we reduce the cognitive
load on developers, allowing them to focus on agent behavior rather than
database administration.

### 4.3 Limitations and Future Work

While the in-memory model (Oxigraph) provides exceptional speed, it introduces
RAM constraints. As "Worlds" grow into the millions of statements, memory usage
becomes a limiting factor. **Future Work** includes:

- **Separated Vector Store**: Offloading the bulk of vector data from the
  primary SQLite/Memory store to a specialized index while maintaining valid
  ties to the statement materialization.
- **Sandboxed Code Execution**: Investigating the integration of Deno Sandboxes
  to allow agents to write and execute code against their own data for complex
  calculations.
- **Granular Version Control (CRDTs)**: While the current implementation implies
  naive file-based versioning, future enhancements will integrate **Automerge**
  or similar CRDTs. This would enable true "Git-for-Knowledge" capabilities:
  forking worlds, merging independent agent timelines, and conflict-free
  resolution of distributed edits.
- **Distributed Synchronization**: Using **Automerge's** sync protocol to
  efficiently synchronize graph state across distributed edge nodes, treating
  the local SQLite database as a reactive cache.
- **File-System Projection**: Developing a Virtual File System (VFS) layer to
  project the Graph as a directory structure (e.g., one file per Entity). **YAML
  files** are preferred over Markdown to prevent ambiguity while maintaining
  human readability, enabling "Git-Native" workflows for inspection, diffing,
  and version control. This enables "Git-Native" workflows, allowing developers
  to use standard CLI tools to inspect, diff, and version-control the World
  state.
  [Guide on using Markdown as a programming language](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-using-markdown-as-a-programming-language-when-building-with-ai/).

---

## 5. Conclusion

Worlds API demonstrates that it is possible to bring malleable, structured
knowledge to the edge. By rejecting the dichotomy between Vector Search and
Knowledge Graphs, and instead fusing them through RRF and a hybrid storage
engine, we provide AI agents with the context and reasoning capabilities
necessary for true autonomy. By adopting **Web 3.0** standards, we ensure this
knowledge layer is not just a proprietary silo, but a participant in a global,
interoperable semantic web. As we move towards AGI, the ability for an agent to
not just "retrieve" but to "know" and "reason" will be the defining
characteristic of the next generation of intelligent systems.

---

## 6. References

1. **Oxigraph**. (n.d.). _Oxigraph: SPARQL graph database_. GitHub.
   https://github.com/oxigraph/oxigraph
2. **Willison, S.** (2024, October 4). _Hybrid full-text search and vector
   search with SQLite_. Simon Willison’s Weblog.
   https://simonwillison.net/2024/Oct/4/hybrid-full-text-search-and-vector-search-with-sqlite/
3. **W3C.** (2013). _SPARQL 1.1 Query Language_. W3C Recommendation.
   https://www.w3.org/TR/sparql11-query/
4. **Ha, D., & Schmidhuber, J.** (2018). _World Models_. arXiv preprint
   arXiv:1803.10122. https://worldmodels.github.io/
5. **Repo Author.** (2024). _Worlds API™ Design Document_. GitHub.
   https://github.com/EthanThatOneKid/worlds-design
6. **Arxiv.** (2024). _Thinking with Knowledge Graphs_.
   https://arxiv.org/abs/2412.10654
7. **Arxiv.** (2025). _Jelly: RDF Serialization Format_.
   https://arxiv.org/abs/2506.11298
