-- Tabla para configurar puntos por platillo
CREATE TABLE IF NOT EXISTS puntos_config (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(64) UNIQUE NOT NULL DEFAULT 'default',
  points_per_platillo INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar valor por defecto si no existe
INSERT INTO puntos_config (nombre, points_per_platillo)
VALUES ('default', 7)
ON CONFLICT (nombre) DO NOTHING;

-- Nota: para cambiar el valor en producción usar:
-- UPDATE puntos_config SET points_per_platillo = 10 WHERE nombre = 'default';
