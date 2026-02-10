-- Agregar campo activo a usuarios si no existe
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo TINYINT(1) DEFAULT 1;

-- Crear tabla de reseñas si no existe
CREATE TABLE IF NOT EXISTS resenas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    libro_id INT NOT NULL,
    prestamo_id INT NOT NULL,
    calificacion TINYINT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
    comentario TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (libro_id) REFERENCES libros(id),
    FOREIGN KEY (prestamo_id) REFERENCES prestamos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla de logros si no existe
CREATE TABLE IF NOT EXISTS logros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    icono_url VARCHAR(255),
    umbral INT NOT NULL, -- Número de libros necesarios para desbloquear
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla de asignación de logros a usuarios
CREATE TABLE IF NOT EXISTS logros_usuario (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    logro_id INT NOT NULL,
    fecha_obtencion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (logro_id) REFERENCES logros(id),
    UNIQUE KEY unique_logro_usuario (usuario_id, logro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar logros predefinidos
INSERT INTO logros (clave, nombre, descripcion, icono_url, umbral) VALUES
('lector_novato_1', 'Lector Novato', 'Has completado la lectura de tu primer libro', '/img/badges/novato.svg', 1),
('lector_junior_5', 'Lector Junior', 'Has leído 5 libros', '/img/badges/junior.svg', 5),
('lector_intermedio_10', 'Lector Intermedio', 'Has leído 10 libros', '/img/badges/intermedio.svg', 10),
('lector_avanzado_25', 'Lector Avanzado', 'Has leído 25 libros', '/img/badges/avanzado.svg', 25),
('lector_experto_50', 'Lector Experto', 'Has leído 50 libros', '/img/badges/experto.svg', 50),
('lector_maestro_100', 'Maestro Lector', 'Has leído 100 libros', '/img/badges/maestro.svg', 100);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_usuario_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_prestamo_usuario ON prestamos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_prestamo_fecha ON prestamos(fecha_devolucion_esperada);
CREATE INDEX IF NOT EXISTS idx_resena_usuario ON resenas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logro_usuario ON logros_usuario(usuario_id);

-- Actualizar la contraseña del administrador si existe
UPDATE usuarios 
SET contrasena = '$2a$10$XFE/UJzAGYWrcf4zh7mN5.E66gNv8Y4PjXYXkzV5JG4KHzqX.YZeq' -- password: admin123
WHERE correo = 'admin@biblioteca.edu.pe';