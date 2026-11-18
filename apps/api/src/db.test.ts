import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { createPool } from "./db.ts";
import { migrate } from "./migrate.ts";

// Runs only when a test database is available (CI provides one with PostGIS).
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database", () => {
  const pool = createPool(url ?? "");
  beforeAll(async () => {
    await migrate(pool);
  });
  afterAll(async () => {
    await pool.end();
  });

  it("migrations are idempotent", async () => {
    expect(await migrate(pool)).toEqual([]);
  });

  it("serves the seeded categories", async () => {
    const app = buildApp(pool);
    const res = await app.inject({ method: "GET", url: "/v1/categories" });
    expect(res.statusCode).toBe(200);
    const slugs = res.json().categories.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain("shoes");
    await app.close();
  });

  it("finds a shop branch by distance", async () => {
    const { rows } = await pool.query<{ km: number }>(
      `SELECT ST_Distance(
         ST_GeogFromText('POINT(35.8336 31.9978)'),  -- Khalda
         ST_GeogFromText('POINT(35.8628 31.9566)')   -- Sweifieh
       ) / 1000 AS km`,
    );
    expect(rows[0]!.km).toBeGreaterThan(4);
    expect(rows[0]!.km).toBeLessThan(7);
  });
});
