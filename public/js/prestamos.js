/* ========================================================================
   BIBLIOTECA ESCOLAR DANIEL HERNÁNDEZ
   Archivo: /public/js/prestamos.js
   Propósito: Lógica e interactividad para la gestión de préstamos
   ======================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar animaciones AOS
    AOS.init({
        duration: 800,
        once: true,
        offset: 50
    });

    // Inicializar DataTables si existe la tabla
    const tablaPrestamos = $('#tablaPrestamosAdmin');
    if (tablaPrestamos.length) {
        tablaPrestamos.DataTable({
            responsive: true,
            language: {
                url: '//cdn.datatables.net/plug-ins/1.11.5/i18n/es-ES.json',
                search: "Búsqueda rápida:", // Personalizar etiqueta de búsqueda
                searchPlaceholder: "Buscar estudiante, libro..."
            },
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'Todos']],
            pageLength: 10, // Mostrar 10 datos por defecto
            // Configuración DOM para mostrar Búsqueda (f) y Paginación (p)
            // f: filter (search), r: processing, t: table, i: info, p: pagination
            dom: '<"flex justify-between items-center mb-4"f>rt<"flex justify-between items-center mt-4"ip>',
            columnDefs: [
                { orderable: false, targets: 4 } // Estado no ordenable
            ],
            drawCallback: function () {
                // Re-inicializar tooltips o efectos si fuera necesario al cambiar de página
            },
            initComplete: function () {
                // Asegurar que el placeholder se aplique correctamente si la configuración de idioma no lo hace
                $('.dataTables_filter input').attr('placeholder', 'Buscar estudiante, libro...');
            }
        });
    }

    // Manejo del formulario de filtros
    const filtrosForm = document.getElementById('filtrosForm');
    if (filtrosForm) {
        filtrosForm.addEventListener('submit', (e) => {
            // La validación o lógica adicional antes de enviar puede ir aquí
            // Por ahora dejamos que el formulario se envíe nativamente para recargar con query params
        });
    }
});

// Función para mostrar Toast (Reutilizable)
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `fixed bottom-5 right-5 bg-white border-l-4 py-2 px-3 shadow-md rounded-lg z-50 transition-all duration-300 transform translate-y-0 opacity-100 ${type === 'success' ? 'border-green-500 text-gray-700' : 'border-red-500 text-gray-700'
        }`;

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}
