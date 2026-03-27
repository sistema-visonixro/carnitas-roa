-- =============================================================
--  TABLA pagosf  — Una sola fila por factura
--  Reemplaza la tabla pagos (múltiples filas por factura) para
--  eliminar duplicados, pérdida de datos e inconsistencias.
--  Usar UPSERT con onConflict:"factura" desde el frontend.
-- =============================================================

CREATE TABLE IF NOT EXISTS pagosf (
  id             BIGSERIAL       PRIMARY KEY,
  factura        VARCHAR(30)     UNIQUE NOT NULL,  -- Número de factura (clave natural única)

  -- Montos por método de pago (en Lempiras)
  efectivo       NUMERIC(12,2)   NOT NULL DEFAULT 0,
  tarjeta        NUMERIC(12,2)   NOT NULL DEFAULT 0,
  transferencia  NUMERIC(12,2)   NOT NULL DEFAULT 0,
  dolares        NUMERIC(12,2)   NOT NULL DEFAULT 0,   -- monto en Lempiras
  dolares_usd    NUMERIC(12,2)   NOT NULL DEFAULT 0,   -- monto en USD original
  delivery       NUMERIC(12,2)   NOT NULL DEFAULT 0,   -- costo de envío delivery

  -- Totales de la transacción
  total_recibido NUMERIC(12,2)   NOT NULL DEFAULT 0,
  cambio         NUMERIC(12,2)   NOT NULL DEFAULT 0,

  -- Detalles pago con tarjeta
  banco          VARCHAR(100),
  tarjeta_num    VARCHAR(30),     -- últimos 4 dígitos o referencia
  autorizacion   VARCHAR(50),     -- número de autorización

  -- Referencia de transferencia bancaria
  ref_transferencia VARCHAR(100),

  -- Metadatos del cajero y cliente
  cajero         VARCHAR(100),
  cajero_id      TEXT,                        -- UUID del cajero como texto
  cliente        VARCHAR(200),

  -- Referencia a la tabla facturas (evita duplicados, facilita JOINs)
  facturas_id    INTEGER         UNIQUE REFERENCES facturas(id) ON DELETE SET NULL,

  fecha_hora     TIMESTAMP       NOT NULL,

  -- Auditoría
  created_at     TIMESTAMP       DEFAULT NOW(),
  updated_at     TIMESTAMP       DEFAULT NOW()
);

-- Índices para consultas frecuentes
-- (idx_pagosf_facturas_id no es necesario: UNIQUE ya crea un índice implícito)
CREATE INDEX IF NOT EXISTS idx_pagosf_cajero_id   ON pagosf (cajero_id);
CREATE INDEX IF NOT EXISTS idx_pagosf_fecha_hora  ON pagosf (fecha_hora);
CREATE INDEX IF NOT EXISTS idx_pagosf_caj_fecha   ON pagosf (cajero_id, fecha_hora);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION pagosf_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pagosf_updated_at ON pagosf;
CREATE TRIGGER trg_pagosf_updated_at
  BEFORE UPDATE ON pagosf
  FOR EACH ROW EXECUTE FUNCTION pagosf_set_updated_at();

-- Row Level Security
ALTER TABLE pagosf ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "pagosf_select" ON pagosf
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pagosf_insert" ON pagosf
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "pagosf_update" ON pagosf
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "pagosf_service_role" ON pagosf
  TO service_role USING (true) WITH CHECK (true);
