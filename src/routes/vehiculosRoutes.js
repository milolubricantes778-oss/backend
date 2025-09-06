const express = require("express")
const router = express.Router()
const vehiculosController = require("../controllers/vehiculosController")
const { verifyToken } = require("../middleware/auth")
const { validateVehiculo, validateId, validateClienteId } = require("../middleware/validation")

// Aplicar autenticación a todas las rutas
router.use(verifyToken)

// Rutas específicas primero (antes de /:id)
router.get(
  "/cliente/:clienteId",
  (req, res, next) => {
    console.log("[v0] Ruta /cliente/:clienteId llamada con:", req.params.clienteId)
    next()
  },
  validateClienteId,
  vehiculosController.getVehiculosByCliente,
)

// Rutas CRUD generales
router.get("/", vehiculosController.getVehiculos)
router.post("/", validateVehiculo, vehiculosController.createVehiculo)

// Rutas con :id al final para evitar conflictos
router.get("/:id", validateId, vehiculosController.getVehiculoById)
router.put("/:id", validateId, validateVehiculo, vehiculosController.updateVehiculo)
router.delete("/:id", validateId, vehiculosController.deleteVehiculo)
router.patch("/:id/kilometraje", validateId, vehiculosController.actualizarKilometraje)

module.exports = router
