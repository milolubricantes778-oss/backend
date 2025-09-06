const express = require("express")
const router = express.Router()
const usersController = require("../controllers/usersController")
const { verifyToken, verifyAdmin } = require("../middleware/auth") // Cambiando requireAdmin por verifyAdmin
const { validateUser } = require("../middleware/validation")

// Todas las rutas requieren autenticación y rol admin
router.use(verifyToken)
router.use(verifyAdmin) // Usando verifyAdmin en lugar de requireAdmin

// Obtener todos los usuarios
router.get("/", usersController.getUsers)

// Crear usuario
router.post("/", validateUser, usersController.createUser)

// Actualizar usuario
router.put("/:id", validateUser, usersController.updateUser)

// Eliminar usuario
router.delete("/:id", usersController.deleteUser)

module.exports = router
