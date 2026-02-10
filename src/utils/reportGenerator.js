const PDFDocument = require('pdfkit');

// Función helper para formatear fechas
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const formatDateTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getCurrentDateForFilename = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${year}-${month}-${day}`;
};

class ReportGenerator {
    constructor(res, title, orientation = 'portrait', description = '') {
        this.doc = new PDFDocument({
            margin: 50,
            layout: orientation,
            size: 'A4',
            bufferPages: true,
            autoFirstPage: true
        });
        this.res = res;
        this.title = title;
        this.orientation = orientation;
        this.description = description;
    }

    initialize() {
        const filename = `${this.title.replace(/\s+/g, '_')}_${getCurrentDateForFilename()}.pdf`;
        this.res.setHeader('Content-Type', 'application/pdf');
        this.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        this.doc.pipe(this.res);
    }

    drawHeader(usuario) {
        const doc = this.doc;
        const width = doc.page.width;

        // --- Branding ---
        // Fondo sutil para el encabezado
        doc.rect(0, 0, width, 110).fillColor('#f8f9fa').fill();

        // Nombre de la Institución
        doc.fillColor('#1e3a8a') // Azul oscuro
            .font('Helvetica-Bold')
            .fontSize(16)
            .text('INSTITUCIÓN EDUCATIVA EMBLEMÁTICA DE VARONES', 0, 30, { align: 'center' });

        doc.fontSize(14)
            .text('“DANIEL HERNÁNDEZ”', { align: 'center' });

        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#64748b') // Gris azulado
            .text('Pampas - Tayacaja', { align: 'center' });

        // Línea divisoria decorativa
        doc.moveTo(50, 90)
            .lineTo(width - 50, 90)
            .strokeColor('#3b82f6') // Azul brillante
            .lineWidth(2)
            .stroke();

        // --- Título del Reporte ---
        doc.moveDown(3); // Espacio después del branding

        // Título principal
        const currentY = doc.y + 10;
        doc.fillColor('#111827') // Negro casi puro
            .fontSize(20)
            .font('Helvetica-Bold')
            .text(this.title.toUpperCase(), { align: 'center' });

        // Metadatos (Fecha y Usuario)
        doc.moveDown(0.5);
        doc.fontSize(9)
            .font('Helvetica')
            .fillColor('#4b5563')
            .text(`Generado: ${formatDateTime(new Date())}`, { align: 'center' });

        if (usuario) {
            doc.text(`Por: ${usuario.nombre || 'Sistema'}`, { align: 'center' });
        }

        // --- Descripción / Indicaciones ---
        if (this.description) {
            doc.moveDown(1);
            // Dibujar cuadro de descripción tipo "Info"
            const descX = 80;
            const descWidth = width - 160;
            const descY = doc.y;

            // Fondo del cuadro de descripción
            doc.rect(descX - 10, descY - 5, descWidth + 20, 30) // Altura inicial estimada
                .fillColor('#eff6ff') // Azul muy claro
                .fill();

            // Borde izquierdo azul lateral
            doc.rect(descX - 10, descY - 5, 3, 30)
                .fillColor('#3b82f6')
                .fill();

            doc.fillColor('#1e40af') // Azul texto
                .font('Helvetica-Oblique')
                .fontSize(10)
                .text(this.description, descX, descY, {
                    align: 'center',
                    width: descWidth
                });

            doc.moveDown(2);
        } else {
            doc.moveDown(2);
        }
    }

    drawTable(columns, data) {
        const doc = this.doc;
        const margin = 50;
        const availableWidth = doc.page.width - (margin * 2);

        // --- 1. Calcular anchos de columnas ---
        const totalDefinedWidth = columns.reduce((acc, col) => acc + (col.width || 0), 0);
        const undefinedCols = columns.filter(c => !c.width).length;
        // Si sobra o falta espacio, ajustar
        let defaultWidth = 0;
        if (undefinedCols > 0) {
            defaultWidth = (availableWidth - totalDefinedWidth) / undefinedCols;
        }

        const tableCols = columns.map(col => ({
            ...col,
            width: col.width || defaultWidth
        }));

        // --- 2. Función para dibujar Encabezado de Tabla ---
        const drawTableHeader = (y) => {
            const headerHeight = 25;

            // Fondo del encabezado
            doc.rect(margin, y, availableWidth, headerHeight)
                .fillColor('#1e40af') // Azul intenso
                .fill();

            // Texto del encabezado
            let currentX = margin;
            doc.fillColor('#ffffff')
                .font('Helvetica-Bold')
                .fontSize(10);

            tableCols.forEach(col => {
                doc.text(col.header, currentX + 5, y + 8, { // +8 para centrar verticalmente manual
                    width: col.width - 10,
                    align: 'left'
                });
                currentX += col.width;
            });

            return y + headerHeight;
        };

        // Dibujar el primer encabezado
        // Asegurar que hay espacio
        if (doc.y + 100 > doc.page.height - margin) {
            doc.addPage();
            // Si agregamos página aquí, quizás queramos el header principa de nuevo? 
            // Por simplicidad, solo el de tabla en nueva pag.
        }

        let currentY = drawTableHeader(doc.y);
        currentY += 5; // Un pequeño padding antes de la primera fila

        // --- 3. Casuística VACÍO ---
        if (!data || data.length === 0) {
            doc.moveDown(2);
            doc.fontSize(10)
                .fillColor('#64748b')
                .text('No se encontraron registros para este periodo.', margin, currentY + 20, {
                    align: 'center',
                    width: availableWidth
                });

            // Línea final de cierre
            doc.moveTo(margin, currentY + 45)
                .lineTo(doc.page.width - margin, currentY + 45)
                .strokeColor('#cbd5e1')
                .lineWidth(1)
                .stroke();
            return;
        }

        // --- 4. Dibujar Filas ---
        doc.font('Helvetica').fontSize(9);

        data.forEach((row, index) => {
            // Pre-procesar contenido de celdas
            const cellValues = tableCols.map(col => {
                let val = row[col.key];
                if (col.format) val = col.format(val, row);
                return val != null ? String(val) : '';
            });

            // Calcular altura de la fila basada en el contenido más alto
            let maxRowHeight = 20; // Altura mínima base
            cellValues.forEach((text, i) => {
                const colWidth = tableCols[i].width - 10; // padding lateral 5+5
                const textHeight = doc.heightOfString(text, { width: colWidth });
                if (textHeight > maxRowHeight) {
                    maxRowHeight = textHeight;
                }
            });
            maxRowHeight += 12; // Padding vertical extra (6 arriba, 6 abajo)

            // Verificar si cabe en la página
            if (currentY + maxRowHeight > doc.page.height - margin) {
                doc.addPage();
                // En nueva página, redibujamos header de tabla
                currentY = margin; // Empezar arriba (respetando margen)
                // Opcional: branding pequeño
                currentY = drawTableHeader(currentY) + 5;
                // CRITICAL: Reset font style to normal after header (which uses Bold)
                doc.font('Helvetica').fontSize(9);
            }

            // Dibujar fondo zebra (filas pares o impares)
            if (index % 2 !== 0) {
                doc.rect(margin, currentY, availableWidth, maxRowHeight)
                    .fillColor('#f1f5f9') // Gris muy claro
                    .fill();
            }

            // Dibujar contenido de celdas
            doc.fillColor('#334155'); // Color texto filas
            let currentX = margin;

            cellValues.forEach((text, i) => {
                const colWidth = tableCols[i].width - 10;
                doc.text(text, currentX + 5, currentY + 6, { // +6 padding top
                    width: colWidth,
                    align: 'left'
                });
                currentX += tableCols[i].width;
            });

            // Línea divisoria inferior de fila (opcional, sutil)
            doc.moveTo(margin, currentY + maxRowHeight)
                .lineTo(doc.page.width - margin, currentY + maxRowHeight)
                .strokeColor('#cbd5e1')
                .lineWidth(0.5)
                .stroke();

            // Avanzar cursor Y
            currentY += maxRowHeight;
            doc.y = currentY; // Sincronizar doc.y oficial
        });

        // Línea final de cierre de tabla
        doc.moveTo(margin, currentY)
            .lineTo(doc.page.width - margin, currentY)
            .strokeColor('#1e40af')
            .lineWidth(1)
            .stroke();
    }

    finalize() {
        const range = this.doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            this.doc.switchToPage(i);

            // Pie de página con numeración
            const footerY = this.doc.page.height - 40;

            // Línea separadora pie
            this.doc.moveTo(50, footerY - 10)
                .lineTo(this.doc.page.width - 50, footerY - 10)
                .strokeColor('#e2e8f0')
                .lineWidth(0.5)
                .stroke();

            this.doc.fontSize(8)
                .fillColor('#94a3b8')
                .text(
                    `Reporte generado por el Sistema de Biblioteca - Página ${i + 1} de ${range.count}`,
                    50,
                    footerY,
                    { align: 'center', width: this.doc.page.width - 100 }
                );
        }
        this.doc.end();
    }
}

module.exports = ReportGenerator;
