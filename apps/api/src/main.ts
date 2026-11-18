import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createPool } from "./db.ts";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const app = buildApp(pool);

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
