const db = require("../config/database")
const { validationResult } = require("express-validator")
const responseHelper = require("../utils/responseHelper")

const sucursalesController = {
  // Obtener todas las sucursales con paginación y filtros
  async getSucursales(req, res) {
    try {
      const { page = 1, limit = 10, search = "", activo } = req.query
      const offset = (page - 1) * limit

      let whereClause = "WHERE 1=1"
      const queryParams = []

      if (search) {
        whereClause += " AND (s.nombre LIKE ? OR s.ubicacion LIKE ?)"
        const searchTerm = `%${search}%`
        queryParams.push(searchTerm, searchTerm)
      }

      // Filtro por estado activo
      if (activo !== undefined) {
        whereClause += " AND s.activo = ?"
        queryParams.push(activo === "true" ? 1 : 0)
      }

      const sucursalesQuery = `
        SELECT 
          s.id,
          s.nombre,
          s.ubicacion,
          s.activo,
          s.created_at,
          s.updated_at,
          COUNT(serv.id) as total_servicios,
          COUNT(emp.id) as total_empleados
        FROM sucursales s
        LEFT JOIN servicios serv ON s.id = serv.sucursal_id AND serv.activo = 1
        LEFT JOIN empleados emp ON s.id = emp.sucursal_id AND emp.activo = 1
        ${whereClause}
        GROUP BY s.id
        ORDER BY s.nombre ASC
        LIMIT ? OFFSET ?
      `

      // Consulta para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM sucursales s
        ${whereClause}
      `

      const [sucursales] = await db.pool.execute(sucursalesQuery, [
        ...queryParams,
        Number.parseInt(limit),
        Number.parseInt(offset),
      ])
      const [countResult] = await db.pool.execute(countQuery, queryParams)
      const total = countResult[0].total
      const totalPages = Math.ceil(total / limit)

      res.json({
        success: true,
        data: {
          sucursales,
          pagination: {
            currentPage: Number.parseInt(page),
            totalPages,
            totalItems: total,
            itemsPerPage: Number.parseInt(limit),
          },
        },
      })
    } catch (error) {
      console.error("Error al obtener sucursales:", error)
      res.status(500).json(responseHelper.error("Error interno del servidor"))
    }
  },

  // Obtener sucursal por ID
  async getSucursalById(req, res) {
    try {
      const { id } = req.params

      const query = `
        SELECT 
          s.id,
          s.nombre,
          s.ubicacion,
          s.activo,
          s.created_at,
          s.updated_at,
          COUNT(serv.id) as total_servicios,
          COUNT(emp.id) as total_empleados
        FROM sucursales s
        LEFT JOIN servicios serv ON s.id = serv.sucursal_id AND serv.activo = 1
        LEFT JOIN empleados emp ON s.id = emp.sucursal_id AND emp.activo = 1
        WHERE s.id = ?
        GROUP BY s.id
      `

      const [sucursales] = await db.pool.execute(query, [id])

      if (sucursales.length === 0) {
        return res.status(404).json(responseHelper.error("Sucursal no encontrada"))
      }

      responseHelper.success(res, sucursales[0])
    } catch (error) {
      console.error("Error al obtener sucursal:", error)
      res.status(500).json(responseHelper.error("Error interno del servidor"))
    }
  },

  // Crear nueva sucursal
  async createSucursal(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json(responseHelper.error("Datos inválidos", errors.array()))
      }

      const { nombre, ubicacion } = req.body

      // Verificar si ya existe una sucursal con el mismo nombre
      const [existingSucursal] = await db.pool.execute("SELECT id FROM sucursales WHERE nombre = ? AND activo = 1", [
        nombre,
      ])

      if (existingSucursal.length > 0) {
        return res.status(400).json(responseHelper.error("Ya existe una sucursal con este nombre"))
      }

      const query = `
        INSERT INTO sucursales (nombre, ubicacion, activo)
        VALUES (?, ?, 1)
      `

      const [result] = await db.pool.execute(query, [nombre, ubicacion || null])

      responseHelper.success(
        res,
        {
          id: result.insertId,
          nombre,
          ubicacion,
          activo: true,
        },
        "Sucursal creada exitosamente",
        201,
      )
    } catch (error) {
      console.error("Error al crear sucursal:", error)
      res.status(500).json(responseHelper.error("Error interno del servidor"))
    }
  },

  // Actualizar sucursal
  async updateSucursal(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json(responseHelper.error("Datos inválidos", errors.array()))
      }

      const { id } = req.params
      const { nombre, ubicacion, activo } = req.body

      // Verificar si la sucursal existe
      const [existingSucursal] = await db.pool.execute("SELECT id FROM sucursales WHERE id = ?", [id])

      if (existingSucursal.length === 0) {
        return res.status(404).json(responseHelper.error("Sucursal no encontrada"))
      }

      // Verificar si ya existe otra sucursal con el mismo nombre
      const [nameCheck] = await db.pool.execute(
        "SELECT id FROM sucursales WHERE nombre = ? AND id != ? AND activo = 1",
        [nombre, id],
      )

      if (nameCheck.length > 0) {
        return res.status(400).json(responseHelper.error("Ya existe otra sucursal con este nombre"))
      }

      const query = `
        UPDATE sucursales 
        SET nombre = ?, ubicacion = ?, activo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `

      await db.pool.execute(query, [nombre, ubicacion || null, activo, id])

      responseHelper.success(
        res,
        {
          id: Number.parseInt(id),
          nombre,
          ubicacion,
          activo,
        },
        "Sucursal actualizada exitosamente",
      )
    } catch (error) {
      console.error("Error al actualizar sucursal:", error)
      res.status(500).json(responseHelper.error("Error interno del servidor"))
    }
  },

  // Eliminar sucursal (soft delete)
  async deleteSucursal(req, res) {
    try {
      const { id } = req.params

      // Verificar si la sucursal existe
      const [existingSucursal] = await db.pool.execute("SELECT id FROM sucursales WHERE id = ? AND activo = 1", [id])

      if (existingSucursal.length === 0) {
        return res.status(404).json(responseHelper.error("Sucursal no encontrada"))
      }

      // Verificar si la sucursal tiene servicios asociados
      const [serviciosAsociados] = await db.pool.execute(
        "SELECT COUNT(*) as count FROM servicios WHERE sucursal_id = ? AND activo = 1",
        [id],
      )

      if (serviciosAsociados[0].count > 0) {
        return res
          .status(400)
          .json(responseHelper.error("No se puede eliminar la sucursal porque tiene servicios asociados"))
      }

      const [empleadosAsociados] = await db.pool.execute(
        "SELECT COUNT(*) as count FROM empleados WHERE sucursal_id = ? AND activo = 1",
        [id],
      )

      if (empleadosAsociados[0].count > 0) {
        return res
          .status(400)
          .json(responseHelper.error("No se puede eliminar la sucursal porque tiene empleados asociados"))
      }

      // Soft delete
      await db.pool.execute("UPDATE sucursales SET activo = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id])

      responseHelper.success(res, null, "Sucursal eliminada exitosamente")
    } catch (error) {
      console.error("Error al eliminar sucursal:", error)
      res.status(500).json(responseHelper.error("Error interno del servidor"))
    }
  },

  // Obtener sucursales activas (para selects)
  async getSucursalesActivas(req, res) {
    try {
      const query = `
        SELECT 
          id,
          nombre,
          ubicacion
        FROM sucursales 
        WHERE activo = 1 
        ORDER BY nombre ASC
      ` 

      const [sucursales] = await db.pool.execute(query)

      responseHelper.success(res, sucursales)
    } catch (error) {
      console.error("Error al obtener sucursales activas:", error)
      res.status(500).json(responseHelper.error("Error interno del servidor"))
    }
  },
}

module.exports = sucursalesController
