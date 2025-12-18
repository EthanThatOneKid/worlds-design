# Design Alternatives

ADR stands for "Architecture Decision Record". It is a document that records the
decision-making process for a specific architectural decision. It includes the
problem, the decision, and the rationale for the decision.

We operate with a
[polymorphic](https://en.wikipedia.org/wiki/Polymorphism_(computer_science))
architecture mindset. While v1 utilizes specific technologies, the system is
designed to be adaptable. We evaluate components based on their synergy with our
core philosophy.

## Database Strategy

- **Per-World SQLite (Turso Namespaces / D1)**
  - **Pros (Synergy):**
    - **Isolation:** Each world is its own physical database file. "Detaching" a
      world is as simple as copying the file.
    - **Performance:** Write locks and FTS indexing are scoped to a single
      world, preventing "noisy neighbor" latency.
    - **Schema:** Migrations can be rolled out incrementally.
  - **Cons (Trade-offs):**
    - **Management:** Requires a "Control Plane" database to map `world_id` to
      database connection strings/paths.
    - **Connections:** Managing thousands of DB connections requires careful
      pooling or HTTP-based query protocols.

- **Monolithic SQLite**
  - **Pros (Synergy):**
    - **Simplicity:** One file to back up, one schema to manage.
  - **Cons (Trade-offs):**
    - **Bottleneck:** A single massive FTS index will choke on updates as the
      platform grows.
    - **Lock-in:** Exporting a single world requires complex `SELECT ...` logic
      rather than a simple file copy.

- **SurrealDB**
  - **Pros (Synergy):**
    - **Multi-Model:** Natively supports graph relationships alongside standard
      document storage, aligning well with our "World" concept.
    - **Scale:** Built for distributed scalability from the ground up.
  - **Cons (Trade-offs):**
    - **Operational Overhead:** Running a SurrealDB cluster (or paying for
      cloud) adds infrastructure complexity compared to embedded SQLite.
    - **Maturity:** Newer entrant compared to the battle-tested SQLite/Postgres
      ecosystem.

## Graph Engine

- **Oxigraph (Wasm) + Pre-loading**
  - **Pros (Synergy):**
    - **Speed:** Near-native performance (Rust).
    - **Compliance:** Full SPARQL 1.1 support.
    - **Optimization:** Pre-loading the WASM module in the global scope (outside
      request handlers) eliminates 90% of cold stat latency on Edge runtimes.
  - **Cons (Trade-offs):**
    - **Memory:** Higher footprint than simple JS object traversal.
    - **Complexity:** Requires careful lifecycle management in serverless
      environments to ensure the "warm" isolate is reused.

- **Comunica + N3.js**
  - **Pros (Synergy):**
    - **Ecosystem:** Pure JavaScript, easy to debug and extend.
    - **Federation:** Excellent support for querying multiple sources.
  - **Cons (Trade-offs):**
    - **Latency:** Parsing and execution is significantly slower than Wasm.
    - **Throughput:** JS garbage collection can impact high-load consistency.

- **Comunica + Quadstore**
  - **Pros (Synergy):**
    - **Persistence:** backend-agnostic (runs on LevelDB, IndexedDB, etc.)
      allowing for persistent storage in JS/Node envs.
    - **Standards:** Fully implements the standard RDF/JS Store interface.
  - **Cons (Trade-offs):**
    - **Performance:** JS-based overhead compared to native Rust/Wasm solutions
      like Oxigraph.
    - **Complexity:** Managing native LevelDB bindings can be difficult in
      serverless environments.

## Embeddings Strategy

- **TensorFlow Universal Sentence Encoder (USE)**
  - **Pros (Synergy):**
    - **Edge-Native:** Can run within the application or via a sidecar without
      external API calls.
    - **Privacy:** Data never leaves the immediate processing environment.
    - **Cost:** Free/Open Source.
  - **Cons (Trade-offs):**
    - **Quality:** Older architecture compared to modern large-scale
      transformers.
    - **Maintenance:** Requires managing the model weights and inference runtime
      manually.

- **OpenAI Embeddings (text-embedding-3)**
  - **Pros (Synergy):**
    - **Quality:** Industry standard not just for retrieval but for "reasoning"
      capability.
    - **Simplicity:** Extremely easy to implement via HTTP client.
      [Docs](https://platform.openai.com/docs/api-reference/embeddings/create)
  - **Cons (Trade-offs):**
    - **Latency:** Adds network round-trip overhead to every ingestion and
      query.
    - **Cost:** Pay-per-token model scales linearly with data.

- **Google Vertex AI Embeddings**
  - **Pros (Synergy):**
    - **Scale:** Excellent support for high-throughput batch processing.
      [Batch API Docs](https://ai.google.dev/gemini-api/docs/batch-api?batch=file#batch-embedding)
    - **Multimodal:** Potential path to support image and video embeddings in
      the future.
      [Embeddings Docs](https://ai.google.dev/gemini-api/docs/embeddings)
  - **Cons (Trade-offs):**
    - **Complexity:** Heavier authentication (IAM) compared to simple API keys.
    - **Cold Starts:** Client library initialization can be slower than
      lightweight fetch calls.

- **Ollama**
  - **Pros (Synergy):**
    - **Sovereignty:** Complete control over the model and data; no external API
      dependency.
    - **Flexibility:** Trivial to swap between various open-source embedding
      models (e.g., `nomic-embed-text`).
  - **Cons (Trade-offs):**
    - **Infrastructure:** Requires self-hosting a GPU-backed instance; not
      "serverless" friendly.
    - **Operations:** Adds burden of managing the Ollama service availability.

## Chunking Strategy

- **Recursive Character Text Splitting
  ([LangChain](https://docs.langchain.com/oss/javascript/integrations/splitters/recursive_text_splitter))**
  - **Pros (Synergy):**
    - **Context-Aware:** Respects document structure (paragraphs, newlines)
      better than blind token counting.
    - **Flexible:** Configurable separators allow tuning for different content
      types (Code, Markdown, Prose).
  - **Cons (Trade-offs):**
    - **Complexity:** Slightly more CPU intensive than simple string slicing.
    - **Heuristic:** May still split semantically linked concepts if they are
      far apart textually.

- **Fixed-Size Chunking**
  - **Pros (Synergy):**
    - **Simplicity:** Trivial to implement and extremely fast.
    - **Predictability:** Guarantees exact token window fit.
  - **Cons (Trade-offs):**
    - **Fragmentation:** Frequently cuts sentences or thoughts in half,
      destroying semantic meaning.
    - **Noise:** Increases "semantic noise" by including irrelevant trailing
      text in a chunk.

- **Semantic Chunking**
  - **Pros (Synergy):**
    - **Meaning-Centric:** Uses embedding similarity to determine boundaries,
      ensuring chunks represent coherent topics.
    - **Quality:** Generally yields higher retrieval precision for complex
      queries.
  - **Cons (Trade-offs):**
    - **Latency:** Requires double-embedding (once to chunk, once to index),
      significantly slowing ingestion.
    - **Cost:** Doubles the embedding API costs if using a paid provider.

## Runtime & Deployment Strategy

We view runtime and deployment as intrinsically linked decisions. We evaluate
the following pairings:

- **Deno + Deno Deploy (Edge-Native)**
  - **Pros (Synergy):**
    - **Isolates:** V8 Isolates offer superior security and startup time
      (<10ms).
    - **Native:** 1:1 parity with local development; "Calm Technology"
      (Zero-Config).
    - **Security:** Permissions model defaults to secure.
  - **Cons (Trade-offs):**
    - **Specificity:** Lock-in to Deno-compatible ecosystems.
    - **Features:** Less broad platform features than AWS/Vercel.

- **Node.js + Vercel (Standard Serverless)**
  - **Pros (Synergy):**
    - **Ecosystem:** Massive access to libraries (`npm`).
    - **Integration:** Perfect fit for the Next.js Dashboard.
    - **DX:** Premier developer experience.
  - **Cons (Trade-offs):**
    - **Cold Starts:** Serverless Functions (Lambda) can be slower than Edge
      Isolates.
    - **Friction:** CommonJS vs ESM legacy issues.

- **Bun + Arbitrary Cloud (Fly.io, Railway, DigitalOcean)**
  - **Pros (Synergy):**
    - **Performance:** Extremely fast startup and execution.
    - **Flexibility:** Arbitrary container hosting allows for stateful services
      if needed.
    - **DX:** Great drop-in compatibility.
  - **Cons (Trade-offs):**
    - **Operations:** Requires managing Dockerfiles or buildpacks unlike the
      "deploy from git" ease of Edge platforms.
    - **Stability:** Bun is newer with potentially unforeseen edge-cases.

- **Deno + Cloudflare Workers (Hybrid)**
  - **Pros (Synergy):**
    - **Network:** Unmatched global distribution and 0ms cold starts.
    - **DX:** Use Deno findings/tooling locally (`deno lint`, `deno test`).
      [Denoflare](https://denoflare.dev/) helps bridge the gap.
  - **Cons (Trade-offs):**
    - **Build Step:** Requires bundling (e.g. `esbuild`) to target `workerd`;
      loses Deno's native zero-config deployment.
    - **Compatibility:** `workerd` != Deno; some APIs may differ.

## Auth Provider Strategy

- **WorkOS**
  - **Pros (Synergy):**
    - **Enterprise-Native:** Best-in-class for SSO and SCIM; prepares the app
      for "high assurance" use cases immediately.
    - **DX:** Modern, uncompromising API design.
  - **Cons (Trade-offs):**
    - **B2C Depth:** While capable, its DNA is heavily B2B compared to Clerk's
      consumer focus.

- **Auth0**
  - **Pros (Synergy):**
    - **Ubiquity:** The standard reference for identity; huge community support.
    - **Flexibility:** "Actions" allow complex customization of the auth
      pipeline.
  - **Cons (Trade-offs):**
    - **Legacy:** Can feel "enterprise-heavy" and complex to configure for
      modern lightweight stacks.
    - **Cost:** Price cliffs for enterprise features are steep.

- **Clerk**
  - **Pros (Synergy):**
    - **Next.js Native:** Unbeatable integration with Next.js App Router and
      React Server Components.
    - **UI:** Drop-in components are premium and distinct, saving weeks of
      frontend work.
  - **Cons (Trade-offs):**
    - **Lock-in:** Deep coupling with their specific React component ecosystem.
    - **Middleware:** Heavy reliance on Middleware can sometimes complicate Edge
      layouts.
