const Usuario = require('../models/usuario.model');
const LogroModel = require('../models/logro.model');
const ResenaModel = require('../models/resena.model');
const multer = require('multer');
const path = require('path');

// Configurar multer para subida de fotos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/perfil/');
    },
    filename: function (req, file, cb) {
        cb(null, 'perfil-' + req.user.id + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpg, jpeg, png)'));
    }
}).single('foto');

const PerfilController = {
    // Mostrar perfil
    async mostrarPerfil(req, res) {
        try {
            const usuario = await Usuario.findById(req.user.id);
            if (!usuario) {
                return res.status(404).send('Usuario no encontrado');
            }

            // Obtener estadísticas según el rol
            let datos = {
                usuario,
                badges: [],
                estadisticas: {}
            };

            if (usuario.rol === 'estudiante' || usuario.rol === 'docente') {
                // Estadísticas de lectura (compartidas entre estudiantes y docentes)
                const [stats, logros, resenas, librosElegibles] = await Promise.all([
                    Usuario.obtenerEstadisticasEstudiante(usuario.id) || {},
                    LogroModel.obtenerLogrosUsuario(usuario.id),
                    ResenaModel.listarPorUsuario(usuario.id),
                    ResenaModel.listarLibrosElegibles(usuario.id)
                ]);

                datos.estadisticas = {
                    prestamosActivos: stats.prestamosActivos || 0,
                    totalLeidos: stats.totalLeidos || 0,
                    resenas: stats.resenas || 0,
                    nivel: stats.nivel,
                    progreso: stats.progreso
                };
                datos.badges = logros;
                datos.resenas = resenas;
                datos.resenaPromedio = resenas.length
                    ? (resenas.reduce((acc, item) => acc + (item.calificacion || 0), 0) / resenas.length).toFixed(1)
                    : null;
                datos.librosElegibles = librosElegibles;

            } else if (usuario.rol === 'admin') {
                // Estadísticas de admin (mantenemos las de gestión)
                const stats = await Usuario.obtenerEstadisticasDocente(usuario.id) || {};

                datos.estadisticas = {
                    librosAgregados: stats.librosAgregados || 0,
                    estudiantesActivos: stats.estudiantesActivos || 0,
                    prestamosSupervisados: stats.prestamosSupervisados || 0
                };
            }

            res.render('perfil/index', datos);
        } catch (error) {
            console.error('Error al mostrar perfil:', error);
            res.status(500).send('Error al cargar el perfil');
        }
    },

    // Mostrar formulario para editar perfil
    async mostrarFormularioEditar(req, res) {
        try {
            const usuario = await Usuario.findById(req.user.id);
            if (!usuario) {
                return res.status(404).send('Usuario no encontrado');
            }
            res.render('perfil/editar', { usuario });
        } catch (error) {
            console.error('Error al mostrar formulario de edición de perfil:', error);
            res.status(500).send('Error al cargar la página de edición');
        }
    },

    // Mostrar formulario para cambiar contraseña
    async mostrarFormularioPassword(req, res) {
        try {
            // Solo necesitamos pasar el objeto de usuario por si el navbar lo necesita
            const usuario = await Usuario.findById(req.user.id);
            if (!usuario) {
                return res.status(404).send('Usuario no encontrado');
            }
            res.render('perfil/password', { usuario });
        } catch (error) {
            console.error('Error al mostrar formulario de contraseña:', error);
            res.status(500).send('Error al cargar la página');
        }
    },

    // Actualizar datos del perfil
    async actualizarPerfil(req, res) {
        try {
            upload(req, res, async (err) => {
                if (err) {
                    return res.status(400).json({ error: err.message });
                }

                // Filtrar solo los campos permitidos para actualizar
                const allowedFields = ['nombre', 'telefono', 'grado', 'seccion', 'area_docente', 'correo'];
                const updateData = {};
                for (const key of allowedFields) {
                    if (req.body[key] !== undefined) {
                        // Validación específica para grado
                        if (key === 'grado') {
                            const grado = parseInt(req.body[key]);
                            if (isNaN(grado) || grado < 1 || grado > 5) {
                                return res.status(400).json({ message: 'El grado debe estar entre 1 y 5' });
                            }
                        }
                        updateData[key] = req.body[key];
                    }
                }

                // Si se subió una foto, actualizar la URL
                if (req.file) {
                    updateData.foto_url = '/uploads/perfil/' + req.file.filename;
                }

                // No permitir cambiar la contraseña desde este endpoint
                if (updateData.contrasena) {
                    delete updateData.contrasena;
                }

                const actualizado = await Usuario.actualizar(req.user.id, updateData);

                if (actualizado) {
                    res.json({ success: true, message: 'Perfil actualizado correctamente' });
                } else {
                    res.status(400).json({ message: 'No se pudo actualizar el perfil' });
                }
            });
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            res.status(500).json({ error: 'Error al actualizar el perfil' });
        }
    },

    // Actualizar foto de perfil
    async actualizarFoto(req, res) {
        try {
            upload(req, res, async (err) => {
                if (err) {
                    return res.status(400).json({ error: err.message });
                }

                if (!req.file) {
                    return res.status(400).json({ error: 'No se subió ninguna foto' });
                }

                const updateData = {
                    foto_url: '/uploads/perfil/' + req.file.filename
                };

                const actualizado = await Usuario.actualizar(req.user.id, updateData);

                if (actualizado) {
                    res.json({
                        success: true,
                        message: 'Foto actualizada correctamente',
                        foto_url: updateData.foto_url
                    });
                } else {
                    res.status(400).json({ error: 'No se pudo actualizar la foto' });
                }
            });
        } catch (error) {
            console.error('Error al actualizar foto:', error);
            res.status(500).json({ error: 'Error al actualizar la foto de perfil' });
        }
    },

    // Actualizar contraseña
    async actualizarPassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ message: 'Todos los campos son requeridos.' });
            }

            // 1. Obtener usuario para verificar contraseña actual
            const usuario = await Usuario.findById(userId, true); // true para obtener la contraseña
            if (!usuario) {
                return res.status(404).json({ message: 'Usuario no encontrado.' });
            }

            // 2. Verificar contraseña actual
            const esValida = await Usuario.verificarContrasena(currentPassword, usuario.contrasena);
            if (!esValida) {
                return res.status(401).json({ message: 'La contraseña actual es incorrecta.' });
            }

            // 3. Actualizar con la nueva contraseña (el modelo se encargará de hashear)
            await Usuario.actualizar(userId, { contrasena: newPassword });

            res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
        } catch (error) {
            console.error('Error al actualizar contraseña:', error);
            res.status(500).json({ message: 'Error interno al actualizar la contraseña.' });
        }
    }
};

module.exports = PerfilController;
