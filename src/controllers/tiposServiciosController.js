const db = require("../config/database")
const ResponseHelper = require("../utils/responseHelper")

const tiposServiciosController = {
  // Obtener todos los tipos de servicios
  getTiposServicios: async (req, res) => {
    try {
      const { page = 1, limit = 50, search = "" } = req.query
      const offset = (page - 1) * limit

      let query = `SELECT * FROM tipos_servicios WHERE activo = true`
      let countQuery = "SELECT COUNT(*) as total FROM tipos_servicios WHERE activo = true"
      const queryParams = []
      const countParams = []

      // Filtro de búsqueda
      if (search) {
        query += " AND (nombre LIKE ? OR descripcion LIKE ?)"
        countQuery += " AND (nombre LIKE ? OR descripcion LIKE ?)"
        const searchParam = `%${search}%`
        queryParams.push(searchParam, searchParam)
        countParams.push(searchParam, searchParam)
      }

      query += " ORDER BY nombre ASC LIMIT ? OFFSET ?"
      queryParams.push(Number.parseInt(limit), Number.parseInt(offset))

      const [tiposServicios] = await db.pool.execute(query, queryParams)
      const [countResult] = await db.pool.execute(countQuery, countParams)
      const total = countResult[0].total

      return ResponseHelper.successWithPagination(
        res,
        tiposServicios,
        { page, limit, total },
        "Tipos de servicios obtenidos exitosamente",
      )
    } catch (error) {
      console.error("Error al obtener tipos de servicios:", error)
      return ResponseHelper.error(res, "Error al obtener tipos de servicios", 500)
    }
  },

  // Obtener tipo de servicio por ID
  getTipoServicioById: async (req, res) => {
    try {
      const { id } = req.params
      const [tiposServicios] = await db.pool.execute("SELECT * FROM tipos_servicios WHERE id = ? AND activo = true", [
        id,
      ])

      if (tiposServicios.length === 0) {
        return ResponseHelper.notFound(res, "Tipo de servicio no encontrado")
      }

      return ResponseHelper.success(res, tiposServicios[0], "Tipo de servicio obtenido exitosamente")
    } catch (error) {
      console.error("Error al obtener tipo de servicio:", error)
      return ResponseHelper.error(res, "Error al obtener tipo de servicio", 500)
    }
  },

  // Crear nuevo tipo de servicio
  createTipoServicio: async (req, res) => {
    try {
      const { nombre, descripcion } = req.body

      if (!nombre || nombre.trim().length === 0) {
        return ResponseHelper.validationError(res, "El nombre es requerido")
      }

      // Verificar si ya existe un tipo de servicio con el mismo nombre
      const [existing] = await db.pool.execute("SELECT id FROM tipos_servicios WHERE nombre = ? AND activo = true", [
        nombre,
      ])


      if (existing.length > 0) {
        return ResponseHelper.conflict(res, "Ya existe un tipo de servicio con ese nombre")
      }

      const [result] = await db.pool.execute(
        "INSERT INTO tipos_servicios (nombre, descripcion, activo) VALUES (?, ?, true)",
        [nombre, descripcion || null],
      )

      const [newTipoServicio] = await db.pool.execute("SELECT * FROM tipos_servicios WHERE id = ?", [result.insertId])

      return ResponseHelper.created(res, newTipoServicio[0], "Tipo de servicio creado exitosamente")
    } catch (error) {
      console.error("[v0] Error en createTipoServicio:", error)
      console.error("Error al crear tipo de servicio:", error)
      return ResponseHelper.error(res, "Error al crear tipo de servicio", 500)
    }
  },

  // Actualizar tipo de servicio
  updateTipoServicio: async (req, res) => {
    try {
      const { id } = req.params
      const { nombre, descripcion } = req.body

      // Verificar si el tipo de servicio existe
      const [existing] = await db.pool.execute("SELECT id FROM tipos_servicios WHERE id = ? AND activo = true", [id])
      if (existing.length === 0) {
        return ResponseHelper.notFound(res, "Tipo de servicio no encontrado")
      }

      // Verificar si ya existe otro tipo de servicio con el mismo nombre
      const [duplicate] = await db.pool.execute(
        "SELECT id FROM tipos_servicios WHERE nombre = ? AND id != ? AND activo = true",
        [nombre, id],
      )
      if (duplicate.length > 0) {
        return ResponseHelper.conflict(res, "Ya existe otro tipo de servicio con ese nombre")
      }

      await db.pool.execute("UPDATE tipos_servicios SET nombre = ?, descripcion = ? WHERE id = ?", [
        nombre,
        descripcion,
        id,
      ])

      const [updatedTipoServicio] = await db.pool.execute("SELECT * FROM tipos_servicios WHERE id = ?", [id])

      return ResponseHelper.updated(res, updatedTipoServicio[0], "Tipo de servicio actualizado exitosamente")
    } catch (error) {
      console.error("Error al actualizar tipo de servicio:", error)
      return ResponseHelper.error(res, "Error al actualizar tipo de servicio", 500)
    }
  },

  // Eliminar tipo de servicio (soft delete)
  deleteTipoServicio: async (req, res) => {
    try {
      const { id } = req.params

      // Verificar si el tipo de servicio existe
      const [existing] = await db.pool.execute("SELECT id FROM tipos_servicios WHERE id = ? AND activo = true", [id])
      if (existing.length === 0) {
        return ResponseHelper.notFound(res, "Tipo de servicio no encontrado")
      }

      // Verificar si el tipo de servicio está siendo usado en servicios
      const [serviciosUsando] = await db.pool.execute(
        "SELECT COUNT(*) as count FROM servicio_items WHERE tipo_servicio_id = ?",
        [id],
      )
      if (serviciosUsando[0].count > 0) {
        return ResponseHelper.validationError(
          res,
          "No se puede eliminar el tipo de servicio porque está siendo usado en servicios",
        )
      }

      await db.pool.execute("UPDATE tipos_servicios SET activo = false WHERE id = ?", [id])

      return ResponseHelper.deleted(res, "Tipo de servicio eliminado correctamente")
    } catch (error) {
      console.error("Error al eliminar tipo de servicio:", error)
      return ResponseHelper.error(res, "Error al eliminar tipo de servicio", 500)
    }
  },

  // Buscar tipos de servicios
  searchTiposServicios: async (req, res) => {
    try {
      const { q = "" } = req.query

      let query = `SELECT * FROM tipos_servicios WHERE activo = true`
      const queryParams = []

      if (q) {
        query += " AND (nombre LIKE ? OR descripcion LIKE ?)"
        const searchParam = `%${q}%`
        queryParams.push(searchParam, searchParam)
      }

      query += " ORDER BY nombre ASC LIMIT 20"

      const [tiposServicios] = await db.pool.execute(query, queryParams)
      return ResponseHelper.success(res, tiposServicios, "Búsqueda de tipos de servicios exitosa")
    } catch (error) {
      console.error("Error al buscar tipos de servicios:", error)
      return ResponseHelper.error(res, "Error al buscar tipos de servicios", 500)
    }
  },
}

module.exports = tiposServiciosController
