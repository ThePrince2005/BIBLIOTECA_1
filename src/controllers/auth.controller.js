const Usuario = require('../models/usuario.model');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

class AuthController {
    /**
     * Mostrar página de inicio de sesión
     */
    static async showLogin(req, res) {
        const role = req.query.role;
        const registered = req.query.registered === 'true';

        if (!role) {
            // Si no hay rol seleccionado, mostrar la página de selección de rol
            return res.render('auth/select-role');
        }

        // Si hay rol seleccionado, mostrar el formulario específico de login
        const view = role === 'estudiante' ? 'auth/login-estudiante' :
            role === 'docente' ? 'auth/login-docente' :
                role === 'admin' ? 'auth/login-admin' :
                    'auth/select-role'; // Fallback

        res.render(view, {
            registered,
            message: registered ? '¡Registro exitoso! Ahora puedes iniciar sesión.' : ''
        });
    }

    /**
     * Mostrar página de registro
     */
    static async showRegistro(req, res) {
        const selectedRole = req.query.role || '';
        const isAdmin = req.user && req.user.rol === 'admin';
        res.render('auth/registro', {
            selectedRole,
            isAdmin,
            usuario: req.user || null
        });
    }

    /**
     * Registro de nuevo usuario
     */
    static async registro(req, res) {
        try {
            // Validar entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.log('Errores de validación:', errors.array());
                return res.status(400).json({ errors: errors.array() });
            }

            // Validación extra de contraseña
            const password = req.body.contrasena || '';
            const pwdLengthOk = password.length >= 8;
            const pwdPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).*$/;
            const pwdPatternOk = pwdPattern.test(password);
            if (!pwdLengthOk) {
                return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
            }
            if (!pwdPatternOk) {
                return res.status(400).json({
                    message:
                        'Debe incluir al menos una letra mayúscula, una minúscula, un número y un símbolo especial.'
                });
            }

            const { correo, dni } = req.body;
            console.log('Datos recibidos:', req.body);

            // Verificar si el usuario ya existe
            const usuarioExistente = await Usuario.buscarPorCorreo(correo);
            if (usuarioExistente) {
                console.log('Correo ya registrado:', correo);
                return res.status(400).json({
                    message:
                        'Este correo electrónico ya está registrado. Por favor, usa otro correo o inicia sesión si ya tienes una cuenta.'
                });
            }

            const dniExistente = await Usuario.buscarPorDNI(dni);
            if (dniExistente) {
                console.log('DNI ya registrado:', dni);
                return res.status(400).json({
                    message:
                        'Este número de DNI ya está registrado en el sistema. Si ya tienes una cuenta, por favor inicia sesión.',
                    tipo: 'dni_duplicado'
                });
            }

            // Preparar datos del usuario
            const userData = {
                ...req.body,
                anio_ingreso: req.body.anio_ingreso || new Date().getFullYear()
            };

            // Validar datos específicos según el rol
            if (userData.rol === 'estudiante') {
                if (!userData.grado || !userData.seccion) {
                    return res.status(400).json({
                        message: 'El grado y la sección son requeridos para estudiantes'
                    });
                }
                const gradoInt = parseInt(userData.grado);
                if (isNaN(gradoInt) || gradoInt < 1 || gradoInt > 5) {
                    return res.status(400).json({
                        message: 'El grado debe estar entre 1° y 5° de secundaria'
                    });
                }
            } else if (userData.rol === 'docente') {
                if (!userData.area_docente) {
                    return res.status(400).json({
                        message: 'El área es requerida para docentes'
                    });
                }
            }

            console.log('Intentando crear usuario con datos:', userData);
            const userId = await Usuario.crear(userData);

            // Si el usuario actual es admin (está autenticado), redirigir a gestión de usuarios
            // Si no está autenticado, es un registro público y debe ir al login
            if (req.user && req.user.rol === 'admin') {
                // Admin creando usuario - redirigir a gestión de usuarios
                return res.status(201).json({
                    message: 'Usuario registrado exitosamente',
                    redirect: '/usuario/admin/alumnos',
                    success: true
                });
            }

            // Generar token para registro público
            const token = jwt.sign(
                { id: userId, rol: req.body.rol },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            // Establecer cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 horas
            });

            // Redireccionar a la página de login con mensaje de éxito
            const redirectUrl = `/auth/login?role=${req.body.rol}&registered=true`;

            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                token,
                redirect: redirectUrl,
                success: true
            });
        } catch (error) {
            console.error('Error en registro:', error);
            if (error.message.includes('Error al crear usuario')) {
                return res.status(500).json({
                    message: 'No se pudo completar el registro. Por favor, intente nuevamente.',
                    details: error.message
                });
            }
            res.status(500).json({
                message: 'Error al registrar usuario. Por favor, verifique su conexión e intente nuevamente.'
            });
        }
    }

    /**
     * Login de usuario
     */
    static async login(req, res) {
        try {
            const { correo, contrasena, role } = req.body;

            console.log('Intento de login:', { correo, role });

            const usuario = await Usuario.buscarPorCorreo(correo);

            if (!role) {
                console.log('Intento de login sin rol especificado');
                return res.status(400).json({
                    message: 'Por favor, seleccione un tipo de usuario',
                    redirect: '/auth'
                });
            }

            if (!usuario) {
                console.log('Usuario no encontrado:', correo);
                return res.status(401).json({
                    message: 'El correo electrónico o la contraseña son incorrectos',
                    redirect: '/auth/login?role=' + role
                });
            }

            console.log('Usuario encontrado:', {
                id: usuario.id,
                rol: usuario.rol,
                rolSolicitado: role
            });

            // Verificar contraseña
            const esValida = await Usuario.verificarContrasena(contrasena, usuario.contrasena);
            if (!esValida) {
                console.log('Contraseña inválida para usuario:', correo);
                return res.status(401).json({
                    message: 'El correo electrónico o la contraseña son incorrectos',
                    redirect: '/auth/login?role=' + role
                });
            }

            // Verificar que el rol coincida de forma estricta
            const roleMatch = usuario.rol === role;

            if (!roleMatch) {
                console.log('Rol no coincide:', { rolUsuario: usuario.rol, rolSolicitado: role });
                return res.status(403).json({
                    message: `La cuenta existe pero no tiene permisos de ${role}. Por favor, inicie sesión con el tipo de usuario correcto.`,
                    redirect: '/auth/login?role=' + role
                });
            }

            // Crear el payload del token
            const payload = {
                id: usuario.id,
                rol: usuario.rol,
                nombre: usuario.nombre
            };
            if (usuario.rol === 'estudiante') {
                payload.grado = usuario.grado;
                payload.seccion = usuario.seccion;
            }

            // Generar token
            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            // Establecer cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 horas
            });

            // Determinar la URL de redirección basada en el rol autenticado
            let redirectUrl = '/dashboard';
            if (usuario.rol === 'estudiante') {
                redirectUrl = '/dashboard/estudiante';
            } else if (usuario.rol === 'docente') {
                redirectUrl = '/dashboard/docente';
            } else if (usuario.rol === 'admin') {
                redirectUrl = '/dashboard/admin';
            }

            res.json({
                message: 'Login exitoso',
                token,
                redirect: redirectUrl,
                usuario: {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    rol: usuario.rol,
                    grado: usuario.grado,
                    seccion: usuario.seccion
                }
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ message: 'Error al iniciar sesión' });
        }
    }

    /**
     * Logout de usuario
     */
    static async logout(req, res) {
        res.clearCookie('token');
        res.redirect('/auth/login');
    }

    /**
     * Obtener perfil del usuario actual
     */
    static async perfil(req, res) {
        try {
            const usuario = await Usuario.buscarPorDNI(req.user.dni);
            if (!usuario) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            const { contrasena, ...datosUsuario } = usuario;
            res.json(datosUsuario);
        } catch (error) {
            console.error('Error al obtener perfil:', error);
            res.status(500).json({ message: 'Error al obtener perfil' });
        }
    }
}

module.exports = AuthController;