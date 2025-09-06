const joi = require("joi")

const envSchema = joi
  .object({
    NODE_ENV: joi.string().valid("development", "production", "test").default("development"),
    PORT: joi.number().port().default(5000),

    // Database configuration - support both individual vars and connection string
    DATABASE_URL: joi.string().uri().optional(),
    DB_HOST: joi.string().when("DATABASE_URL", { is: joi.exist(), then: joi.optional(), otherwise: joi.required() }),
    DB_USER: joi.string().when("DATABASE_URL", { is: joi.exist(), then: joi.optional(), otherwise: joi.required() }),
    DB_PASSWORD: joi
      .string()
      .allow("")
      .when("DATABASE_URL", { is: joi.exist(), then: joi.optional(), otherwise: joi.optional() }),
    DB_NAME: joi.string().when("DATABASE_URL", { is: joi.exist(), then: joi.optional(), otherwise: joi.required() }),
    DB_PORT: joi.number().port().default(3306),
    DB_CONNECTION_LIMIT: joi.number().min(1).max(100).default(10),
    DB_SSL: joi.boolean().default(false),

    // Security - JWT_SECRET is critical
    JWT_SECRET: joi.string().min(32).required().messages({
      "string.min": "JWT_SECRET must be at least 32 characters long",
      "any.required": "JWT_SECRET is required for authentication",
    }),

    // CORS configuration
    FRONTEND_URL: joi.string().uri().default("http://localhost:3000"),

    // Optional
    npm_package_version: joi.string().default("1.0.0"),
  })
  .unknown(true) // Allow other env vars

const validateEnv = () => {
  console.log("[ENV] Starting environment validation...")
  console.log("[ENV] NODE_ENV:", process.env.NODE_ENV)
  console.log("[ENV] PORT:", process.env.PORT)
  console.log("[ENV] DATABASE_URL exists:", !!process.env.DATABASE_URL)
  console.log("[ENV] JWT_SECRET exists:", !!process.env.JWT_SECRET)
  console.log("[ENV] JWT_SECRET length:", process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0)

  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false,
  })

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message)
    console.error("[ENV] Validation failed with errors:")
    errorMessages.forEach((msg, index) => {
      console.error(`[ENV] Error ${index + 1}: ${msg}`)
    })

    console.error("[ENV] Available environment variables:")
    Object.keys(process.env).forEach((key) => {
      if (
        key.includes("DB_") ||
        key.includes("JWT") ||
        key === "DATABASE_URL" ||
        key === "NODE_ENV" ||
        key === "PORT"
      ) {
        console.error(
          `[ENV] ${key}: ${key.includes("SECRET") || key.includes("PASSWORD") ? "[HIDDEN]" : process.env[key]}`,
        )
      }
    })

    throw new Error(`Environment validation failed:\n${errorMessages.join("\n")}`)
  }

  console.log("[ENV] Environment validation successful!")
  return value
}

module.exports = { validateEnv }
