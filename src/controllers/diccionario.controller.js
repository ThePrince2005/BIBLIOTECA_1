const Diccionario = require('../models/diccionario.model');
const { validationResult } = require('express-validator');

class DiccionarioController {
    static async index(req, res) {
        try {
            const pagina = parseInt(req.query.pagina) || 1;
            const busqueda = req.query.busqueda || '';

            const resultado = await Diccionario.buscar(busqueda, pagina, 20);

            if (req.xhr) {
                return res.json(resultado);
            }

            res.render('diccionario/index', {
                terminos: resultado.terminos,
                paginacion: {
                    paginaActual: pagina,
                    totalPaginas: resultado.paginas,
                    totalRegistros: resultado.total
                },
                busqueda,
                usuario: req.user
            });
        } catch (error) {
            console.error('Error en diccionario:', error);
            res.status(500).render('error', { message: 'Error al cargar el diccionario' });
        }
    }

    static async crear(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            await Diccionario.crear(req.body);
            res.status(201).json({ message: 'Término agregado correctamente' });
        } catch (error) {
            console.error('Error al crear término:', error);
            res.status(500).json({ message: 'Error al agregar término' });
        }
    }

    static async actualizar(req, res) {
        try {
            const actualizado = await Diccionario.actualizar(req.params.id, req.body);
            if (!actualizado) {
                return res.status(404).json({ message: 'Término no encontrado' });
            }
            res.json({ message: 'Término actualizado correctamente' });
        } catch (error) {
            console.error('Error al actualizar término:', error);
            res.status(500).json({ message: 'Error al actualizar término' });
        }
    }

    static async eliminar(req, res) {
        try {
            const eliminado = await Diccionario.eliminar(req.params.id);
            if (!eliminado) {
                return res.status(404).json({ message: 'Término no encontrado' });
            }
            res.json({ message: 'Término eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar término:', error);
            res.status(500).json({ message: 'Error al eliminar término' });
        }
    }
}

module.exports = DiccionarioController;
