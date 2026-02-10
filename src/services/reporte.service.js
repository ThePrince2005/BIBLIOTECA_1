const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { pool } = require('../config/database');

class ReporteService {
    async generarReportePDF(tipo, filtros) {
        const doc = new PDFDocument();
        const datos = await this.obtenerDatos(tipo, filtros);
        
        // Encabezado
        doc.fontSize(20).text('Biblioteca Escolar', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text(`Reporte de ${tipo}`, { align: 'center' });
        doc.moveDown();

        // Filtros aplicados
        doc.fontSize(12).text('Filtros aplicados:');
        Object.entries(filtros).forEach(([key, value]) => {
            doc.text(`${key}: ${value}`);
        });
        doc.moveDown();

        // Contenido según tipo
        switch (tipo) {
            case 'prestamos':
                this.generarReportePrestamos(doc, datos);
                break;
            case 'estudiantes':
                this.generarReporteEstudiantes(doc, datos);
                break;
            case 'libros':
                this.generarReporteLibros(doc, datos);
                break;
        }

        return doc;
    }

    async generarReporteExcel(tipo, filtros) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(tipo);
        const datos = await this.obtenerDatos(tipo, filtros);

        // Configurar encabezados según tipo
        switch (tipo) {
            case 'prestamos':
                worksheet.columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'Estudiante', key: 'estudiante' },
                    { header: 'Libro', key: 'libro' },
                    { header: 'Fecha Préstamo', key: 'fecha_prestamo' },
                    { header: 'Fecha Devolución', key: 'fecha_devolucion' },
                    { header: 'Estado', key: 'estado' }
                ];
                break;
            case 'estudiantes':
                worksheet.columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'Nombre', key: 'nombre' },
                    { header: 'Grado', key: 'grado' },
                    { header: 'Sección', key: 'seccion' },
                    { header: 'Total Préstamos', key: 'total_prestamos' },
                    { header: 'Préstamos Activos', key: 'prestamos_activos' }
                ];
                break;
            case 'libros':
                worksheet.columns = [
                    { header: 'ID', key: 'id' },
                    { header: 'Título', key: 'titulo' },
                    { header: 'Autor', key: 'autor' },
                    { header: 'Área', key: 'area' },
                    { header: 'Total Préstamos', key: 'total_prestamos' },
                    { header: 'Disponibles', key: 'ejemplares_disponibles' }
                ];
                break;
        }

        // Agregar datos
        worksheet.addRows(datos);

        // Dar formato
        worksheet.getRow(1).font = { bold: true };
        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        return workbook;
    }

    async obtenerDatos(tipo, filtros) {
        const connection = await pool.getConnection();
        try {
            let query = '';
            let params = [];

            switch (tipo) {
                case 'prestamos':
                    query = `
                        SELECT p.id, u.nombre as estudiante, l.titulo as libro,
                               p.fecha_prestamo, p.fecha_devolucion, p.estado
                        FROM prestamos p
                        JOIN usuarios u ON p.usuario_id = u.id
                        JOIN libros l ON p.libro_id = l.id
                        WHERE 1=1
                    `;
                    if (filtros.fechaInicio) {
                        query += ' AND p.fecha_prestamo >= ?';
                        params.push(filtros.fechaInicio);
                    }
                    if (filtros.fechaFin) {
                        query += ' AND p.fecha_prestamo <= ?';
                        params.push(filtros.fechaFin);
                    }
                    if (filtros.estado) {
                        query += ' AND p.estado = ?';
                        params.push(filtros.estado);
                    }
                    break;

                case 'estudiantes':
                    query = `
                        SELECT u.id, u.nombre, u.grado, u.seccion,
                               COUNT(p.id) as total_prestamos,
                               SUM(CASE WHEN p.estado = 'activo' THEN 1 ELSE 0 END) as prestamos_activos
                        FROM usuarios u
                        LEFT JOIN prestamos p ON u.id = p.usuario_id
                        WHERE u.rol = 'estudiante'
                        GROUP BY u.id
                    `;
                    if (filtros.grado) {
                        query += ' HAVING u.grado = ?';
                        params.push(filtros.grado);
                    }
                    break;

                case 'libros':
                    query = `
                        SELECT l.id, l.titulo, l.autor, l.area,
                               COUNT(p.id) as total_prestamos,
                               l.ejemplares - COUNT(CASE WHEN p.estado = 'activo' THEN 1 END) as ejemplares_disponibles
                        FROM libros l
                        LEFT JOIN prestamos p ON l.id = p.libro_id
                        GROUP BY l.id
                    `;
                    if (filtros.area) {
                        query += ' HAVING l.area = ?';
                        params.push(filtros.area);
                    }
                    break;
            }

            const [resultados] = await connection.query(query, params);
            return resultados;
        } finally {
            connection.release();
        }
    }

    _generarTablaPDF(doc, headers, dataRows, columnWidths, rowFormatter) {
        const tableTop = 200;
        let y = tableTop;
        const pageBottom = 700;

        const drawHeader = () => {
            this.generarEncabezadosTabla(doc, y, headers, columnWidths);
            y += 20;
        };

        drawHeader();

        dataRows.forEach(row => {
            if (y > 700) {
                doc.addPage();
                y = tableTop;
                drawHeader();
            }
            rowFormatter(doc, row, y, columnWidths);
            y += 15;
        });
    }

    generarReportePrestamos(doc, datos) {
        const headers = ['ID', 'Estudiante', 'Libro', 'F. Préstamo', 'Estado'];
        const widths = [50, 100, 200, 400, 500];
        const formatter = (doc, prestamo, y, w) => {
            doc.fontSize(10)
               .text(prestamo.id.toString(), w[0], y)
               .text(prestamo.estudiante, w[1], y, { width: w[2] - w[1] - 10 })
               .text(prestamo.libro, w[2], y, { width: w[3] - w[2] - 10 })
               .text(new Date(prestamo.fecha_prestamo).toLocaleDateString('es-PE'), w[3], y)
               .text(prestamo.estado, w[4], y);
        };
        this._generarTablaPDF(doc, headers, datos, widths, formatter);
    }

    generarReporteEstudiantes(doc, datos) {
        const headers = ['ID', 'Nombre', 'Grado', 'Sección', 'T. Préstamos'];
        const widths = [50, 100, 300, 400, 500];
        const formatter = (doc, estudiante, y, w) => {
            doc.fontSize(10)
               .text(estudiante.id.toString(), w[0], y)
               .text(estudiante.nombre, w[1], y, { width: w[2] - w[1] - 10 })
               .text(estudiante.grado.toString(), w[2], y)
               .text(estudiante.seccion, w[3], y)
               .text(estudiante.total_prestamos.toString(), w[4], y);
        };
        this._generarTablaPDF(doc, headers, datos, widths, formatter);
    }

    generarReporteLibros(doc, datos) {
        const headers = ['ID', 'Título', 'Autor', 'Área', 'T. Préstamos', 'Disp.'];
        const widths = [50, 100, 250, 400, 500, 550];
        const formatter = (doc, libro, y, w) => {
            doc.fontSize(10)
               .text(libro.id.toString(), w[0], y)
               .text(libro.titulo, w[1], y, { width: w[2] - w[1] - 10 })
               .text(libro.autor, w[2], y, { width: w[3] - w[2] - 10 })
               .text(libro.area, w[3], y)
               .text(libro.total_prestamos.toString(), w[4], y)
               .text(libro.ejemplares_disponibles.toString(), w[5], y);
        };
        this._generarTablaPDF(doc, headers, datos, widths, formatter);
    }

    generarEncabezadosTabla(doc, y, headers, columnWidths) {
        doc.fontSize(12).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, columnWidths[i], y);
        });
        doc.font('Helvetica');
    }
}

module.exports = new ReporteService();