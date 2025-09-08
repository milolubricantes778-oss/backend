const db = require("../config/database")

const vehiculosController = {
  // Obtener todos los vehículos con paginación y filtros
  getVehiculos: async (req, res) => {
    try {
      let { page = 1, limit = 10, search = "", searchCriteria = "patente", clienteId = "" } = req.query

      page = parseInt(page, 10) || 1
      limit = parseInt(limit, 10) || 10
      page = page < 1 ? 1 : page
      limit = limit < 1 ? 10 : limit
      limit = Math.min(limit, 100)
      const offset = (page - 1) * limit

      let query = `SELECT v.id, v.patente, v.marca, v.modelo, v.año, 
               v.kilometraje, v.observaciones,
               v.cliente_id, v.activo, v.created_at, v.updated_at,
               CONCAT(c.nombre, ' ', c.apellido) as cliente_nombre,
               c.dni as cliente_dni, c.telefono as cliente_telefono, c.direccion as cliente_direccion,
               GROUP_CONCAT(
                 DISTINCT CONCAT(
                   s.id, '|',
                   s.numero, '|',
                   COALESCE(s.descripcion, ''), '|',
                   COALESCE(s.precio_referencia, 0), '|',
                   COALESCE(s.created_at, ''), '|',
                   COALESCE(s.estado, '')
                 ) ORDER BY s.created_at DESC SEPARATOR ';;'
               ) as servicios_data
        FROM vehiculos v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        LEFT JOIN servicios s ON v.id = s.vehiculo_id
        WHERE v.activo = true`

      let countQuery =
        "SELECT COUNT(DISTINCT v.id) as total FROM vehiculos v LEFT JOIN clientes c ON v.cliente_id = c.id WHERE v.activo = true"
      const queryParams = []
      const countParams = []

      // Filtro por cliente específico
      if (clienteId) {
        query += " AND v.cliente_id = ?"
        countQuery += " AND v.cliente_id = ?"
        queryParams.push(clienteId)
        countParams.push(clienteId)
      }

      if (search) {
        let searchCondition = ""
        const searchParam = `%${search}%`

        switch (searchCriteria) {
          case "patente":
            searchCondition = " AND v.patente LIKE ?"
            queryParams.push(searchParam)
            countParams.push(searchParam)
            break
          case "marca_modelo":
            searchCondition = " AND (v.marca LIKE ? OR v.modelo LIKE ? OR CONCAT(v.marca, ' ', v.modelo) LIKE ?)"
            queryParams.push(searchParam, searchParam, searchParam)
            countParams.push(searchParam, searchParam, searchParam)
            break
          case "cliente":
            searchCondition = " AND (CONCAT(c.nombre, ' ', c.apellido) LIKE ? OR c.nombre LIKE ? OR c.apellido LIKE ?)"
            queryParams.push(searchParam, searchParam, searchParam)
            countParams.push(searchParam, searchParam, searchParam)
            break
          default:
            searchCondition =
              " AND (v.patente LIKE ? OR v.marca LIKE ? OR v.modelo LIKE ? OR CONCAT(c.nombre, ' ', c.apellido) LIKE ?)"
            queryParams.push(searchParam, searchParam, searchParam, searchParam)
            countParams.push(searchParam, searchParam, searchParam, searchParam)
        }

        query += searchCondition
        countQuery += searchCondition
      }

      query += `
        GROUP BY v.id, v.patente, v.marca, v.modelo, v.año, v.kilometraje, v.observaciones, 
                 v.cliente_id, v.activo, v.created_at, v.updated_at, 
                 c.nombre, c.apellido, c.dni, c.telefono, c.direccion
        ORDER BY v.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `

      const [vehiculos] = await db.pool.execute(query, queryParams)
      const [countResult] = await db.pool.execute(countQuery, countParams)
      const total = countResult[0].total

      const processedVehiculos = vehiculos.map((vehiculo) => {
        const servicios = []

        if (vehiculo.servicios_data) {
          const serviciosArray = vehiculo.servicios_data.split(";;")
          for (const servicioStr of serviciosArray) {
            if (servicioStr.trim()) {
              const [id, numero, descripcion, precio_referencia, created_at, estado] = servicioStr.split("|")
              servicios.push({
                id: Number.parseInt(id) || 0,
                numero: numero || "",
                descripcion: descripcion || "",
                total: Number.parseFloat(precio_referencia) || 0,
                fecha_creacion: created_at || "",
                estado: estado || "",
              })
            }
          }
        }

        const { servicios_data, ...vehiculoData } = vehiculo
        return {
          ...vehiculoData,
          servicios,
        }
      })

      const response = {
        data: processedVehiculos,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      }

      res.json(response)
    } catch (error) {
      console.error("Error al obtener vehículos:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  // Obtener vehículo por ID
  getVehiculoById: async (req, res) => {
    try {
      const { id } = req.params
      const [vehiculos] = await db.pool.execute(
        `SELECT v.*, CONCAT(c.nombre, ' ', c.apellido) as cliente_nombre
         FROM vehiculos v
         LEFT JOIN clientes c ON v.cliente_id = c.id
         WHERE v.id = ? AND v.activo = true`,
        [id],
      )

      if (vehiculos.length === 0) {
        return res.status(404).json({ error: "Vehículo no encontrado" })
      }

      res.json(vehiculos[0])
    } catch (error) {
      console.error("Error al obtener vehículo:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  // Crear nuevo vehículo
  createVehiculo: async (req, res) => {
    try {
      const { clienteId, patente, marca, modelo, año, kilometraje, observaciones } = req.body

      const [cliente] = await db.pool.execute("SELECT id FROM clientes WHERE id = ? AND activo = true", [clienteId])
      if (cliente.length === 0) {
        return res.status(400).json({ error: "Cliente no encontrado" })
      }

      const [existingVehiculo] = await db.pool.execute("SELECT id FROM vehiculos WHERE patente = ? AND activo = true", [
        patente,
      ])
      if (existingVehiculo.length > 0) {
        return res.status(400).json({ error: "Ya existe un vehículo con esa patente" })
      }

      const [result] = await db.pool.execute(
        `INSERT INTO vehiculos (
          cliente_id, patente, marca, modelo, año, kilometraje, observaciones, activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, true)`,
        [clienteId, patente, marca, modelo, año, kilometraje, observaciones],
      )

      const [newVehiculo] = await db.pool.execute(
        `SELECT v.*, CONCAT(c.nombre, ' ', c.apellido) as cliente_nombre
         FROM vehiculos v
         LEFT JOIN clientes c ON v.cliente_id = c.id
         WHERE v.id = ?`,
        [result.insertId],
      )

      res.status(201).json(newVehiculo[0])
    } catch (error) {
      console.error("Error al crear vehículo:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  // Actualizar vehículo
  updateVehiculo: async (req, res) => {
    try {
      const { id } = req.params
      const { clienteId, patente, marca, modelo, año, kilometraje, observaciones } = req.body

      const [existingVehiculo] = await db.pool.execute("SELECT id FROM vehiculos WHERE id = ? AND activo = true", [id])
      if (existingVehiculo.length === 0) {
        return res.status(404).json({ error: "Vehículo no encontrado" })
      }

      const [cliente] = await db.pool.execute("SELECT id FROM clientes WHERE id = ? AND activo = true", [clienteId])
      if (cliente.length === 0) {
        return res.status(400).json({ error: "Cliente no encontrado" })
      }

      const [duplicateVehiculo] = await db.pool.execute(
        "SELECT id FROM vehiculos WHERE patente = ? AND id != ? AND activo = true",
        [patente, id],
      )
      if (duplicateVehiculo.length > 0) {
        return res.status(400).json({ error: "Ya existe otro vehículo con esa patente" })
      }

      await db.pool.execute(
        `UPDATE vehiculos 
         SET cliente_id = ?, patente = ?, marca = ?, modelo = ?, año = ?, 
             kilometraje = ?, observaciones = ?
         WHERE id = ?`,
        [clienteId, patente, marca, modelo, año, kilometraje, observaciones, id],
      )

      const [updatedVehiculo] = await db.pool.execute(
        `SELECT v.*, CONCAT(c.nombre, ' ', c.apellido) as cliente_nombre
         FROM vehiculos v
         LEFT JOIN clientes c ON v.cliente_id = c.id
         WHERE v.id = ?`,
        [id],
      )

      res.json(updatedVehiculo[0])
    } catch (error) {
      console.error("Error al actualizar vehículo:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  // Eliminar vehículo (soft delete)
  deleteVehiculo: async (req, res) => {
    try {
      const { id } = req.params

      const [existingVehiculo] = await db.pool.execute("SELECT id FROM vehiculos WHERE id = ? AND activo = true", [id])
      if (existingVehiculo.length === 0) {
        return res.status(404).json({ error: "Vehículo no encontrado" })
      }

      const [servicios] = await db.pool.execute(
        "SELECT id FROM servicios WHERE vehiculo_id = ? AND estado IN ('PENDIENTE', 'EN_PROGRESO')",
        [id],
      )
      if (servicios.length > 0) {
        return res.status(400).json({
          error: "No se puede eliminar el vehículo porque tiene servicios pendientes",
        })
      }

      await db.pool.execute("UPDATE vehiculos SET activo = false WHERE id = ?", [id])

      res.json({ message: "Vehículo eliminado correctamente" })
    } catch (error) {
      console.error("Error al eliminar vehículo:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  // Obtener vehículos por cliente
  getVehiculosByCliente: async (req, res) => {
    try {
      const { clienteId } = req.params
      const clienteIdNum = Number.parseInt(clienteId, 10)
      if (isNaN(clienteIdNum) || clienteIdNum <= 0) {
        return res.status(400).json({ error: "ID de cliente inválido" })
      }

      const [vehiculos] = await db.pool.execute(
        `SELECT v.*, CONCAT(c.nombre, ' ', c.apellido) as cliente_nombre
         FROM vehiculos v
         LEFT JOIN clientes c ON v.cliente_id = c.id
         WHERE v.cliente_id = ? AND v.activo = true
         ORDER BY v.patente ASC`,
        [clienteIdNum],
      )

      res.json({ data: vehiculos })
    } catch (error) {
      console.error("Error al obtener vehículos del cliente:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  // Actualizar kilometraje
  actualizarKilometraje: async (req, res) => {
    try {
      const { id } = req.params
      const { kilometraje } = req.body

      const [existingVehiculo] = await db.pool.execute(
        "SELECT kilometraje FROM vehiculos WHERE id = ? AND activo = true",
        [id],
      )
      if (existingVehiculo.length === 0) {
        return res.status(404).json({ error: "Vehículo no encontrado" })
      }

      const kilometrajeAnterior = existingVehiculo[0].kilometraje
      if (kilometraje < kilometrajeAnterior) {
        return res.status(400).json({ error: "El nuevo kilometraje no puede ser menor al actual" })
      }

      await db.pool.execute("UPDATE vehiculos SET kilometraje = ? WHERE id = ?", [kilometraje, id])

      const [updatedVehiculo] = await db.pool.execute(
        `SELECT v.*, CONCAT(c.nombre, ' ', c.apellido) as cliente_nombre
         FROM vehiculos v
         LEFT JOIN clientes c ON v.cliente_id = c.id
         WHERE v.id = ?`,
        [id],
      )

      res.json(updatedVehiculo[0])
    } catch (error) {
      console.error("Error al actualizar kilometraje:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },
}

module.exports = vehiculosController
