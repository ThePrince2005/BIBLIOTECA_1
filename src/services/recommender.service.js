const { pool } = require('../config/database');
const Libro = require('../models/libro.model');
const FavoritoModel = require('../models/favorito.model');

/**
 * Servicio sencillo de recomendaciones content-based
 */
const RecommenderService = {
    /**
     * Obtener recomendaciones para un usuario
     * @param {number} userId
     * @param {number} limit
     */
    async getRecommendationsForUser(userId, limit = 6) {
        try {
            if (!userId) return [];

            // 1) Obtener libros (hasta 1000)
            const { libros } = await Libro.buscar({}, 1, 1000);

            // 2) Obtener favoritos del usuario
            let favoritos = [];
            try {
                favoritos = await FavoritoModel.obtenerPorUsuario(userId);
            } catch (e) {
                favoritos = [];
            }

            // 3) Obtener libros prestados por usuario (solo ids, area y autor)
            const [prestadosRows] = await pool.query(
                `SELECT DISTINCT l.id as libro_id, l.area, l.autor
                 FROM prestamos p
                 JOIN libros l ON p.libro_id = l.id
                 WHERE p.usuario_id = ?`,
                [userId]
            );

            const leidosIds = new Set();
            prestadosRows.forEach(r => { if (r.libro_id) leidosIds.add(r.libro_id); });
            favoritos.forEach(f => { if (f.libro_id) leidosIds.add(f.libro_id); });

            // 4) Construir perfil: conteo por area y autor
            const areaCount = {};
            const authorCount = {};

            prestadosRows.forEach(r => {
                if (r.area) areaCount[r.area] = (areaCount[r.area] || 0) + 1;
                if (r.autor) authorCount[r.autor] = (authorCount[r.autor] || 0) + 1;
            });
            favoritos.forEach(f => {
                const a = f.categoria || f.area || '';
                const au = f.autor || '';
                if (a) areaCount[a] = (areaCount[a] || 0) + 1;
                if (au) authorCount[au] = (authorCount[au] || 0) + 1;
            });

            // 5) Scorear libros por coincidencia de area/autor y disponibilidad
            const scored = libros
                .filter(l => l && !leidosIds.has(l.id))
                .map(l => {
                    const areaScore = areaCount[l.area] || 0;
                    const authorScore = authorCount[l.autor] || 0;
                    const availableBoost = (l.ejemplares_disponibles && l.ejemplares_disponibles > 0) ? 0.5 : 0;
                    const score = (areaScore * 2) + (authorScore * 1.2) + availableBoost;
                    return { libro: l, score };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(s => ({
                    id: s.libro.id,
                    titulo: s.libro.titulo,
                    autor: s.libro.autor,
                    area: s.libro.area,
                    portada_url: s.libro.portada_url || s.libro.imagen_portada || '/img/portada-default.jpg',
                    disponibles: s.libro.ejemplares_disponibles || 0,
                    score: Math.round(s.score * 100) / 100
                }));

            return scored;
        } catch (err) {
            console.error('RecommenderService.getRecommendationsForUser error:', err);
            // En caso de error con la consulta avanzada, devolver lista vacía para no romper el dashboard
            return [];
        }
    }
};

module.exports = RecommenderService;
