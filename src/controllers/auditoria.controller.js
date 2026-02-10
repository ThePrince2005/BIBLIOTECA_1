const AuditoriaModel = require('../models/auditoria.model');
const { generarPDF, generarExcel } = require('../utils/reportes');

const AuditoriaController = {
    /**
     * Vista principal de auditoría
     */
    async index(req, res) {
        try {
            const {
                accion,
                entidad,
                usuario_id,
                fecha_inicio,
                fecha_fin,
                pagina = 1
            } = req.query;

            const limite = 50;
            const offset = (pagina - 1) * limite;

            const [registros, estadisticas] = await Promise.all([
                AuditoriaModel.obtenerRegistros({
                    accion,
                    entidad,
                    usuario_id,
                    fecha_inicio,
                    fecha_fin,
                    limite,
                    offset
                }),
                AuditoriaModel.obtenerEstadisticas(fecha_inicio, fecha_fin)
            ]);

            res.render('auditoria/index', {
                registros,
                estadisticas,
                filtros: {
                    accion,
                    entidad,
                    usuario_id,
                    fecha_inicio,
                    fecha_fin,
                    pagina
                }
            });
        } catch (error) {
            console.error('Error en vista de auditoría:', error);
            res.status(500).render('error', {
                message: 'Error al cargar los registros de auditoría',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    },

    /**
     * Exportar registros de auditoría
     */
    async exportar(req, res) {
        try {
            const {
                formato,
                accion,
                entidad,
                usuario_id,
                fecha_inicio,
                fecha_fin
            } = req.query;

            const registros = await AuditoriaModel.obtenerRegistros({
                accion,
                entidad,
                usuario_id,
                fecha_inicio,
                fecha_fin, // pasar fechas a la consulta
                limite: 1000
            });

            // Prepare description for report header
            let descripcion = 'Registro detallado de acciones y eventos del sistema.';
            if (fecha_inicio || fecha_fin) {
                descripcion += ` Período: ${fecha_inicio || 'Inicio'} al ${fecha_fin || 'Presente'}.`;
            }

            if (formato === 'pdf') {
                const ReportGenerator = require('../utils/reportGenerator');
                const report = new ReportGenerator(res, 'Reporte de Auditoría', 'landscape', descripcion);
                report.initialize();
                report.drawHeader(req.user);

                report.drawTable([
                    { header: 'Fecha', key: 'fecha', width: 90, format: (v) => new Date(v).toLocaleString('es-PE') },
                    { header: 'Usuario', key: 'usuario_nombre', width: 120, format: (v) => v || 'Sistema' },
                    { header: 'Acción', key: 'accion', width: 120 },
                    { header: 'Entidad', key: 'tabla_afectada', width: 100 },
                    { header: 'ID Ref.', key: 'registro_afectado_id', width: 50, format: (v) => v || '-' },
                    {
                        header: 'Detalles', key: 'detalles', width: 250, format: (v) => {
                            try {
                                const str = typeof v === 'string' ? v : JSON.stringify(v);
                                // Truncar si es muy largo para evitar romper tabla
                                return str.length > 200 ? str.substring(0, 197) + '...' : str;
                            } catch (e) { return '-'; }
                        }
                    }
                ], registros);

                report.finalize();

            } else if (formato === 'excel') {
                const ExcelJS = require('exceljs');
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Auditoría');

                // Branding 
                worksheet.mergeCells('A1:F1');
                worksheet.getCell('A1').value = 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”';
                worksheet.getCell('A1').font = { bold: true, size: 14 };
                worksheet.getCell('A1').alignment = { horizontal: 'center' };

                worksheet.mergeCells('A2:F2');
                worksheet.getCell('A2').value = 'Reporte de Auditoría';
                worksheet.getCell('A2').font = { bold: true, size: 12 };
                worksheet.getCell('A2').alignment = { horizontal: 'center' };

                // Headers
                worksheet.getRow(4).values = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'ID Referencia', 'Detalles'];
                worksheet.columns = [
                    { key: 'fecha', width: 20 },
                    { key: 'usuario_nombre', width: 25 },
                    { key: 'accion', width: 25 },
                    { key: 'tabla_afectada', width: 20 },
                    { key: 'registro_afectado_id', width: 15 },
                    { key: 'detalles', width: 50 },
                ];

                const headerRow = worksheet.getRow(4);
                headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B6CB0' } };

                // Data
                registros.forEach(r => {
                    let detallesStr = '';
                    try {
                        detallesStr = typeof r.detalles === 'string' ? r.detalles : JSON.stringify(r.detalles);
                    } catch (e) { detallesStr = '-'; }

                    worksheet.addRow({
                        fecha: new Date(r.fecha).toLocaleString('es-PE'),
                        usuario_nombre: r.usuario_nombre || 'Sistema',
                        accion: r.accion,
                        tabla_afectada: r.tabla_afectada,
                        registro_afectado_id: r.registro_afectado_id || '-',
                        detalles: detallesStr
                    });
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Auditoria.xlsx"');
                await workbook.xlsx.write(res);
                res.end();

            } else if (formato === 'word') {
                const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } = require('docx');
                const doc = new Document({
                    sections: [{
                        children: [
                            new Paragraph({
                                changeCase: 'upper',
                                text: 'INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES “DANIEL HERNÁNDEZ”',
                                heading: HeadingLevel.HEADING_1,
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({
                                text: 'Reporte de Auditoría',
                                heading: HeadingLevel.HEADING_2,
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({
                                text: descripcion,
                                alignment: AlignmentType.CENTER,
                            }),
                            new Paragraph({ text: '' }),
                            new Table({
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph({ text: 'Fecha', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Usuario', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Acción', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Entidad', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'ID', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                            new TableCell({ children: [new Paragraph({ text: 'Detalles', bold: true, color: 'FFFFFF' })], shading: { fill: '2B6CB0' } }),
                                        ],
                                    }),
                                    ...registros.map(r => {
                                        let detallesStr = '';
                                        try {
                                            detallesStr = typeof r.detalles === 'string' ? r.detalles : JSON.stringify(r.detalles);
                                            if (detallesStr.length > 200) detallesStr = detallesStr.substring(0, 197) + '...';
                                        } catch (e) { detallesStr = '-'; }

                                        return new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph(new Date(r.fecha).toLocaleString('es-PE'))] }),
                                                new TableCell({ children: [new Paragraph(r.usuario_nombre || 'Sistema')] }),
                                                new TableCell({ children: [new Paragraph(r.accion)] }),
                                                new TableCell({ children: [new Paragraph(r.tabla_afectada)] }),
                                                new TableCell({ children: [new Paragraph(String(r.registro_afectado_id || '-'))] }),
                                                new TableCell({ children: [new Paragraph(detallesStr)] }),
                                            ]
                                        });
                                    })
                                ],
                            }),
                        ],
                    }],
                });

                const buffer = await Packer.toBuffer(doc);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Auditoria.docx"');
                res.send(buffer);

            } else {
                res.status(400).json({ message: 'Formato no soportado' });
            }
        } catch (error) {
            console.error('Error al exportar auditoría:', error);
            res.status(500).json({ message: 'Error al exportar los registros' });
        }
    }
};

module.exports = AuditoriaController;