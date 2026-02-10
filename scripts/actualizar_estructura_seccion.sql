-- Aumentar el tamaño de la columna seccion para permitir nombres completos
ALTER TABLE usuarios MODIFY COLUMN seccion VARCHAR(50);

-- Verificar el cambio
DESCRIBE usuarios;
