import { assertEquals } from "@std/assert";
import { createClient } from "@libsql/client";
import { SqliteSearchStore } from "./sqlite-search-store.ts";
import { DataFactory } from "rdf-data-factory";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";

const factory = new DataFactory();

// Helper to create tables matching the new schema
const createTablesSql = sql`
CREATE TABLE IF NOT EXISTS kb_statements (
    statement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    graph TEXT NOT NULL,
    term_type TEXT NOT NULL DEFAULT 'NamedNode',
    object_language TEXT NOT NULL DEFAULT '',
    object_datatype TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_statement_unique ON kb_statements (subject, predicate, object, graph, term_type, object_language, object_datatype);
CREATE INDEX IF NOT EXISTS kb_s_index ON kb_statements (subject);
CREATE INDEX IF NOT EXISTS kb_g_index ON kb_statements (graph);
`;

Deno.test("SqliteSearchStore", async (t) => {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);
  await db.run(createTablesSql);

  const store = new SqliteSearchStore(client);

  await t.step("addStatement / getStatements", async () => {
    const quad = factory.quad(
      factory.namedNode("http://example.org/s1"),
      factory.namedNode("http://example.org/p1"),
      factory.literal("o1"),
      factory.namedNode("http://example.org/g1"),
    );

    await store.addStatement(quad);

    const retrieved = await store.getStatements("http://example.org/g1");
    assertEquals(retrieved.length, 1);
    assertEquals(retrieved[0].subject.value, "http://example.org/s1");
    assertEquals(retrieved[0].graph.value, "http://example.org/g1");
    // Check term types
    assertEquals(retrieved[0].object.termType, "Literal");
    assertEquals(retrieved[0].object.value, "o1");
  });

  await t.step("removeStatements", async () => {
    // Add another quad in the same graph
    const quad2 = factory.quad(
      factory.namedNode("http://example.org/s2"),
      factory.namedNode("http://example.org/p1"),
      factory.literal("o2"),
      factory.namedNode("http://example.org/g1"),
    );
    await store.addStatement(quad2);

    // Verify we have 2 (from previous step + this one)
    let retrieved = await store.getStatements("http://example.org/g1");
    assertEquals(retrieved.length, 2);

    // Remove
    await store.removeStatements("http://example.org/g1");

    retrieved = await store.getStatements("http://example.org/g1");
    assertEquals(retrieved.length, 0);
  });

  await t.step("removeStatement by ID", async () => {
    const quad = factory.quad(
      factory.namedNode("http://example.org/s3"),
      factory.namedNode("http://example.org/p3"),
      factory.literal("o3"),
      factory.namedNode("http://example.org/g2"),
    );
    await store.addStatement(quad);

    // We must find the ID first since it's auto-increment
    // Since we don't return ID from addStatement, we assume we find it via content or list
    // In this test, we just get everything from g2
    const retrieved = await store.getStatements("http://example.org/g2");
    assertEquals(retrieved.length, 1);

    // For the purpose of testing the STORE logic, I will query the DB directly to get the ID.
    const rows = await db.all(
      sql`SELECT statement_id FROM kb_statements WHERE subject = 'http://example.org/s3'`,
    );
    assertEquals(rows.length, 1);
    const id = (rows[0] as any).statement_id; // number

    await store.removeStatement(id.toString());

    const retrievedAfter = await store.getStatements("http://example.org/g2");
    assertEquals(retrievedAfter.length, 0);
  });

  client.close();
});
