-- Crear tabla de libros virtuales
CREATE TABLE IF NOT EXISTS `libros_virtuales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `google_volume_id` varchar(40) NOT NULL,
  `titulo` varchar(255) NOT NULL,
  `autor` varchar(255) DEFAULT NULL,
  `editorial` varchar(255) DEFAULT NULL,
  `isbn` varchar(20) DEFAULT NULL,
  `categoria` varchar(100) DEFAULT NULL,
  `anio_publicacion` int(11) DEFAULT NULL,
  `portada_url` varchar(255) DEFAULT NULL,
  `preview_link` varchar(255) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_libros_virtuales_volume` (`google_volume_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Crear tabla de lecturas virtuales
CREATE TABLE IF NOT EXISTS `lecturas_virtuales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `libro_virtual_id` int(11) NOT NULL,
  `fecha_lectura` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_lecturas_virtuales_usuario` (`usuario_id`),
  KEY `fk_lecturas_virtuales_libro_virtual` (`libro_virtual_id`),
  CONSTRAINT `fk_lecturas_virtuales_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lecturas_virtuales_libro_virtual`
    FOREIGN KEY (`libro_virtual_id`) REFERENCES `libros_virtuales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
