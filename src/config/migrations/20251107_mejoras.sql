-- Agregar columna foto_url a la tabla usuarios
ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(255) DEFAULT NULL;

-- Agregar columna activo a la tabla usuarios si no existe
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
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX idx_usuario_rol ON usuarios(rol);
CREATE INDEX idx_prestamo_usuario ON prestamos(usuario_id);
CREATE INDEX idx_prestamo_fecha_devolucion ON prestamos(fecha_devolucion);
CREATE INDEX idx_resena_usuario ON resenas(usuario_id);
CREATE INDEX idx_libro_creador ON libros(creado_por);
