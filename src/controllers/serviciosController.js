const db = require("../config/database")

const serviciosController = {
  // Obtener todos los servicios con paginación y filtros
  getServicios: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "", clienteId = "", vehiculoId = "" } = req.query
      const pageNum = Number.parseInt(page) || 1
      const limitNum = Math.min(Number.parseInt(limit) || 10, 100) // máximo 100 por seguridad
      const offset = (pageNum - 1) * limitNum

      let query = `
        SELECT s.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, c.dni as cliente_dni,
               v.patente, v.marca, v.modelo, v.año,
               suc.nombre as sucursal_nombre,
               COUNT(si.id) as items_count
        FROM servicios s
        LEFT JOIN clientes c ON s.cliente_id = c.id
        LEFT JOIN vehiculos v ON s.vehiculo_id = v.id
        LEFT JOIN sucursales suc ON s.sucursal_id = suc.id
        LEFT JOIN servicio_items si ON s.id = si.servicio_id
        WHERE s.activo = true
      `
      let countQuery = "SELECT COUNT(DISTINCT s.id) as total FROM servicios s WHERE s.activo = true"
      const queryParams = []
      const countParams = []

      // Filtro de búsqueda
      if (search) {
        query += " AND (s.numero LIKE ? OR CONCAT(c.nombre, ' ', c.apellido) LIKE ? OR v.patente LIKE ?)"
        countQuery +=
          " AND EXISTS (SELECT 1 FROM clientes c2 LEFT JOIN vehiculos v2 ON s.vehiculo_id = v2.id WHERE s.cliente_id = c2.id AND (s.numero LIKE ? OR CONCAT(c2.nombre, ' ', c2.apellido) LIKE ? OR v2.patente LIKE ?))"
        const searchParam = `%${search}%`
        queryParams.push(searchParam, searchParam, searchParam)
        countParams.push(searchParam, searchParam, searchParam)
      }

      // Filtro por cliente
      if (clienteId) {
        query += " AND s.cliente_id = ?"
        countQuery += " AND s.cliente_id = ?"
        queryParams.push(clienteId)
        countParams.push(clienteId)
      }

      // Filtro por vehículo
      if (vehiculoId) {
        query += " AND s.vehiculo_id = ?"
        countQuery += " AND s.vehiculo_id = ?"
        queryParams.push(vehiculoId)
        countParams.push(vehiculoId)
      }

      // Inyectar LIMIT y OFFSET directamente
      query += ` GROUP BY s.id ORDER BY s.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`

      const [servicios] = await db.pool.execute(query, queryParams)
      const [countResult] = await db.pool.execute(countQuery, countParams)
      const total = countResult[0].total

      res.json({
        data: servicios,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
      })
    } catch (error) {
      console.error("Error al obtener servicios:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  // Obtener servicio por ID con items
  getServicioById: async (req, res) => {
    try {
      const { id } = req.params

      // Obtener servicio con datos del cliente, vehículo, sucursal y empleados
      const [servicios] = await db.pool.execute(
        `
        SELECT s.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, c.dni as cliente_dni, c.telefono as cliente_telefono,
               v.patente, v.marca, v.modelo, v.año,
               suc.nombre as sucursal_nombre, suc.ubicacion as sucursal_ubicacion
        FROM servicios s
        LEFT JOIN clientes c ON s.cliente_id = c.id
        LEFT JOIN vehiculos v ON s.vehiculo_id = v.id
        LEFT JOIN sucursales suc ON s.sucursal_id = suc.id
        WHERE s.id = ? AND s.activo = true
      `,
        [id],
      )

      if (servicios.length === 0) {
        return res.status(404).json({ error: "Servicio no encontrado" })
      }

      // Obtener empleados del servicio
      const [empleados] = await db.pool.execute(
        `
        SELECT e.id, e.nombre, e.apellido, e.cargo
        FROM servicio_empleados se
        LEFT JOIN empleados e ON se.empleado_id = e.id
        WHERE se.servicio_id = ? AND e.activo = true
        ORDER BY e.nombre, e.apellido
      `,
        [id],
      )

      const [items] = await db.pool.execute(
        `
        SELECT si.*, ts.nombre as tipo_servicio_nombre, ts.descripcion as tipo_servicio_descripcion
        FROM servicio_items si
        LEFT JOIN tipos_servicios ts ON si.tipo_servicio_id = ts.id
        WHERE si.servicio_id = ?
        ORDER BY si.id
      `,
        [id],
      )

      // Obtener productos para cada item
      for (const item of items) {
        const [productos] = await db.pool.execute(`SELECT * FROM productos WHERE servicio_item_id = ? ORDER BY id`, [
          item.id,
        ])
        item.productos = productos
      }

      const servicio = {
        ...servicios[0],
        empleados,
        items,
      }

      res.json(servicio)
    } catch (error) {
      console.error("Error al obtener servicio:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  createServicio: async (req, res) => {
    const connection = await db.pool.getConnection()
    try {
      await connection.beginTransaction()

      const { cliente_id, vehiculo_id, sucursal_id, empleados, descripcion, observaciones, items, precio_referencia } = req.body

      if (!cliente_id) {
        return res.status(400).json({ error: "Cliente ID es requerido" })
      }
      if (!vehiculo_id) {
        return res.status(400).json({ error: "Vehículo ID es requerido" })
      }
      if (!sucursal_id) {
        return res.status(400).json({ error: "Sucursal ID es requerido" })
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Debe incluir al menos un item de servicio" })
      }

      // Get the highest existing service number
      const [lastService] = await connection.execute(
        "SELECT numero FROM servicios WHERE numero LIKE 'SERV-%' ORDER BY CAST(SUBSTRING(numero, 6) AS UNSIGNED) DESC LIMIT 1",
      )

      let nextNumber = 1
      if (lastService.length > 0) {
        const lastNumber = Number.parseInt(lastService[0].numero.substring(5))
        nextNumber = lastNumber + 1
      }

      const numero = `SERV-${nextNumber.toString().padStart(5, "0")}`

      const [result] = await connection.execute(
        `
        INSERT INTO servicios (numero, cliente_id, vehiculo_id, sucursal_id, descripcion, observaciones, 
                              precio_referencia, activo) 
        VALUES (?, ?, ?, ?, ?, ?, true)
      `,
        [numero, cliente_id, vehiculo_id, sucursal_id, descripcion || null, observaciones || null, precio_referencia || 0],
      )

      const servicioId = result.insertId

      if (empleados && Array.isArray(empleados) && empleados.length > 0) {
        for (const empleadoId of empleados) {
          await connection.execute(`INSERT INTO servicio_empleados (servicio_id, empleado_id) VALUES (?, ?)`, [
            servicioId,
            empleadoId,
          ])
        }
      }

      // Crear items del servicio con productos
      for (const item of items) {
        const [itemResult] = await connection.execute(
          `INSERT INTO servicio_items (servicio_id, tipo_servicio_id, descripcion, observaciones, notas)
           VALUES (?, ?, ?, ?)`,
          [servicioId, item.tipo_servicio_id, item.descripcion || "Sin descripción", item.observaciones || null, item.notas || null],
        )

        const servicioItemId = itemResult.insertId

        // Insertar productos para este item de servicio
        if (item.productos && Array.isArray(item.productos)) {
          for (const producto of item.productos) {
            await connection.execute(`INSERT INTO productos (servicio_item_id, nombre, es_nuestro) VALUES (?, ?, ?)`, [
              servicioItemId,
              producto.nombre,
              producto.es_nuestro,
            ])
          }
        }
      }

      await connection.commit()

      // Obtener el servicio creado con todos los datos
      const [newServicio] = await db.pool.execute(
        `
        SELECT s.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, c.dni as cliente_dni,
               v.patente, v.marca, v.modelo, v.año,
               suc.nombre as sucursal_nombre
        FROM servicios s
        LEFT JOIN clientes c ON s.cliente_id = c.id
        LEFT JOIN vehiculos v ON s.vehiculo_id = v.id
        LEFT JOIN sucursales suc ON s.sucursal_id = suc.id
        WHERE s.id = ?
      `,
        [servicioId],
      )

      res.status(201).json(newServicio[0])
    } catch (error) {
      await connection.rollback()
      console.error("Error al crear servicio:", error)
      res.status(500).json({ error: error.message || "Error interno del servidor" })
    } finally {
      connection.release()
    }
  },

  updateServicio: async (req, res) => {
    const connection = await db.pool.getConnection()
    try {
      await connection.beginTransaction()

      const { id } = req.params
      const { cliente_id, vehiculo_id, sucursal_id, empleados, descripcion, observaciones, items, precio_referencia } = req.body

      const [existingServicio] = await connection.execute("SELECT id FROM servicios WHERE id = ? AND activo = true", [
        id,
      ])

      if (existingServicio.length === 0) {
        return res.status(404).json({ error: "Servicio no encontrado" })
      }

      await connection.execute("DELETE FROM servicio_empleados WHERE servicio_id = ?", [id])

      // Eliminar items anteriores y sus productos
      await connection.execute(
        "DELETE p FROM productos p INNER JOIN servicio_items si ON p.servicio_item_id = si.id WHERE si.servicio_id = ?",
        [id],
      )
      await connection.execute("DELETE FROM servicio_items WHERE servicio_id = ?", [id])

      await connection.execute(
        `
        UPDATE servicios 
        SET cliente_id = ?, vehiculo_id = ?, sucursal_id = ?, descripcion = ?, observaciones = ?, precio_referencia = ?
        WHERE id = ?
      `,
        [cliente_id, vehiculo_id, sucursal_id, descripcion || null, observaciones || null, precio_referencia || 0, id],
      )

      if (empleados && Array.isArray(empleados) && empleados.length > 0) {
        for (const empleadoId of empleados) {
          await connection.execute(`INSERT INTO servicio_empleados (servicio_id, empleado_id) VALUES (?, ?)`, [
            id,
            empleadoId,
          ])
        }
      }

      // Crear nuevos items con productos
      for (const item of items) {
        const [itemResult] = await connection.execute(
          `
          INSERT INTO servicio_items (servicio_id, tipo_servicio_id, descripcion, observaciones, notas)
          VALUES (?, ?, ?, ?)
        `,
          [id, item.tipo_servicio_id, item.descripcion || "Sin descripción", item.observaciones || null, item.notas || null],
        )

        const servicioItemId = itemResult.insertId

        // Insertar productos para este item de servicio
        if (item.productos && Array.isArray(item.productos)) {
          for (const producto of item.productos) {
            await connection.execute(`INSERT INTO productos (servicio_item_id, nombre, es_nuestro) VALUES (?, ?, ?)`, [
              servicioItemId,
              producto.nombre,
              producto.es_nuestro,
            ])
          }
        }
      }

      await connection.commit()

      const [updatedServicio] = await db.pool.execute(
        `
        SELECT s.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, c.dni as cliente_dni,
               v.patente, v.marca, v.modelo, v.año,
               suc.nombre as sucursal_nombre
        FROM servicios s
        LEFT JOIN clientes c ON s.cliente_id = c.id
        LEFT JOIN vehiculos v ON s.vehiculo_id = v.id
        LEFT JOIN sucursales suc ON s.sucursal_id = suc.id
        WHERE s.id = ?
      `,
        [id],
      )

      res.json(updatedServicio[0])
    } catch (error) {
      await connection.rollback()
      console.error("Error al actualizar servicio:", error)
      res.status(500).json({ error: error.message || "Error interno del servidor" })
    } finally {
      connection.release()
    }
  },

  deleteServicio: async (req, res) => {
    const connection = await db.pool.getConnection()
    try {
      await connection.beginTransaction()

      const { id } = req.params
      console.log("[v0] Iniciando deleteServicio - ID recibido:", id)

      const [existingServicio] = await connection.execute("SELECT id FROM servicios WHERE id = ? AND activo = true", [
        id,
      ])
      console.log("[v0] Servicio encontrado:", existingServicio.length > 0 ? "Sí" : "No")

      if (existingServicio.length === 0) {
        console.log("[v0] Servicio no encontrado - devolviendo 404")
        return res.status(404).json({ error: "Servicio no encontrado" })
      }

      console.log("[v0] Iniciando eliminación completa del servicio y sus relaciones")

      // 1. Eliminar productos relacionados con los items del servicio
      await connection.execute(
        `
        DELETE p FROM productos p 
        INNER JOIN servicio_items si ON p.servicio_item_id = si.id 
        WHERE si.servicio_id = ?
      `,
        [id],
      )
      console.log("[v0] Productos eliminados")

      // 2. Eliminar items del servicio
      await connection.execute("DELETE FROM servicio_items WHERE servicio_id = ?", [id])
      console.log("[v0] Items del servicio eliminados")

      // 3. Eliminar relaciones con empleados
      await connection.execute("DELETE FROM servicio_empleados WHERE servicio_id = ?", [id])
      console.log("[v0] Relaciones con empleados eliminadas")

      // 4. Eliminar el servicio principal
      await connection.execute("DELETE FROM servicios WHERE id = ?", [id])
      console.log("[v0] Servicio principal eliminado")

      await connection.commit()
      console.log("[v0] Servicio eliminado completamente de la base de datos")

      res.json({ message: "Servicio eliminado completamente" })
    } catch (error) {
      await connection.rollback()
      console.error("[v0] Error en deleteServicio:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    } finally {
      connection.release()
    }
  },

  getEstadisticas: async (req, res) => {
    try {
      const [stats] = await db.pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as servicios_hoy,
          SUM(CASE WHEN WEEK(created_at) = WEEK(CURDATE()) THEN 1 ELSE 0 END) as servicios_semana,
          SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END) as servicios_mes
        FROM servicios 
        WHERE activo = true
      `)

      res.json(stats[0])
    } catch (error) {
      console.error("Error al obtener estadísticas:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  getServiciosByCliente: async (req, res) => {
    try {
      const { id } = req.params

      const query = `
        SELECT s.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, c.dni as cliente_dni,
               v.patente, v.marca, v.modelo, v.año,
               suc.nombre as sucursal_nombre,
               COUNT(si.id) as items_count
        FROM servicios s
        LEFT JOIN clientes c ON s.cliente_id = c.id
        LEFT JOIN vehiculos v ON s.vehiculo_id = v.id
        LEFT JOIN sucursales suc ON s.sucursal_id = suc.id
        LEFT JOIN servicio_items si ON s.id = si.servicio_id
        WHERE s.activo = true AND s.cliente_id = ?
        GROUP BY s.id 
        ORDER BY s.created_at DESC
      `

      const [servicios] = await db.pool.execute(query, [id])
      res.json(servicios)
    } catch (error) {
      console.error("Error al obtener servicios del cliente:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },

  getServiciosByVehiculo: async (req, res) => {
    try {
      const { patente } = req.params

      const query = `
        SELECT s.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, c.dni as cliente_dni,
               v.patente, v.marca, v.modelo, v.año,
               suc.nombre as sucursal_nombre,
               COUNT(si.id) as items_count
        FROM servicios s
        LEFT JOIN clientes c ON s.cliente_id = c.id
        LEFT JOIN vehiculos v ON s.vehiculo_id = v.id
        LEFT JOIN sucursales suc ON s.sucursal_id = suc.id
        LEFT JOIN servicio_items si ON s.id = si.servicio_id
        WHERE s.activo = true AND v.patente = ?
        GROUP BY s.id 
        ORDER BY s.created_at DESC
      `

      const [servicios] = await db.pool.execute(query, [patente])
      res.json(servicios)
    } catch (error) {
      console.error("Error al obtener servicios del vehículo:", error)
      res.status(500).json({ error: "Error interno del servidor" })
    }
  },
}

module.exports = serviciosController
