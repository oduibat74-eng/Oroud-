import type { FastifyPluginAsync } from "fastify";
import type pg from "pg";

/** GET /v1/categories: category list in Arabic and English (spec section 11). */
export function categoryRoutes(pool: pg.Pool): FastifyPluginAsync {
  return async (app) => {
    app.get("/categories", async () => {
      const { rows } = await pool.query(
        "SELECT id, slug, name_en, name_ar, parent_id FROM categories ORDER BY id",
      );
      return { categories: rows };
    });
  };
}
