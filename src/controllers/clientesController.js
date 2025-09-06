const db = require("../config/database")
const ResponseHelper = require("../utils/responseHelper")

const clientesController = {
  // Obtener todos los clientes con paginación y filtros
  getClientes: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "", searchBy = "" } = req.query
      const offset = (page - 1) * limit

      let query = `
        SELECT DISTINCT
          c.id, c.nombre, c.apellido, c.dni, c.telefono, c.direccion, 
          c.activo, c.created_at, c.updated_at,
          GROUP_CONCAT(DISTINCT CONCAT(
            v.id, '|', v.patente, '|', v.marca, '|', v.modelo, '|', 
            COALESCE(v.año, ''), '|', COALESCE(v.kilometraje, '')
          ) SEPARATOR ';;') as vehiculos_data,
          GROUP_CONCAT(DISTINCT CONCAT(
            s.id, '|', s.numero, '|', s.descripcion, '|', 
            DATE_FORMAT(s.created_at, '%Y-%m-%d'), '|', 
            COALESCE(s.precio_referencia, ''), '|', v2.patente, '|',
            COALESCE(s.observaciones, ''), '|', s.created_at
          ) ORDER BY s.created_at DESC SEPARATOR ';;') as servicios_data
        FROM clientes c
        LEFT JOIN vehiculos v ON c.id = v.cliente_id AND v.activo = true
        LEFT JOIN servicios s ON c.id = s.cliente_id AND s.activo = true
        LEFT JOIN vehiculos v2 ON s.vehiculo_id = v2.id
        WHERE c.activo = true
      `

      let countQuery = "SELECT COUNT(DISTINCT c.id) as total FROM clientes c WHERE c.activo = true"
      const queryParams = []
      const countParams = []

      if (search) {
        let searchCondition = ""
        const searchParam = `%${search}%`

        switch (searchBy) {
          case "nombre":
            // Search in both nombre and full name (nombre + apellido)
            searchCondition = " AND (c.nombre LIKE ? OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?)"
            queryParams.push(searchParam, searchParam)
            countParams.push(searchParam, searchParam)
            break
          case "apellido":
            searchCondition = " AND c.apellido LIKE ?"
            queryParams.push(searchParam)
            countParams.push(searchParam)
            break
          case "dni":
            searchCondition = " AND c.dni LIKE ?"
            queryParams.push(searchParam)
            countParams.push(searchParam)
            break
          case "telefono":
            searchCondition = " AND c.telefono LIKE ?"
            queryParams.push(searchParam)
            countParams.push(searchParam)
            break
          default:
            // Default: search in all fields including full name
            searchCondition =
              " AND (c.nombre LIKE ? OR c.apellido LIKE ? OR c.dni LIKE ? OR c.telefono LIKE ? OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?)"
            queryParams.push(searchParam, searchParam, searchParam, searchParam, searchParam)
            countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam)
        }

        query += searchCondition
        countQuery += searchCondition
      }

      query += " GROUP BY c.id ORDER BY c.nombre ASC, c.apellido ASC LIMIT ? OFFSET ?"
      queryParams.push(Number.parseInt(limit), Number.parseInt(offset))

      const [clientesRaw] = await db.pool.execute(query, queryParams)
      const [countResult] = await db.pool.execute(countQuery, countParams)
      const total = countResult[0].total

      const clientes = clientesRaw.map((cliente) => {
        const clienteData = {
          id: cliente.id,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          dni: cliente.dni,
          telefono: cliente.telefono,
          direccion: cliente.direccion,
          activo: cliente.activo,
          created_at: cliente.created_at,
          updated_at: cliente.updated_at,
          vehiculos: [],
          servicios: [],
        }

        // Parse vehicles data
        if (cliente.vehiculos_data) {
          clienteData.vehiculos = cliente.vehiculos_data.split(";;").map((vehiculoStr) => {
            const [id, patente, marca, modelo, año, kilometraje] = vehiculoStr.split("|")
            return {
              id: Number.parseInt(id),
              patente,
              marca,
              modelo,
              año: año ? Number.parseInt(año) : null,
              kilometraje: kilometraje ? Number.parseInt(kilometraje) : null,
            }
          })
        }

        // Parse services data
        if (cliente.servicios_data) {
          clienteData.servicios = cliente.servicios_data.split(";;").map((servicioStr) => {
            const [id, numero, descripcion, fecha, precio, vehiculoPatente, observaciones, created_at] =
              servicioStr.split("|")
            return {
              id: Number.parseInt(id),
              numero,
              descripcion,
              fecha,
              precio: precio ? Number.parseFloat(precio) : null,
              vehiculo: vehiculoPatente,
              observaciones: observaciones || null,
              created_at: created_at || null,
              items_count: 1,
            }
          })
        }

        return clienteData
      })

      return ResponseHelper.success(res, {
        data: clientes,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: Number.parseInt(page),
          limit: Number.parseInt(limit),
        },
      })
    } catch (error) {
      console.error("Error al obtener clientes:", error)
      return ResponseHelper.error(res, "Error al obtener clientes", 500, "DATABASE_ERROR", error)
    }
  },

  // Obtener cliente por ID
  getClienteById: async (req, res) => {
    try {
      const { id } = req.params
      const [clientes] = await db.pool.execute("SELECT * FROM clientes WHERE id = ? AND activo = true", [id])

      if (clientes.length === 0) {
        return ResponseHelper.notFound(res, "Cliente no encontrado", "CLIENT_NOT_FOUND")
      }

      return ResponseHelper.success(res, clientes[0])
    } catch (error) {
      console.error("Error al obtener cliente:", error)
      return ResponseHelper.error(res, "Error al obtener cliente", 500, "DATABASE_ERROR", error)
    }
  },

  // Crear nuevo cliente
  createCliente: async (req, res) => {
    try {
      const { nombre, apellido, dni, telefono, direccion } = req.body

      // Verificar si ya existe un cliente con el mismo DNI
      if (dni) {
        const [existingCliente] = await db.pool.execute("SELECT id FROM clientes WHERE dni = ? AND activo = true", [
          dni,
        ])
        if (existingCliente.length > 0) {
          return ResponseHelper.error(res, "Ya existe un cliente con ese DNI", 400, "DUPLICATE_DNI")
        }
      }

      const [result] = await db.pool.execute(
        `INSERT INTO clientes (nombre, apellido, dni, telefono, direccion, activo) 
         VALUES (?, ?, ?, ?, ?, true)`,
        [nombre, apellido, dni || null, telefono || null, direccion || null],
      )

      const [newCliente] = await db.pool.execute("SELECT * FROM clientes WHERE id = ?", [result.insertId])

      return ResponseHelper.success(res, newCliente[0], "Cliente creado exitosamente", 201)
    } catch (error) {
      console.error("Error al crear cliente:", error)
      return ResponseHelper.error(res, "Error al crear cliente", 500, "DATABASE_ERROR", error)
    }
  },

  // Actualizar cliente
  updateCliente: async (req, res) => {
    try {
      const { id } = req.params
      const { nombre, apellido, dni, telefono, direccion } = req.body

      // Verificar si el cliente existe
      const [existingCliente] = await db.pool.execute("SELECT id FROM clientes WHERE id = ? AND activo = true", [id])
      if (existingCliente.length === 0) {
        return ResponseHelper.notFound(res, "Cliente no encontrado", "CLIENT_NOT_FOUND")
      }

      // Verificar si ya existe otro cliente con el mismo DNI
      if (dni) {
        const [duplicateCliente] = await db.pool.execute(
          "SELECT id FROM clientes WHERE dni = ? AND id != ? AND activo = true",
          [dni, id],
        )
        if (duplicateCliente.length > 0) {
          return ResponseHelper.error(res, "Ya existe otro cliente con ese DNI", 400, "DUPLICATE_DNI")
        }
      }

      await db.pool.execute(
        `UPDATE clientes 
         SET nombre = ?, apellido = ?, dni = ?, telefono = ?, direccion = ?
         WHERE id = ?`,
        [nombre, apellido, dni || null, telefono || null, direccion || null, id],
      )

      const [updatedCliente] = await db.pool.execute("SELECT * FROM clientes WHERE id = ?", [id])

      return ResponseHelper.success(res, updatedCliente[0], "Cliente actualizado exitosamente")
    } catch (error) {
      console.error("Error al actualizar cliente:", error)
      return ResponseHelper.error(res, "Error al actualizar cliente", 500, "DATABASE_ERROR", error)
    }
  },

  // Eliminar cliente (soft delete)
  deleteCliente: async (req, res) => {
    try {
      const { id } = req.params

      // Verificar si el cliente existe
      const [existingCliente] = await db.pool.execute("SELECT id FROM clientes WHERE id = ? AND activo = true", [id])
      if (existingCliente.length === 0) {
        return ResponseHelper.notFound(res, "Cliente no encontrado", "CLIENT_NOT_FOUND")
      }

      // Verificar si el cliente tiene vehículos activos
      const [vehiculos] = await db.pool.execute("SELECT id FROM vehiculos WHERE cliente_id = ? AND activo = true", [id])

      if (vehiculos.length > 0) {
        const errorResponse = ResponseHelper.error(
          res,
          "No se puede eliminar el cliente porque tiene vehículos asociados",
          400,
          "VEHICLES_ASSOCIATED",
        )
        return errorResponse
      }

      // Verificar si el cliente tiene servicios pendientes
      const [servicios] = await db.pool.execute(
        "SELECT id FROM servicios WHERE cliente_id = ? AND estado IN ('PENDIENTE', 'EN_PROGRESO')",
        [id],
      )
      if (servicios.length > 0) {
        return ResponseHelper.error(
          res,
          "No se puede eliminar el cliente porque tiene servicios pendientes",
          400,
          "SERVICES_PENDING",
        )
      }

      await db.pool.execute("UPDATE clientes SET activo = false WHERE id = ?", [id])

      return ResponseHelper.success(res, { message: "Cliente eliminado correctamente" })
    } catch (error) {
      console.error("[v0] Error al eliminar cliente:", error)
      return ResponseHelper.error(res, "Error al eliminar cliente", 500, "DATABASE_ERROR", error)
    }
  },
}

module.exports = clientesController
 