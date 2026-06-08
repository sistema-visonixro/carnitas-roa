-- Tabla para almacenar puntos acumulados por cliente
CREATE TABLE IF NOT EXISTS puntos_clientes (
  id BIGSERIAL PRIMARY KEY,
  identidad VARCHAR(64) NOT NULL UNIQUE,
  nombre VARCHAR(250),
  puntos INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Historial de puntos (entradas y salidas)
CREATE TABLE IF NOT EXISTS puntos_historial (
  id BIGSERIAL PRIMARY KEY,
  identidad VARCHAR(64) NOT NULL,
  factura VARCHAR(128),
  puntos INTEGER NOT NULL,
  descripcion TEXT,
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice por identidad para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_puntos_clientes_identidad ON puntos_clientes(identidad);
CREATE INDEX IF NOT EXISTS idx_puntos_historial_identidad ON puntos_historial(identidad);
