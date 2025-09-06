const express = require("express")
const router = express.Router()
const sucursalesController = require("../controllers/sucursalesController")
const { validateSucursal, validateSucursalUpdate } = require("../middleware/validation")
const { verifyToken } = require("../middleware/auth")

// Aplicar autenticación a todas las rutas
router.use(verifyToken)

// Rutas para sucursales
router.get("/", sucursalesController.getSucursales)
router.get("/activas", sucursalesController.getSucursalesActivas)
router.get("/:id", sucursalesController.getSucursalById)
router.post("/", validateSucursal, sucursalesController.createSucursal)
router.put("/:id", validateSucursalUpdate, sucursalesController.updateSucursal)
router.delete("/:id", sucursalesController.deleteSucursal)

module.exports = router
