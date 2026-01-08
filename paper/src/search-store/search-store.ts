import type * as rdfjs from "@rdfjs/types";

/**
 * SearchStore is an RDF store with RRF search capabilities.
 */
export interface SearchStore {
  /**
   * addStatements ingests a set of statements into the store.
   */
  addStatements(statements: rdfjs.Quad[]): Promise<void>;

  /**
   * addStatement ingests a statement into the store.
   */
  addStatement(statement: rdfjs.Quad): Promise<void>;

  /**
   * getStatements retrieves a set of statements by graph ID.
   */
  getStatements(graphId: string): Promise<rdfjs.Quad[]>;

  /**
   * getStatement retrieves a statement by ID.
   */
  getStatement(statementId: string): Promise<rdfjs.Quad | null>;

  /**
   * removeStatements removes a set of statements by graph ID.
   */
  removeStatements(graphId: string): Promise<void>;

  /**
   * removeStatement removes a statement by ID.
   */
  removeStatement(statementId: string): Promise<void>;
}
