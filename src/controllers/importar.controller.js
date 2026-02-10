const ExcelJS = require('exceljs');
const Usuario = require('../models/usuario.model');
const bcrypt = require('bcryptjs');

class ImportarController {
    /**
     * Procesa y valida los datos de estudiantes desde un archivo Excel
     */
    static async procesarEstudiantes(archivo) {
        try {
            // Leer el archivo Excel con ExcelJS
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(archivo.path);

            // Obtener la primera hoja
            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error('El archivo Excel no contiene ninguna hoja.');
            }

            // Convertir datos a JSON (similar a xlsx.utils.sheet_to_json)
            const datos = [];
            let encabezados = [];

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) {
                    encabezados = row.values;
                } else {
                    const filaData = {};
                    row.eachCell((cell, colNumber) => {
                        const header = encabezados[colNumber];
                        if (header) {
                            filaData[header] = cell.value;
                        }
                    });
                    if (Object.keys(filaData).length > 0) {
                        datos.push(filaData);
                    }
                }
            });

            // Validar estructura del archivo
            const columnasRequeridas = ['nombre', 'correo', 'dni'];
            const headersArr = encabezados.filter(h => h);
            const faltanColumnas = columnasRequeridas.filter(col => !headersArr.includes(col));
            if (faltanColumnas.length > 0) {
                throw new Error(`Faltan columnas requeridas: ${faltanColumnas.join(', ')}`);
            }

            const resultados = {
                total: datos.length,
                exitosos: 0,
                errores: []
            };

            const usuariosAInsertar = [];
            const correosEnArchivo = new Set();
            const dnisEnArchivo = new Set();

            // Paso 1: Validación en memoria
            for (let i = 0; i < datos.length; i++) {
                const fila = datos[i];
                const numFila = i + 2;

                try {
                    const getString = (val) => {
                        if (val && typeof val === 'object' && val.text) return val.text;
                        return val ? String(val).trim() : '';
                    };

                    const nombre = getString(fila.nombre);
                    const apellido = getString(fila.apellido);
                    const correo = getString(fila.correo).toLowerCase();
                    const dni = getString(fila.dni);
                    const gradoVal = fila.grado;
                    const seccion = fila.seccion ? getString(fila.seccion).toUpperCase() : null;

                    // Validaciones básicas
                    if (!nombre || !correo || !dni) throw new Error('Faltan campos obligatorios');

                    // Validar duplicados dentro del mismo archivo
                    if (correosEnArchivo.has(correo)) throw new Error('Correo duplicado en el archivo');
                    if (dnisEnArchivo.has(dni)) throw new Error('DNI duplicado en el archivo');

                    // Validar grado
                    let grado = gradoVal ? parseInt(gradoVal) : null;
                    if (grado && (isNaN(grado) || grado < 1 || grado > 12)) {
                        throw new Error('El grado debe ser un número entre 1 y 12');
                    }

                    // Preparar objeto usuario
                    // Hashear password (DNI) - Nota: bcrypt es lento, pero necesario. 
                    // Para optimizar batch real se podría hacer paralelo, pero JS es single thread.
                    // Promise.all podría saturar el event loop si son muchos. Lo dejamos secuencial por seguridad 
                    // o usamos una constante si todos tienen la misma password inicial, pero aquí es dinámica (DNI).
                    const contrasena = await bcrypt.hash(dni, 10);

                    usuariosAInsertar.push({
                        fila: numFila,
                        usuario: {
                            nombre: `${nombre} ${apellido}`.trim(),
                            apellido: apellido,
                            correo: correo,
                            dni: dni,
                            rol: 'estudiante',
                            grado: grado,
                            seccion: seccion,
                            contrasena: contrasena
                        }
                    });

                    correosEnArchivo.add(correo);
                    dnisEnArchivo.add(dni);

                } catch (error) {
                    resultados.errores.push({
                        fila: numFila,
                        error: error.message,
                        datos: fila
                    });
                }
            }

            // Paso 2: Filtrar duplicados en Base de Datos (Bulk Check)
            // Esto es más eficiente que consultar 1 por 1
            if (usuariosAInsertar.length > 0) {
                const correosVerificar = usuariosAInsertar.map(u => u.usuario.correo);
                const dnisVerificar = usuariosAInsertar.map(u => u.usuario.dni);

                // Nota: Usuario.obtenerPorCorreo/DNI son individuales. 
                // Para batch real se necesitaría `SELECT email FROM usuarios WHERE email IN (...)`
                // Por simplicidad y eficiencia razonable, lo haremos iterativo PERO solo verificando, 
                // o mejor, intentamos insertar y capturamos error de duplicado si falla el batch.
                // Sin embargo, `crearBatch` fallará por completo si uno falla.
                // Lo mejor es filtrar previamente.

                // Implementación rápida de verificación iterativa para filtrar antes del batch
                // (Es mejor que insertar 1 por 1)
                const usuariosFinales = [];
                for (const item of usuariosAInsertar) {
                    // Check rápido (idealmente optimizar con query IN)
                    const existeC = await Usuario.buscarPorCorreo(item.usuario.correo);
                    const existeD = await Usuario.buscarPorDNI(item.usuario.dni);

                    if (existeC) {
                        resultados.errores.push({ fila: item.fila, error: 'El correo ya existe en BD', datos: item.usuario });
                    } else if (existeD) {
                        resultados.errores.push({ fila: item.fila, error: 'El DNI ya existe en BD', datos: item.usuario });
                    } else {
                        usuariosFinales.push(item.usuario);
                    }
                }

                // Paso 3: Batch Insert
                if (usuariosFinales.length > 0) {
                    try {
                        const result = await Usuario.crearBatch(usuariosFinales);
                        resultados.exitosos = result.affectedRows;
                    } catch (batchError) {
                        // Si falla el batch, fallback o error general
                        throw new Error(`Error en inserción masiva: ${batchError.message}`);
                    }
                }
            }

            return resultados;

        } catch (error) {
            console.error('Error al procesar el archivo:', error);
            throw new Error(`Error al procesar el archivo: ${error.message}`);
        }
    }
}

module.exports = ImportarController;
