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
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false,
  })

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message)
    throw new Error(`Environment validation failed:\n${errorMessages.join("\n")}`)
  }

  return value
}

module.exports = { validateEnv }
