const ReportGenerator = require('../utils/reportGenerator');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const Prestamo = require('../models/prestamo.model');
const Ranking = require('../models/ranking.model');

class ReporteController {
    /**
     * Genera un reporte de préstamos en PDF, Excel o HTML.
     */
    static async generarReportePrestamos(req, res) {
        try {
            // Lógica de fechas (similar a dashboard)
            const { periodo } = req.query;
            let fechaInicio, fechaFin;
            let tituloPeriodo = '';

            if (periodo) {
                const now = new Date();
                switch (periodo) {
                    case 'anio_actual':
                        fechaInicio = new Date(now.getFullYear(), 0, 1);
                        fechaFin = new Date(now.getFullYear(), 11, 31);
                        tituloPeriodo = `Año ${now.getFullYear()}`;
                        break;
                    case 'mes_actual':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        tituloPeriodo = dayjs(now).format('MMMM YYYY');
                        break;
                    case 'trimestre':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        tituloPeriodo = 'Último Trimestre';
                        break;
                    case 'bimestre':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        tituloPeriodo = 'Último Bimestre';
                        break;
                    case 'hoy':
                        fechaInicio = new Date();
                        fechaFin = new Date(); // Prestamo model handles comparison correctly (start <= date <= end)
                        tituloPeriodo = 'Hoy';
                        break;
                }
            }

            const filtros = {
                estado: req.query.estado,
                grado: req.query.grado ? parseInt(req.query.grado) : null,
                fechaInicio: fechaInicio ? fechaInicio.toISOString().split('T')[0] : req.query.fechaInicio,
                fechaFin: fechaFin ? fechaFin.toISOString().split('T')[0] : req.query.fechaFin
            };
            const formato = req.query.formato || req.query.format || 'pdf';
            const prestamos = await Prestamo.obtenerTodos(filtros);

            if (formato === 'pdf') {
                const report = new ReportGenerator(res, `Reporte de Préstamos ${tituloPeriodo ? '- ' + tituloPeriodo : ''}`, 'landscape', 'Registro detallado de préstamos de libros, incluyendo estado, fechas y estudiantes responsables.');
                report.initialize();
                report.drawHeader(req.user);

                report.drawTable([
                    { header: 'Estudiante', key: 'nombre_estudiante', width: 200 },
                    { header: 'Libro', key: 'titulo', width: 250 },
                    { header: 'F. Préstamo', key: 'fecha_prestamo', width: 110, format: (val) => dayjs(val).format('DD/MM/YYYY HH:mm') },
                    { header: 'F. Devolución', key: 'fecha_devolucion_esperada', width: 110, format: (val) => dayjs(val).format('DD/MM/YYYY HH:mm') },
                    { header: 'Estado', key: 'estado', width: 80 }
                ], prestamos);

                report.finalize();

            } else if (formato === 'word') {
                const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType } = require('docx');

                const doc = new Document({
                    sections: [{
                        children: [
                            new Paragraph({
                                text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                heading: 'Heading1',
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({
                                text: `Reporte de Préstamos ${tituloPeriodo ? '- ' + tituloPeriodo : ''}`,
                                heading: 'Heading2',
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({
                                text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`,
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({ text: '' }),
                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ text: 'Estudiante', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Libro', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'F. Préstamo', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'F. Devolución', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Estado', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                        ],
                                    }),
                                    ...prestamos.map(p => new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph(p.nombre_estudiante)] }),
                                            new TableCell({ children: [new Paragraph(p.titulo)] }),
                                            new TableCell({ children: [new Paragraph(dayjs(p.fecha_prestamo).format('DD/MM/YYYY HH:mm'))] }),
                                            new TableCell({ children: [new Paragraph(dayjs(p.fecha_devolucion_esperada).format('DD/MM/YYYY HH:mm'))] }),
                                            new TableCell({ children: [new Paragraph(p.estado)] }),
                                        ],
                                    })),
                                ],
                            }),
                        ],
                    }],
                });

                const buffer = await Packer.toBuffer(doc);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="Reporte_Prestamos.docx"`);
                res.send(buffer);

            } else if (formato === 'excel') {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Préstamos');

                worksheet.mergeCells('A1:F1');
                worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                worksheet.getCell('A1').font = { bold: true, size: 14 };
                worksheet.getCell('A1').alignment = { horizontal: 'center' };

                worksheet.mergeCells('A2:F2');
                worksheet.getCell('A2').value = `Reporte de Préstamos ${tituloPeriodo ? '- ' + tituloPeriodo : ''}`;
                worksheet.getCell('A2').font = { bold: true, size: 12 };
                worksheet.getCell('A2').alignment = { horizontal: 'center' };

                worksheet.getRow(4).values = ['ID', 'Estudiante', 'Libro', 'Fecha Préstamo', 'Fecha Devolución', 'Estado'];
                worksheet.columns = [
                    { key: 'id', width: 10 },
                    { key: 'nombre_estudiante', width: 30 },
                    { key: 'titulo', width: 40 },
                    { key: 'fecha_prestamo', width: 25 },
                    { key: 'fecha_devolucion_esperada', width: 25 },
                    { key: 'estado', width: 15 }
                ];

                const headerRow = worksheet.getRow(4);
                headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                prestamos.forEach(p => {
                    worksheet.addRow({
                        id: p.id,
                        nombre_estudiante: p.nombre_estudiante,
                        titulo: p.titulo,
                        fecha_prestamo: dayjs(p.fecha_prestamo).format('DD/MM/YYYY HH:mm'),
                        fecha_devolucion_esperada: dayjs(p.fecha_devolucion_esperada).format('DD/MM/YYYY HH:mm'),
                        estado: p.estado
                    });
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="Reporte_Prestamos.xlsx"`);
                await workbook.xlsx.write(res);
                res.end();
            } else {
                const estadisticas = {
                    total: prestamos.length,
                    activos: prestamos.filter(p => p.estado === 'activo').length,
                    vencidos: prestamos.filter(p => p.estado === 'vencido').length,
                    devueltos: prestamos.filter(p => p.estado === 'devuelto').length
                };
                res.render('prestamos/reportes', { prestamos, estadisticas, filtros, usuario: req.user });
            }
        } catch (error) {
            console.error('Error al generar reporte de préstamos:', error);
            res.status(500).send('Error al generar el reporte');
        }
    }

    /**
     * Genera un reporte de listado de estudiantes (PDF, Word, Excel, HTML)
     */
    static async generarReporteEstudiantes(req, res) {
        try {
            const format = req.query.format || req.query.formato || 'pdf';
            const Usuario = require('../models/usuario.model');

            // Filtros opcionales
            const filtros = {
                grado: req.query.grado,
                seccion: req.query.seccion
            };

            const estudiantes = await Usuario.obtenerEstudiantes(filtros);

            if (format === 'pdf') {
                const report = new ReportGenerator(res, 'Listado de Estudiantes', 'portrait', 'Registro completo de alumnos inscritos en la institución.');
                report.initialize();
                report.drawHeader(req.user);

                // Ajuste de anchos para evitar desbordamiento (Total max ~480px para portrait)
                report.drawTable([
                    { header: 'DNI', key: 'dni', width: 65 },
                    { header: 'Estudiante', key: 'nombre', width: 170 },
                    { header: 'Grado', key: 'grado', width: 45, format: (v) => `${v}°` },
                    { header: 'Sección', key: 'seccion', width: 85, format: (v) => v || '-' },
                    { header: 'Correo Institucional', key: 'correo', width: 145 },
                ], estudiantes);

                report.finalize();

            } else if (format === 'word') {
                const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');
                const dayjs = require('dayjs');

                const doc = new Document({
                    sections: [{
                        children: [
                            new Paragraph({
                                text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                heading: HeadingLevel.HEADING_1,
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({ text: 'Listado de Estudiantes', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`, alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: '' }),
                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ text: 'DNI', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Estudiante', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Grado', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Sección', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Correo', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                        ],
                                    }),
                                    ...estudiantes.map(e => new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph(e.dni || '')] }),
                                            new TableCell({ children: [new Paragraph(e.nombre)] }),
                                            new TableCell({ children: [new Paragraph(`${e.grado}°`)] }),
                                            new TableCell({ children: [new Paragraph(e.seccion || '-')] }),
                                            new TableCell({ children: [new Paragraph(e.correo)] }),
                                        ],
                                    })),
                                ],
                            }),
                        ],
                    }],
                });

                const buffer = await Packer.toBuffer(doc);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', `attachment; filename="Listado_Estudiantes.docx"`);
                res.send(buffer);

            } else if (format === 'excel') {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Estudiantes');

                worksheet.mergeCells('A1:E1');
                worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                worksheet.getCell('A1').font = { bold: true, size: 14 };
                worksheet.getCell('A1').alignment = { horizontal: 'center' };

                worksheet.getRow(3).values = ['DNI', 'Estudiante', 'Grado', 'Sección', 'Correo', 'Estado'];
                worksheet.columns = [
                    { key: 'dni', width: 15 },
                    { key: 'nombre', width: 35 },
                    { key: 'grado', width: 10 },
                    { key: 'seccion', width: 10 },
                    { key: 'correo', width: 30 },
                    { key: 'activo', width: 10 }
                ];

                const headerRow = worksheet.getRow(3);
                headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                estudiantes.forEach(e => {
                    worksheet.addRow({
                        dni: e.dni,
                        nombre: e.nombre,
                        grado: e.grado,
                        seccion: e.seccion,
                        correo: e.correo,
                        activo: e.activo ? 'Activo' : 'Inactivo'
                    });
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="Listado_Estudiantes.xlsx"`);
                await workbook.xlsx.write(res);
                res.end();

            } else {
                // Renderizar vista HTML si no se especifica formato
                const estadisticas = {
                    total: estudiantes.length,
                    activos: estudiantes.filter(e => e.activo).length,
                    grados: [...new Set(estudiantes.map(e => e.grado))].sort((a, b) => a - b).join(', ')
                };

                // Intentar renderizar la vista, si existe. La crearemos si no.
                res.render('reportes/estudiantes', {
                    estudiantes,
                    estadisticas,
                    usuario: req.user
                });
            }
        } catch (error) {
            console.error('Error al generar reporte de estudiantes:', error);
            res.status(500).send('Error al generar el reporte: ' + error.message);
        }
    }
    /**
     * Exportar catálogo de libros en PDF, Word o Excel
     */
    static async exportarLibros(req, res) {
        const dayjs = require('dayjs');
        try {
            const { pool } = require('../config/database');
            const connection = await pool.getConnection();

            try {
                const formato = req.query.formato || req.query.format || 'pdf';
                const [libros] = await connection.execute(
                    `SELECT id, titulo, autor, editorial, isbn, area, grado_recomendado, 
                 ejemplares_totales, ejemplares_disponibles, estado 
                 FROM libros ORDER BY titulo`
                );

                if (formato === 'pdf') {
                    const report = new ReportGenerator(res, 'Catálogo de Libros', 'landscape', 'Inventario completo de recursos bibliográficos disponibles en la biblioteca.');
                    report.initialize();
                    report.drawHeader(req.user);

                    report.drawTable([
                        { header: 'Título', key: 'titulo', width: 220 },
                        { header: 'Autor', key: 'autor', width: 150 },
                        { header: 'Área', key: 'area', width: 100 },
                        { header: 'Grado', key: 'grado_recomendado', width: 50, format: (v) => `${v}°` },
                        { header: 'Disp.', key: 'ejemplares_disponibles', width: 40, format: (v, r) => `${v}/${r.ejemplares_totales}` },
                        { header: 'Prest.', key: 'prestados', width: 40, format: (v, r) => (r.ejemplares_totales - r.ejemplares_disponibles) },
                        { header: 'Estado', key: 'estado', width: 60 }
                    ], libros);

                    report.finalize();

                } else if (formato === 'word') {
                    const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');

                    const doc = new Document({
                        sections: [{
                            properties: {},
                            children: [
                                new Paragraph({
                                    text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                    heading: HeadingLevel.HEADING_1,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({
                                    text: 'Catálogo de Libros',
                                    heading: HeadingLevel.HEADING_2,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({
                                    text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({ text: '' }),
                                new Table({
                                    width: { size: 100, type: WidthType.PERCENTAGE },
                                    rows: [
                                        new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph({ text: 'Título', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Autor', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Área', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Grado', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Ejemplares', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Estado', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            ],
                                        }),
                                        ...libros.map(libro => new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph(libro.titulo)] }),
                                                new TableCell({ children: [new Paragraph(libro.autor)] }),
                                                new TableCell({ children: [new Paragraph(libro.area)] }),
                                                new TableCell({ children: [new Paragraph(`${libro.grado_recomendado}°`)] }),
                                                new TableCell({ children: [new Paragraph(`${libro.ejemplares_disponibles}/${libro.ejemplares_totales}`)] }),
                                                new TableCell({ children: [new Paragraph(libro.estado)] }),
                                            ],
                                        })),
                                    ],
                                }),
                                new Paragraph({ text: '' }),
                                new Paragraph({ text: `Total de libros: ${libros.length}` }),
                            ],
                        }],
                    });

                    const buffer = await Packer.toBuffer(doc);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                    res.setHeader('Content-Disposition', `attachment; filename="Catalogo_Libros.docx"`);
                    res.send(buffer);

                } else if (formato === 'excel') {
                    const ExcelJS = require('exceljs');
                    const workbook = new ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Catálogo de Libros');

                    worksheet.mergeCells('A1:I1');
                    worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                    worksheet.getCell('A1').font = { bold: true, size: 14 };
                    worksheet.getCell('A1').alignment = { horizontal: 'center' };

                    worksheet.mergeCells('A2:I2');
                    worksheet.getCell('A2').value = 'Catálogo de Libros';
                    worksheet.getCell('A2').font = { bold: true, size: 12 };
                    worksheet.getCell('A2').alignment = { horizontal: 'center' };

                    worksheet.getRow(4).values = ['Título', 'Autor', 'Editorial', 'ISBN', 'Área', 'Grado', 'Ejemplares Totales', 'Ejemplares Disponibles', 'Estado'];

                    worksheet.columns = [
                        { key: 'titulo', width: 40 },
                        { key: 'autor', width: 30 },
                        { key: 'editorial', width: 25 },
                        { key: 'isbn', width: 15 },
                        { key: 'area', width: 20 },
                        { key: 'grado_recomendado', width: 10 },
                        { key: 'ejemplares_totales', width: 15 },
                        { key: 'ejemplares_disponibles', width: 20 },
                        { key: 'estado', width: 15 }
                    ];

                    const headerRow = worksheet.getRow(4);
                    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF2B6CB0' }
                    };

                    libros.forEach(libro => {
                        worksheet.addRow({
                            titulo: libro.titulo,
                            autor: libro.autor,
                            editorial: libro.editorial,
                            isbn: libro.isbn,
                            area: libro.area,
                            grado_recomendado: libro.grado_recomendado,
                            ejemplares_totales: libro.ejemplares_totales,
                            ejemplares_disponibles: libro.ejemplares_disponibles,
                            estado: libro.estado
                        });
                    });

                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename="Catalogo_Libros.xlsx"`);
                    await workbook.xlsx.write(res);
                    res.end();
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error al exportar libros:', error);
            res.status(500).send('Error al generar el reporte');
        }
    }

    /**
     * Exportar reseñas en PDF, Word o Excel
     */
    static async exportarResenas(req, res) {
        const dayjs = require('dayjs');
        try {
            const { pool } = require('../config/database');
            const connection = await pool.getConnection();

            try {
                const formato = req.query.formato || req.query.format || 'pdf';
                const [resenas] = await connection.execute(
                    `SELECT r.id, u.nombre as estudiante, u.grado, u.seccion,
                 l.titulo as libro, l.autor, r.calificacion, r.comentario, r.fecha_creacion
                 FROM resenas r
                 JOIN usuarios u ON r.usuario_id = u.id
                 JOIN libros l ON r.libro_id = l.id
                 ORDER BY r.fecha_creacion DESC`
                );

                if (formato === 'pdf') {
                    const report = new ReportGenerator(res, 'Reseñas de Libros', 'portrait', 'Opiniones y valoraciones dejadas por los estudiantes sobre los libros leídos.');
                    report.initialize();
                    report.drawHeader(req.user);

                    report.drawTable([
                        { header: 'Estudiante', key: 'estudiante', width: 95, format: (v, r) => `${v}\n(${r.grado}° ${r.seccion || ''})` },
                        { header: 'Libro', key: 'libro', width: 110 },
                        { header: 'Calific.', key: 'calificacion', width: 50, format: (v) => `${v}/5` },
                        { header: 'Comentario', key: 'comentario', width: 160 },
                        { header: 'Fecha', key: 'fecha_creacion', width: 60, format: (v) => dayjs(v).format('DD/MM/YYYY') }
                    ], resenas);

                    report.finalize();

                } else if (formato === 'word') {
                    const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');

                    const doc = new Document({
                        sections: [{
                            children: [
                                new Paragraph({
                                    text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                    heading: HeadingLevel.HEADING_1,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({ text: 'Reseñas de Libros', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
                                new Paragraph({ text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`, alignment: AlignmentType.CENTER }),
                                new Paragraph({ text: '' }),
                                new Table({
                                    width: { size: 100, type: WidthType.PERCENTAGE },
                                    rows: [
                                        new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph({ text: 'Estudiante', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Libro', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Calificación', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Comentario', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Fecha', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            ],
                                        }),
                                        ...resenas.map(r => new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph(`${r.estudiante} (${r.grado}°) ${r.seccion || ''}`)] }),
                                                new TableCell({ children: [new Paragraph(r.libro)] }),
                                                new TableCell({ children: [new Paragraph(`${r.calificacion}/5`)] }),
                                                new TableCell({ children: [new Paragraph(r.comentario)] }),
                                                new TableCell({ children: [new Paragraph(dayjs(r.fecha_creacion).format('DD/MM/YYYY'))] }),
                                            ],
                                        })),
                                    ],
                                }),
                            ],
                        }],
                    });

                    const buffer = await Packer.toBuffer(doc);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                    res.setHeader('Content-Disposition', `attachment; filename="Resenas.docx"`);
                    res.send(buffer);

                } else if (formato === 'excel') {
                    const ExcelJS = require('exceljs');
                    const workbook = new ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Reseñas');

                    worksheet.mergeCells('A1:G1');
                    worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                    worksheet.getCell('A1').font = { bold: true, size: 14 };
                    worksheet.getCell('A1').alignment = { horizontal: 'center' };

                    worksheet.getRow(3).values = ['Estudiante', 'Grado', 'Libro', 'Autor', 'Calificación', 'Comentario', 'Fecha'];

                    worksheet.columns = [
                        { key: 'estudiante', width: 30 },
                        { key: 'grado', width: 10 },
                        { key: 'libro', width: 40 },
                        { key: 'autor', width: 30 },
                        { key: 'calificacion', width: 12 },
                        { key: 'comentario', width: 50 },
                        { key: 'fecha', width: 15 }
                    ];

                    const headerRow = worksheet.getRow(3);
                    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                    resenas.forEach(r => {
                        worksheet.addRow({
                            estudiante: r.estudiante,
                            grado: `${r.grado}° ${r.seccion || ''}`,
                            libro: r.libro,
                            autor: r.autor,
                            calificacion: `${r.calificacion}/5`,
                            comentario: r.comentario,
                            fecha: dayjs(r.fecha_creacion).format('DD/MM/YYYY')
                        });
                    });

                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename="Resenas.xlsx"`);
                    await workbook.xlsx.write(res);
                    res.end();
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error al exportar reseñas:', error);
            res.status(500).send('Error al generar el reporte');
        }
    }

    /**
     * Exportar top lectores en PDF, Word o Excel
     */
    /**
     * Exportar top lectores en PDF, Word o Excel con filtros
     */
    /**
     * Exportar top lectores en PDF, Word o Excel con filtros
     */
    static async exportarTopLectores(req, res) {
        try {
            const Ranking = require('../models/ranking.model');
            const formato = req.query.formato || req.query.format || 'pdf';
            // Default to 'global' if not specified, per user request "unir ambos"
            const { periodo, grado, busqueda, tipo = 'global' } = req.query;

            // Lógica de fechas (sincronizada con DashboardController)
            const now = new Date();
            let fechaInicio, fechaFin;
            let tituloPeriodo = 'Todo el tiempo';

            // Configurar locale español
            require('dayjs/locale/es');
            dayjs.locale('es');

            switch (periodo) {
                case 'anio_anterior':
                    fechaInicio = new Date(now.getFullYear() - 1, 0, 1);
                    fechaFin = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
                    tituloPeriodo = `Año ${now.getFullYear() - 1}`;
                    break;
                case 'anio_actual':
                    fechaInicio = new Date(now.getFullYear(), 0, 1);
                    fechaFin = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                    tituloPeriodo = `Año ${now.getFullYear()}`;
                    break;
                case 'mes_actual':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    // Capitalizar primera letra del mes
                    const mesAnio = dayjs(now).format('MMMM YYYY');
                    tituloPeriodo = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
                    break;
                case 'trimestre':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    tituloPeriodo = 'Último Trimestre';
                    break;
                case 'bimestre':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    tituloPeriodo = 'Último Bimestre';
                    break;
                case 'historico':
                default:
                    tituloPeriodo = 'Histórico';
                    break;
            }

            // CORRECCION: Limitar a 10 resultados como solicita el cliente (mismo que tabla dashboard)
            const filters = { limit: 10, grado, busqueda, tipo };
            if (fechaInicio) {
                // IMPORTANT: Format as YYYY-MM-DD string to match DashboardController and ensure MySQL compatibility
                filters.fechaInicio = fechaInicio.toISOString().split('T')[0];
                filters.fechaFin = fechaFin ? fechaFin.toISOString().split('T')[0] : null;
            }

            const topLectores = await Ranking.obtenerRankingLectores(filters);
            const esDocente = tipo === 'docente';
            const subtitulo = `Reporte: ${tituloPeriodo} ${grado && grado !== 'todos' && !esDocente ? ` - Grado: ${grado}°` : ''}`;
            const tituloReporte = esDocente ? `Top Docentes - ${tituloPeriodo}` : `Top Estudiantes - ${tituloPeriodo}`;
            const descripcionReporte = esDocente
                ? 'Listado de los docentes más destacados por su actividad lectora.'
                : 'Listado de los estudiantes más destacados por su actividad lectora.';

            if (formato === 'pdf') {
                const report = new ReportGenerator(res, tituloReporte, 'portrait', descripcionReporte);
                report.initialize();
                report.drawHeader(req.user);

                // Subtítulo custom
                report.doc.fontSize(12).text(subtitulo, { align: 'center' });
                report.doc.moveDown();

                // Definir columnas con lógica unificada
                let columnas = [];
                if (tipo === 'global' || tipo === 'todos') {
                    columnas = [
                        { header: 'Pos.', key: 'index', width: 30, format: (v, r) => `#${r.index + 1}` },
                        { header: 'Lector', key: 'nombre', width: 160 },
                        { header: 'Tipo', key: 'tipoUsuario', width: 70 },
                        { header: 'G./Área', key: 'infoAdicional', width: 90 },
                        { header: 'Libros', key: 'totalLibros', width: 50 },
                        { header: 'Áreas', key: 'areasLeidas', width: 50 },
                    ];
                } else if (esDocente) {
                    columnas = [
                        { header: 'Pos.', key: 'index', width: 40, format: (v, r) => `#${r.index + 1}` },
                        { header: 'Docente', key: 'nombre', width: 180 },
                        { header: 'Área', key: 'grado', width: 120, format: (v) => v || 'Sin área' },
                        { header: 'Libros', key: 'totalLibros', width: 60 },
                        { header: 'Áreas', key: 'areasLeidas', width: 50 }
                    ];
                } else {
                    columnas = [
                        { header: 'Pos.', key: 'index', width: 40, format: (v, r) => `#${r.index + 1}` },
                        { header: 'Estudiante', key: 'nombre', width: 180 },
                        { header: 'Grado', key: 'grado', width: 60, format: (v) => `${v}°` },
                        { header: 'Libros', key: 'totalLibros', width: 60 },
                        { header: 'Áreas', key: 'areasLeidas', width: 50 }
                    ];
                }

                report.drawTable(columnas, topLectores.map((l, i) => ({ ...l, index: i })));
                report.finalize();

            } else if (formato === 'word') {
                const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');

                const doc = new Document({
                    sections: [{
                        children: [
                            new Paragraph({
                                changeCase: 'upper',
                                text: 'Institución Educativa Emblemática de Varones “Daniel Hernández”',
                                heading: HeadingLevel.HEADING_1,
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({ text: `${tituloReporte}`, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`, alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: subtitulo, alignment: AlignmentType.CENTER }),
                            new Paragraph({ text: '' }),
                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ text: 'Posición', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: esDocente ? 'Docente' : 'Estudiante', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: esDocente ? 'Área' : 'Grado', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Libros Leídos', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Áreas Exploradas', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                        ],
                                    }),
                                    ...topLectores.map((lector, index) => new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph(`#${index + 1}`)] }),
                                            new TableCell({ children: [new Paragraph(lector.nombre)] }),
                                            new TableCell({ children: [new Paragraph(esDocente ? (lector.area_docente || lector.grado || 'Sin área') : `${lector.grado}°`)] }),
                                            new TableCell({ children: [new Paragraph({ text: lector.totalLibros.toString(), alignment: AlignmentType.CENTER })] }),
                                            new TableCell({ children: [new Paragraph({ text: (lector.areasLeidas || 0).toString(), alignment: AlignmentType.CENTER })] }),
                                        ],
                                    })),
                                ],
                            }),
                        ],
                    }],
                });

                const buffer = await Packer.toBuffer(doc);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                const nombreArchivoDoc = esDocente ? `Top_Docentes_${periodo || 'general'}.docx` : `Top_Estudiantes_${periodo || 'general'}.docx`;
                res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoDoc}"`);
                res.send(buffer);

            } else if (formato === 'excel') {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Top Lectores');

                worksheet.mergeCells('A1:E1');
                worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                worksheet.getCell('A1').font = { bold: true, size: 14 };
                worksheet.getCell('A1').alignment = { horizontal: 'center' };

                worksheet.mergeCells('A2:E2');
                worksheet.getCell('A2').value = `${tituloReporte} ${grado && grado !== 'todos' && !esDocente ? `(Grado ${grado}°)` : ''}`;
                worksheet.getCell('A2').font = { bold: true, size: 12 };
                worksheet.getCell('A2').alignment = { horizontal: 'center' };

                worksheet.getRow(4).values = ['Posición', esDocente ? 'Docente' : 'Estudiante', esDocente ? 'Área' : 'Grado', 'Libros Leídos', 'Áreas Exploradas'];

                worksheet.columns = [
                    { key: 'posicion', width: 12 },
                    { key: 'tipoUsuario', width: 15 },
                    { key: 'nombre', width: 35 },
                    { key: 'infoAdicional', width: 25 },
                    { key: 'totalLibros', width: 15 },
                    { key: 'areasLeidas', width: 15 }
                ];

                if (tipo !== 'global' && tipo !== 'todos') {
                    // Restaurar columnas especificas si no es global
                    worksheet.columns = [
                        { key: 'posicion', width: 12 },
                        { key: 'nombre', width: 35 },
                        { key: 'grado', width: 15 },
                        { key: 'totalLibros', width: 15 },
                        { key: 'areasLeidas', width: 18 }
                    ];
                }

                const headerRow = worksheet.getRow(4);
                headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                topLectores.forEach((lector, index) => {
                    worksheet.addRow({
                        posicion: `#${index + 1}`,
                        tipoUsuario: lector.tipoUsuario || (esDocente ? 'Docente' : 'Estudiante'),
                        nombre: lector.nombre,
                        infoAdicional: lector.infoAdicional || (esDocente ? (lector.area_docente || lector.grado || 'Sin área') : `${lector.grado}°`),
                        grado: esDocente ? (lector.area_docente || lector.grado || 'Sin área') : `${lector.grado}°`, // Fallback for specific cols
                        totalLibros: lector.totalLibros,
                        areasLeidas: lector.areasLeidas || 0
                    });
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                const nombreArchivo = esDocente ? `Top_Docentes_${periodo || 'general'}.xlsx` : `Top_Estudiantes_${periodo || 'general'}.xlsx`;
                res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
                await workbook.xlsx.write(res);
                res.end();
            }
        } catch (error) {
            console.error('Error al exportar top lectores:', error);
            res.status(500).send('Error al generar el reporte');
        }
    }

    /**
     * Exportar libros más populares (más leídos)
     */
    static async exportarLibrosPopulares(req, res) {
        const dayjs = require('dayjs');
        try {
            const { pool } = require('../config/database');
            const connection = await pool.getConnection();

            try {
                const formato = req.query.formato || req.query.format || 'pdf';

                // Obtener los 10 libros más prestados
                const [libros] = await connection.execute(
                    `SELECT l.titulo, l.autor, l.area, COUNT(p.id) as total_prestamos
                 FROM libros l
                 LEFT JOIN prestamos p ON l.id = p.libro_id
                 GROUP BY l.id
                 HAVING total_prestamos > 0
                 ORDER BY total_prestamos DESC
                 LIMIT 10`
                );

                if (formato === 'pdf') {
                    const report = new ReportGenerator(res, 'Libros Más Leídos', 'portrait', 'Libros con mayor demanda entre los estudiantes en el periodo actual.');
                    report.initialize();
                    report.drawHeader(req.user);

                    report.drawTable([
                        { header: 'Pos.', key: 'index', width: 40, format: (v, r) => `#${r.index + 1}` },
                        { header: 'Título', key: 'titulo', width: 160 },
                        { header: 'Autor', key: 'autor', width: 120 },
                        { header: 'Área', key: 'area', width: 90 },
                        { header: 'Préstamos', key: 'total_prestamos', width: 70 }
                    ], libros.map((l, i) => ({ ...l, index: i })));

                    report.finalize();

                } else if (formato === 'word') {
                    const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType,
                        HeadingLevel, TextRun, BorderStyle } = require('docx');

                    const doc = new Document({
                        sections: [{
                            children: [
                                new Paragraph({
                                    text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                    heading: HeadingLevel.HEADING_1,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({
                                    text: "LIBROS MÁS LEÍDOS",
                                    heading: HeadingLevel.HEADING_2,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({
                                    text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`,
                                    alignment: AlignmentType.CENTER,
                                    spacing: { after: 400 },
                                }),
                                new Table({
                                    width: { size: 100, type: WidthType.PERCENTAGE },
                                    rows: [
                                        new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph({ text: "Posición", bold: true, color: 'FFFFFF' })], shading: { fill: "2B6CB0" } }),
                                                new TableCell({ children: [new Paragraph({ text: "Título", bold: true, color: 'FFFFFF' })], shading: { fill: "2B6CB0" } }),
                                                new TableCell({ children: [new Paragraph({ text: "Autor", bold: true, color: 'FFFFFF' })], shading: { fill: "2B6CB0" } }),
                                                new TableCell({ children: [new Paragraph({ text: "Préstamos", bold: true, color: 'FFFFFF' })], shading: { fill: "2B6CB0" } }),
                                            ],
                                        }),
                                        ...libros.map((libro, index) => new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph(`${index + 1}`)] }),
                                                new TableCell({ children: [new Paragraph(libro.titulo)] }),
                                                new TableCell({ children: [new Paragraph(libro.autor)] }),
                                                new TableCell({ children: [new Paragraph(libro.total_prestamos.toString())] }),
                                            ],
                                        })),
                                    ],
                                }),
                            ],
                        }],
                    });

                    const buffer = await Packer.toBuffer(doc);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                    res.setHeader('Content-Disposition', `attachment; filename="Libros_Populares.docx"`);
                    res.send(buffer);

                } else if (formato === 'excel') {
                    const ExcelJS = require('exceljs');
                    const workbook = new ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Libros Populares');

                    worksheet.mergeCells('A1:E1');
                    worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                    worksheet.getCell('A1').font = { bold: true, size: 14 };
                    worksheet.getCell('A1').alignment = { horizontal: 'center' };

                    worksheet.getRow(3).values = ['Posición', 'Título', 'Autor', 'Área', 'Total Préstamos'];

                    worksheet.columns = [
                        { key: 'posicion', width: 12 },
                        { key: 'titulo', width: 40 },
                        { key: 'autor', width: 30 },
                        { key: 'area', width: 20 },
                        { key: 'total_prestamos', width: 15 }
                    ];

                    const headerRow = worksheet.getRow(3);
                    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                    libros.forEach((libro, index) => {
                        worksheet.addRow({
                            posicion: index + 1,
                            titulo: libro.titulo,
                            autor: libro.autor,
                            area: libro.area,
                            total_prestamos: libro.total_prestamos
                        });
                    });

                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename="Libros_Populares.xlsx"`);
                    await workbook.xlsx.write(res);
                    res.end();
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('Error al exportar libros populares:', error);
            res.status(500).send('Error al generar el reporte');
        }
    }

    /**
     * Exportar préstamos por grado
     */
    static async exportarPrestamosPorGrado(req, res) {
        const dayjs = require('dayjs');
        try {
            const { pool } = require('../config/database');
            const DashboardModel = require('../models/dashboard.model'); // Importar el modelo
            // Configurar locale español
            require('dayjs/locale/es');
            dayjs.locale('es');

            try {
                const formato = req.query.formato || 'pdf';
                const { periodo } = req.query;

                // Lógica de fechas (sincronizada)
                const now = new Date();
                let fechaInicio, fechaFin;
                let tituloPeriodo = 'Histórico'; // Default title

                switch (periodo) {
                    case 'anio_anterior':
                        fechaInicio = new Date(now.getFullYear() - 1, 0, 1);
                        fechaFin = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
                        tituloPeriodo = `Año ${now.getFullYear() - 1}`;
                        break;
                    case 'anio_actual':
                        fechaInicio = new Date(now.getFullYear(), 0, 1);
                        fechaFin = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                        tituloPeriodo = `Año ${now.getFullYear()}`;
                        break;
                    case 'mes_actual':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                        const mesAnio = dayjs(now).format('MMMM YYYY');
                        tituloPeriodo = mesAnio.charAt(0).toUpperCase() + mesAnio.slice(1);
                        break;
                    case 'trimestre':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                        tituloPeriodo = 'Último Trimestre';
                        break;
                    case 'bimestre':
                        fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                        tituloPeriodo = 'Último Bimestre';
                        break;
                    case 'historico':
                    default:
                        tituloPeriodo = 'Histórico';
                        break;
                }

                const filters = {};
                if (fechaInicio) {
                    filters.fechaInicio = fechaInicio.toISOString().split('T')[0];
                    filters.fechaFin = fechaFin ? fechaFin.toISOString().split('T')[0] : null;
                }

                // Obtener estadísticas de préstamos por grado usando el modelo
                const stats = await DashboardModel.obtenerEstadisticasPorGrado(filters);

                if (formato === 'pdf') {
                    const report = new ReportGenerator(res, `Préstamos por Grado - ${tituloPeriodo}`, 'portrait', 'Detalle de préstamos distribuidos por grados escolares.');
                    report.initialize();
                    report.drawHeader(req.user);

                    report.drawTable([
                        { header: 'Grado', key: 'grado', width: 100, format: (v) => `${v}° Grado` },
                        { header: 'Activos', key: 'activos', width: 80 },
                        { header: 'Vencidos', key: 'vencidos', width: 80 },
                        { header: 'Devueltos', key: 'devueltos', width: 80 },
                        { header: 'Total Histórico', key: 'total', width: 100 }
                    ], stats);

                    report.finalize();

                } else if (formato === 'word') {
                    const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType } = require('docx');
                    // ...
                } else if (formato === 'excel') {
                    const ExcelJS = require('exceljs');
                    const workbook = new ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Préstamos por Grado');

                    worksheet.mergeCells('A1:E1');
                    worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                    worksheet.getCell('A1').font = { bold: true, size: 14 };
                    worksheet.getCell('A1').alignment = { horizontal: 'center' };

                    worksheet.getRow(3).values = ['Grado', 'Activos', 'Vencidos', 'Devueltos', 'Total Histórico'];
                    worksheet.columns = [
                        { key: 'grado', width: 20 },
                        { key: 'activos', width: 15 },
                        { key: 'vencidos', width: 15 },
                        { key: 'devueltos', width: 15 },
                        { key: 'total', width: 20 }
                    ];

                    const headerRow = worksheet.getRow(3);
                    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                    stats.forEach(s => {
                        worksheet.addRow({
                            grado: `${s.grado}° Grado`,
                            activos: s.activos,
                            vencidos: s.vencidos,
                            devueltos: s.devueltos,
                            total: s.total
                        });
                    });

                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename="Prestamos_Por_Grado.xlsx"`);
                    await workbook.xlsx.write(res);
                    res.end();
                }

            } catch (error) {
                console.error('Error al exportar préstamos por grado:', error);
                res.status(500).send('Error al generar el reporte');
            }
        } catch (error) {
            console.error('Error al exportar préstamos por grado (wrapper):', error);
            res.status(500).send('Error al generar el reporte');
        }
    }

    /**
     * Exportar libros prestados por semana
     */
    static async exportarLibrosPorSemana(req, res) {
        try {
            const { pool } = require('../config/database');
            const connection = await pool.getConnection();
            const dayjs = require('dayjs');
            require('dayjs/locale/es');
            dayjs.locale('es');

            try {
                const formato = req.query.formato || req.query.format || 'pdf';

                // Calcular rango de la semana actual (Lunes a Viernes)
                // Con locale es, startOf('week') es Lunes.
                const startOfWeek = dayjs().startOf('week');
                const endOfWeek = startOfWeek.add(4, 'day'); // Viernes
                const rangoFechas = `${startOfWeek.format('DD/MM')} - ${endOfWeek.format('DD/MM')}`;

                const [datos] = await connection.execute(`
                    SELECT 
                        ELT(DAYOFWEEK(fecha_prestamo), 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado') as dia,
                        DAYOFWEEK(fecha_prestamo) as dia_num, 
                        COUNT(*) as total
                    FROM prestamos
                    WHERE fecha_prestamo BETWEEN ? AND ?
                    GROUP BY DAYOFWEEK(fecha_prestamo)
                    ORDER BY dia_num ASC
                `, [startOfWeek.format('YYYY-MM-DD 00:00:00'), endOfWeek.format('YYYY-MM-DD 23:59:59')]);

                // Asegurar que aparezcan todos los días de Lunes a Viernes con su fecha
                const diasSemanaNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
                const datosCompletos = [];

                for (let i = 0; i < 5; i++) {
                    const d = startOfWeek.add(i, 'day'); // startOfWeek is Monday
                    const diaNombre = diasSemanaNombres[i];
                    const diaFecha = `${diaNombre} ${d.format('DD/MM')}`;

                    // Match by simple day name from SQL results (which returns 'Lunes' etc)
                    const datoExistente = datos.find(r => r.dia === diaNombre);

                    datosCompletos.push({
                        dia: diaFecha,
                        total: datoExistente ? datoExistente.total : 0
                    });
                }


                if (formato === 'pdf') {
                    const report = new ReportGenerator(res, 'Préstamos por Semana', 'portrait', `Préstamos por día de la semana (${rangoFechas}).`);
                    report.initialize();
                    report.drawHeader(req.user);
                    report.drawTable([
                        { header: 'Día de la Semana', key: 'dia', width: 200 },
                        { header: 'Total Préstamos', key: 'total', width: 100 }
                    ], datosCompletos);
                    report.finalize();
                } else if (formato === 'excel') {
                    const ExcelJS = require('exceljs');
                    const workbook = new ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Préstamos por Semana');

                    // Branding
                    worksheet.mergeCells('A1:B1');
                    worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                    worksheet.getCell('A1').font = { bold: true, size: 14 };
                    worksheet.getCell('A1').alignment = { horizontal: 'center' };

                    worksheet.mergeCells('A2:B2');
                    worksheet.getCell('A2').value = `Préstamos por Semana (${rangoFechas})`;
                    worksheet.getCell('A2').font = { bold: true, size: 12 };
                    worksheet.getCell('A2').alignment = { horizontal: 'center' };

                    worksheet.getRow(4).values = ['Día', 'Total'];
                    worksheet.columns = [{ key: 'dia', width: 30 }, { key: 'total', width: 15 }];

                    const headerRow = worksheet.getRow(4);
                    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                    datosCompletos.forEach(d => worksheet.addRow(d));

                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', 'attachment; filename="Prestamos_Semana.xlsx"');
                    await workbook.xlsx.write(res);
                    res.end();
                } else if (formato === 'word') {
                    const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');
                    const doc = new Document({
                        sections: [{
                            children: [
                                new Paragraph({
                                    text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                    heading: HeadingLevel.HEADING_1,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({ text: `Préstamos por Semana (${rangoFechas})`, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
                                new Paragraph({ text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`, alignment: AlignmentType.CENTER }),
                                new Paragraph({ text: '' }),
                                new Table({
                                    width: { size: 100, type: WidthType.PERCENTAGE },
                                    rows: [
                                        new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph({ text: 'Día', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                                new TableCell({ children: [new Paragraph({ text: 'Total', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } })
                                            ]
                                        }),
                                        ...datosCompletos.map(d => new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph(d.dia)] }),
                                                new TableCell({ children: [new Paragraph(String(d.total))] })
                                            ]
                                        }))
                                    ]
                                })
                            ]
                        }]
                    });
                    const buffer = await Packer.toBuffer(doc);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                    res.setHeader('Content-Disposition', 'attachment; filename="Prestamos_Semana.docx"');
                    res.send(buffer);
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('Error');
        }
    }

    /**
     * Exportar actividad mensual
     */
    static async exportarActividadMensual(req, res) {
        try {
            const { pool } = require('../config/database');
            const connection = await pool.getConnection();

            try {
                const formato = req.query.formato || req.query.format || 'pdf';
                const currentYear = new Date().getFullYear();

                // Consultamos actividad del año actual
                const [datos] = await connection.execute(`
                    SELECT 
                        DATE_FORMAT(fecha_prestamo, '%Y-%m') as mes,
                        COUNT(*) as total
                    FROM prestamos
                    WHERE YEAR(fecha_prestamo) = ?
                    GROUP BY DATE_FORMAT(fecha_prestamo, '%Y-%m')
                    ORDER BY mes ASC
                `, [currentYear]);

                // Rellenar todos los meses del año (01 a 12)
                const datosCompletos = [];
                for (let i = 0; i < 12; i++) {
                    const date = dayjs().year(currentYear).month(i).startOf('month');
                    const mesStr = date.format('YYYY-MM');
                    const mesNombre = date.format('MMMM'); // Nombre del mes en español

                    const datoExistente = datos.find(d => d.mes === mesStr);
                    datosCompletos.push({
                        mes: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1), // Capitalizar
                        total: datoExistente ? datoExistente.total : 0
                    });
                }
                const datosFormateados = datosCompletos;

                if (formato === 'pdf') {
                    const report = new ReportGenerator(res, 'Actividad Mensual', 'portrait', `Total de libros leídos por mes (${currentYear}).`);
                    report.initialize();
                    report.drawHeader(req.user);
                    report.drawTable([
                        { header: 'Mes', key: 'mes', width: 200 },
                        { header: 'Libros Leídos', key: 'total', width: 100 }
                    ], datosFormateados);
                    report.finalize();
                } else if (formato === 'excel') {
                    const workbook = new ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Actividad Mensual');

                    // Branding headers like before...
                    worksheet.mergeCells('A1:B1');
                    worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                    worksheet.getCell('A1').font = { bold: true, size: 14 };
                    worksheet.getCell('A1').alignment = { horizontal: 'center' };

                    worksheet.mergeCells('A2:B2');
                    worksheet.getCell('A2').value = `Actividad Mensual (Año ${currentYear})`;
                    worksheet.getCell('A2').font = { bold: true, size: 12 };
                    worksheet.getCell('A2').alignment = { horizontal: 'center' };

                    worksheet.getRow(3).values = ['Mes', 'Total Libros'];
                    worksheet.columns = [{ key: 'mes', width: 30 }, { key: 'total', width: 15 }];

                    const headerRow = worksheet.getRow(3);
                    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                    datosFormateados.forEach(d => worksheet.addRow(d));

                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', 'attachment; filename="Actividad_Mensual.xlsx"');
                    await workbook.xlsx.write(res);
                    res.end();
                } else if (formato === 'word') {
                    const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');
                    const doc = new Document({
                        sections: [{
                            children: [
                                new Paragraph({
                                    text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                    heading: HeadingLevel.HEADING_1,
                                    alignment: AlignmentType.CENTER,
                                }),
                                new Paragraph({ text: `Actividad Mensual (Año ${currentYear})`, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
                                new Paragraph({ text: `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`, alignment: AlignmentType.CENTER }),
                                new Paragraph({ text: '' }),
                                new Table({
                                    width: { size: 100, type: WidthType.PERCENTAGE },
                                    rows: [
                                        new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph({ text: 'Mes', bold: true })] }),
                                                new TableCell({ children: [new Paragraph({ text: 'Total', bold: true })] })
                                            ]
                                        }),
                                        ...datosFormateados.map(d => new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph(d.mes)] }),
                                                new TableCell({ children: [new Paragraph(String(d.total))] })
                                            ]
                                        }))
                                    ]
                                })
                            ]
                        }]
                    });
                    const buffer = await Packer.toBuffer(doc);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                    res.setHeader('Content-Disposition', 'attachment; filename="Actividad_Mensual.docx"');
                    res.send(buffer);
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('Error');
        }
    }

    /**
     * Exportar lectura por grado
     */
    static async exportarLecturaPorGrado(req, res) {
        try {
            const { pool } = require('../config/database');
            const connection = await pool.getConnection();

            try {
                const formato = req.query.formato || req.query.format || 'pdf';
                const [datos] = await connection.execute(`
                    SELECT 
                        u.grado,
                        COUNT(*) as total
                    FROM prestamos p
                    JOIN usuarios u ON p.usuario_id = u.id
                    WHERE u.rol = 'estudiante' AND u.grado BETWEEN 1 AND 5
                    GROUP BY u.grado
                    ORDER BY u.grado ASC
                `);

                // Ensure all grades 1-5 are present, defaulting to 0 if no data
                const datosFormateados = [];
                for (let i = 1; i <= 5; i++) {
                    const gradoData = datos.find(d => d.grado === i);
                    datosFormateados.push({
                        grado: `${i}° Grado`,
                        total: gradoData ? gradoData.total : 0
                    });
                }

                if (formato === 'pdf') {
                    const report = new ReportGenerator(res, 'Lectura por Grado', 'portrait', 'Ranking de grados con mayor actividad.');
                    report.initialize();
                    report.drawHeader(req.user);
                    report.drawTable([
                        { header: 'Grado', key: 'grado', width: 200 },
                        { header: 'Total Libros', key: 'total', width: 100 }
                    ], datosFormateados);
                    report.finalize();
                } else if (formato === 'excel') {
                    const workbook = new ExcelJS.Workbook();
                    const worksheet = workbook.addWorksheet('Lectura por Grado');

                    worksheet.mergeCells('A1:B1');
                    worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                    worksheet.getCell('A1').font = { bold: true, size: 14 };
                    worksheet.getCell('A1').alignment = { horizontal: 'center' };

                    worksheet.getRow(3).values = ['Grado', 'Total Libros'];
                    worksheet.columns = [{ key: 'grado', width: 30 }, { key: 'total', width: 15 }];

                    const headerRow = worksheet.getRow(3);
                    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                    datosFormateados.forEach(d => worksheet.addRow(d));

                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', 'attachment; filename="Lectura_Grado.xlsx"');
                    await workbook.xlsx.write(res);
                    res.end();
                } else if (formato === 'word') {
                    const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');
                    const doc = new Document({
                        sections: [{
                            children: [
                                new Paragraph({ text: 'Lectura por Grado', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                                new Table({
                                    width: { size: 100, type: WidthType.PERCENTAGE },
                                    rows: [
                                        new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph({ text: 'Grado', bold: true })] }),
                                                new TableCell({ children: [new Paragraph({ text: 'Total', bold: true })] })
                                            ]
                                        }),
                                        ...datosFormateados.map(d => new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph(d.grado)] }),
                                                new TableCell({ children: [new Paragraph(String(d.total))] })
                                            ]
                                        }))
                                    ]
                                })
                            ]
                        }]
                    });
                    const buffer = await Packer.toBuffer(doc);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                    res.setHeader('Content-Disposition', 'attachment; filename="Lectura_Grado.docx"');
                    res.send(buffer);
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error(error);
            res.status(500).send('Error');
        }
    }
}

module.exports = ReporteController;
