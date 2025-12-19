-- World Database Schema (world_*.db)
-- Isolated Data Plane for a single World.
-- Contains the Knowledge Graph (Statements) and Vector Memory (Chunks).

-- The Core Triple Store (kb_statements)
-- kb_statements: Knowledge Base Statements
CREATE TABLE IF NOT EXISTS kb_statements (
  statement_id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  graph TEXT NOT NULL,
  
  -- Term Types: 'NamedNode', 'Literal', 'BlankNode', 'DefaultGraph'.
  -- NOTE: 'BlankNode' subjects/objects MUST be skolemized (e.g., .well-known/genid/...) 
  -- to ensure stable identity across storage and sessions.
  term_type TEXT NOT NULL DEFAULT 'NamedNode',
  object_language TEXT NOT NULL DEFAULT '',
  object_datatype TEXT NOT NULL DEFAULT '',
  CONSTRAINT kb_statement_unique UNIQUE (
    subject, predicate, object, graph, term_type, object_language, object_datatype
  )
);

-- Trigger for Recursive Cascading Deletes of Blank Nodes
-- NOTE: Requires 'PRAGMA recursive_triggers = ON;' in the connection setup.
CREATE TRIGGER IF NOT EXISTS kb_statements_ad_bn AFTER DELETE ON kb_statements
WHEN old.term_type = 'BlankNode' OR OLD.object LIKE 'urn:uuid:%' OR OLD.object LIKE '.well-known/genid/%'
BEGIN
  -- If we deleted a statement where the Object was a Blank Node (Skolemized),
  -- we must recursively delete all statements where that Blank Node is the Subject.
  DELETE FROM kb_statements WHERE subject = old.object;
END;

-- Chunks Table (Linked to kb_statements)
-- We use FLOAT32(512) for TensorFlow USE embeddings.
-- kb_chunks: Knowledge Base Chunks
CREATE TABLE IF NOT EXISTS kb_chunks (
  chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
  statement_id INTEGER,
  content TEXT,
  embedding FLOAT32(512),
  FOREIGN KEY(statement_id) REFERENCES kb_statements(statement_id) ON DELETE CASCADE
);

-- Vector Index
-- kb_chunks_vector_idx: Knowledge Base Chunks Vector Index
CREATE INDEX IF NOT EXISTS kb_chunks_vector_idx ON kb_chunks (libsql_vector_idx(embedding));

-- FTS5 Virtual Table for Full-Text Search
-- kb_chunks_fts: Knowledge Base Chunks Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS kb_chunks_fts USING fts5(
  content,
  content = 'kb_chunks',
  content_rowid = 'chunk_id'
);

-- Triggers to keep FTS index in sync
-- kb_chunks_ai: Knowledge Base Chunks After Insert
CREATE TRIGGER IF NOT EXISTS kb_chunks_ai AFTER INSERT ON kb_chunks BEGIN
  INSERT INTO kb_chunks_fts(rowid, content) VALUES (new.chunk_id, new.content);
END;

-- kb_chunks_ad: Knowledge Base Chunks After Delete
CREATE TRIGGER IF NOT EXISTS kb_chunks_ad AFTER DELETE ON kb_chunks BEGIN
  INSERT INTO kb_chunks_fts(kb_chunks_fts, rowid, content) VALUES ('delete', old.chunk_id, old.content);
END;

-- kb_chunks_au: Knowledge Base Chunks After Update
CREATE TRIGGER IF NOT EXISTS kb_chunks_au AFTER UPDATE ON kb_chunks BEGIN
  INSERT INTO kb_chunks_fts(kb_chunks_fts, rowid, content) VALUES ('delete', old.chunk_id, old.content);
  INSERT INTO kb_chunks_fts(rowid, content) VALUES (new.chunk_id, new.content);
END;

-- Indices
-- kb_s_index: Knowledge Base Subject Index
CREATE INDEX IF NOT EXISTS kb_s_index ON kb_statements (subject);
-- kb_p_index: Knowledge Base Predicate Index
CREATE INDEX IF NOT EXISTS kb_p_index ON kb_statements (predicate);
-- kb_o_index: Knowledge Base Object Index
CREATE INDEX IF NOT EXISTS kb_o_index ON kb_statements (object);
-- kb_g_index: Knowledge Base Graph Index
CREATE INDEX IF NOT EXISTS kb_g_index ON kb_statements (graph);
-- kb_sp_index: Knowledge Base Subject-Predicate Index
CREATE INDEX IF NOT EXISTS kb_sp_index ON kb_statements (subject, predicate);
-- kb_po_index: Knowledge Base Predicate-Object Index
CREATE INDEX IF NOT EXISTS kb_po_index ON kb_statements (predicate, object);
