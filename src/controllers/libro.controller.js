const Libro = require('../models/libro.model');
const ResenaModel = require('../models/resena.model');
const FavoritoModel = require('../models/favorito.model');
const { validationResult } = require('express-validator');

class LibroController {
    /**
     * Obtener todos los libros con filtros y paginación
     */
    static async obtenerLibros(req, res) {
        try {
            // Scroll infinito: cargar 20 libros por página
            const pagina = parseInt(req.query.pagina) || 1;
            const porPagina = parseInt(req.query.porPagina) || 20;
            const filtros = {
                titulo: req.query.titulo,
                autor: req.query.autor,
                area: req.query.area,
                etiquetas: req.query.etiquetas,
                palabrasClave: req.query.busqueda
            };
            const resultado = await Libro.buscar(filtros, pagina, porPagina);
            const areas = await Libro.obtenerAreas();
            const defaultAreas = [
                'Matemáticas', 'Lengua', 'Ciencias Sociales', 'Ciencias Naturales', 'Historia', 'Geografía',
                'Educación Física', 'Arte', 'Inglés', 'Tecnología', 'Religión'
            ];
            const mergedAreas = Array.from(new Set([...(areas || []), ...defaultAreas])).sort();
            const libroIds = resultado.libros.map(libro => libro.id);
            const resumenPorLibro = libroIds.length
                ? await ResenaModel.obtenerResumenPorLibros(libroIds)
                : {};

            // Obtener favoritos si es estudiante
            let favoritosIds = [];
            if (req.user && req.user.rol === 'estudiante') {
                favoritosIds = await FavoritoModel.obtenerIdsPorUsuario(req.user.id);
            }

            // Si es una petición AJAX, devolver JSON
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.json({ 
                    ...resultado, 
                    resumenPorLibro,
                    favoritosIds,
                    usuario: req.user ? { rol: req.user.rol } : null
                });
            }

            // Renderizar vista unificada (admin.ejs maneja roles internamente)
            return res.render('libros/admin', {
                libros: resultado.libros,
                total: resultado.total,
                paginas: resultado.paginas,
                paginaActual: pagina,
                filtros,
                areas: mergedAreas,
                usuario: req.user,
                resumenPorLibro,
                favoritosIds,
                porPagina: porPagina
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Error interno del servidor');
        }
    }

    /**
     * Obtener un libro específico
     */
    static async obtenerLibro(req, res, next) {
        try {
            const libro = await Libro.buscarPorId(req.params.id);
            if (!libro) {
                return res.status(404).json({ message: 'Libro no encontrado' });
            }

            const [resenas, resumenResenas] = await Promise.all([
                ResenaModel.listarPorLibro(libro.id),
                ResenaModel.obtenerResumenLibro(libro.id)
            ]);

            // Si es una petición AJAX, devolver JSON
            if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return res.json({ libro, resenas, resumenResenas });
            }

            // Si es una petición normal, renderizar vista
            res.render('libros/detalle', {
                libro,
                usuario: req.user,
                resenas,
                resumenResenas
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Crear un nuevo libro
     */
    static async crearLibro(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const libroId = await Libro.crear(req.body);
            res.status(201).json({
                message: 'Libro creado exitosamente',
                id: libroId
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al crear libro' });
        }
    }

    /**
     * Actualizar un libro
     */
    static async actualizarLibro(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const actualizado = await Libro.actualizar(req.params.id, req.body);
            if (!actualizado) {
                return res.status(404).json({ message: 'Libro no encontrado' });
            }

            res.json({ message: 'Libro actualizado exitosamente' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al actualizar libro' });
        }
    }

    /**
     * Eliminar un libro
     */
    static async eliminarLibro(req, res) {
        try {
            const eliminado = await Libro.eliminar(req.params.id);
            if (!eliminado) {
                return res.status(404).json({ message: 'Libro no encontrado' });
            }

            res.json({ message: 'Libro eliminado exitosamente' });
        } catch (error) {
            console.error('Error al eliminar libro:', error);
            if (error.message.includes('préstamos activos')) {
                return res.status(400).json({ message: 'No se puede eliminar el libro porque tiene préstamos activos o pendientes.' });
            } else if (error.message.includes('marcado como favorito')) {
                return res.status(400).json({ message: error.message });
            }
            res.status(500).json({ message: 'Error al eliminar libro' });
        }
    }

    /**
     * Verificar disponibilidad de un libro
     */
    static async verificarDisponibilidad(req, res) {
        try {
            const disponible = await Libro.verificarDisponibilidad(req.params.id);
            res.json({ disponible });
        } catch (error) {
            console.error('Error al verificar disponibilidad:', error);
            res.status(500).json({ message: 'Error al verificar disponibilidad' });
        }
    }

    /**
     * Renderizar formulario de creación
     */
    static async mostrarFormularioCrear(req, res) {
        try {
            const areas = await Libro.obtenerAreas();
            const defaultAreas = [
                'Matemáticas', 'Lengua', 'Ciencias Sociales', 'Ciencias Naturales', 'Historia', 'Geografía',
                'Educación Física', 'Arte', 'Inglés', 'Tecnología', 'Religión'
            ];
            const mergedAreas = Array.from(new Set([...(areas || []), ...defaultAreas])).sort();
            res.render('libros/crear', {
                areas: mergedAreas,
                usuario: req.user,
                libro: null // Fix: Pass null to indicate creation mode
            });
        } catch (error) {
            console.error('Error al mostrar formulario:', error);
            res.status(500).json({ message: 'Error al cargar formulario' });
        }
    }

    /**
     * Renderizar formulario de edición
     */
    static async mostrarFormularioEditar(req, res) {
        try {
            const libro = await Libro.buscarPorId(req.params.id);
            if (!libro) {
                return res.status(404).render('error', {
                    message: 'Libro no encontrado',
                    usuario: req.user
                });
            }

            const areas = await Libro.obtenerAreas();
            const defaultAreas = [
                'Matemáticas', 'Lengua', 'Ciencias Sociales', 'Ciencias Naturales', 'Historia', 'Geografía',
                'Educación Física', 'Arte', 'Inglés', 'Tecnología', 'Religión'
            ];
            const mergedAreas = Array.from(new Set([...(areas || []), ...defaultAreas])).sort();
            res.render('libros/editar', {
                libro,
                areas: mergedAreas,
                usuario: req.user
            });
        } catch (error) {
            console.error('Error al mostrar formulario:', error);
            res.status(500).json({ message: 'Error al cargar formulario' });
        }
    }
}

module.exports = LibroController;