function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see apps/ai/.env.example`);
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5",
};
