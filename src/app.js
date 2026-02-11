const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const flash = require('connect-flash');
const compression = require('compression');
const cors = require('cors');
require('dotenv').config();

// Validar variables de entorno
const { printValidationSummary } = require('./utils/envValidator');
const validation = printValidationSummary();
if (!validation.isValid && process.env.NODE_ENV === 'production') {
  console.error('❌ No se puede iniciar en producción con variables de entorno faltantes');
  process.exit(1);
}

// Importar servicios para tareas programadas
const actualizacionGradosService = require('./services/actualizacionGrados.service');
const alertaDevolucionService = require('./services/alertaDevolucion.service');

// Importar conexión DB
const { testConnection } = require('./config/database');

// Inicialización de la aplicación
const app = express();

// 🔹 Configuración de seguridad básica
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
  })
);

// 🔹 Validar variables de entorno críticas
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: JWT_SECRET no está configurado. Es requerido en producción.');
  process.exit(1);
}

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: SESSION_SECRET no está configurado. Es requerido en producción.');
  process.exit(1);
}

// 🔹 Configuración de sesiones
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tu_secreto_super_seguro_cambiar_en_produccion',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      sameSite: 'strict'
    },
    name: 'biblioteca.session' // Cambiar nombre por defecto de cookie
  })
);

// 🔹 Configuración de mensajes flash
app.use(flash());

// 🔹 Límite de peticiones (Rate Limiting)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos por defecto
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 100 : 1000),
  message: {
    error: 'Demasiadas solicitudes desde esta IP, por favor intente de nuevo más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Deshabilitar en desarrollo si se necesita
  skip: (req) => process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true'
});
app.use('/api/', limiter); // Aplicar solo a rutas API
app.use('/auth/', limiter); // Aplicar a rutas de autenticación

// 🔹 Configuración de la vista
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 🔹 Middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

const { attachUser } = require('./middlewares/auth.middleware');

// Adjuntar usuario (si hay token) antes de establecer variables locales
app.use(attachUser);

// Middleware para pasar el usuario a todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// NUEVO: exponer la sesión a las vistas (para mensajes flash)
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Middleware para marcar el enlace activo del navbar
app.use((req, res, next) => {
  const currentPath = req.originalUrl || req.url || '';
  const check = (prefix) =>
    currentPath === prefix || currentPath.startsWith(`${prefix}/`);

  res.locals.navActive = {
    dashboard: check('/dashboard'),
    libros: check('/libros'),
    librosVirtuales: check('/libros-virtuales'),
    librosLeidos: check('/libros-leidos'),
    librosGroup: check('/libros') || check('/libros-virtuales') || check('/libros-leidos'),
    prestamos: check('/prestamos'),
    favoritos: check('/favoritos'),
    configuracion: check('/configuracion'),
    resenas: check('/admin/resenas'),
    material: check('/admin/material') || check('/admin/documentos'),
  };

  next();
});

// 🔹 Importar rutas
const authRoutes = require('./routes/auth.routes');
const libroRoutes = require('./routes/libro.routes');
const prestamoRoutes = require('./routes/prestamo.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const favoritoRoutes = require('./routes/favorito.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const libroVirtualRoutes = require('./routes/libroVirtual.routes');
const libroLeidoRoutes = require('./routes/libroLeido.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const rankingRoutes = require('./routes/ranking.routes');
const reporteRoutes = require('./routes/reporte.routes');
const perfilRoutes = require('./routes/perfil.routes');
const configuracionRoutes = require('./routes/configuracion.routes');
const { resenaRouter, resenaAdminRouter } = require('./routes/resena.routes');
const diccionarioRoutes = require('./routes/diccionario.routes');
const documentoRoutes = require('./routes/documento.routes');

const auditoriaMiddleware = require('./middlewares/auditoria.middleware');

// 🔹 Rutas
app.get('/', (req, res) => {
  // Si el usuario está autenticado, redirigir al dashboard correspondiente
  if (req.user) {
    if (req.user.rol === 'estudiante') {
      return res.redirect('/dashboard/estudiante');
    } else if (req.user.rol === 'docente' || req.user.rol === 'admin') {
      return res.redirect('/dashboard/admin');
    }
  }

  // Si no está autenticado, mostrar la página de selección de rol
  res.render('auth/select-role');
});

// 🔹 Middleware para establecer variables locales en todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.user || null;
  next();
});

// 🔹 Middleware de auditoría para todas las rutas
app.use(auditoriaMiddleware.registrarAccion);

// 🔹 Rutas de la aplicación
app.use('/auth', authRoutes);
app.use('/perfil', perfilRoutes);
app.use('/configuracion', configuracionRoutes);
app.use('/libros', libroRoutes);
app.use('/prestamos', prestamoRoutes);
app.use('/libros-virtuales', libroVirtualRoutes);
app.use('/libros-leidos', libroLeidoRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/favoritos', favoritoRoutes);
app.use('/auditoria', auditoriaRoutes);
app.use('/usuario', usuarioRoutes);
app.use('/reportes', reporteRoutes);
app.use('/ranking', rankingRoutes);
app.use('/resenas', resenaRouter);
app.use('/admin', resenaAdminRouter);
app.use('/admin', documentoRoutes); // Documentos administrativos
app.use('/diccionario', diccionarioRoutes);

// 🔹 Manejo de errores 404
app.use((req, res, next) => {
  // Log solo en desarrollo para evitar spam en producción
  if (process.env.NODE_ENV === 'development') {
    console.log('404 - Ruta no encontrada:', req.method, req.url);
  }

  // Si es una petición AJAX/API, responder con JSON
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: true,
      message: 'Ruta no encontrada',
      path: req.originalUrl
    });
  }

  // Para peticiones normales, renderizar página de error
  res.status(404).render('error', {
    title: 'Error 404 - Página no encontrada',
    message: 'La página que buscas no existe',
    error: { status: 404 },
    statusCode: 404
  });
});

// 🔹 Manejo de errores generales
app.use((err, req, res, next) => {
  // Log del error
  const errorDetails = {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: req.user ? req.user.id : 'anonymous',
    timestamp: new Date().toISOString()
  };

  // Log en consola con más detalles en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', errorDetails);
  } else {
    // En producción, loguear solo información esencial
    console.error(`Error ${err.status || 500}: ${err.message} - ${req.method} ${req.originalUrl}`);
  }

  // Determinar el código de estado
  const statusCode = err.status || err.statusCode || 500;

  // Si es una petición AJAX/API, responder con JSON
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(statusCode).json({
      error: true,
      message: err.message || 'Ha ocurrido un error en el servidor',
      ...(process.env.NODE_ENV === 'development' && { details: err.message, stack: err.stack })
    });
  }

  // Para peticiones normales, renderizar página de error
  res.status(statusCode).render('error', {
    title: `Error ${statusCode}`,
    message: err.message || 'Ha ocurrido un error',
    error: process.env.NODE_ENV === 'development' ? err : {},
    statusCode
  });
});

// 🔹 Configuración del puerto
const PORT = process.env.PORT || 3000;
const MAX_PORT_ATTEMPTS = 10;

const startServer = async () => {
  try {
    console.log('⏳ Iniciando verificación de conexión a base de datos...');
    await testConnection();
    console.log('✅ Verificación de DB completada.');

    console.log(`⏳ Intentando iniciar servidor en puerto ${PORT}...`);
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor iniciado exitosamente en puerto ${PORT}`);
    });

    server.on('error', (err) => {
      console.error('❌ Error fatal al iniciar el servidor HTTP:', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ No se pudo conectar a la base de datos o iniciar el servidor:', err.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
