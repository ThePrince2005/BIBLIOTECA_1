-- Tabla para el Diccionario
CREATE TABLE IF NOT EXISTS diccionario (
    id INT PRIMARY KEY AUTO_INCREMENT,
    termino VARCHAR(100) NOT NULL UNIQUE,
    definicion TEXT NOT NULL,
    ejemplo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_termino (termino)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para Maratones de Lectura
CREATE TABLE IF NOT EXISTS maratones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    meta_libros INT DEFAULT 0, -- Meta opcional de cantidad de libros
    estado ENUM('planificada', 'activa', 'finalizada') DEFAULT 'planificada',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para Inscripciones a Maratones
CREATE TABLE IF NOT EXISTS inscripciones_maraton (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    maraton_id INT NOT NULL,
    libros_leidos INT DEFAULT 0,
    fecha_inscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (maraton_id) REFERENCES maratones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_inscripcion (usuario_id, maraton_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para registrar progreso específico en maratones (opcional, si se quiere trackear qué libros cuentan para la maratón)
CREATE TABLE IF NOT EXISTS progreso_maraton (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inscripcion_id INT NOT NULL,
    libro_id INT NOT NULL,
    fecha_lectura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inscripcion_id) REFERENCES inscripciones_maraton(id) ON DELETE CASCADE,
    FOREIGN KEY (libro_id) REFERENCES libros(id),
    UNIQUE KEY unique_libro_maraton (inscripcion_id, libro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
