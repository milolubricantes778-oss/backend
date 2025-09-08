const bcrypt = require("bcrypt")
const db = require("../config/database")

// Obtener todos los usuarios (solo admin)
const getUsers = async (req, res) => {
  try {
    // Parseo y validación estricta de los parámetros de paginación
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    let limit = parseInt(req.query.limit, 10)
    if (!Number.isInteger(limit) || limit <= 0) {
      limit = 10
    }
    limit = Math.max(1, Math.min(100, limit)) // entre 1 y 100
    const offset = (page - 1) * limit

    // Forzar tipos seguros
    const limitInt = Number(limit)
    const offsetInt = Number(offset >= 0 ? offset : 0)

    const search = (req.query.search || "").toString().trim()
    const rol = (req.query.rol || "").toString().trim()

    let whereClause = "WHERE 1=1"
    const params = []

    // Filtro por búsqueda (nombre o email)
    if (search) {
      whereClause += " AND (nombre LIKE ? OR email LIKE ?)"
      params.push(`%${search}%`, `%${search}%`)
    }

    // Filtro por rol
    if (rol) {
      whereClause += " AND rol = ?"
      params.push(rol)
    }

    // Construyo la consulta inyectando limit/offset validados (enteros controlados)
    const usersSql = `
      SELECT id, nombre, email, rol, activo, creado_en, ultimo_login
      FROM usuarios
      ${whereClause}
      ORDER BY creado_en DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `

    // Ejecutar consulta de usuarios (params solo para los filtros)
    const [users] = await db.pool.execute(usersSql, params)

    // Consulta para total de registros (usa los mismos params de filtro)
    const countSql = `SELECT COUNT(*) as total FROM usuarios ${whereClause}`
    const [totalResult] = await db.pool.execute(countSql, params)

    const total = totalResult && totalResult[0] ? Number(totalResult[0].total) : 0
    const totalPages = limitInt > 0 ? Math.ceil(total / limitInt) : 0

    return res.json({
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
    // Logueo más informativo en development, y mínimo en producción
    if (process.env.NODE_ENV === "development") {
      console.error("Error al obtener usuarios:", error)
    } else {
      console.error("Error al obtener usuarios:", error.message)
    }

    // Responder con error genérico al cliente
    return res.status(500).json({
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

    return res.status(201).json({
      success: true,
      message: "Usuario creado exitosamente",
      data: newUser[0],
    })
  } catch (error) {
    console.error("Error al crear usuario:", error)
    return res.status(500).json({
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

    // Normalizar activo a 0/1
    const activoValue = activo === undefined ? 1 : activo ? 1 : 0

    // Actualizar usuario
    await db.pool.execute(
      `UPDATE usuarios
       SET nombre = ?, email = ?, rol = ?, activo = ?, actualizado_en = NOW()
       WHERE id = ?`,
      [nombre, email, rol, activoValue, id],
    )

    // Obtener el usuario actualizado
    const [updatedUser] = await db.pool.execute(
      "SELECT id, nombre, email, rol, activo, creado_en, actualizado_en FROM usuarios WHERE id = ?",
      [id],
    )

    return res.json({
      success: true,
      message: "Usuario actualizado exitosamente",
      data: updatedUser[0],
    })
  } catch (error) {
    console.error("Error al actualizar usuario:", error)
    return res.status(500).json({
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
    if (Number.parseInt(id, 10) === req.user.id) {
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

    return res.json({
      success: true,
      message: "Usuario eliminado exitosamente",
    })
  } catch (error) {
    console.error("Error al eliminar usuario:", error)
    return res.status(500).json({
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
