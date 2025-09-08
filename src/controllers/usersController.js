const bcrypt = require("bcrypt")
const db = require("../config/database")

// Obtener todos los usuarios (solo admin)
const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10))
    const search = req.query.search || ""
    const rol = req.query.rol || ""
    const offset = (page - 1) * limit

    // Forzar a que sean enteros antes de pasarlos a MySQL
    const limitInt = Number(limit)
    const offsetInt = Number(offset)

    let whereClause = "WHERE 1=1"
    const params = []

    // Filtro por búsqueda
    if (search) {
      whereClause += " AND (nombre LIKE ? OR email LIKE ?)"
      params.push(`%${search}%`, `%${search}%`)
    }

    // Filtro por rol
    if (rol) {
      whereClause += " AND rol = ?"
      params.push(rol)
    }

    // Obtener usuarios con paginación
    const [users] = await db.pool.execute(
      `SELECT id, nombre, email, rol, activo, creado_en, ultimo_login 
       FROM usuarios ${whereClause} 
       ORDER BY creado_en DESC 
       LIMIT ? OFFSET ?`,
      [...params, limitInt, offsetInt],
    )

    // Obtener total de registros
    const [totalResult] = await db.pool.execute(`SELECT COUNT(*) as total FROM usuarios ${whereClause}`, params)

    const total = totalResult[0].total
    const totalPages = Math.ceil(total / limitInt)

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limitInt,
        },
      },
    })
  } catch (error) {
    console.error("Error al obtener usuarios:", error)
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    })
  }
}

// Crear usuario (solo admin)
const createUser = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body

    // Validar campos requeridos
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son requeridos",
      })
    }

    // Verificar si el email ya existe
    const [existingUsers] = await db.pool.execute("SELECT id FROM usuarios WHERE email = ?", [email])

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El email ya está registrado",
      })
    }

    // Encriptar contraseña
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Crear usuario
    const [result] = await db.pool.execute(
      `INSERT INTO usuarios (nombre, email, password, rol, activo, creado_en) 
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [nombre, email, hashedPassword, rol],
    )

    // Obtener el usuario creado
    const [newUser] = await db.pool.execute(
      "SELECT id, nombre, email, rol, activo, creado_en FROM usuarios WHERE id = ?",
      [result.insertId],
    )

    res.status(201).json({
      success: true,
      message: "Usuario creado exitosamente",
      data: newUser[0],
    })
  } catch (error) {
    console.error("Error al crear usuario:", error)
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    })
  }
}

// Actualizar usuario (solo admin)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { nombre, email, rol, activo } = req.body

    // Validar campos requeridos
    if (!nombre || !email || !rol) {
      return res.status(400).json({
        success: false,
        message: "Nombre, email y rol son requeridos",
      })
    }

    // Verificar si el usuario existe
    const [existingUsers] = await db.pool.execute("SELECT id FROM usuarios WHERE id = ?", [id])

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      })
    }

    // Verificar si el email ya existe en otro usuario
    const [emailCheck] = await db.pool.execute("SELECT id FROM usuarios WHERE email = ? AND id != ?", [email, id])

    if (emailCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: "El email ya está registrado por otro usuario",
      })
    }

    // Actualizar usuario
    await db.pool.execute(
      `UPDATE usuarios 
       SET nombre = ?, email = ?, rol = ?, activo = ?, actualizado_en = NOW() 
       WHERE id = ?`,
      [nombre, email, rol, activo !== undefined ? activo : 1, id],
    )

    // Obtener el usuario actualizado
    const [updatedUser] = await db.pool.execute(
      "SELECT id, nombre, email, rol, activo, creado_en, actualizado_en FROM usuarios WHERE id = ?",
      [id],
    )

    res.json({
      success: true,
      message: "Usuario actualizado exitosamente",
      data: updatedUser[0],
    })
  } catch (error) {
    console.error("Error al actualizar usuario:", error)
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    })
  }
}

// Eliminar usuario (solo admin)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    // No permitir eliminar al usuario actual
    if (Number.parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "No puedes eliminar tu propio usuario",
      })
    }

    // Verificar si el usuario existe
    const [existingUsers] = await db.pool.execute("SELECT id FROM usuarios WHERE id = ?", [id])

    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      })
    }

    // Soft delete - marcar como inactivo
    await db.pool.execute("UPDATE usuarios SET activo = 0, actualizado_en = NOW() WHERE id = ?", [id])

    res.json({
      success: true,
      message: "Usuario eliminado exitosamente",
    })
  } catch (error) {
    console.error("Error al eliminar usuario:", error)
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    })
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
}
