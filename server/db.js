require("dotenv").config();
const dns = require("dns");
const { Pool } = require("pg");

dns.setDefaultResultOrder("ipv4first");

const connectionString =
  process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      family: 4,
      ssl:
        process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "elib",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      family: 4,
      ssl:
        process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌  Cannot connect to PostgreSQL/Supabase:", err.message);
    console.error(
      "   Check your .env settings (SUPABASE_DATABASE_URL or DATABASE_URL, or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD)",
    );
    process.exit(1);
  }
  release();
  console.log(
    "✅  Database connected →",
    connectionString ? "Supabase PostgreSQL" : process.env.DB_NAME || "elib",
  );
});

module.exports = pool;
