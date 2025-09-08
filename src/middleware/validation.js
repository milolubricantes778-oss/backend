const { body, param, query, validationResult } = require("express-validator")
const ResponseHelper = require("../utils/responseHelper")

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }))
    return ResponseHelper.validationError(res, formattedErrors)
  }
  next()
}

const validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email demasiado largo"),
  body("password").isLength({ min: 1 }).withMessage("La contraseña es requerida"),
  handleValidationErrors,
]

const validateRegister = [
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El nombre solo puede contener letras y espacios"),
  body("email")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email demasiado largo"),
  body("password").isLength({ min: 6, max: 50 }).withMessage("La contraseña debe tener entre 6 y 50 caracteres"),
  body("rol").isIn(["ADMIN", "EMPLEADO"]).withMessage("El rol debe ser ADMIN o EMPLEADO"),
  handleValidationErrors,
]

const validateChangePassword = [
  body("currentPassword").isLength({ min: 1 }).withMessage("Contraseña actual es requerida"),
  body("newPassword")
    .isLength({ min: 6, max: 50 })
    .withMessage("La nueva contraseña debe tener entre 6 y 50 caracteres"),
  handleValidationErrors,
]

const validateCliente = [
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El nombre solo puede contener letras y espacios"),
  body("apellido")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El apellido debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El apellido solo puede contener letras y espacios"),
  body("dni")
    .optional()
    .isLength({ min: 7, max: 8 })
    .withMessage("DNI debe tener 7 u 8 dígitos")
    .isNumeric()
    .withMessage("DNI debe contener solo números")
    .custom((value) => {
      if (value && (value.length < 7 || value.length > 8)) {
        throw new Error("DNI debe tener 7 u 8 dígitos")
      }
      return true
    }),
  body("direccion")
    .optional()
    .isLength({ min: 5, max: 255 })
    .withMessage("La dirección debe tener entre 5 y 255 caracteres"),
  handleValidationErrors,
]

const validateVehiculo = [
  body("patente")
    .trim()
    .toUpperCase()
    .isLength({ min: 3, max: 10 })
    .withMessage("La patente debe tener entre 3 y 10 caracteres")
    .matches(/^[A-Z0-9]+$/)
    .withMessage("La patente solo puede contener letras y números"),
  body("marca").trim().isLength({ min: 2, max: 50 }).withMessage("La marca debe tener entre 2 y 50 caracteres"),
  body("modelo")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("El modelo debe tener entre 2 y 50 caracteres")
    .matches(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-.]+$/)
    .withMessage("El modelo contiene caracteres inválidos"),
  body("año")
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage(`El año debe estar entre 1900 y ${new Date().getFullYear() + 1}`),
  body("clienteId").isInt({ min: 1 }).withMessage("ID de cliente inválido"),
  body("kilometraje")
    .isInt({ min: 0, max: 9999999 })
    .withMessage("El kilometraje debe ser un número entero entre 0 y 9,999,999"),
  body("observaciones")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Las observaciones no pueden tener más de 1000 caracteres"),
  handleValidationErrors,
]

const validateUser = [
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El nombre solo puede contener letras y espacios"),
  body("email")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage("Email demasiado largo"),
  body("password")
    .optional()
    .isLength({ min: 6, max: 50 })
    .withMessage("La contraseña debe tener entre 6 y 50 caracteres"),
  body("rol").isIn(["ADMIN", "EMPLEADO"]).withMessage("El rol debe ser ADMIN o EMPLEADO"),
  handleValidationErrors,
]

const validateServicio = [
  body("cliente_id").isInt({ min: 1 }).withMessage("ID de cliente inválido"),
  body("vehiculo_id").isInt({ min: 1 }).withMessage("ID de vehículo inválido"),
  body("sucursal_id").isInt({ min: 1 }).withMessage("ID de sucursal inválido"),
  body("empleados")
    .optional()
    .isArray()
    .withMessage("Los empleados deben ser un array")
    .custom((empleados) => {
      if (empleados && empleados.length > 0) {
        for (const empleadoId of empleados) {
          if (!Number.isInteger(empleadoId) || empleadoId < 1) {
            throw new Error("Todos los IDs de empleados deben ser números enteros positivos")
          }
        }
      }
      return true
    }),
  body("observaciones")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Las observaciones no pueden tener más de 1000 caracteres"),
  body("precio_referencia")
    .optional()
    .isFloat({ min: 0, max: 999999.99 })
    .withMessage("El precio de referencia debe ser un número positivo menor a $999,999.99"),
  body("items").isArray({ min: 1 }).withMessage("Debe incluir al menos un item"),
  body("items.*.tipo_servicio_id").isInt({ min: 1 }).withMessage("ID de tipo de servicio inválido"),
  body("items.*.observaciones")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Las observaciones del item no pueden tener más de 500 caracteres"),
  body("items.*.notas")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Las notas del item no pueden tener más de 500 caracteres"),
  handleValidationErrors,
]

const validateConfiguracion = [
  body("categoria")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("La categoría debe tener entre 2 y 50 caracteres")
    .matches(/^[a-zA-Z_]+$/)
    .withMessage("La categoría solo puede contener letras y guiones bajos"),
  body("clave")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("La clave debe tener entre 2 y 50 caracteres")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("La clave solo puede contener letras, números y guiones bajos"),
  body("valor").trim().isLength({ min: 1, max: 1000 }).withMessage("El valor debe tener entre 1 y 1000 caracteres"),
  body("tipo")
    .isIn(["string", "number", "boolean", "json"])
    .withMessage("Tipo debe ser string, number, boolean o json"),
  body("descripcion")
    .optional()
    .isLength({ max: 200 })
    .withMessage("La descripción no puede tener más de 200 caracteres"),
  handleValidationErrors,
]

const validateConfiguracionUpdate = [
  body("configuraciones").isArray({ min: 1 }).withMessage("Debe proporcionar al menos una configuración"),
  body("configuraciones.*.categoria")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("La categoría debe tener entre 2 y 50 caracteres"),
  body("configuraciones.*.clave")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("La clave debe tener entre 2 y 50 caracteres"),
  body("configuraciones.*.valor")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("El valor debe tener entre 1 y 1000 caracteres"),
  body("configuraciones.*.tipo")
    .isIn(["string", "number", "boolean", "json"])
    .withMessage("Tipo debe ser string, number, boolean o json"),
  handleValidationErrors,
]

const validateId = [
  param("id").isInt({ min: 1 }).withMessage("ID debe ser un número entero positivo"),
  handleValidationErrors,
]

const validateClienteId = [
  param("clienteId")
    .isInt({ min: 1 })
    .withMessage("ID de cliente debe ser un número entero positivo")
    .toInt(), // Convertir a entero automáticamente
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((error) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
      }))
      return res.status(400).json({
        error: "Datos de entrada inválidos",
        details: formattedErrors,
      })
    }
    next()
  },
]

const validatePagination = [
  query("page").optional().isInt({ min: 1, max: 10000 }).withMessage("Página debe ser un número entre 1 y 10,000"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Límite debe ser un número entre 1 y 100"),
  query("search").optional().isLength({ max: 100 }).withMessage("Búsqueda no puede tener más de 100 caracteres"),
  handleValidationErrors,
]

const validateDateRange = [
  query("fecha_desde").optional().isISO8601().withMessage("Fecha desde debe ser una fecha válida (YYYY-MM-DD)"),
  query("fecha_hasta").optional().isISO8601().withMessage("Fecha hasta debe ser una fecha válida (YYYY-MM-DD)"),
  handleValidationErrors,
]

const validateExists = (table, field = "id") => {
  return async (req, res, next) => {
    try {
      const db = require("../config/database")
      const value = req.body[field] || req.params[field]

      if (!value) {
        return next()
      }

      const query = `SELECT id FROM ${table} WHERE ${field} = ? AND activo = 1`
      const results = await db.query(query, [value])

      if (results.length === 0) {
        return ResponseHelper.notFound(res, `${table} no encontrado`, "RESOURCE_NOT_FOUND")
      }

      next()
    } catch (error) {
      console.error(`Error validating ${table} existence:`, error)
      return ResponseHelper.error(res, "Error de validación", 500, "VALIDATION_ERROR", error)
    }
  }
}

const validateTipoServicio = [
  (req, res, next) => {
    next()
  },
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-.]+$/)
    .withMessage("El nombre contiene caracteres inválidos"),
  body("descripcion")
    .optional()
    .isLength({ max: 500 })
    .withMessage("La descripción no puede tener más de 500 caracteres"),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((error) => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value,
      }))
      return ResponseHelper.validationError(res, formattedErrors)
    }
    next()
  },
]

const validateEmpleado = [
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El nombre solo puede contener letras y espacios"),
  body("apellido")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El apellido debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El apellido solo puede contener letras y espacios"),
  body("cargo").optional().isLength({ max: 100 }).withMessage("El cargo no puede tener más de 100 caracteres"),
  body("sucursal_id").isInt({ min: 1 }).withMessage("ID de sucursal inválido"),
  handleValidationErrors,
]

const validateEmpleadoUpdate = [
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El nombre solo puede contener letras y espacios"),
  body("apellido")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El apellido debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage("El apellido solo puede contener letras y espacios"),
  body("telefono")
    .optional()
    .matches(/^(\+54\s?)?(\d{2,4}\s?)?\d{6,8}$/)
    .withMessage("Formato de teléfono argentino inválido (ej: +54 11 1234-5678)"),
  body("cargo").optional().isLength({ max: 100 }).withMessage("El cargo no puede tener más de 100 caracteres"),
  body("sucursal_id").isInt({ min: 1 }).withMessage("ID de sucursal inválido"),
  body("activo").isBoolean().withMessage("El estado activo debe ser verdadero o falso"),
  handleValidationErrors,
]

const validateSucursal = [
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-.]+$/)
    .withMessage("El nombre contiene caracteres inválidos"),
  body("ubicacion").optional().isLength({ max: 255 }).withMessage("La ubicación no puede tener más de 255 caracteres"),
  handleValidationErrors,
]

const validateSucursalUpdate = [
  body("nombre")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-.]+$/)
    .withMessage("El nombre contiene caracteres inválidos"),
  body("ubicacion").optional().isLength({ max: 255 }).withMessage("La ubicación no puede tener más de 255 caracteres"),
  body("activo").isBoolean().withMessage("El estado activo debe ser verdadero o falso"),
  handleValidationErrors,
]

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateRegister,
  validateChangePassword,
  validateCliente,
  validateVehiculo,
  validateUser,
  validateId,
  validateClienteId,
  validateServicio,
  validateConfiguracion,
  validateConfiguracionUpdate,
  validatePagination,
  validateDateRange,
  validateExists,
  validateTipoServicio,
  validateEmpleado,
  validateEmpleadoUpdate,
  validateSucursal,
  validateSucursalUpdate,
}
