const express = require("express")
const router = express.Router()
const empleadosController = require("../controllers/empleadosController")
const { validateEmpleado, validateEmpleadoUpdate } = require("../middleware/validation")
const { verifyToken } = require("../middleware/auth")

// Aplicar autenticación a todas las rutas
router.use(verifyToken)

// Rutas para empleados
router.get("/", empleadosController.getEmpleados)
router.get("/activos", empleadosController.getEmpleadosActivos)
router.get("/sucursal/:sucursalId", empleadosController.getEmpleadosBySucursal)
router.get("/:id", empleadosController.getEmpleadoById)
router.post("/", validateEmpleado, empleadosController.createEmpleado)
router.put("/:id", validateEmpleadoUpdate, empleadosController.updateEmpleado)
router.delete("/:id", empleadosController.deleteEmpleado)

module.exports = router
