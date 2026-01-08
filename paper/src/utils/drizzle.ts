import { customType } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { Buffer } from "node:buffer";

/**
 * Custom Float32Array type for vector embeddings
 * Ref: https://docs.turso.tech/sdk/ts/orm/drizzle#vector-embeddings
 */
export const float32Array = customType<{
  data: number[];
  config: { dimensions: number };
  configRequired: true;
  driverData: Buffer;
}>({
  dataType(config) {
    return `F32_BLOB(${config.dimensions})`;
  },
  fromDriver(value: Buffer) {
    return Array.from(new Float32Array(value.buffer));
  },
  toDriver(value: number[]) {
    return sql`vector32(${JSON.stringify(value)})`;
  },
});
