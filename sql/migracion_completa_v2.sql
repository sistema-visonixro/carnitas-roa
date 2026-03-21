-- ============================================================
-- MIGRACIÓN COMPLETA v2 - Carnitas Roa
-- Ejecutar completo en Supabase SQL Editor
-- Todos los ALTER usan IF NOT EXISTS / IF EXISTS para ser
-- idempotentes: se puede ejecutar más de una vez sin error.
-- ============================================================


-- ============================================================
-- 1. TABLA facturas
--    Nuevas columnas requeridas por el frontend
-- ============================================================

-- Tipo de orden: "PARA LLEVAR" | "COMER AQUÍ"
-- Se guarda al momento de facturar para que la reimpresión de
-- comanda desde historial no tenga que preguntar de nuevo.
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS tipo_orden TEXT DEFAULT 'PARA LLEVAR';

COMMENT ON COLUMN public.facturas.tipo_orden IS
  'Tipo de orden elegido en el POS: PARA LLEVAR o COMER AQUÍ.';

-- ID de operación único por factura.
-- Permite enviar la misma operación dos veces a Supabase sin crear
-- duplicados (upsert idempotente con onConflict: operation_id).
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS operation_id UUID DEFAULT gen_random_uuid();

-- Restricción UNIQUE sobre operation_id (segunda línea de defensa
-- contra facturas duplicadas desde el frontend).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_facturas_operation_id'
  ) THEN
    ALTER TABLE public.facturas
      ADD CONSTRAINT uq_facturas_operation_id UNIQUE (operation_id);
  END IF;
END$$;

COMMENT ON COLUMN public.facturas.operation_id IS
  'UUID único por operación de facturación. Previene duplicados en sincronización offline.';


-- ============================================================
-- 2. TABLA facturas — restricción única (factura + cajero_id)
--    Antes de crear el constraint, eliminar filas duplicadas
--    conservando solo la de mayor id (la más reciente).
-- ============================================================

-- Ver cuántos duplicados existen (informativo)
-- SELECT factura, cajero_id, COUNT(*) AS total
-- FROM public.facturas
-- GROUP BY factura, cajero_id
-- HAVING COUNT(*) > 1
-- ORDER BY total DESC;

-- Eliminar duplicados: conserva el registro con el id más alto
-- por cada combinación (factura, cajero_id)
DELETE FROM public.facturas
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY factura, cajero_id
        ORDER BY id DESC   -- conserva el mayor (más reciente)
      ) AS rn
    FROM public.facturas
  ) sub
  WHERE rn > 1
);

-- Ahora sí aplicar el constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_facturas_numero_cajero'
  ) THEN
    ALTER TABLE public.facturas
      ADD CONSTRAINT uq_facturas_numero_cajero UNIQUE (factura, cajero_id);
  END IF;
END$$;

-- Índice de apoyo para búsquedas rápidas por número de factura
CREATE INDEX IF NOT EXISTS idx_facturas_factura_cajero
  ON public.facturas (factura, cajero_id);

CREATE INDEX IF NOT EXISTS idx_facturas_operation_id
  ON public.facturas (operation_id);


-- ============================================================
-- 3. TABLA pagos
--    ID de operación único por registro de pago.
--    Igual que en facturas: previene pagos duplicados al
--    sincronizar desde IndexedDB.
-- ============================================================
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS operation_id UUID DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_pagos_operation_id'
  ) THEN
    ALTER TABLE public.pagos
      ADD CONSTRAINT uq_pagos_operation_id UNIQUE (operation_id);
  END IF;
END$$;

COMMENT ON COLUMN public.pagos.operation_id IS
  'UUID único por registro de pago. Previene pagos duplicados en sincronización offline.';

CREATE INDEX IF NOT EXISTS idx_pagos_operation_id
  ON public.pagos (operation_id);

-- Índice para búsquedas por factura_venta (muy frecuente en cierre y resumen)
CREATE INDEX IF NOT EXISTS idx_pagos_factura_venta
  ON public.pagos (factura_venta);

CREATE INDEX IF NOT EXISTS idx_pagos_cajero_fecha
  ON public.pagos (cajero_id, fecha_hora);


-- ============================================================
-- 4. FUNCIÓN RPC: reservar_siguiente_factura
--    Incrementa atomicamente el contador de factura_actual en
--    cai_facturas y devuelve el número QUE SE DEBE USAR ahora.
--    
--    Uso desde el frontend:
--      const { data } = await supabase
--        .rpc('reservar_siguiente_factura', { p_cajero_id: id })
--      // data = "00123"  ← número reservado, nadie más lo obtendrá
--
--    Esto elimina la condición de carrera donde dos ventas
--    concurrentes leen el mismo número de factura.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reservar_siguiente_factura(
  p_cajero_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_factura_actual  TEXT;
  v_factura_hasta   TEXT;
  v_num_actual      BIGINT;
  v_num_hasta       BIGINT;
  v_siguiente       BIGINT;
  v_siguiente_text  TEXT;
BEGIN
  -- Bloquear la fila del cajero para lectura+escritura atómica
  SELECT factura_actual, rango_hasta
    INTO v_factura_actual, v_factura_hasta
    FROM public.cai_facturas
   WHERE cajero_id = p_cajero_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe CAI para cajero_id %', p_cajero_id;
  END IF;

  -- Parsear números
  v_num_actual := COALESCE(v_factura_actual::BIGINT, 0);
  v_num_hasta  := COALESCE(v_factura_hasta::BIGINT, 0);

  -- Verificar límite
  IF v_num_actual >= v_num_hasta THEN
    RETURN 'Límite alcanzado';
  END IF;

  -- El número a usar ES el actual; el siguiente para la próxima venta es actual+1
  v_siguiente      := v_num_actual + 1;
  v_siguiente_text := v_siguiente::TEXT;

  -- Avanzar el puntero en la base de datos
  UPDATE public.cai_facturas
     SET factura_actual = v_siguiente_text
   WHERE cajero_id = p_cajero_id;

  -- Devolver el número que se usó (el que estaba antes del incremento)
  RETURN v_num_actual::TEXT;
END;
$$;

COMMENT ON FUNCTION public.reservar_siguiente_factura IS
  'Reserva y devuelve el número de factura actual para el cajero dado,
   incrementando atomicamente el contador. Elimina condiciones de carrera
   en ventas concurrentes o sincronizaciones paralelas.';

-- Permitir ejecución por usuarios autenticados
GRANT EXECUTE ON FUNCTION public.reservar_siguiente_factura(TEXT)
  TO authenticated, anon;


-- ============================================================
-- 5. TABLA cai_facturas
--    Índice para acelerar la función RPC anterior
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cai_facturas_cajero_id
  ON public.cai_facturas (cajero_id);


-- ============================================================
-- 6. VERIFICACIÓN FINAL
--    Muestra el resultado de cada cambio para confirmar que
--    se aplicó correctamente.
-- ============================================================

-- Columnas agregadas a facturas
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'facturas'
  AND column_name IN ('tipo_orden', 'operation_id', 'descuento')
ORDER BY column_name;

-- Columnas agregadas a pagos
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'pagos'
  AND column_name IN ('operation_id', 'banco', 'autorizador', 'usd_monto')
ORDER BY column_name;

-- Restricciones únicas creadas
SELECT
  conname   AS restriccion,
  contype   AS tipo,
  conrelid::regclass AS tabla
FROM pg_constraint
WHERE conname IN (
  'uq_facturas_operation_id',
  'uq_facturas_numero_cajero',
  'uq_pagos_operation_id'
)
ORDER BY tabla, restriccion;

-- Función RPC disponible
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name   = 'reservar_siguiente_factura';
