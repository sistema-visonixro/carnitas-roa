-- =============================================================
--  PARCHE: Prevenir doble apertura de caja
--
--  Garantiza que un cajero en una caja específica solo puede
--  tener UNA apertura activa (estado = 'APERTURA') a la vez.
--  El constraint de BD es el último salvavidas: aunque el cliente
--  falle (offline, doble click, corte de conexión), la BD rechaza
--  el segundo INSERT.
--
--  EJECUTAR EN: Supabase SQL Editor
-- =============================================================

-- 1. Índice único parcial: solo un estado='APERTURA' por cajero+caja
--    Si ya existe lo elimina primero para recrearlo limpio.
DROP INDEX IF EXISTS public.uq_cierres_apertura_activa;

CREATE UNIQUE INDEX uq_cierres_apertura_activa
  ON public.cierres (cajero_id, caja)
  WHERE estado = 'APERTURA';

COMMENT ON INDEX public.uq_cierres_apertura_activa
  IS 'Garantiza que un cajero solo tenga una apertura activa por caja. '
     'Rechaza doble apertura aunque venga de offline o doble click.';

-- 2. Verificar duplicados existentes ANTES de aplicar el índice
--    (si hay duplicados, el CREATE INDEX fallará — hay que limpiarlos primero)
--    Ejecuta esta consulta para detectarlos:
SELECT cajero_id, caja, COUNT(*) AS total_aperturas
FROM   public.cierres
WHERE  estado = 'APERTURA'
GROUP  BY cajero_id, caja
HAVING COUNT(*) > 1;

-- Si la consulta anterior devuelve filas, primero ejecuta esto para limpiar duplicados
-- (mantiene solo el registro más reciente):
/*
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY cajero_id, caja ORDER BY fecha DESC) AS rn
  FROM   public.cierres
  WHERE  estado = 'APERTURA'
)
UPDATE public.cierres
SET    estado = 'APERTURA_DUPLICADA'    -- marca para revisión, no borra
WHERE  id IN (
  SELECT id FROM ranked WHERE rn > 1
);
*/

-- 3. (Opcional) Función RPC para abrir caja de forma idempotente
--    Llama esta función en lugar de INSERT directo.
--    Si ya hay apertura activa, devuelve la existente sin crear otra.
CREATE OR REPLACE FUNCTION public.abrir_caja_seguro(
  p_cajero_id   UUID,
  p_cajero      TEXT,
  p_caja        TEXT,
  p_fondo_fijo  NUMERIC DEFAULT 0
)
RETURNS TABLE (
  id              INTEGER,
  es_nueva        BOOLEAN,
  fecha           TIMESTAMP,
  estado          TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_apertura RECORD;
BEGIN
  -- Intentar obtener apertura existente
  SELECT c.id, c.fecha, c.estado
  INTO   v_apertura
  FROM   public.cierres c
  WHERE  c.cajero_id = p_cajero_id
    AND  c.caja      = p_caja
    AND  c.estado    = 'APERTURA'
  LIMIT 1;

  IF FOUND THEN
    -- Ya existe → devolver la existente sin crear otra
    RETURN QUERY
    SELECT v_apertura.id, FALSE, v_apertura.fecha, v_apertura.estado;
    RETURN;
  END IF;

  -- No existe → insertar nueva apertura
  INSERT INTO public.cierres (
    tipo_registro, cajero, cajero_id, caja, fecha,
    fondo_fijo_registrado, fondo_fijo,
    efectivo_registrado, efectivo_dia,
    monto_tarjeta_registrado, monto_tarjeta_dia,
    transferencias_registradas, transferencias_dia,
    dolares_registrado, dolares_dia,
    diferencia, estado
  ) VALUES (
    'apertura', p_cajero, p_cajero_id, p_caja, NOW(),
    p_fondo_fijo, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    'APERTURA'
  )
  RETURNING cierres.id, cierres.fecha, cierres.estado
  INTO v_apertura;

  RETURN QUERY
  SELECT v_apertura.id, TRUE, v_apertura.fecha, v_apertura.estado;
END;
$$;

COMMENT ON FUNCTION public.abrir_caja_seguro IS
  'Apertura idempotente: si ya existe apertura activa la devuelve, '
  'si no la crea. Previene duplicados por reconexión o doble click.';

-- 4. Verificar resultado del índice
SELECT indexname, indexdef
FROM   pg_indexes
WHERE  tablename = 'cierres'
  AND  indexname = 'uq_cierres_apertura_activa';
