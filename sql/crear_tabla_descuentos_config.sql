-- ============================================================
-- TABLA: descuentos_config
-- Descuento configurable por tipo de producto en el POS.
-- El cajero puede aplicar este descuento mediante un botón
-- en la fila del producto (solo tipo 'comida').
-- ============================================================

CREATE TABLE IF NOT EXISTS descuentos_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_producto   TEXT    NOT NULL DEFAULT 'comida',   -- 'comida' | 'bebida' | 'complemento'
  monto_descuento NUMERIC(10,2) NOT NULL DEFAULT 20.00, -- Monto fijo en Lempiras
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  descripcion     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE  descuentos_config IS 'Configuración de descuentos fijos por tipo de producto en el POS';
COMMENT ON COLUMN descuentos_config.tipo_producto   IS 'Tipo de producto al que aplica: comida, bebida o complemento';
COMMENT ON COLUMN descuentos_config.monto_descuento IS 'Monto del descuento en Lempiras (L) que se aplica por producto';
COMMENT ON COLUMN descuentos_config.activo          IS 'Si es false el botón de descuento no aparece en el POS';

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_descuentos_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_descuentos_config_updated_at ON descuentos_config;
CREATE TRIGGER trg_descuentos_config_updated_at
  BEFORE UPDATE ON descuentos_config
  FOR EACH ROW EXECUTE FUNCTION update_descuentos_config_updated_at();

-- ────────────────────────────────────────────────────────────
-- Insertar el descuento inicial: L 20.00 para 'comida'
-- ────────────────────────────────────────────────────────────
INSERT INTO descuentos_config (tipo_producto, monto_descuento, activo, descripcion)
VALUES ('comida', 20.00, true, 'Descuento fijo de L 20.00 por producto de comida')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- RLS (Row Level Security) - ajusta según tu política actual
-- ────────────────────────────────────────────────────────────
ALTER TABLE descuentos_config ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer la configuración
CREATE POLICY "descuentos_config_select" ON descuentos_config
  FOR SELECT USING (true);

-- Solo el administrador (service_role) puede modificar
-- (descomenta y adapta si necesitas un rol específico)
-- CREATE POLICY "descuentos_config_admin_write" ON descuentos_config
--   FOR ALL USING (auth.role() = 'service_role');
