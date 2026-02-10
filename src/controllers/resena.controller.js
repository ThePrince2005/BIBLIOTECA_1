const { validationResult } = require('express-validator');
const ResenaModel = require('../models/resena.model');

const sanitizeComentario = (comentario = '') => {
    return comentario
        .replace(/<[^>]*>?/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
};

class ResenaController {
    static getUsuarioId(req) {
        return (req.user && req.user.id) || (req.session && req.session.usuario && req.session.usuario.id);
    }

    static async obtenerContexto(req, res) {
        try {
            const usuarioId = ResenaController.getUsuarioId(req);
            if (!usuarioId) {
                return res.status(401).json({ message: 'No autenticado' });
            }
            const { libroId } = req.params;
            const contexto = await ResenaModel.obtenerContextoUsuarioLibro(usuarioId, libroId);
            res.json(contexto);
        } catch (error) {
            console.error('Error al obtener contexto de reseña:', error);
            res.status(500).json({ message: 'Error al obtener contexto' });
        }
    }

    static async listarPorLibro(req, res) {
        try {
            const { id } = req.params;
            const [resenas, resumen] = await Promise.all([
                ResenaModel.listarPorLibro(id),
                ResenaModel.obtenerResumenLibro(id)
            ]);
            res.json({ resenas, resumen });
        } catch (error) {
            console.error('Error al listar reseñas:', error);
            res.status(500).json({ message: 'Error al listar reseñas' });
        }
    }

    static async crear(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const usuarioId = ResenaController.getUsuarioId(req);
            const { libro_id, prestamo_id: prestamoIdRaw, calificacion, comentario } = req.body;
            const comentarioSanitizado = sanitizeComentario(comentario);

            const prestamoId = prestamoIdRaw || null;
            let prestamoSeleccionadoId = prestamoId;

            if (!prestamoSeleccionadoId) {
                const contexto = await ResenaModel.obtenerContextoUsuarioLibro(usuarioId, libro_id);
                prestamoSeleccionadoId = contexto.prestamoElegibleId;
            }

            if (!prestamoSeleccionadoId) {
                return res.status(403).json({ message: 'Debes haber prestado este libro para poder reseñarlo.' });
            }

            const prestamoValido = await ResenaModel.verificarPrestamoDisponible(prestamoSeleccionadoId, usuarioId);
            if (!prestamoValido) {
                return res.status(403).json({ message: 'El préstamo seleccionado no es válido para reseñar.' });
            }

            const resenaExistente = await ResenaModel.existeResenaParaPrestamo(prestamoSeleccionadoId);
            if (resenaExistente) {
                return res.status(409).json({ message: 'Ya registraste una reseña para este préstamo.' });
            }

            const insertId = await ResenaModel.crear({
                usuario_id: usuarioId,
                libro_id,
                prestamo_id: prestamoSeleccionadoId,
                calificacion,
                comentario: comentarioSanitizado
            });

            const nuevaResena = await ResenaModel.buscarPorId(insertId);
            res.status(201).json({
                message: '¡Gracias por compartir tu reseña!',
                resena: nuevaResena
            });
        } catch (error) {
            console.error('Error al crear reseña:', error);
            res.status(500).json({ message: 'No se pudo crear la reseña' });
        }
    }

    static async actualizar(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const usuarioId = ResenaController.getUsuarioId(req);
            const { id } = req.params;
            const resena = await ResenaModel.buscarPorId(id);

            if (!resena) {
                return res.status(404).json({ message: 'Reseña no encontrada' });
            }

            const esPropietario = resena.usuario_id === usuarioId;
            const esAdmin = req.user && (req.user.rol === 'admin' || req.user.rol === 'docente');
            if (!esPropietario && !esAdmin) {
                return res.status(403).json({ message: 'No tienes permiso para editar esta reseña' });
            }

            const comentarioSanitizado = sanitizeComentario(req.body.comentario);
            await ResenaModel.actualizar(id, {
                calificacion: req.body.calificacion,
                comentario: comentarioSanitizado
            });

            const actualizada = await ResenaModel.buscarPorId(id);
            res.json({ message: 'Reseña actualizada', resena: actualizada });
        } catch (error) {
            console.error('Error al actualizar reseña:', error);
            res.status(500).json({ message: 'No se pudo actualizar la reseña' });
        }
    }

    static async eliminar(req, res) {
        try {
            const usuarioId = ResenaController.getUsuarioId(req);
            const { id } = req.params;
            const resena = await ResenaModel.buscarPorId(id);

            if (!resena) {
                return res.status(404).json({ message: 'Reseña no encontrada' });
            }

            const esPropietario = resena.usuario_id === usuarioId;
            const esAdmin = req.user && (req.user.rol === 'admin' || req.user.rol === 'docente');
            if (!esPropietario && !esAdmin) {
                return res.status(403).json({ message: 'No tienes permiso para eliminar esta reseña' });
            }

            await ResenaModel.eliminar(id);
            res.json({ message: 'Reseña eliminada' });
        } catch (error) {
            console.error('Error al eliminar reseña:', error);
            res.status(500).json({ message: 'No se pudo eliminar la reseña' });
        }
    }

    static async panelAdmin(req, res) {
        try {
            const resenas = await ResenaModel.listarTodas();
            res.render('admin/resenas', {
                resenas,
                usuario: req.user,
                navActive: { gestionResenas: true }
            });
        } catch (error) {
            console.error('Error al mostrar panel de reseñas:', error);
            res.status(500).render('error', { message: 'Error al cargar reseñas', usuario: req.user });
        }
    }
}

module.exports = ResenaController;
