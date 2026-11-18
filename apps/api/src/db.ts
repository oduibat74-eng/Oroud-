import pg from "pg";

// bigint ids fit safely in a JS number for our volumes; return them as numbers.
// numeric columns (JOD prices) stay strings by default so no precision is lost.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}
