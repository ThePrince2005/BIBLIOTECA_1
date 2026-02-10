-- Migración: Agregar campos de validación de libros leídos
-- Fecha: 2025-01-15
-- Descripción: Agrega campos para almacenar las respuestas del cuestionario de validación de libros

-- Agregar campos a la tabla prestamos para validación
ALTER TABLE prestamos 
ADD COLUMN validado BOOLEAN DEFAULT FALSE COMMENT 'Indica si el libro fue validado con cuestionario',
ADD COLUMN opinion_libro TEXT NULL COMMENT '¿Qué tal me pareció el libro?',
ADD COLUMN resumen_libro TEXT NULL COMMENT '¿De qué trata el libro?',
ADD COLUMN personajes_principales TEXT NULL COMMENT '¿Cuáles son los personajes principales?',
ADD COLUMN tema_principal VARCHAR(255) NULL COMMENT 'Tema principal del libro',
ADD COLUMN lecciones_aprendidas TEXT NULL COMMENT 'Lecciones o enseñanzas del libro',
ADD COLUMN fecha_validacion TIMESTAMP NULL COMMENT 'Fecha en que se completó la validación';

-- Agregar campos a la tabla lecturas_virtuales para validación
ALTER TABLE lecturas_virtuales 
ADD COLUMN validado BOOLEAN DEFAULT FALSE COMMENT 'Indica si el libro fue validado con cuestionario',
ADD COLUMN opinion_libro TEXT NULL COMMENT '¿Qué tal me pareció el libro?',
ADD COLUMN resumen_libro TEXT NULL COMMENT '¿De qué trata el libro?',
ADD COLUMN personajes_principales TEXT NULL COMMENT '¿Cuáles son los personajes principales?',
ADD COLUMN tema_principal VARCHAR(255) NULL COMMENT 'Tema principal del libro',
ADD COLUMN lecciones_aprendidas TEXT NULL COMMENT 'Lecciones o enseñanzas del libro',
ADD COLUMN fecha_validacion TIMESTAMP NULL COMMENT 'Fecha en que se completó la validación';

-- Crear índices para mejorar consultas
CREATE INDEX idx_prestamos_validado ON prestamos(validado);
CREATE INDEX idx_lecturas_virtuales_validado ON lecturas_virtuales(validado);
