-- Migration: Add validation columns to prestamos and lecturas_virtuales

-- Table: prestamos
ALTER TABLE prestamos
ADD COLUMN validado BOOLEAN DEFAULT 0,
ADD COLUMN fecha_validacion DATETIME DEFAULT NULL,
ADD COLUMN opinion_libro TEXT DEFAULT NULL,
ADD COLUMN resumen_libro TEXT DEFAULT NULL,
ADD COLUMN personajes_principales TEXT DEFAULT NULL,
ADD COLUMN tema_principal VARCHAR(255) DEFAULT NULL,
ADD COLUMN lecciones_aprendidas TEXT DEFAULT NULL;

-- Table: lecturas_virtuales
ALTER TABLE lecturas_virtuales
ADD COLUMN validado BOOLEAN DEFAULT 0,
ADD COLUMN fecha_validacion DATETIME DEFAULT NULL,
ADD COLUMN opinion_libro TEXT DEFAULT NULL,
ADD COLUMN resumen_libro TEXT DEFAULT NULL,
ADD COLUMN personajes_principales TEXT DEFAULT NULL,
ADD COLUMN tema_principal VARCHAR(255) DEFAULT NULL,
ADD COLUMN lecciones_aprendidas TEXT DEFAULT NULL;
