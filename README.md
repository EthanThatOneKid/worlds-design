# Worlds API™ Design Document

| **Project Name** | Worlds API™ (Neuro-symbolic Knowledge Platform) |
| ---------------- | ----------------------------------------------- |
| **Author**       | Ethan (Founder, FartLabs/Wazoo)                 |
| **Repository**   | <https://github.com/EthanThatOneKid/worlds-api> |

> The Semantic Web is not a separate Web but an extension of the current one, in
> which information is given well-defined meaning, better enabling computers and
> people to work in cooperation.
>
> – Sir Tim Berners-Lee

## Executive Summary

**Worlds API™** is an edge-compatible infrastructure layer designed to provide
AI agents with "long-term memory" and reasoning capabilities. Unlike vector-only
RAG systems, Worlds API utilizes **RDF (Resource Description Framework)** and
**SPARQL 1.1** to enable structured, symbolic reasoning alongside neural
processing.

This platform allows developers to "Bring Your Own Brain" (BYOB), offering a
high-performance HTTP API to manage malleable knowledge graphs ("Worlds") to
solve hallucination and limited context windows. While Vector Databases provide
semantic retrieval, they lack **structured reasoning** (e.g., "Who is the
brother of the person who invented X?").

- **Current Solution:** `worlds-api` uses **Oxigraph** for high-performance,
  standards-compliant SPARQL operations.
- **Unified Architecture:** We integrate a **Hybrid Statements Store** directly
  alongside the graph, capable of fusing SPARQL precision with Vector and
  Full-Text Search (FTS) with Reciprocal Rank Fusion (RRF) for comprehensive
  [world models](https://www.nvidia.com/en-us/glossary/world-models/).

### Scope

- **In Scope:**
  - **Control Plane (Frontend):** Next.js dashboard for humans to manage Worlds,
    billing, and API keys.
  - **Data Plane (API):** Deno-based REST API handling SPARQL query execution,
    triple storage, and chunk storage.
  - **SDK:** TypeScript client for agent integration. (`@fartlabs/worlds`).
  - **Tools:** A collection of drop-in AISDK tools for managing Worlds.
  - **Authentication:** Dual-strategy service accounts (WorkOS for humans, API
    Keys for automations/agents).
  - **Semantic Web:** RDF and SPARQL compatibility for Semantic Web
    applications.

- **Out of Scope:**
  - The implementation of the AI Agents themselves. To be used in future
    FartLabs/Wazoo projects such as Computer, Holosuite, and more.
  - Visual Graph Editors (v1 is code-first).

## Project Philosophy

We adhere to core philosophical pillars to guide every technical decision:

- **Bring Your Own Brain (BYOB):** The API is agnostic to the intelligence
  layer. Whether using Open AI, Google, Anthropic, or a local open source model,
  the "World" acts as a detachable hippocampus.
- **Calm Technology:** Developer tooling should be invisible. We target
  **Zero-Config** experiences (e.g., `deno task start`).
- **Edge-First:** Knowledge must be retrieved in milliseconds (always hot). The
  architecture is designed for distributed runtimes (Deno Deploy, Cloudflare
  Workers).
- **Malleable Knowledge:** Data is not static. "Worlds" are designed to be
  forked, merged, and mutated by agents in real-time.
- **Agent Autonomy:** True agency requires more than tooling—it requires
  onboarding agents as teammates. Our human-centric framework equips agents with
  "senses" to perceive their world and the judgment to know when to escalate
  ambiguity to human operators.
- **Web Standards:** A space where users maintain their autonomy, control their
  data and privacy, and choose applications and services to fulfil their needs.

## Glossary

| Term                  | Definition                                                                                                   |
| :-------------------- | :----------------------------------------------------------------------------------------------------------- |
| **World**             | An isolated Knowledge Graph instance (RDF Dataset), acting as a memory store for an agent.                   |
| **Statement**         | An atomic unit of fact (Quad: Subject, Predicate, Object, Graph).                                            |
| **Chunk**             | A text segment derived from a Statement's Object (string literal), treating the Statement as a RAG document. |
| **RRF**               | **Reciprocal Rank Fusion**. An algorithm fusing Keyword (FTS) and Vector search rankings.                    |
| **RDF**               | **Resource Description Framework**. The W3C standard for graph data interchange.                             |
| **SPARQL**            | The W3C standard query language for RDF graphs.                                                              |
| **NamedNode**         | A node in an RDF graph that has a URI.                                                                       |
| **BlankNode**         | A node in an RDF graph that does not have a URI.                                                             |
| **Neuro-symbolic AI** | An AI system that combines the strengths of neural networks and structured data.                             |
| **Ontology**          | A formal description of a domain of knowledge.                                                               |

## System Architecture

### High-Level Diagram

The system follows a segregated Client-Server architecture designed for edge
deployment.

```mermaid
graph TD
    subgraph "Clients"
        Dev[Developer/Human]
        Agent[AI Agent / Bot]
    end

    subgraph "Frontend Layer (Vercel)"
        Next[Next.js Dashboard]
        WorkOS[WorkOS Auth]
    end

    subgraph "Backend Layer (Deno Deploy / Edge)"
        API[Worlds API Server]
        Guard[Auth Middleware]
        Router[Rt Router]
    end

    subgraph "Storage Layer"
        Oxi[Oxigraph Store (In-Memory/File)]
        SQLite[Per-World SQLite DBs]
    end

    Dev -->|HTTPS / UI| Next
    Next -->|OIDC| WorkOS
    Next -->|Mgmt API| API
    
    Agent -->|HTTPS / SDK| API
    API -->|Validate Key| Guard
    API -->|SPARQL Query| Oxi
    API -->|Hybrid Query| SQLite
```

### Component Breakdown

The project works as a **Deno Monorepo**, treating the SDK, Server, and Shared
Libraries as co-located packages.

#### **A. The SDK (`/src/sdk`)**

[![JSR](https://jsr.io/badges/@fartlabs/worlds)](https://jsr.io/@fartlabs/worlds)
[![JSR score](https://jsr.io/badges/@fartlabs/worlds/score)](https://jsr.io/@fartlabs/worlds/score)

- **Package:** [`@fartlabs/worlds`](https://jsr.io/@fartlabs/worlds) (name TBD,
  might claim a new org on JSR if needed e.g., `@wazoo/worlds`, `@worlds/sdk`)
- **Role:** The canonical TypeScript `fetch` client. It handles authentication,
  type-safe API requests, and response parsing. It also provides drop-in AISDK
  memory tools for managing Worlds.
- **Distribution:** Published to JSR. Use with Node.js:
  `npx jsr add @fartlabs/worlds`.
- **Reference Design:** See [`sdk`](./sdk) for the proposed SDK implementation.

#### **B. The Server (`/src/server`)**

- **Role:** The minimal Deno-based HTTP server.
- **Core Library:** `oxigraph` (Wasm) and `libsql` for Hybrid Storage.
- **Deployment:** Deno Deploy (Edge).

#### **C. Shared Core (`/src/core`)**

- **Role:** Common logic shared between the Server and SDK (e.g., Validation
  logic, Type definitions, Encoding helpers).

### Repository Structure

We enforce a strict separation of concerns within the monorepo to allow the SDK
and Server to evolve together while sharing Types.

```text
/
├── deno.json             # Workspace configuration
├── src/
│   ├── sdk/              # Public client library (@fartlabs/worlds)
│   │   ├── mod.ts        # Entry point
│   │   ├── client.ts     # HTTP methods
│   │   └── tools/        # Drop-in AISDK Tools
│   ├── server/           # API Implementation
│   │   ├── main.ts       # Entry point
│   │   └── routes/       # Route handlers (v1/)
│   ├── core/             # Shared logic (Validation, Types)
│   └── store/            # Storage Engines
│       ├── oxigraph/     # Wasm Triplestore implementation
│       └── sqlite/       # SQLite Statements & Chunks implementation
└── tests/                # Integration tests
```

### Storage Interfaces

We define distinct interfaces for the **Statements Store** (for RRF Search). See
[statements.ts](sqlite/statements.ts).

### RDF Ecosystem Compatibility

To ensure compatibility with the extensive
[JavaScript RDF ecosystem](https://rdfjs.dev/), we provide adapters to convert
between our internal `StatementRow` and the standard `@rdfjs/types` data model.
This enables developers to seamlessly leverage RDFJS libraries such as:

- **Comunica:** For federated querying over heterogenous sources.
- **Oxigraph:** For high-performance SPARQL execution.
- **N3.js:** For fast Turtle/N-Quads parsing and serialization.
- **rdf-ext:** To handle RDF data in a developer-friendly way.
- **Quadstore:** For in-memory storage of RDF datasets.
- **Solid:** <https://solidproject.org/about/>

```ts
import type { Quad } from "@rdfjs/types";
import type { StatementRow } from "./sqlite/statements.ts";

/**
 * toQuad converts an internal StatementRow to an RDFJS Quad.
 */
export function toQuad(row: StatementRow): Quad {
  // Implementation mapped to DataFactory
}

/**
 * fromQuad converts an RDFJS Quad to an internal StatementRow.
 */
export function fromQuad(quad: Quad): StatementRow {
  // Implementation extracting subject, predicate, object, graph
}
```

## AI SDK Tools Design

To facilitate seamless integration with the
[Vercel AI SDK](https://sdk.vercel.ai/docs), the `@fartlabs/worlds` package
exports pre-configured **Tool Definitions**. These allow agents to interact with
their "World" using natural language tool calls.

### Core Tools

- **remember:** **Ingestion.** Stores facts or unstructured text into the World.
  - Parses input text.
  - Extracts RDF statements (via LLM or deterministic rules).
  - Skolemizes Blank Nodes (application-level).
  - Writes to `kb_statements` and `kb_chunks`.
- **recall:** **Retrieval.** Searches the World for relevant context.
  - Performs **Hybrid Search** (RRF of Vector + FTS).
  - Optionally executes SPARQL for structured queries.
  - Returns ranked `RankedResult<Statement>[]`.
- **forget:** **Deletion.** Removes specific knowledge.
  - Accepts Statement IDs or Natural Language descriptions (resolved to IDs).
  - Triggers Recursive Cascading Deletes for dependent Blank Nodes.

### Design Pattern: The "Detachable Hippocampus"

The tools are designed to be **model-agnostic**. They do not require the agent
to know SPARQL.

- **Input:** Natural Language (e.g., "Recall what we discussed about Project
  X").
- **Process:** The Tool implementation handles the complexity of embedding
  generation and query construction.
- **Output:** JSON-structured facts (Triples/Quads) or text chunks, ready for
  the Agent's context window.

```ts
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createTools } from "@fartlabs/worlds/tools";

const { text } = await generateText({
  model: google("gemini-3-flash"),
  tools: createTools({
    apiKey: Deno.env.get("WORLDS_API_KEY")!,
    worldId: "world_123",
  }),
  prompt: "My name is Ethan.",
});
```

**References:**

- [Supermemory memory tools](https://supermemory.ai/docs/ai-sdk/memory-tools)
- [Letta (MemGPT) memory tools](https://docs.letta.com/guides/agents/base-tools)
- [Gemini CLI memory tool](https://geminicli.com/docs/tools/memory/)
- [Anthropic memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Claude-Mem Claude Code plugin](https://docs.claude-mem.ai/architecture/overview)

## Web Application: The Dashboard

This Next.js project serves as the frontend dashboard for the Worlds platform—a
service utilizing the `@fartlabs/worlds` SDK. It provides a user interface for
users to authenticate, view, and manage their "world models."

### Scope & Features

- **Authentication:** Built on WorkOS AuthKit (`@workos-inc/authkit-nextjs`) for
  handling sign-in, sign-up, and session management.
- **Dashboard:** A protected `/dashboard` route where authenticated users can:
  - View owned worlds.
  - Edit world descriptions (via Server Actions).
  - Delete worlds.
  - Create new worlds.
  - Get API keys; integration with AISDK.
  - View hidden worlds.
  - View recently deleted worlds.
- **SDK Integration:** Wraps API interactions in a type-safe manner using
  `@fartlabs/worlds`, bridging the frontend with the backend service.
- **Design System:** Uses Tailwind CSS with a minimalist, "Vercel-native"
  aesthetic (implicit dark mode support).

### Interface & Capabilities

The dashboard is organized into a hierarchy of pages designed to move from
high-level account management to granular graph inspection.

#### 1. Overview (`/overview`)

The initial landing page providing a high-level summary of the user's account.

- **Usage Metrics:** Aggregate visualization of API calls, storage usage, and
  active agents across all projects.
- **Recent Activity:** A timeline of recent world creations, deletions, or
  significant modifications.

#### 2. Settings (`/settings`)

Global configuration for the user's account.

- **Account Management:** User profile and organizational settings.
- **Global API Keys:** Management of admin-level keys (if applicable) or
  personal access tokens.
- **Billing:** Invoice history, payment methods, and plan upgrades.

#### 3. Worlds (`/worlds`)

The central inventory of all Worlds owned by the account.

- **World Grid:** A card-based layout displaying all worlds with status
  indicators (Active, Hidden, Recently Deleted).
- **Create World:** Workflow to initialize a new empty World or fork an existing
  one.
- **Search & Filter:** Tools to quickly locate worlds by name or ID.

#### 4. World Details (`/worlds/{world_id}`)

The main workspace for a specific World. This page serves as the "IDE" for the
data.

- **Graph Playground:** An interactive SPARQL editor and "Natural Language
  Tester" to experiment with `recall` and `remember` capabilities.
- **Data Explorer:** Visual tools to browse statements and chunks stored in the
  world.
- **Connection Info:** Quick access to the `world_id` and specific endpoints for
  SDK usage.

#### 5. World Settings (`/worlds/{world_id}/settings`)

Configuration specific to a single World.

- **General:** Rename the world or update its description.
- **Access Keys:** Manage API keys scoped specifically to this world.
- **Danger Zone:** Delete the world or reset its knowledge graph.

### Design Story & Motivations

- **Separation of Concerns:** The project delegates core business logic to an
  external SDK (`@fartlabs/worlds`) and authentication to a dedicated provider
  (WorkOS), allowing this codebase to focus purely on presentation and user
  workflows.
- **Server-Centric Data Flow:** It heavily leverages React Server Components
  (RSC) and Server Actions (e.g., in `app/dashboard/actions.ts`) to keep
  sensitive logic like API keys and mutations secure on the server, exposing
  only necessary UI states to the client.
- **Account Mapping:** There is a deliberate design pattern to map generic
  WorkOS users to specific "Worlds Accounts" using the WorkOS user ID, ensuring
  a seamless bridge between identity and domain-specific data.
- **Unified Visual Identity:** The frontend aims to harbor attention and gain
  trust through a "million dollar" landing page design and a cohesive design
  system. This ensures continuity by sharing design language and tokens between
  the public marketing site and the authenticated dashboard UI.

The architecture emphasizes security and simplicity by offloading complex auth
and backend communications, resulting in a cleaner, lightweight frontend
application.

## Storage Engine Design

This is the most critical technical decision in the system. We currently operate
a **Pluggable Storage Architecture** to accommodate our research findings.

### Primary Engine: Oxigraph

- **Type:** In-Memory Native RDF Store (Wasm).
- **Role:** Query Engine & Cache.
- **Persistence Strategy:**
  - **Pre-loading:** The heavy Wasm module and TF USE models are pre-loaded in
    the global scope (outside the request handler) to ensure the isolate is
    "warm" for incoming requests.
  - **Cold Start:** Hydrates graph state from the `kb_statements` SQLite table
    upon initialization.
  - **Warm State:** Persists in the Deno
    ([Edge Cache](https://docs.deno.com/deploy/classic/edge_cache/)) between
    requests for high-performance read operations.
  - **Writes:** Updates are written synchronously to SQLite (Source of Truth).
    Upon success, the system **invalidates** the Edge Cache for that specific
    World, forcing a fresh hydration from SQLite on the next read.
- **Pros:** Full SPARQL 1.1 compliance, millisecond read latency on warm
  isolates.
- **Cons:** Purely symbolic (exact match only); requires re-hydration on cold
  starts.

#### Benchmarks

| Benchmark                | Time/Iter (Avg) | Iter/s      |
| :----------------------- | :-------------- | :---------- |
| **encodeStore (nq)**     | **2.9 µs**      | **345,100** |
| **encodeStore (trig)**   | **3.1 µs**      | **318,700** |
| **encodeStore (jsonld)** | **4.6 µs**      | **219,400** |

_(Benchmarks run on Deno 2.5.6, Intel i7-1280P)_

### Integrated Engine: Per-World Hybrid SQLite

We utilize a **Per-World Database Strategy** to maximize isolation and
performance.

- **Architecture:**
  - **Control Plane DB (`sys.db`):** Manage accounts, billing, and maps
    `world_id` -> Database URI.
  - **Data Plane DBs (`world_*.db`):** Each "World" is an isolated SQLite file
    containing its own `kb_statements` and `kb_chunks` tables.

- **Value Proposition:**
  - **Detachable:** "Detaching" a hippocampus is as simple as copying the
    `world_123.sqlite` file.
  - **Performance:** Bulk write operations (ingestion) lock only the specific
    world's file, preventing platform-wide contention.
  - **search:** FTS indices are kept small and relevant to the specific agent
    context.

- **Schema Design:**

> [!NOTE]
> See [schema.sql](./sqlite/schema.sql) for the complete database schema
> including `kb_worlds`, `kb_chunks`, and `kb_statements` tables.

- **World Metadata (`kb_worlds`):**
  - Stores high-level attributes: Name, Description, Owner (`account_id`), and
    Visibility.
  - Supports "Soft Deletes" via `deleted_at` column to prevent accidental data
    loss.
  - The `world_id` acts as the foreign key linking to the Graph data.
  - **Integration:** This metadata is exposed via the **Worlds API SDK**,
    enabling frontend applications (like the official Dashboard) to allow users
    to manually update world names and descriptions.

### Blank Node Strategy

To address the ambiguity of Blank Node representation and lifecycle, we utilize
a **Skolemization** strategy paired with **Recursive Cascading Deletes**.

- **Representation (Skolemization):**
  - Blank Nodes are not stored as ephemeral `_:` identifiers. Instead, they are
    **skolemized** into globally unique, stable URIs (e.g., `urn:uuid:<uuid>` or
    `genid:<hash>`) at the point of ingestion.
  - This ensures that "Blank Nodes" can be reliably referenced and queried
    across sessions and storage engines (SQLite <-> Oxigraph) without identity
    collision or loss.
  - In the `kb_statements` table, these appear with `term_type = 'BlankNode'`,
    but the `subject`/`object` value is the stable skolem URI.

- **Lifecycle (Cascading Deletes):**
  - Blank Nodes are treated as **dependent substructures** of the Named Node
    they describe.
  - **Recursive Delete:** When a parent Named Node is deleted, the system must
    identify all linked Blank Nodes (where the Named Node is the subject, and
    the object is a Blank Node) and recursively delete them.
  - This prevents "orphan" Blank Node chains from polluting the Knowledge Graph.
    This logic is enforced at the Application Layer (or via recursive SQL
    triggers where supported).

## Design Alternatives

For a detailed breakdown of our architectural decisions (Database, Graph Engine,
Runtime, Deployment, Authentication), please see [ADR.md](./ADR.md).

## API Specification

The API is a RESTful HTTP server programmed in (Deno) TypeScript.

### Authentication

- **Header:** `Authorization: Bearer <sk_world_key_...>`
- **Scope:** Keys are scoped to specific `world_id`s to prevent
  cross-contamination between agents and enable data security features like
  "Hidden Worlds" and "Recently Deleted Worlds".

### Control Plane Endpoints (Internal)

These endpoints are used for account management and are typically restricted to
admin or service-owner contexts.

#### `POST /v1/accounts`

Create a new account.

- **Request:** JSON body `{ id, apiKey, description, plan, accessControl }`.
- **Response:** `200 OK` → `WorldsAccount`

#### `GET /v1/accounts`

List all accounts.

- **Request:** Empty body.
- **Response:** `200 OK` → `WorldsAccount[]`

#### `GET /v1/accounts/:account`

Get a specific account.

- **Request:** Empty body.
- **Response:** `200 OK` → `WorldsAccount`

#### `PUT /v1/accounts/:account`

Update an account.

- **Request:** JSON body `{ id, apiKey, description, plan, accessControl }`.
- **Response:** `204 No Content`

#### `DELETE /v1/accounts/:account`

Remove an account.

- **Request:** Empty body.
- **Response:** `204 No Content`

#### `GET /v1/accounts/:account/worlds`

Get worlds owned by a specific account.

- **Request:** Empty body.
- **Response:** `200 OK` → `WorldMetadata[]`

#### `POST /v1/accounts/:account/rotate`

Rotate the API key for an account.

- **Request:** Empty body.
- **Response:** `200 OK` → `WorldsAccount` (with new apiKey)

### Control Plane Endpoints (Public)

#### `GET /v1/worlds`

Get all Worlds owned by the user.

- **Purpose:** Retrieve all Worlds owned by the user.
- **Request:** Empty body.
- **Response:** `200 OK` → `WorldMetadata[]`

#### `GET /v1/worlds/:world`

Get a specific World graph.

- **Purpose:** Retrieve the full knowledge graph.
- **Request:** Empty body.
- **Response:** `200 OK` (Content-Type: `application/n-quads`)

#### `PUT /v1/worlds/:world`

Create or completely replace a World.

- **Purpose:** Overwrite the entire graph with new data.
- **Request:** Raw RDF body (Content-Type: `application/n-quads`).
- **Response:** `204 No Content`

#### `PATCH /v1/worlds/:world`

Update World metadata.

- **Purpose:** Modify attributes like name or description.
- **Request:** JSON body `{ name?, description? }` (Content-Type:
  `application/json`).
- **Response:** `204 No Content`

#### `POST /v1/worlds/:world`

Ingest (Append quads) knowledge to a World.

- **Purpose:** Add new quads to the existing graph.
- **Request:** Raw RDF body (Content-Type: `application/n-quads`).
- **Response:** `204 No Content`

#### `GET /v1/worlds/:world/sparql`

SPARQL Reasoning & Retrieval (Read).

- **Purpose:** Execute read-only SPARQL queries.
- **Request:** Raw SPARQL query body (Content-Type: `application/sparql-query`).
- **Response:** `200 OK` → `application/sparql-results+json`

#### `POST /v1/worlds/:world/sparql`

SPARQL Update (Write).

- **Purpose:** Execute SPARQL update operations.
- **Request:** Raw SPARQL Update body (Content-Type:
  `application/sparql-update`).
- **Response:** `200 OK` → `application/sparql-results+json`

#### `DELETE /v1/worlds/:world`

Wipe memory.

- **Purpose:** Permanently delete the World and all associated data.
- **Request:** Empty body.
- **Response:** `204 No Content`

#### `GET /v1/worlds/:world/statements`

Search statements.

- **Purpose:** Perform semantic retrieval and full-text search using Reciprocal
  Rank Fusion (RRF).
- **Request:** JSON parameters `{ query: string }` (Content-Type:
  `application/json`).
- **Response:** `200 OK` → `RankedResult<Statement>[]`

#### `GET /v1/worlds/:world/statements/:statement`

Get a specific statement.

- **Purpose:** Retrieve a specific statement.
- **Request:** Empty body.
- **Response:** `200 OK` → `Statement`

#### `GET /v1/worlds/:world/chunks`

Search chunks.

- **Purpose:** Perform semantic retrieval and full-text search using Reciprocal
  Rank Fusion (RRF).
- **Request:** JSON parameters `{ query: string }` (Content-Type:
  `application/json`).
- **Response:** `200 OK` → `RankedResult<Chunk>[]`

#### `GET /v1/worlds/:world/chunks/:chunk`

Get a specific chunk.

- **Purpose:** Retrieve a specific chunk.
- **Request:** Empty body.
- **Response:** `200 OK` → `Chunk`

## Getting Started & Development

### Onboarding

1. **Prerequisites:** Install [Deno 2.x](https://deno.com) and
   [Git](https://git-scm.com).
2. **Clone:** `git clone https://github.com/EthanThatOneKid/worlds-api`
3. **Run:** `deno task start` (Starts the backend on port 8000).

### Local Development

We utilize Deno tasks for a zero-config dev experience, aligning with the "Calm
Technology" philosophy.

```bash
# Backend
deno task start      # Starts server on localhost:8000
deno task precommit  # Runs fmt, lint, and tests

# Frontend
npm run dev          # Starts Next.js on localhost:3000
```

### CI/CD Pipeline

- **GitHub Actions:**
  - On PR: Runs `deno lint`, `deno test` (unit tests for Oxigraph logic), and
    builds the Next.js app.
  - On Merge: Publishes SDK to **JSR** (`@fartlabs/worlds`) and deploys Backend
    to Deno Deploy / Frontend to Vercel.

## Risks & Mitigations

We take security seriously and implement several measures to ensure the safety
of our users' data.

| Risk                 | Impact                   | Mitigation                                                                                                |
| -------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **SPARQL Injection** | High (Data Exfiltration) | Oxigraph's query parser is robust; strict input validation on the API layer before passing to the engine. |
| **Memory Usage**     | Medium (Cost)            | Oxigraph is memory-hungry. We implement strict triple limits per World (e.g., 50k triples/free tier).     |
| **Latency**          | Low                      | Edge deployment ensures low TTL. Benchmarks show <5µs encoding overhead.                                  |

## Hand-off Checklist

- [ ] **SDK:** Ensure `@fartlabs/worlds` on JSR is synced with the latest API
      types.
- [ ] **Env Vars:** Verify `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` are set in
      Vercel.
- [ ] **Docs:** Document the `kb_chunks` schema and RRF scoring algorithm in the
      official Wiki.
- [ ] **Testing:** Verify RRF (Reciprocal Rank Fusion) performance on large
      chunk datasets.

### Next Steps for Stakeholders

1. **Finalize Chunks Schema:** Lock down the `kb_chunks` table definition for
   v1.
2. **Review WorkOS Integration:** Confirm the organization mapping logic (One
   WorkOS Org = Many Worlds).
3. **Greenlight Deployment:** Push to production environment.

### Dynamic Access Control

The platform enables **Dynamic Access** via the `kb_limits` table. This design
allows for real-time adjustments to service levels without code deployment:

- **Runtime Enforcement:** The API Gateway / Middleware fetches the `plan_tier`
  and quotas for the authenticated `account_id` on every request (cached with
  short TTL).
- **Instant Upgrades:** Changing a user's `plan_tier` from 'free' to 'pro' in
  the database immediately unlocks higher `quota_reads_per_min` limits and
  features restricted to specific tiers.
- **Granular Feature Flags:** The `plan_tier` can be mapped to specific
  capability flags in the application logic (e.g., access to "Reasoning"
  endpoints).

## Future Work

### Separated Vector Store

As the Knowledge Graph grows, the presence of 512-dimension float vectors in the
primary SQLite file (`kb_chunks`) may impact maintenance operations
(Vacuum/Backup). A future iteration will explore splitting the Vector Index into
a dedicated specialized store (e.g., a separate SQLite file attached via
`ATTACH DATABASE` or a dedicated Vector DB) while keeping metadata in the
primary `kb_worlds`.

### Improving Agent Accuracy with Sandboxed Code Execution

To enhance the precision of agent responses, we plan to implement a tool for
**arbitrary code execution**. This will allow agents to generate and run short
scripts to perform accurate calculations on retrieved datapoints, rather than
relying solely on LLM inference.

We intend to utilize [Deno Deploy Sandboxes](https://deno.com/deploy/sandboxes)
to provide secure, isolated environments for executing this code. This approach
ensures safety while granting agents the flexibility to spawn processes, manage
files, and execute JavaScript/TypeScript runtimes.

**References:**

- [Deno Sandbox Docs](https://docs.deno.com/sandboxes/)
- [JSR: @deno/sandbox](https://jsr.io/@deno/sandbox)
- [Google Gemini Code Execution](https://ai.google.dev/gemini-api/docs/code-execution#javascript)
- [Anthropic Code Execution Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool)
- [Anthropic Programmatic Tool Calling](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)

### Distributed Graph Synchronization

The current "invalidation-on-write" strategy incurs a latency penalty by forcing
re-hydration of the Graph Store. To mitigate this, we plan to implement a
**real-time synchronization protocol** using the `BroadcastChannel` API (or a
KV-backed message bus). This will allow "hot" Oxigraph isolates to receive
granular RDF patches (deltas) from the writer, applying updates in-memory
without requiring a full reload from SQLite.

### Usage Monitoring & Limits

We aim to implement a robust, asynchronous metering system to support
"Pay-as-you-go" pricing and prevent abuse. Usage will be metered by **Service
Account (API Key)** and aggregated into time buckets (e.g., 1-minute intervals)
in a high-throughput key-value store (e.g., Deno KV) before being flushed to
permanent storage.

```ts
export interface WorldUsageBucket {
  bucket_start_ts: number;
  account_id: string;
  endpoint: string;
  request_count: number;
  cpu_time_ms: number;
  tokens_in: number;
  tokens_out: number;
}
```

This will ensure:

- **Billing Transparency:** Users can see exactly which key incurred costs.
- **Resource Control:** Granular limits can be applied to specific agents.
- **Zero Latency Impact:** Metering will not block the hot path of the API.

### Research Papers

- [Thinking with Knowledge Graphs (Arxiv)](https://arxiv.org/abs/2412.10654)
- [Jelly: RDF Serialization Format (Arxiv)](https://arxiv.org/abs/2506.11298)
- [MemGPT: Towards LLMs as Operating Systems (Arxiv)](https://arxiv.org/abs/2310.08560)

## Resources & References

- **Oxigraph:** [oxigraph.org](https://oxigraph.org/) - The core graph engine
  used.
- **AuthKit by WorkOS:** [workos.com](https://workos.com/docs/authkit) - The
  authentication layer used.
- **LibSQL:** [docs.turso.tech/libsql](https://docs.turso.tech/libsql) - The
  database used.
- **RDF 1.1 Primer:**
  [w3.org/TR/rdf11-primer](https://www.w3.org/TR/rdf11-primer/) - Introduction
  to the data model.
- **Deno:** [deno.com](https://deno.com) - The runtime environment.
- **Reciprocal Rank Fusion:**
  [Paper (Cormack et al.)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) -
  The ranking logic used for Hybrid Search.

---

Developed with 🧪 [**@FartLabs**](https://github.com/FartLabs)
