const FavoritoModel = require('../models/favorito.model');

const FavoritoController = {
    /**
     * Obtener lista de favoritos del usuario
     */
    async listar(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            
            const favoritos = await FavoritoModel.obtenerPorUsuario(req.user.id, page, limit);
            const estadisticas = await FavoritoModel.obtenerEstadisticas(req.user.id);
            
            res.render('favoritos/index', {
                favoritos,
                estadisticas,
                titulo: 'Mis Libros Favoritos'
            });
        } catch (error) {
            console.error('Error al obtener favoritos:', error);
            // Renderizar una vista de error en lugar de JSON
            res.status(500).render('error', { message: 'Error al obtener la lista de favoritos' });
        }
    },

    /**
     * Agregar libro a favoritos
     */
    async agregar(req, res) {
        try {
            const { libro_id } = req.body;
            const id = await FavoritoModel.agregar(req.user.id, libro_id);
            
            res.json({
                success: true,
                message: 'Libro agregado a favoritos',
                id
            });
        } catch (error) {
            console.error('Error al agregar favorito:', error);
            // Si es duplicado, FavoritoModel ahora devuelve el id existente; aquí manejamos otros errores
            res.status(400).json({
                success: false,
                message: error.message || 'Error al agregar el libro a favoritos'
            });
        }
    },

    /**
     * Eliminar libro de favoritos
     */
    async eliminar(req, res) {
        try {
            const { libro_id } = req.params;
            const eliminado = await FavoritoModel.eliminar(req.user.id, libro_id);
            
            if (!eliminado) {
                return res.status(404).json({
                    success: false,
                    message: 'El libro no está en tus favoritos'
                });
            }

            res.json({
                success: true,
                message: 'Libro eliminado de favoritos'
            });
        } catch (error) {
            console.error('Error al eliminar favorito:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar el libro de favoritos'
            });
        }
    },

    /**
     * Verificar si un libro está en favoritos
     */
    async verificar(req, res) {
        try {
            const { libro_id } = req.params;
            const esFavorito = await FavoritoModel.esFavorito(req.user.id, libro_id);
            
            res.json({
                success: true,
                esFavorito
            });
        } catch (error) {
            console.error('Error al verificar favorito:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar el estado del libro'
            });
        }
    }
};

module.exports = FavoritoController;