const express = require("express")
const router = express.Router()
const tiposServiciosController = require("../controllers/tiposServiciosController")
const { verifyToken } = require("../middleware/auth")
const { validateTipoServicio } = require("../middleware/validation")

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken)

// Rutas para tipos de servicios
router.get("/", tiposServiciosController.getTiposServicios)
router.get("/search", tiposServiciosController.searchTiposServicios)
router.get("/:id", tiposServiciosController.getTipoServicioById)
router.post("/", validateTipoServicio, tiposServiciosController.createTipoServicio)
router.put("/:id", validateTipoServicio, tiposServiciosController.updateTipoServicio)
router.delete("/:id", tiposServiciosController.deleteTipoServicio)

module.exports = router
