export interface Config {
  port: number;
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.example)");
  return { port: Number(env.PORT ?? 3000), databaseUrl };
}
