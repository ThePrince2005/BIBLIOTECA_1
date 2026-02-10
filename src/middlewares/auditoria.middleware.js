const AuditoriaModel = require('../models/auditoria.model');

const auditoriaMiddleware = {
    /**
     * Registra automáticamente acciones importantes
     */
    async registrarAccion(req, res, next) {
        const oldJson = res.json;
        const oldSend = res.send;
        const oldRender = res.render;

        // Capturar respuestas JSON
        res.json = function(data) {
            registrarSiNecesario(req, res, data);
            return oldJson.apply(res, arguments);
        };

        // Capturar respuestas normales
        res.send = function(data) {
            registrarSiNecesario(req, res, data);
            return oldSend.apply(res, arguments);
        };

        // Capturar renderizados de vista
        res.render = function(view, options) {
            registrarSiNecesario(req, res, { view, ...options });
            return oldRender.apply(res, arguments);
        };

        next();
    }
};

/**
 * Determina si una acción debe ser registrada y la registra
 */
async function registrarSiNecesario(req, res, data) {
    try {
        // Solo registrar acciones autenticadas
        if (!req.user) return;

        const { method, path } = req;
        let accion = '';
        let entidad = '';
        let entidad_id = null;
        let detalles = {};

        // Determinar la acción basada en el método y la ruta
        if (path.startsWith('/libros')) {
            entidad = 'LIBRO';
            entidad_id = parseInt(path.split('/')[2]);
            
            switch (method) {
                case 'POST': accion = 'CREAR_LIBRO'; break;
                case 'PUT': accion = 'ACTUALIZAR_LIBRO'; break;
                case 'DELETE': accion = 'ELIMINAR_LIBRO'; break;
            }
        }
        else if (path.startsWith('/prestamos')) {
            entidad = 'PRESTAMO';
            entidad_id = parseInt(path.split('/')[2]);
            
            if (path.includes('/devolucion')) {
                accion = 'REGISTRAR_DEVOLUCION';
            } else {
                switch (method) {
                    case 'POST': accion = 'CREAR_PRESTAMO'; break;
                    case 'PUT': accion = 'ACTUALIZAR_PRESTAMO'; break;
                    case 'DELETE': accion = 'CANCELAR_PRESTAMO'; break;
                }
            }
        }
        else if (path.startsWith('/auth')) {
            entidad = 'USUARIO';
            
            if (path.includes('/login')) {
                accion = 'LOGIN_USUARIO';
                detalles = { email: req.body.email };
            }
            else if (path.includes('/registro')) {
                accion = 'REGISTRO_USUARIO';
                detalles = { 
                    email: req.body.email,
                    nombre: req.body.nombre,
                    rol: req.body.rol
                };
            }
        }

        // Si se identificó una acción para registrar
        if (accion) {
            // Agregar información del estado de la respuesta
            detalles.status = res.statusCode;
            if (res.statusCode >= 400) {
                accion += '_ERROR';
                if (data && data.message) {
                    detalles.error = data.message;
                }
            }

            // Registrar en la auditoría
            await AuditoriaModel.registrar(
                accion,
                entidad,
                entidad_id,
                req.user.id,
                detalles
            );
        }
    } catch (error) {
        console.error('Error al registrar auditoría:', error);
        // No interrumpir el flujo de la aplicación si hay un error en la auditoría
    }
}

module.exports = auditoriaMiddleware;