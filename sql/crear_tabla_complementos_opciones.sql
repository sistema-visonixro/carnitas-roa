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
-- El sistema usa anon key de Supabase (no Supabase Auth), por lo
-- que las políticas deben permitir acceso público completo.
ALTER TABLE complementos_opciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acceso_publico_complementos"
  ON complementos_opciones FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

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
