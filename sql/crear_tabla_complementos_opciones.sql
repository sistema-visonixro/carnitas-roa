-- ============================================================
-- Tabla: complementos_opciones
-- Descripción: Opciones de complementos para productos de tipo
--              comida en punto de venta (ej. CON TODO, SIN SALSAS)
-- ============================================================

CREATE TABLE IF NOT EXISTS complementos_opciones (
  id         BIGSERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  orden      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Seguridad ───────────────────────────────────────────────
ALTER TABLE complementos_opciones ENABLE ROW LEVEL SECURITY;

-- Lectura pública (cajeros sin sesión de auth pueden leer)
CREATE POLICY "Lectura publica complementos"
  ON complementos_opciones FOR SELECT USING (true);

-- Escritura solo para usuarios autenticados (admin / inventario)
CREATE POLICY "Escritura autenticados complementos"
  ON complementos_opciones FOR ALL
  USING (auth.role() = 'authenticated');

-- ── Datos iniciales ─────────────────────────────────────────
INSERT INTO complementos_opciones (nombre, orden) VALUES
  ('CON TODO',     1),
  ('SIN NADA',     2),
  ('SIN SALSAS',   3),
  ('SIN REPOLLO',  4),
  ('SIN ADEREZO',  5),
  ('SIN CEBOLLA',  6),
  ('SALSAS APARTE',7)
ON CONFLICT (nombre) DO NOTHING;
