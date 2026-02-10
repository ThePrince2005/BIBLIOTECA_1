const Usuario = require('../models/usuario.model');
const LogroModel = require('../models/logro.model');
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
// const xlsx = require('xlsx'); // Removed
const ExcelJS = require('exceljs');
const path = require('path');

// PERFIL

exports.getPerfil = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res
        .status(404)
        .render('error', { mensaje: 'Usuario no encontrado' });
    }

    // Obtener badges y estadísticas según rol
    let badges = [];
    let estadisticas = {};
    try {
      badges = await LogroModel.obtenerLogrosUsuario(usuarioId);
    } catch (e) {
      console.error('Error cargando badges:', e);
      badges = [];
    }

    try {
      if (usuario.rol === 'estudiante') {
        estadisticas = await Usuario.obtenerEstadisticasEstudiante(usuarioId);
      } else {
        estadisticas = await Usuario.obtenerEstadisticasDocente(usuarioId);
      }
    } catch (e) {
      console.error('Error cargando estadísticas de perfil:', e);
      estadisticas = {};
    }

    res.render('perfil/index', { usuario, badges, estadisticas });
  } catch (error) {
    console.error('Error en usuario.getPerfil:', error);
    res
      .status(500)
      .render('error', { mensaje: 'Error al obtener perfil' });
  }
};

exports.editarPerfil = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const datos = req.body;
    await Usuario.updateById(usuarioId, datos);
    res.redirect('/usuario/perfil');
  } catch (error) {
    res
      .status(500)
      .render('error', { mensaje: 'Error al editar perfil' });
  }
};

// PANEL ADMIN: LISTADOS Y ELIMINACIÓN LÓGICA

// Lista de alumnos y personal (solo usuarios activos)
exports.listarAlumnosAdmin = async (req, res) => {
  try {
    // Alumnos activos
    const [alumnos] = await pool.query(
      `SELECT id, nombre, grado, seccion, correo
       FROM usuarios
       WHERE rol = 'estudiante' AND activo = 1
       ORDER BY grado, seccion, nombre`
    );

    // Docentes y administradores activos
    const [personal] = await pool.query(
      `SELECT id, nombre, rol, correo
       FROM usuarios
       WHERE rol IN ('docente', 'admin') AND activo = 1
       ORDER BY rol, nombre`
    );

    res.render('admin/alumnos', {
      alumnos,
      personal,
      navActive: { gestionUsuarios: true }
    });
  } catch (error) {
    console.error('Error al listar alumnos/personal para admin:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'No se pudo cargar la lista de usuarios',
      error,
    });
  }
};

// Lista de alumnos para docente
exports.listarAlumnosDocente = async (req, res) => {
  try {
    // Alumnos activos con conteo de libros leídos
    // Se cuentan tanto préstamos físicos devueltos (validado=1 o fecha_devolucion_real IS NOT NULL)
    // como lecturas virtuales validadas.
    // Ajustaremos la query para ser eficiente.
    const [alumnos] = await pool.query(
      `SELECT 
        u.id, 
        u.nombre, 
        u.grado, 
        u.seccion, 
        u.correo,
        (
          (SELECT COUNT(*) FROM prestamos p WHERE p.usuario_id = u.id AND (p.validado = 1 OR p.estado = 'devuelto') AND YEAR(p.fecha_prestamo) = YEAR(CURDATE())) +
          (SELECT COUNT(*) FROM lecturas_virtuales lv WHERE lv.usuario_id = u.id AND lv.validado = 1 AND YEAR(lv.fecha_lectura) = YEAR(CURDATE()))
        ) as total_libros_leidos
       FROM usuarios u
       WHERE u.rol = 'estudiante' AND u.activo = 1
       ORDER BY u.grado, u.seccion, u.nombre`
    );

    res.render('docente/alumnos', {
      alumnos: alumnos || [],
      session: req.session || {},
      user: req.user || null,
      navActive: { alumnos: true }
    });
  } catch (error) {
    console.error('Error al listar alumnos para docente:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'No se pudo cargar la lista de alumnos',
      error,
    });
  }
};

// "Eliminar" alumno = marcar activo = 0
exports.eliminarAlumnoAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'UPDATE usuarios SET activo = 0 WHERE id = ?',
      [id]
    );
    if (result.affectedRows > 0) {
      req.session.flash = {
        tipo: 'success',
        mensaje: 'Alumno eliminado correctamente.',
      };
    } else {
      req.session.flash = {
        tipo: 'danger',
        mensaje: 'No se encontró el alumno a eliminar.',
      };
    }
    res.redirect('/usuario/admin/alumnos');
  } catch (error) {
    console.error('Error al eliminar alumno:', error);
    req.session.flash = {
      tipo: 'danger',
      mensaje: 'No se pudo eliminar el alumno.',
    };
    res.redirect('/usuario/admin/alumnos');
  }
};

// "Eliminar" docente/admin = marcar activo = 0
exports.eliminarPersonalAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      'UPDATE usuarios SET activo = 0 WHERE id = ?',
      [id]
    );
    if (result.affectedRows > 0) {
      req.session.flash = {
        tipo: 'success',
        mensaje: 'Usuario eliminado correctamente.',
      };
    } else {
      req.session.flash = {
        tipo: 'danger',
        mensaje: 'No se encontró el usuario a eliminar.',
      };
    }
    res.redirect('/usuario/admin/alumnos');
  } catch (error) {
    console.error('Error al eliminar usuario de personal:', error);
    req.session.flash = {
      tipo: 'danger',
      mensaje: 'No se pudo eliminar el usuario.',
    };
    res.redirect('/usuario/admin/alumnos');
  }
};

// Renderiza el formulario para crear un nuevo usuario
// Puede llegar con un rol preseleccionado vía query (?rol=estudiante|docente|admin)
exports.crearUsuarioForm = (req, res) => {
  const { rol } = req.query || {};
  const allowedRoles = ['estudiante', 'docente', 'admin'];
  const rolePreset = allowedRoles.includes(rol) ? rol : '';

  res.render('admin/crear-usuario', { rolePreset });
};

// Procesa la creación de un nuevo usuario
exports.crearUsuario = async (req, res) => {
  const { nombre, correo, contrasena, rol, grado, seccion } = req.body;

  try {
    // Validar que el correo no esté ya registrado
    const usuarioExistente = await Usuario.findByEmail(correo);
    if (usuarioExistente) {
      req.session.flash = {
        tipo: 'danger',
        mensaje: 'El correo electrónico ya está registrado.',
      };
      return res.redirect('/usuario/admin/usuarios/crear');
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    // Crear el usuario en la base de datos
    const nuevoUsuarioId = await Usuario.create({
      nombre,
      correo,
      contrasena: hashedPassword,
      rol,
      grado: rol === 'estudiante' ? grado : null,
      seccion: rol === 'estudiante' ? seccion : null,
    });

    req.session.flash = {
      tipo: 'success',
      mensaje: 'Usuario creado exitosamente.',
    };
    res.redirect('/usuario/admin/alumnos');
  } catch (error) {
    console.error('Error al crear usuario:', error);
    req.session.flash = {
      tipo: 'danger',
      mensaje: 'Error al crear el usuario.',
    };
    res.redirect('/usuario/admin/usuarios/crear');
  }
};

// Función auxiliar para calcular fechas según periodo
const calcularFechasPorPeriodo = (periodo) => {
  const now = new Date();
  let fechaInicio, fechaFin;
  let tituloPeriodo = '';

  switch (periodo) {
    case 'anio_actual':
      fechaInicio = new Date(now.getFullYear(), 0, 1);
      fechaFin = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      tituloPeriodo = `Año ${now.getFullYear()}`;
      break;
    case 'mes_actual':
      fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
      fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      tituloPeriodo = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      break;
    case 'trimestre':
      fechaInicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      tituloPeriodo = 'Último Trimestre';
      break;
    case 'bimestre':
      fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      tituloPeriodo = 'Último Bimestre';
      break;
    case 'historico':
      fechaInicio = null;
      fechaFin = null;
      tituloPeriodo = 'Todo el tiempo';
      break;
    default:
      fechaInicio = null;
      fechaFin = null;
      tituloPeriodo = 'Todo el tiempo';
  }

  return { fechaInicio, fechaFin, tituloPeriodo };
};

// Historial de lectura de un usuario: préstamos físicos + libros virtuales
exports.verHistorialUsuario = async (req, res) => {
  const { id } = req.params;
  const { periodo } = req.query;

  try {
    // Datos básicos del usuario
    const [usuarios] = await pool.query(
      'SELECT id, nombre, correo, dni, rol, grado, seccion, area_docente FROM usuarios WHERE id = ?',
      [id]
    );
    const usuario = usuarios[0]; // Renamed from 'alumno' to 'usuario'
    if (!usuario) {
      req.session.flash = {
        tipo: 'danger',
        mensaje: 'El usuario no existe.', // Generic message
      };
      return res.redirect('/usuario/admin/alumnos');
    }

    // Calcular fechas según periodo
    const { fechaInicio, fechaFin } = calcularFechasPorPeriodo(periodo);

    // Construir condiciones WHERE para filtros de fecha
    let condicionFechaPrestamos = 'p.usuario_id = ?';
    let condicionFechaVirtuales = 'lvv.usuario_id = ?';
    const paramsPrestamos = [id];
    const paramsVirtuales = [id];

    if (fechaInicio && fechaFin) {
      condicionFechaPrestamos += ' AND DATE(p.fecha_prestamo) BETWEEN ? AND ?';
      paramsPrestamos.push(fechaInicio.toISOString().split('T')[0], fechaFin.toISOString().split('T')[0]);

      condicionFechaVirtuales += ' AND DATE(lvv.fecha_lectura) BETWEEN ? AND ?';
      paramsVirtuales.push(fechaInicio.toISOString().split('T')[0], fechaFin.toISOString().split('T')[0]);
    }

    // Libros físicos (prestamos) - aplicar filtros de fecha
    const [prestamos] = await pool.query(
      `SELECT p.id,
              l.titulo,
              l.autor,
              l.editorial,
              l.isbn,
              l.area,
              l.anio_publicacion,
              l.grado_recomendado,
              p.fecha_prestamo,
              p.fecha_devolucion_esperada,
              p.fecha_devolucion_real,
              p.estado,
              p.validado,
              p.opinion_libro,
              p.resumen_libro,
              p.personajes_principales,
              p.tema_principal,
              p.lecciones_aprendidas,
              p.tipo_prestamo,
              p.observaciones
       FROM prestamos p
       INNER JOIN libros l ON l.id = p.libro_id
       WHERE ${condicionFechaPrestamos}
       ORDER BY p.fecha_prestamo DESC`,
      paramsPrestamos
    );

    // Libros virtuales (lecturas_virtuales + libros_virtuales)
    const [virtuales] = await pool.query(
      `SELECT lv.id,
              lv.titulo,
              lv.autor,
              lv.editorial,
              lv.isbn,
              lv.categoria,
              lv.anio_publicacion,
              lv.preview_link,
              lvv.validado,
              lvv.opinion_libro,
              lvv.resumen_libro,
              lvv.personajes_principales,
              lvv.tema_principal,
              lvv.lecciones_aprendidas,
              lvv.fecha_lectura
       FROM lecturas_virtuales lvv
       INNER JOIN libros_virtuales lv ON lv.id = lvv.libro_virtual_id
       WHERE ${condicionFechaVirtuales}
       ORDER BY lvv.fecha_lectura DESC`,
      paramsVirtuales
    );

    res.render('admin/historial-alumno', {
      usuario, // Pass 'usuario' instead of 'alumno'
      prestamos,
      virtuales,
      periodo: periodo || 'historico',
      navActive: { gestionUsuarios: true }
    });
  } catch (error) {
    console.error('Error al obtener historial de usuario:', error);
    req.session.flash = {
      tipo: 'danger',
      mensaje: 'No se pudo cargar el historial del usuario.', // Generic message
    };
    res.redirect('/usuario/admin/alumnos');
  }
};

// Importar estudiantes desde archivo Excel
exports.importarEstudiantes = async (req, res) => {
  if (!req.file) {
    req.flash('error', 'Por favor, seleccione un archivo para importar');
    return res.redirect('/admin/estudiantes/importar');
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];

    const data = [];
    let headers = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        headers = row.values;
      } else {
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            // Adaptación para que coincida con las claves del objeto esperado (nombre, apellido, email, dni, etc.)
            // Asumiendo que el Excel tiene encabezados como "nombre", "apellido", "email", etc.
            // Si el excel tiene mayúsculas o espacios, habría que normalizar. 
            // Por ahora asumimos que el usuario sube un template correcto o mapeamos simple.
            rowData[header] = cell.value;
          }
        });
        if (Object.keys(rowData).length > 0) data.push(rowData);
      }
    });

    // Procesar cada estudiante
    for (const estudiante of data) {
      try {
        // Helper para obtener string seguro
        const getString = (val) => {
          if (val && typeof val === 'object' && val.text) return val.text;
          return val ? String(val).trim() : '';
        };

        const email = getString(estudiante.email);
        const dni = getString(estudiante.dni);

        if (!email) continue;

        // Verificar si el usuario ya existe
        const [existing] = await pool.query(
          'SELECT id FROM usuarios WHERE email = ?',
          [email]
        );

        if (existing.length > 0) {
          console.log(`Estudiante con email ${email} ya existe, omitiendo...`);
          continue;
        }

        // Crear hash de la contraseña (usando el DNI como contraseña por defecto)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(dni || '123456', salt);

        // Insertar el nuevo estudiante
        await pool.query(
          'INSERT INTO usuarios (nombre, apellido, email, password, dni, grado, seccion, rol, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
          [
            getString(estudiante.nombre),
            getString(estudiante.apellido),
            email,
            hashedPassword,
            dni,
            estudiante.grado || '1',
            estudiante.seccion || 'A',
            'estudiante'
          ]
        );
      } catch (error) {
        console.error(`Error procesando estudiante ${estudiante.email || 'desconocido'}:`, error);
        continue;
      }
    }

    req.flash('success', 'Estudiantes importados exitosamente');
    res.redirect('/admin/estudiantes');
  } catch (error) {
    console.error('Error al importar estudiantes:', error);
    req.flash('error', 'Error al procesar el archivo de importación');
    res.redirect('/admin/estudiantes/importar');
  }
};

// Exportar historial de usuario
exports.exportarHistorialUsuario = async (req, res) => {
  const { id } = req.params;
  const { formato, periodo } = req.query;

  // Función helper para formatear fechas
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getCurrentDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getCurrentDateForFilename = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${year}-${month}-${day}`;
  };

  try {
    // Datos básicos del usuario
    const [usuarios] = await pool.query(
      'SELECT id, nombre, correo, dni, rol, grado, seccion, area_docente FROM usuarios WHERE id = ?',
      [id]
    );
    const usuario = usuarios[0];
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Calcular fechas según periodo
    const { fechaInicio, fechaFin, tituloPeriodo } = calcularFechasPorPeriodo(periodo);

    // Construir condiciones WHERE para filtros de fecha
    let condicionFechaPrestamos = 'p.usuario_id = ?';
    let condicionFechaVirtuales = 'lvv.usuario_id = ?';
    const paramsPrestamos = [id];
    const paramsVirtuales = [id];

    if (fechaInicio && fechaFin) {
      condicionFechaPrestamos += ' AND DATE(p.fecha_prestamo) BETWEEN ? AND ?';
      paramsPrestamos.push(fechaInicio.toISOString().split('T')[0], fechaFin.toISOString().split('T')[0]);

      condicionFechaVirtuales += ' AND DATE(lvv.fecha_lectura) BETWEEN ? AND ?';
      paramsVirtuales.push(fechaInicio.toISOString().split('T')[0], fechaFin.toISOString().split('T')[0]);
    }

    // Obtener datos
    const [prestamos] = await pool.query(
      `SELECT p.id,
              l.titulo,
              l.autor,
              l.editorial,
              l.isbn,
              l.area,
              l.anio_publicacion,
              p.fecha_prestamo,
              p.fecha_devolucion_esperada,
              p.fecha_devolucion_real,
              p.estado
       FROM prestamos p
       INNER JOIN libros l ON l.id = p.libro_id
       WHERE ${condicionFechaPrestamos}
       ORDER BY p.fecha_prestamo DESC`,
      paramsPrestamos
    );

    const [virtuales] = await pool.query(
      `SELECT lv.titulo,
              lv.autor,
              lv.editorial,
              lv.isbn,
              lv.categoria,
              lv.anio_publicacion,
              lvv.fecha_lectura
       FROM lecturas_virtuales lvv
       INNER JOIN libros_virtuales lv ON lv.id = lvv.libro_virtual_id
       WHERE lvv.usuario_id = ?
       ORDER BY lvv.fecha_lectura DESC`,
      [usuarioId]
    );

    const tituloReporte = `Historial de Lectura - ${usuario.nombre}${tituloPeriodo ? ' - ' + tituloPeriodo : ''}`;

    if (formato === 'pdf') {
      try {
        const ReportGenerator = require('../utils/reportGenerator');
        const report = new ReportGenerator(res, tituloReporte, 'landscape',
          `Historial completo de préstamos físicos y lecturas virtuales${tituloPeriodo ? ' del ' + tituloPeriodo.toLowerCase() : ''}.`);
        report.initialize();
        report.drawHeader(req.user);

        // Información del usuario
        report.doc.moveDown(1);
        report.doc.fontSize(12).font('Helvetica-Bold').text('INFORMACIÓN DEL USUARIO', { align: 'left' });
        report.doc.moveDown(0.3);
        report.doc.fontSize(10).font('Helvetica');
        report.doc.text(`Nombre: ${usuario.nombre}`, { align: 'left' });
        report.doc.text(`Correo: ${usuario.correo}`, { align: 'left' });
        if (usuario.rol === 'estudiante') {
          report.doc.text(`Grado: ${usuario.grado || '-'}° - Sección: ${usuario.seccion || '-'}`, { align: 'left' });
        } else {
          report.doc.text(`Rol: ${usuario.rol}${usuario.area_docente ? ` - Área: ${usuario.area_docente}` : ''}`, { align: 'left' });
        }
        if (usuario.dni) {
          report.doc.text(`DNI: ${usuario.dni}`, { align: 'left' });
        }

        // Estadísticas resumidas
        const totalFisicos = prestamos ? prestamos.length : 0;
        const totalVirtuales = virtuales ? virtuales.length : 0;
        const totalGeneral = totalFisicos + totalVirtuales;

        report.doc.moveDown(1);
        report.doc.fontSize(12).font('Helvetica-Bold').text('ESTADÍSTICAS RESUMIDAS', { align: 'left' });
        report.doc.moveDown(0.3);
        report.doc.fontSize(10).font('Helvetica');
        report.doc.text(`Total de libros físicos: ${totalFisicos}`, { align: 'left' });
        report.doc.text(`Total de libros virtuales: ${totalVirtuales}`, { align: 'left' });
        report.doc.text(`Total de lecturas: ${totalGeneral}`, { align: 'left' });
        report.doc.text(`Período: ${tituloPeriodo || 'Todo el tiempo'}`, { align: 'left' });

        // Tabla de préstamos físicos
        if (prestamos && prestamos.length > 0) {
          report.doc.moveDown(1.5);
          report.doc.fontSize(14).font('Helvetica-Bold').text('PRÉSTAMOS DE LIBROS FÍSICOS', { align: 'left' });
          report.doc.moveDown(0.5);
          report.drawTable([
            { header: 'Título', key: 'titulo', width: 180 },
            { header: 'Autor', key: 'autor', width: 100 },
            { header: 'Editorial', key: 'editorial', width: 90 },
            { header: 'ISBN', key: 'isbn', width: 90 },
            { header: 'Área', key: 'area', width: 70 },
            { header: 'Año', key: 'anio_publicacion', width: 50, format: (v) => v || '-' },
            { header: 'F. Préstamo', key: 'fecha_prestamo', width: 90, format: (v) => formatDate(v) },
            { header: 'F. Límite', key: 'fecha_devolucion_esperada', width: 90, format: (v) => formatDate(v) },
            { header: 'F. Devolución', key: 'fecha_devolucion_real', width: 90, format: (v) => v ? formatDate(v) : 'Pendiente' },
            { header: 'Estado', key: 'estado', width: 70 }
          ], prestamos);
        } else {
          report.doc.moveDown(1.5);
          report.doc.fontSize(12).font('Helvetica').text('No hay préstamos de libros físicos registrados.', { align: 'left' });
        }

        // Tabla de libros virtuales
        if (virtuales && virtuales.length > 0) {
          report.doc.moveDown(2);
          report.doc.fontSize(14).font('Helvetica-Bold').text('LECTURAS DE LIBROS VIRTUALES', { align: 'left' });
          report.doc.moveDown(0.5);
          report.drawTable([
            { header: 'Título', key: 'titulo', width: 200 },
            { header: 'Autor', key: 'autor', width: 120 },
            { header: 'Editorial', key: 'editorial', width: 100 },
            { header: 'ISBN', key: 'isbn', width: 100 },
            { header: 'Categoría', key: 'categoria', width: 120 },
            { header: 'Año', key: 'anio_publicacion', width: 60, format: (v) => v || '-' },
            { header: 'F. Lectura', key: 'fecha_lectura', width: 100, format: (v) => formatDate(v) }
          ], virtuales);
        } else {
          report.doc.moveDown(2);
          report.doc.fontSize(12).font('Helvetica').text('No hay lecturas de libros virtuales registradas.', { align: 'left' });
        }

        report.finalize();
      } catch (error) {
        console.error('Error al generar PDF:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al generar el PDF: ' + error.message });
        }
      }

    } else if (formato === 'excel') {
      try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();

        // Hoja de información y estadísticas
        const worksheetInfo = workbook.addWorksheet('Información');
        worksheetInfo.columns = [
          { header: 'Campo', key: 'campo', width: 25 },
          { header: 'Valor', key: 'valor', width: 40 }
        ];
        worksheetInfo.getRow(1).font = { bold: true };

        // Información del usuario
        worksheetInfo.addRow({ campo: 'Nombre', valor: usuario.nombre });
        worksheetInfo.addRow({ campo: 'Correo', valor: usuario.correo });
        if (usuario.rol === 'estudiante') {
          worksheetInfo.addRow({ campo: 'Grado', valor: `${usuario.grado || '-'}°` });
          worksheetInfo.addRow({ campo: 'Sección', valor: usuario.seccion || '-' });
        } else {
          worksheetInfo.addRow({ campo: 'Rol', valor: usuario.rol });
          if (usuario.area_docente) {
            worksheetInfo.addRow({ campo: 'Área', valor: usuario.area_docente });
          }
        }
        if (usuario.dni) {
          worksheetInfo.addRow({ campo: 'DNI', valor: usuario.dni });
        }
        worksheetInfo.addRow({ campo: '', valor: '' }); // Línea en blanco

        // Estadísticas
        const totalFisicos = prestamos ? prestamos.length : 0;
        const totalVirtuales = virtuales ? virtuales.length : 0;
        const totalGeneral = totalFisicos + totalVirtuales;

        worksheetInfo.addRow({ campo: 'ESTADÍSTICAS', valor: '' });
        worksheetInfo.getRow(worksheetInfo.rowCount).font = { bold: true };
        worksheetInfo.addRow({ campo: 'Total Libros Físicos', valor: totalFisicos });
        worksheetInfo.addRow({ campo: 'Total Libros Virtuales', valor: totalVirtuales });
        worksheetInfo.addRow({ campo: 'Total de Lecturas', valor: totalGeneral });
        worksheetInfo.addRow({ campo: 'Período', valor: tituloPeriodo || 'Todo el tiempo' });

        // Hoja de préstamos físicos
        const worksheetFisicos = workbook.addWorksheet('Préstamos Físicos');
        worksheetFisicos.columns = [
          { header: 'Título', key: 'titulo', width: 30 },
          { header: 'Autor', key: 'autor', width: 20 },
          { header: 'Editorial', key: 'editorial', width: 20 },
          { header: 'ISBN', key: 'isbn', width: 15 },
          { header: 'Área', key: 'area', width: 15 },
          { header: 'Año', key: 'anio_publicacion', width: 10 },
          { header: 'Fecha Préstamo', key: 'fecha_prestamo', width: 18 },
          { header: 'Fecha Límite', key: 'fecha_devolucion_esperada', width: 18 },
          { header: 'Fecha Devolución', key: 'fecha_devolucion_real', width: 18 },
          { header: 'Estado', key: 'estado', width: 15 }
        ];
        worksheetFisicos.getRow(1).font = { bold: true };
        if (prestamos && prestamos.length > 0) {
          prestamos.forEach(p => {
            worksheetFisicos.addRow({
              titulo: p.titulo,
              autor: p.autor || '',
              editorial: p.editorial || '',
              isbn: p.isbn || '',
              area: p.area || '',
              anio_publicacion: p.anio_publicacion || '',
              fecha_prestamo: p.fecha_prestamo ? formatDate(p.fecha_prestamo) : '',
              fecha_devolucion_esperada: p.fecha_devolucion_esperada ? formatDate(p.fecha_devolucion_esperada) : '',
              fecha_devolucion_real: p.fecha_devolucion_real ? formatDate(p.fecha_devolucion_real) : 'Pendiente',
              estado: p.estado || ''
            });
          });
        }

        // Hoja de libros virtuales
        const worksheetVirtuales = workbook.addWorksheet('Libros Virtuales');
        worksheetVirtuales.columns = [
          { header: 'Título', key: 'titulo', width: 30 },
          { header: 'Autor', key: 'autor', width: 20 },
          { header: 'Editorial', key: 'editorial', width: 20 },
          { header: 'ISBN', key: 'isbn', width: 15 },
          { header: 'Categoría', key: 'categoria', width: 20 },
          { header: 'Año', key: 'anio_publicacion', width: 10 },
          { header: 'Fecha Lectura', key: 'fecha_lectura', width: 18 }
        ];
        worksheetVirtuales.getRow(1).font = { bold: true };
        if (virtuales && virtuales.length > 0) {
          virtuales.forEach(v => {
            worksheetVirtuales.addRow({
              titulo: v.titulo,
              autor: v.autor || '',
              editorial: v.editorial || '',
              isbn: v.isbn || '',
              categoria: v.categoria || '',
              anio_publicacion: v.anio_publicacion || '',
              fecha_lectura: v.fecha_lectura ? formatDate(v.fecha_lectura) : ''
            });
          });
        }

        const filename = `Historial_${usuario.nombre.replace(/\s+/g, '_')}_${getCurrentDateForFilename()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
      } catch (error) {
        console.error('Error al generar Excel:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al generar el Excel: ' + error.message });
        }
      }

    } else if (formato === 'word') {
      try {
        const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType } = require('docx');

        const totalFisicos = prestamos ? prestamos.length : 0;
        const totalVirtuales = virtuales ? virtuales.length : 0;
        const totalGeneral = totalFisicos + totalVirtuales;

        const children = [
          new Paragraph({
            text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES "DANIEL HERNÁNDEZ"',
            heading: 'Heading1',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: tituloReporte,
            heading: 'Heading2',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Generado: ${formatDateTime(new Date())}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'INFORMACIÓN DEL USUARIO',
            heading: 'Heading3',
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `Nombre: ${usuario.nombre}`,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `Correo: ${usuario.correo}`,
            alignment: AlignmentType.LEFT,
          }),
        ];

        if (usuario.rol === 'estudiante') {
          children.push(new Paragraph({
            text: `Grado: ${usuario.grado || '-'}° - Sección: ${usuario.seccion || '-'}`,
            alignment: AlignmentType.LEFT,
          }));
        } else {
          children.push(new Paragraph({
            text: `Rol: ${usuario.rol}${usuario.area_docente ? ` - Área: ${usuario.area_docente}` : ''}`,
            alignment: AlignmentType.LEFT,
          }));
        }

        if (usuario.dni) {
          children.push(new Paragraph({
            text: `DNI: ${usuario.dni}`,
            alignment: AlignmentType.LEFT,
          }));
        }

        children.push(
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'ESTADÍSTICAS RESUMIDAS',
            heading: 'Heading3',
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `Total de libros físicos: ${totalFisicos}`,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `Total de libros virtuales: ${totalVirtuales}`,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `Total de lecturas: ${totalGeneral}`,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `Período: ${tituloPeriodo || 'Todo el tiempo'}`,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({ text: '' })
        );

        const doc = new Document({
          sections: [{ children }]
        });

        // Tabla de préstamos físicos
        if (prestamos && prestamos.length > 0) {
          doc.sections[0].children.push(
            new Paragraph({
              text: 'PRÉSTAMOS DE LIBROS FÍSICOS',
              heading: 'Heading3',
            }),
            new Paragraph({ text: '' }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: 'Título', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Autor', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Editorial', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'ISBN', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Área', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Año', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'F. Préstamo', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'F. Límite', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'F. Devolución', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Estado', bold: true })], shading: { fill: '2B6CB0' } }),
                  ]
                }),
                ...prestamos.map(p => new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: p.titulo || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.autor || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.editorial || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.isbn || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.area || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.anio_publicacion ? String(p.anio_publicacion) : '-' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.fecha_prestamo ? formatDate(p.fecha_prestamo) : '' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.fecha_devolucion_esperada ? formatDate(p.fecha_devolucion_esperada) : '-' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.fecha_devolucion_real ? formatDate(p.fecha_devolucion_real) : 'Pendiente' })] }),
                    new TableCell({ children: [new Paragraph({ text: p.estado || '' })] }),
                  ]
                }))
              ]
            }),
            new Paragraph({ text: '' })
          );
        }

        // Tabla de libros virtuales
        if (virtuales && virtuales.length > 0) {
          doc.sections[0].children.push(
            new Paragraph({
              text: 'LECTURAS DE LIBROS VIRTUALES',
              heading: 'Heading3',
            }),
            new Paragraph({ text: '' }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: 'Título', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Autor', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Editorial', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'ISBN', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Categoría', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'Año', bold: true })], shading: { fill: '2B6CB0' } }),
                    new TableCell({ children: [new Paragraph({ text: 'F. Lectura', bold: true })], shading: { fill: '2B6CB0' } }),
                  ]
                }),
                ...virtuales.map(v => new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: v.titulo || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: v.autor || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: v.editorial || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: v.isbn || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: v.categoria || '' })] }),
                    new TableCell({ children: [new Paragraph({ text: v.anio_publicacion ? String(v.anio_publicacion) : '-' })] }),
                    new TableCell({ children: [new Paragraph({ text: v.fecha_lectura ? formatDate(v.fecha_lectura) : '' })] }),
                  ]
                }))
              ]
            })
          );
        }

        const filename = `Historial_${usuario.nombre.replace(/\s+/g, '_')}_${getCurrentDateForFilename()}.docx`;
        const buffer = await Packer.toBuffer(doc);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      } catch (error) {
        console.error('Error al generar Word:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al generar el Word: ' + error.message });
        }
      }

    } else {
      res.status(400).json({ error: 'Formato no válido. Use: pdf, excel o word' });
    }
  } catch (error) {
    console.error('Error al exportar historial:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
};

