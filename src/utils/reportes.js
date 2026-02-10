const PDFDocument = require('pdfkit');
const Excel = require('exceljs');

/**
 * Genera un buffer PDF a partir de datos.
 * @param {string} tipo - El tipo de reporte (ej. 'auditoria', 'librosPopulares').
 * @param {Object} data - Los datos para el reporte.
 * @returns {Promise<Buffer>} - El buffer del PDF generado.
 */
async function generarPDF(tipo, data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // Lógica específica para cada tipo de reporte
            switch (tipo) {
                case 'auditoria':
                    doc.fontSize(18).text('Reporte de Auditoría', { align: 'center' });
                    doc.moveDown();
                    doc.fontSize(10);
                    data.registros.forEach(r => {
                        doc.text(`Fecha: ${new Date(r.fecha).toLocaleString()}`);
                        doc.text(`Usuario: ${r.usuario_nombre || 'Sistema'} (${r.usuario_id || ''})`);
                        doc.text(`Acción: ${r.accion} en ${r.tabla_afectada} (ID: ${r.registro_afectado_id || 'N/A'})`);
                        doc.text(`Detalles: ${JSON.stringify(r.detalles)}`);
                        doc.moveDown();
                    });
                    break;
                // Puedes agregar más casos para otros reportes
                default:
                    doc.text(`Reporte de tipo '${tipo}' no implementado.`);
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Genera un buffer Excel a partir de datos.
 * @param {string} tipo - El tipo de reporte (ej. 'auditoria').
 * @param {Object} data - Los datos para el reporte.
 * @returns {Promise<Buffer>} - El buffer del Excel generado.
 */
async function generarExcel(tipo, data) {
    const workbook = new Excel.Workbook();

    switch (tipo) {
        case 'auditoria': {
            const worksheet = workbook.addWorksheet('Auditoría');
            worksheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Fecha', key: 'fecha', width: 25 },
                { header: 'Usuario ID', key: 'usuario_id', width: 15 },
                { header: 'Usuario Nombre', key: 'usuario_nombre', width: 30 },
                { header: 'Acción', key: 'accion', width: 25 },
                { header: 'Tabla Afectada', key: 'tabla_afectada', width: 20 },
                { header: 'Registro ID', key: 'registro_afectado_id', width: 15 },
                { header: 'Detalles', key: 'detalles', width: 50 },
            ];

            // Estilo a encabezados
            worksheet.getRow(1).font = { bold: true };

            data.registros.forEach(r => {
                worksheet.addRow({
                    id: r.id,
                    fecha: new Date(r.fecha),
                    usuario_id: r.usuario_id,
                    usuario_nombre: r.usuario_nombre,
                    accion: r.accion,
                    tabla_afectada: r.tabla_afectada,
                    registro_afectado_id: r.registro_afectado_id,
                    detalles: JSON.stringify(r.detalles)
                });
            });
            break;
        }
        // Puedes agregar más casos para otros reportes
        default: {
            const worksheet = workbook.addWorksheet('Datos');
            worksheet.addRow([`Reporte de tipo '${tipo}' no implementado.`]);
        }
    }

    return await workbook.xlsx.writeBuffer();
}

module.exports = {
    generarPDF,
    generarExcel
};