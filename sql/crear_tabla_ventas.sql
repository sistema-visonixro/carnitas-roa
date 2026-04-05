-- =============================================================
--  TABLA ventas — Fusiona facturas + pagosf en una sola tabla
--  Cada fila = una transacción completa (factura + pagos)
--  tipos: CONTADO | CREDITO | DEVOLUCION
--  Reemplaza el par facturas + pagosf para simplificar el modelo.
--  pagosf se convierte en tabla de abonos de crédito.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.ventas (
    id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha_hora      TIMESTAMP       NOT NULL DEFAULT NOW(),

    -- Datos del cajero / caja
    cajero          TEXT,
    cajero_id       TEXT,
    caja            TEXT,
    cai             TEXT,

    -- Datos de la factura
    factura         TEXT            UNIQUE NOT NULL,        -- Número SAR (contado/credito) o DEV-NNN (devolución)
    tipo            TEXT            NOT NULL DEFAULT 'CONTADO',  -- CONTADO | CREDITO | DEVOLUCION
    cliente         TEXT,
    tipo_orden      TEXT,                                    -- PARA LLEVAR | COMER AQUÍ | DELIVERY
    productos       TEXT,                                    -- JSON

    -- Montos de la factura
    sub_total       NUMERIC(12,2)   NOT NULL DEFAULT 0,
    isv_15          NUMERIC(12,2)   NOT NULL DEFAULT 0,
    isv_18          NUMERIC(12,2)   NOT NULL DEFAULT 0,
    descuento       NUMERIC(12,2)   DEFAULT 0,
    total           NUMERIC(12,2)   NOT NULL DEFAULT 0,
    es_donacion     BOOLEAN         DEFAULT FALSE,

    -- Columnas de pago (unificadas desde pagosf)
    efectivo        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    tarjeta         NUMERIC(12,2)   NOT NULL DEFAULT 0,
    transferencia   NUMERIC(12,2)   NOT NULL DEFAULT 0,
    dolares         NUMERIC(12,2)   NOT NULL DEFAULT 0,      -- monto en Lempiras
    dolares_usd     NUMERIC(12,2)   NOT NULL DEFAULT 0,      -- monto en USD original
    delivery        NUMERIC(12,2)   NOT NULL DEFAULT 0,      -- costo de envío delivery
    total_recibido  NUMERIC(12,2)   NOT NULL DEFAULT 0,
    cambio          NUMERIC(12,2)   NOT NULL DEFAULT 0,

    -- Detalles del método de pago
    banco           TEXT,
    tarjeta_num     TEXT,            -- últimos 4 dígitos o referencia
    autorizacion    TEXT,            -- número de autorización de tarjeta
    ref_transferencia TEXT,          -- número de referencia bancaria

    -- Auditoría
    operation_id    TEXT            UNIQUE,                  -- UUID único por operación (evita duplicados)
    created_at      TIMESTAMP       DEFAULT NOW(),
    updated_at      TIMESTAMP       DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ventas_cajero_id    ON public.ventas (cajero_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha_hora   ON public.ventas (fecha_hora);
CREATE INDEX IF NOT EXISTS idx_ventas_caj_fecha    ON public.ventas (cajero_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_ventas_tipo         ON public.ventas (tipo);
CREATE INDEX IF NOT EXISTS idx_ventas_es_donacion  ON public.ventas (es_donacion) WHERE es_donacion = TRUE;
CREATE INDEX IF NOT EXISTS idx_ventas_cai          ON public.ventas (cai);

-- ─── Trigger updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ventas_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ventas_updated_at ON public.ventas;
CREATE TRIGGER trg_ventas_updated_at
    BEFORE UPDATE ON public.ventas
    FOR EACH ROW EXECUTE FUNCTION public.ventas_set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ventas_select" ON public.ventas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ventas_insert" ON public.ventas
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ventas_update" ON public.ventas
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "ventas_service_role" ON public.ventas
    TO service_role USING (true) WITH CHECK (true);

-- Permitir acceso público (sin autenticación) igual que las demás tablas operativas
CREATE POLICY "ventas_public_select" ON public.ventas
    FOR SELECT TO public USING (true);

CREATE POLICY "ventas_public_insert" ON public.ventas
    FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "ventas_public_update" ON public.ventas
    FOR UPDATE TO public USING (true) WITH CHECK (true);
