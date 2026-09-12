function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see apps/ai/.env.example`);
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  geminiApiKey: required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL || "gemini-flash-latest",
};
