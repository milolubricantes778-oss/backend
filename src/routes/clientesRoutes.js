const express = require("express")
const router = express.Router()
const { verifyToken } = require("../middleware/auth")
const { validateCliente, validateId } = require("../middleware/validation")
const clientesController = require("../controllers/clientesController")

// Todas las rutas requieren autenticación
router.use(verifyToken)

// Rutas de clientes
router.get("/", clientesController.getClientes)

router.get("/:id", validateId, clientesController.getClienteById)

router.post("/", validateCliente, clientesController.createCliente)

router.put("/:id", validateId, validateCliente, clientesController.updateCliente)

router.delete("/:id", validateId, clientesController.deleteCliente)

module.exports = router
