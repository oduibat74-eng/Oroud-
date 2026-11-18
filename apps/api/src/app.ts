import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import { categoryRoutes } from "./routes/categories.ts";

export function buildApp(pool: pg.Pool): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.get("/health", async () => {
    await pool.query("SELECT 1");
    return { ok: true };
  });

  app.register(categoryRoutes(pool), { prefix: "/v1" });
  return app;
}
