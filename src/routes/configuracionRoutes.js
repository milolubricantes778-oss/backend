const express = require("express")
const router = express.Router()
const configuracionController = require("../controllers/configuracionController")
const { authenticateToken, requireAdmin } = require("../middleware/auth")
const { validateConfiguracion, validateConfiguracionUpdate } = require("../middleware/validation")

// Todas las rutas requieren autenticación
router.use(authenticateToken)

// Obtener toda la configuración (solo admin)
router.get("/", requireAdmin, configuracionController.getConfiguracion)

// Obtener configuración por categoría (solo admin)
router.get("/categoria/:categoria", requireAdmin, configuracionController.getConfiguracionPorCategoria)

// Crear nueva configuración (solo admin)
router.post("/", requireAdmin, validateConfiguracion, configuracionController.createConfiguracion)

// Actualizar configuración (solo admin)
router.put("/", requireAdmin, validateConfiguracionUpdate, configuracionController.updateConfiguracion)

// Eliminar configuración (solo admin)
router.delete("/:id", requireAdmin, configuracionController.deleteConfiguracion)

module.exports = router
 