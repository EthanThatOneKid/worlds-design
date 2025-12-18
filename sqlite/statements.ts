/**
 * StatementRow is a row in the statements table.
 */
export interface StatementRow {
  statement_id: number;
  subject: string;
  predicate: string;
  object: string;
  graph: string;
  term_type?: "NamedNode" | "BlankNode" | "Literal" | "DefaultGraph";
  object_language?: string;
  object_datatype?: string;
}

/**
 * ChunkRow is a row in the chunks table.
 */
export interface ChunkRow {
  chunk_id: number;
  statement_id: number;
  content: string;
  embedding: number[];
}

/**
 * RankedResult is a result from a reciprocal rank fusion search.
 */
export interface RankedResult<T> {
  /**
   * item is the item that was ranked.
   */
  item: T;

  /**
   * score is the final score of the item after RRF fusion.
   */
  score: number;

  /**
   * rank is a record of the rank of the item for each component of the search.
   * For example if we are searching by FTS and vector, the rank will be
   * `{ fts: number; vector: number }`.
   */
  rank: Record<string, number>;
}

export interface StatementsStore {
  // GRAPHS.

  /**
   * getGraph gets all statements in a graph.
   */
  getGraph(graphId: string): Promise<StatementRow[]>;

  /**
   * removeGraph removes all statements in a graph.
   */
  removeGraph(graphId: string): Promise<void>;

  // STATEMENTS.

  /**
   * insertStatement inserts a single statement.
   */
  insertStatement(statement: StatementRow): Promise<void>;

  /**
   * insertStatements inserts multiple statements.
   */
  insertStatements(statements: StatementRow[]): Promise<void>;

  /**
   * getStatement gets a statement by statement ID.
   */
  getStatement(statementId: number): Promise<StatementRow | null>;

  /**
   * removeStatement removes a statement by statement ID.
   */
  removeStatement(statementId: number): Promise<void>;

  /**
   * searchStatements searches for statements.
   */
  searchStatements(
    query: string,
    k?: number,
  ): Promise<RankedResult<StatementRow>[]>;

  // CHUNKS.

  /**
   * getChunk gets a chunk by chunk ID.
   */
  getChunk(chunkId: number): Promise<ChunkRow | null>;

  /**
   * getChunks gets all chunks for a statement by statement ID.
   */
  getChunks(statementId: number): Promise<ChunkRow[]>;

  /**
   * searchChunks searches for chunks.
   */
  searchChunks(query: string, k?: number): Promise<RankedResult<ChunkRow>[]>;
}
