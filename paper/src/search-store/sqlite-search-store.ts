import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle } from "drizzle-orm/libsql";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";
import type * as rdfjs from "@rdfjs/types";
import * as oxigraph from "oxigraph";
import { float32Array } from "#/utils/drizzle.ts";
import type { SearchStore } from "./search-store.ts";

export const kbTerms = sqliteTable("kb_terms", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  value: text("value").notNull(),
});

// The Core Triple Store
export const kbStatements = sqliteTable(
  "kb_statements",
  {
    statementId: integer("statement_id").primaryKey({ autoIncrement: true }),
    subject: text("subject").notNull(),
    predicate: text("predicate").notNull(),
    object: text("object").notNull(),
    graph: text("graph").notNull(),

    // Term Types: 'NamedNode', 'Literal', 'BlankNode', 'DefaultGraph'.
    termType: text("term_type").notNull().default("NamedNode"),
    objectLanguage: text("object_language").notNull().default(""),
    objectDatatype: text("object_datatype").notNull().default(""),
  },
  (t) => ({
    uniqueConstraint: unique("kb_statement_unique").on(
      t.subject,
      t.predicate,
      t.object,
      t.graph,
      t.termType,
      t.objectLanguage,
      t.objectDatatype,
    ),
    subjectIdx: index("kb_s_index").on(t.subject),
    predicateIdx: index("kb_p_index").on(t.predicate),
    objectIdx: index("kb_o_index").on(t.object),
    graphIdx: index("kb_g_index").on(t.graph),
    subjectPredicateIdx: index("kb_sp_index").on(t.subject, t.predicate),
    predicateObjectIdx: index("kb_po_index").on(t.predicate, t.object),
  }),
);

// Chunks Table (Linked to kb_statements)
export const kbChunks = sqliteTable(
  "kb_chunks",
  {
    chunkId: integer("chunk_id").primaryKey({ autoIncrement: true }),
    statementId: integer("statement_id").references(
      () => kbStatements.statementId,
      { onDelete: "cascade" },
    ),
    content: text("content"),
    embedding: float32Array("embedding", { dimensions: 512 }),
  },
  (_t) => ({
    // Vector index typically created via raw SQL: CREATE INDEX ... USING libsql_vector_idx
  }),
);

export class SqliteSearchStore implements SearchStore {
  private readonly db: LibSQLDatabase;
  private readonly df: rdfjs.DataFactory;

  public constructor(
    client: Client,
    df: rdfjs.DataFactory = oxigraph as rdfjs.DataFactory,
  ) {
    this.db = drizzle(client);
    this.df = df;
  }

  async addStatements(statements: rdfjs.Quad[]): Promise<void> {
    if (statements.length === 0) return;

    const values = statements.map((quad) => ({
      subject: quad.subject.value,
      predicate: quad.predicate.value,
      object: quad.object.value,
      graph: quad.graph.value,
      termType: quad.object.termType,
      objectLanguage: quad.object.termType === "Literal"
        ? quad.object.language
        : "",
      objectDatatype: quad.object.termType === "Literal"
        ? quad.object.datatype.value
        : "",
    }));

    await this.db.insert(kbStatements).values(values).onConflictDoNothing()
      .run();
  }

  async addStatement(statement: rdfjs.Quad): Promise<void> {
    await this.addStatements([statement]);
  }

  async getStatements(graphId: string): Promise<rdfjs.Quad[]> {
    const rows = await this.db.select().from(kbStatements).where(
      eq(kbStatements.graph, graphId),
    ).all();

    return rows.map((row) => {
      const subject = this.df.namedNode(row.subject);
      const predicate = this.df.namedNode(row.predicate);
      const graph = this.df.namedNode(row.graph);

      let object: rdfjs.Term;
      if (row.termType === "Literal") {
        object = this.df.literal(
          row.object,
          row.objectLanguage || this.df.namedNode(row.objectDatatype),
        );
      } else if (row.termType === "BlankNode") {
        object = this.df.namedNode(row.object);
        if (row.object.startsWith("_:")) {
          object = this.df.blankNode(row.object.slice(2));
        } else {
          object = this.df.namedNode(row.object);
        }
      } else {
        object = this.df.namedNode(row.object);
      }

      return this.df.quad(subject, predicate, object, graph);
    });
  }

  async getStatement(statementId: string): Promise<rdfjs.Quad | null> {
    // statementId is now an Integer (ROWID/AUTOINC) in the schema!
    // But the interface demands `statementId: string`.
    // We must parseInt.
    const id = parseInt(statementId);
    if (isNaN(id)) return null;

    const rows = await this.db.select().from(kbStatements).where(
      eq(kbStatements.statementId, id),
    ).limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];

    const subject = this.df.namedNode(row.subject);
    const predicate = this.df.namedNode(row.predicate);
    const graph = this.df.namedNode(row.graph);

    let object: rdfjs.Term;
    if (row.termType === "Literal") {
      object = this.df.literal(
        row.object,
        row.objectLanguage || this.df.namedNode(row.objectDatatype),
      );
    } else {
      object = this.df.namedNode(row.object);
    }
    return this.df.quad(subject, predicate, object, graph);
  }

  async removeStatements(graphId: string): Promise<void> {
    await this.db.delete(kbStatements).where(eq(kbStatements.graph, graphId))
      .run();
  }

  async removeStatement(statementId: string): Promise<void> {
    const id = parseInt(statementId);
    if (isNaN(id)) return;
    await this.db.delete(kbStatements).where(eq(kbStatements.statementId, id))
      .run();
  }
}
