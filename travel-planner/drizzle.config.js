module.exports = {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: "postgresql://postgres.ehlmqaevdgyxglbtaluh:55JtmksAxAECk0Sg@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require"
  }
};