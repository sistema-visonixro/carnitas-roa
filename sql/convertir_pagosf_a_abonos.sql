-- =============================================================
--  Convertir pagosf → tabla de abonos de crédito
--
--  Los datos de pago de ventas normales ya están migrados a ventas.
--  pagosf ahora almacena ABONOS: pagos parciales de facturas a crédito.
--  Un crédito puede tener múltiples abonos → eliminar UNIQUE en factura.
-- =============================================================

-- 1. Guardar backup de la estructura anterior (opcional, precaución)
-- COMMENT ON TABLE pagosf IS 'Tabla de abonos de crédito. Cada fila = un pago parcial de una factura de crédito. La columna factura referencia el número de factura del crédito.';

-- 2. Agregar columnas para gestión de abonos
ALTER TABLE public.pagosf
    ADD COLUMN IF NOT EXISTS tipo_abono   TEXT            DEFAULT 'ABONO',
    ADD COLUMN IF NOT EXISTS monto        NUMERIC(12,2)   DEFAULT 0,
    ADD COLUMN IF NOT EXISTS descripcion  TEXT;

-- 3. Poblar monto desde los campos de pago existentes
--    Para abonos ya existentes: monto = suma de todos los métodos de pago
UPDATE public.pagosf
SET monto = (
    COALESCE(efectivo, 0) +
    COALESCE(tarjeta, 0) +
    COALESCE(transferencia, 0) +
    COALESCE(dolares, 0)
)
WHERE monto = 0 OR monto IS NULL;

-- 4. Eliminar restricción UNIQUE en factura
--    (permite múltiples abonos por número de factura de crédito)
ALTER TABLE public.pagosf DROP CONSTRAINT IF EXISTS pagosf_factura_key;

-- 5. Eliminar FK a facturas (ya no aplica; la relación es por número de factura en ventas)
ALTER TABLE public.pagosf DROP CONSTRAINT IF EXISTS pagosf_facturas_id_fkey;
ALTER TABLE public.pagosf DROP COLUMN IF EXISTS facturas_id;

-- 6. Crear índice en factura (ya no es UNIQUE pero sigue siendo clave de búsqueda)
CREATE INDEX IF NOT EXISTS idx_pagosf_factura ON public.pagosf (factura);
CREATE INDEX IF NOT EXISTS idx_pagosf_tipo_abono ON public.pagosf (tipo_abono);

-- 7. Comentarios descriptivos
COMMENT ON TABLE  public.pagosf IS 'Abonos de crédito: pagos parciales de facturas a crédito. Múltiples filas por factura de crédito.';
COMMENT ON COLUMN public.pagosf.factura    IS 'Número de factura del crédito al que pertenece este abono';
COMMENT ON COLUMN public.pagosf.monto      IS 'Monto total de este abono en Lempiras';
COMMENT ON COLUMN public.pagosf.tipo_abono IS 'ABONO (pago parcial) o PAGO_TOTAL (liquida el crédito)';
COMMENT ON COLUMN public.pagosf.descripcion IS 'Observaciones del abono (opcional)';

-- 8. Verificar resultado
SELECT
    COUNT(*) AS total_registros_pagosf,
    SUM(monto) AS monto_total_abonos
FROM public.pagosf;
