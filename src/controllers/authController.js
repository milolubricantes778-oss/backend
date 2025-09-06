const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const db = require("../config/database")
const ResponseHelper = require("../utils/responseHelper")

const generateToken = async (user, req) => {
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.rol,
    }, 
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  )

  // Crear hash del token para almacenar en sesiones
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas

  // Guardar sesión en base de datos
  try {
    await db.query( 
      `
      INSERT INTO sesiones (usuario_id, token_hash, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      [user.id, tokenHash, req.ip || req.connection.remoteAddress, req.get("User-Agent") || "Unknown", expiresAt],
    )
  } catch (error) {
    console.error("Error saving session:", error)
  }

  return token
}

const login = ResponseHelper.asyncHandler(async (req, res) => {
  const { email, password } = req.body
 
  // Validar campos requeridos
  if (!email || !password) {
    return ResponseHelper.validationError(res, [
      { field: "email", message: "Email es requerido" },
      { field: "password", message: "Contraseña es requerida" },
    ])
  }

  // Buscar usuario por email
  const users = await db.query("SELECT * FROM usuarios WHERE email = ? AND activo = 1", [email])

  if (users.length === 0) {
    return ResponseHelper.unauthorized(res, "Credenciales inválidas", "INVALID_CREDENTIALS")
  }

  const user = users[0]

  // Verificar contraseña
  const isValidPassword = await bcrypt.compare(password, user.password)
  if (!isValidPassword) {
    return ResponseHelper.unauthorized(res, "Credenciales inválidas", "INVALID_CREDENTIALS")
  }

  // Generar token con sesión
  const token = await generateToken(user, req)

  // Actualizar último login
  await db.query("UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?", [user.id])

  // Preparar respuesta del usuario (sin password)
  const { password: _, rol, ...userWithoutPassword } = user
  const userResponse = {
    ...userWithoutPassword,
    role: rol,
  }

  return ResponseHelper.loginSuccess(res, userResponse, token)
})

const getCurrentUser = ResponseHelper.asyncHandler(async (req, res) => {
  const userId = req.user.id

  const users = await db.query(
    `
    SELECT id, nombre, email, rol as role, activo, creado_en, ultimo_login 
    FROM usuarios WHERE id = ?
  `,
    [userId],
  )

  if (users.length === 0) {
    return ResponseHelper.notFound(res, "Usuario no encontrado", "USER_NOT_FOUND")
  }

  return ResponseHelper.success(res, users[0], "Usuario obtenido exitosamente")
})

const register = ResponseHelper.asyncHandler(async (req, res) => {
  const { nombre, email, password, rol } = req.body

  // Validar campos requeridos
  const validationErrors = []
  if (!nombre) validationErrors.push({ field: "nombre", message: "Nombre es requerido" })
  if (!email) validationErrors.push({ field: "email", message: "Email es requerido" })
  if (!password) validationErrors.push({ field: "password", message: "Contraseña es requerida" })
  if (!rol) validationErrors.push({ field: "rol", message: "Rol es requerido" })

  if (validationErrors.length > 0) {
    return ResponseHelper.validationError(res, validationErrors)
  }

  // Verificar si el email ya existe
  const existingUsers = await db.query("SELECT id FROM usuarios WHERE email = ?", [email])

  if (existingUsers.length > 0) {
    return ResponseHelper.conflict(res, "El email ya está registrado", "EMAIL_ALREADY_EXISTS")
  }

  // Encriptar contraseña
  const saltRounds = 12
  const hashedPassword = await bcrypt.hash(password, saltRounds)

  // Crear usuario
  const result = await db.query(
    `
    INSERT INTO usuarios (nombre, email, password, rol, activo, creado_en) 
    VALUES (?, ?, ?, ?, 1, NOW())
  `,
    [nombre, email, hashedPassword, rol],
  )

  const newUser = {
    id: result.insertId,
    nombre,
    email,
    role: rol,
  }

  return ResponseHelper.created(res, newUser, "Usuario creado exitosamente")
})

const changePassword = ResponseHelper.asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const userId = req.user.id

  // Validar campos requeridos
  const validationErrors = []
  if (!currentPassword) validationErrors.push({ field: "currentPassword", message: "Contraseña actual es requerida" })
  if (!newPassword) validationErrors.push({ field: "newPassword", message: "Nueva contraseña es requerida" })
  if (newPassword && newPassword.length < 6)
    validationErrors.push({ field: "newPassword", message: "La nueva contraseña debe tener al menos 6 caracteres" })

  if (validationErrors.length > 0) {
    return ResponseHelper.validationError(res, validationErrors)
  }

  // Obtener usuario actual
  const users = await db.query("SELECT password FROM usuarios WHERE id = ?", [userId])

  if (users.length === 0) {
    return ResponseHelper.notFound(res, "Usuario no encontrado", "USER_NOT_FOUND")
  }

  // Verificar contraseña actual
  const isValidPassword = await bcrypt.compare(currentPassword, users[0].password)
  if (!isValidPassword) {
    return ResponseHelper.validationError(res, [{ field: "currentPassword", message: "Contraseña actual incorrecta" }])
  }

  // Encriptar nueva contraseña
  const saltRounds = 12
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

  // Actualizar contraseña
  await db.query("UPDATE usuarios SET password = ?, actualizado_en = NOW() WHERE id = ?", [hashedNewPassword, userId])

  return ResponseHelper.success(res, null, "Contraseña actualizada exitosamente")
})

const getProfile = ResponseHelper.asyncHandler(async (req, res) => {
  const userId = req.user.id

  const users = await db.query(
    `
    SELECT id, nombre, email, rol as role, activo, creado_en, ultimo_login 
    FROM usuarios WHERE id = ?
  `,
    [userId],
  )

  if (users.length === 0) {
    return ResponseHelper.notFound(res, "Usuario no encontrado", "USER_NOT_FOUND")
  }

  return ResponseHelper.success(res, users[0], "Perfil obtenido exitosamente")
})

const logout = ResponseHelper.asyncHandler(async (req, res) => {
  const authHeader = req.header("Authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (token) {
    // Invalidar sesión
    const { invalidateSession } = require("../middleware/auth")
    await invalidateSession(token)
  }

  return ResponseHelper.logoutSuccess(res)
})

module.exports = {
  login,
  register,
  changePassword,
  getProfile,
  getCurrentUser,
  logout,
}
