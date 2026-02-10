// Configuración de los gráficos para el dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Gráfico de préstamos por grado
    const gradosChart = new Chart(document.getElementById('gradosChart'), {
        type: 'bar',
        data: {
            labels: window.chartData.grados.map(g => `Grado ${g.grado}`),
            datasets: [{
                label: 'Préstamos por Grado',
                data: window.chartData.grados.map(g => g.total),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });

    // Gráfico de libros más leídos
    const librosChart = new Chart(document.getElementById('librosChart'), {
        type: 'horizontalBar',
        data: {
            labels: window.chartData.libros.map(l => l.titulo),
            datasets: [{
                label: 'Libros más leídos',
                data: window.chartData.libros.map(l => l.prestamos),
                backgroundColor: 'rgba(16, 185, 129, 0.5)',
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true
        }
    });

    // Gráfico de préstamos por área
    const areasChart = new Chart(document.getElementById('areasChart'), {
        type: 'pie',
        data: {
            labels: window.chartData.areas.map(a => a.area),
            datasets: [{
                data: window.chartData.areas.map(a => a.total),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.5)',
                    'rgba(16, 185, 129, 0.5)',
                    'rgba(245, 158, 11, 0.5)',
                    'rgba(239, 68, 68, 0.5)',
                    'rgba(139, 92, 246, 0.5)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
});