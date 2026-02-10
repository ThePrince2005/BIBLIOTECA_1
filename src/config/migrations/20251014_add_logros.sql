-- Migration: Crear tablas de logros y relación usuario_logros

CREATE TABLE IF NOT EXISTS logros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    umbral INT NOT NULL,
    icono_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuario_logros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    logro_id INT NOT NULL,
    fecha_obtenido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (logro_id) REFERENCES logros(id) ON DELETE CASCADE,
    UNIQUE KEY unique_usuario_logro (usuario_id, logro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar logros base
INSERT IGNORE INTO logros (clave, nombre, descripcion, umbral, icono_url) VALUES
('lector_novato', 'Lector Novato', 'Ha leído 5 libros', 5, '/img/badges/lector_novato.svg'),
('lector_avanzado', 'Lector Avanzado', 'Ha leído 20 libros', 20, '/img/badges/lector_avanzado.svg'),
('lector_experto', 'Lector Experto', 'Ha leído 50 libros', 50, '/img/badges/lector_experto.svg');
