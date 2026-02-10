const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const Documento = require('../models/documento.model');

// Configuración de almacenamiento para documentos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/documentos/';
        // Crear el directorio si no existe
        fs.mkdir(uploadDir, { recursive: true })
            .then(() => cb(null, uploadDir))
            .catch(err => cb(err, uploadDir));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const originalName = path.basename(file.originalname, ext);
        // Crear un nombre de archivo seguro
        const safeName = originalName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        cb(null, safeName + '-' + uniqueSuffix + ext);
    }
});

// Filtro para tipos de archivos permitidos
const fileFilter = (req, file, cb) => {
    const filetypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Solo se permiten documentos (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    fileFilter: fileFilter
}).single('documentos');

const DocumentoController = {
    // Mostrar documentos públicos para estudiantes y docentes
    mostrarDocumentosPublicos: async (req, res) => {
        try {
            const documentos = await Documento.obtenerTodos() || [];

            // Agrupar documentos por tipo (Case insensitive)
            const normalizeType = (type) => (type || '').toLowerCase().trim();
            const esTipo = (doc, tipo) => normalizeType(doc.tipo_documento) === tipo;

            // Helper to format doc for view
            const format = (d, display, cls) => ({ ...d, tipo: display, class: `kind-${cls}` });

            const examen = documentos.filter(d => esTipo(d, 'examen')).map(d => format(d, 'Examen', 'examen'));
            const guia = documentos.filter(d => esTipo(d, 'guia')).map(d => format(d, 'Guía', 'guia'));
            const resolucion = documentos.filter(d => esTipo(d, 'resolucion')).map(d => format(d, 'Resolución', 'resolucion'));

            const otrosTypes = ['examen', 'guia', 'resolucion'];
            const otro = documentos
                .filter(d => !otrosTypes.includes(normalizeType(d.tipo_documento)))
                .map(d => format(d, 'Otro', 'otro'));

            const allDocs = [...examen, ...guia, ...resolucion, ...otro];
            console.log('DEBUG: allDocs type:', typeof allDocs);
            console.log('DEBUG: Is Array?', Array.isArray(allDocs));
            console.log('DEBUG: Length:', allDocs.length);

            res.render('material/documentos', {
                title: 'Material de Estudio',
                user: req.user || null,
                session: req.session || {},
                documentos: allDocs,
                allDocs,
                success: req.flash('success'),
                error: req.flash('error'),
                nav: { material: true }
            });
        } catch (error) {
            console.error('Error al cargar documentos públicos:', error);
            console.error('Stack:', error.stack);
            req.flash('error', 'Error al cargar los documentos');
            res.redirect('/dashboard');
        }
    },

    // Mostrar formulario de subida de documentos y listar documentos existentes
    mostrarFormulario: async (req, res) => {
        try {
            const documentos = await Documento.obtenerTodos();

            // Agrupar documentos por tipo
            const documentosPorTipo = {
                examen: documentos.filter(d => d.tipo_documento === 'examen'),
                resolucion: documentos.filter(d => d.tipo_documento === 'resolucion'),
                guia: documentos.filter(d => d.tipo_documento === 'guia'),
                otro: documentos.filter(d => d.tipo_documento === 'otro')
            };

            res.render('admin/documentos', {
                title: 'Gestión de Documentos',
                user: req.user || null,
                session: req.session || {},
                documentos: documentosPorTipo,
                success: req.flash('success'),
                error: req.flash('error'),
                navActive: {
                    gestionDocumentos: req.user && req.user.rol === 'admin',
                    material: req.user && req.user.rol === 'docente'
                }
            });
        } catch (error) {
            console.error('Error al mostrar formulario de documentos:', error);
            req.flash('error', 'Error al cargar los documentos');
            res.redirect('/admin/documentos');
        }
    },

    // Manejar la subida de documentos
    subirDocumento: (req, res) => {
        upload(req, res, async (err) => {
            try {
                if (err instanceof multer.MulterError) {
                    // Error de Multer al subir el archivo
                    req.flash('error', `Error al subir el archivo: ${err.message}`);
                    return res.redirect('/admin/documentos');
                } else if (err) {
                    // Un error desconocido ocurrió al subir
                    req.flash('error', `Error: ${err.message}`);
                    return res.redirect('/admin/documentos');
                }

                // Si no hay archivo subido
                if (!req.file) {
                    req.flash('error', 'No se seleccionó ningún archivo para subir');
                    return res.redirect('/admin/documentos');
                }

                // Guardar información en la base de datos
                const { titulo, descripcion, tipo_documento } = req.body;

                const documentoData = {
                    titulo: titulo || path.basename(req.file.originalname, path.extname(req.file.originalname)),
                    descripcion: descripcion || '',
                    nombre_archivo: req.file.originalname,
                    ruta_archivo: req.file.path.replace(/\\/g, '/').replace('public/', ''), // Guardar ruta relativa
                    tipo_archivo: path.extname(req.file.originalname).substring(1).toLowerCase(),
                    tamanio: req.file.size,
                    id_usuario: req.user.id,
                    tipo_documento: (tipo_documento || 'otro').toLowerCase().trim()
                };

                await Documento.crear(documentoData);

                // Obtener todos los documentos actualizados
                const documentos = await Documento.obtenerTodos();

                // Agrupar documentos por tipo
                const documentosPorTipo = {
                    examen: documentos.filter(d => d.tipo_documento === 'examen'),
                    resolucion: documentos.filter(d => d.tipo_documento === 'resolucion'),
                    guia: documentos.filter(d => d.tipo_documento === 'guia'),
                    otro: documentos.filter(d => d.tipo_documento === 'otro')
                };

                // Renderizar la vista con los datos actualizados
                res.render('admin/documentos', {
                    title: 'Gestión de Documentos',
                    user: req.user || null,
                    session: req.session || {},
                    documentos: documentosPorTipo,
                    success: 'Documento subido',
                    error: null,
                    navActive: {
                        gestionDocumentos: req.user && req.user.rol === 'admin',
                        material: req.user && req.user.rol === 'docente'
                    }
                });

            } catch (error) {
                console.error('Error al procesar la subida del documento:', error);
                req.flash('error', 'Error al procesar el documento');
                res.redirect('/admin/documentos');
            }
        });
    },

    // Descargar un documento
    descargarDocumento: async (req, res) => {
        try {
            const { id } = req.params;
            const documento = await Documento.obtenerPorId(id);

            if (!documento) {
                req.flash('error', 'Documento no encontrado');
                return res.redirect('/admin/documentos');
            }

            const filePath = path.join(__dirname, '../..', 'public', documento.ruta_archivo);
            const fileName = documento.nombre_archivo;

            res.download(filePath, fileName);

        } catch (error) {
            console.error('Error al descargar el documento:', error);
            req.flash('error', 'Error al descargar el documento');
            res.redirect('/admin/documentos');
        }
    },

    // Ver un documento dentro del sistema
    verDocumento: async (req, res) => {
        try {
            const { id } = req.params;
            const documento = await Documento.obtenerPorId(id);

            if (!documento) {
                req.flash('error', 'Documento no encontrado');
                return res.redirect('/admin/material');
            }

            const filePath = path.join(__dirname, '../..', 'public', documento.ruta_archivo);
            const fileExt = path.extname(documento.nombre_archivo).toLowerCase();

            // Verificar si el archivo existe
            try {
                await fs.access(filePath);
            } catch (err) {
                req.flash('error', 'El archivo no existe en el servidor');
                return res.redirect('/admin/material');
            }

            // Para PDFs, mostrar en un visor
            if (fileExt === '.pdf') {
                res.render('material/ver-documento', {
                    title: documento.titulo,
                    user: req.user,
                    documento: documento,
                    rutaArchivo: documento.ruta_archivo
                });
            } else {
                // Para otros tipos de archivo, intentar descargar o mostrar mensaje
                req.flash('error', 'Este tipo de archivo solo se puede descargar');
                res.redirect('/admin/material');
            }

        } catch (error) {
            console.error('Error al ver el documento:', error);
            req.flash('error', 'Error al abrir el documento');
            res.redirect('/admin/material');
        }
    },

    // Eliminar un documento
    eliminarDocumento: async (req, res) => {
        try {
            const { id } = req.params;
            const resultado = await Documento.eliminar(id);

            if (resultado) {
                req.flash('success', 'Documento eliminado correctamente');
            } else {
                req.flash('error', 'No se pudo eliminar el documento');
            }

            res.redirect('/admin/documentos');

        } catch (error) {
            console.error('Error al eliminar el documento:', error);
            req.flash('error', 'Error al eliminar el documento');
            res.redirect('/admin/documentos');
        }
    }
};

module.exports = DocumentoController;
