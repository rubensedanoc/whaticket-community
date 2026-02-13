require("../bootstrap");

// Soporte para DATABASE_URL (Render, Heroku, etc.)
let config;

if (process.env.DATABASE_URL) {
  config = {
    use_env_variable: "DATABASE_URL",
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_bin"
    },
    dialect: process.env.DB_DIALECT || "postgres",
    dialectOptions: {
      ssl: process.env.DB_SSL === "true" ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    timezone: "-03:00",
    logging: false
  };
} else {
  config = {
    define: {
      charset: "utf8mb4",
      collate: "utf8mb4_bin"
    },
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: "-03:00",
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    logging: false
  };
}

module.exports = config;
