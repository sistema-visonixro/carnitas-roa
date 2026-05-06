-- ============================================================================
-- PATCH: Correlativo SAR sin saltos + saneamiento de facturas históricas
-- Fecha: 2026-05-05
--
-- Qué hace este script:
--  1) Reemplaza la función siguiente_numero_factura_sar para que:
--     - use lock FOR UPDATE
--     - se auto-recupere si factura_actual quedó desfasado
--     - evite devolver un número ya usado en ventas/facturacion_sar
--  2) Incluye bloque opcional para reordenar facturas ya ingresadas
--     de un CAI específico en ventas + facturacion_sar.
--
-- IMPORTANTE:
--  - Ejecutar en ventana de mantenimiento.
--  - Hacer backup antes de correr el bloque de REORDENACIÓN.
-- ============================================================================

-- ============================================================================
-- 1) FUNCIÓN SAR ROBUSTA: evita colisiones y saltos por contador desfasado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.siguiente_numero_factura_sar(
  p_cajero_id UUID
)
RETURNS TABLE (
  numero_secuencial       INTEGER,
  numero_factura_formado  TEXT,
  cai                     TEXT,
  rango_desde             INTEGER,
  rango_hasta             INTEGER,
  fecha_limite_emision    DATE,
  numero_establecimiento  TEXT,
  punto_emision           TEXT,
  tipo_documento          TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cai_row         RECORD;
  v_factura_actual  INTEGER;
  v_siguiente       INTEGER;
  v_numero_formado  TEXT;
  v_existe          BOOLEAN;
BEGIN
  SELECT cf.*
  INTO   v_cai_row
  FROM   public.cai_facturas cf
  WHERE  cf.cajero_id          = p_cajero_id
    AND  cf.activo             = TRUE
    AND  UPPER(COALESCE(cf.tipo_comprobante, '')) = 'FACTURA'
    AND  (cf.fecha_limite_emision IS NULL OR cf.fecha_limite_emision >= CURRENT_DATE)
  ORDER  BY cf.creado_en DESC
  LIMIT  1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'SAR-001: No existe CAI activo y vigente para el cajero %.',
      p_cajero_id
    USING ERRCODE = 'P0001';
  END IF;

  -- FACTURA: factura_actual representa ÚLTIMO correlativo emitido.
  v_factura_actual := COALESCE(NULLIF(TRIM(v_cai_row.factura_actual), '')::INTEGER, v_cai_row.rango_desde - 1);
  v_siguiente      := GREATEST(v_factura_actual + 1, v_cai_row.rango_desde);

  -- Autocorrección: si ese número ya existe, avanzar hasta encontrar uno libre.
  LOOP
    IF v_siguiente > v_cai_row.rango_hasta THEN
      RAISE EXCEPTION
        'SAR-002: Rango de facturas AGOTADO para CAI %. Último usado: %. Límite: %.',
        v_cai_row.cai, v_factura_actual, v_cai_row.rango_hasta
      USING ERRCODE = 'P0002';
    END IF;

    v_numero_formado := CONCAT(
      v_cai_row.numero_establecimiento, '-',
      v_cai_row.punto_emision,          '-',
      v_cai_row.tipo_documento,         '-',
      LPAD(v_siguiente::TEXT, 8, '0')
    );

    SELECT EXISTS (
      SELECT 1
      FROM public.ventas v
      WHERE v.tipo_documento_fiscal = 'FACTURA'
        AND COALESCE(v.cai, '') = COALESCE(v_cai_row.cai, '')
        AND (
          v.numero_secuencial = v_siguiente
          OR v.factura = v_numero_formado
        )
    ) OR EXISTS (
      SELECT 1
      FROM public.facturacion_sar fs
      WHERE COALESCE(fs.cai, '') = COALESCE(v_cai_row.cai, '')
        AND (
          fs.numero_secuencial = v_siguiente
          OR fs.numero_factura = v_numero_formado
        )
    ) INTO v_existe;

    EXIT WHEN NOT v_existe;
    v_siguiente := v_siguiente + 1;
  END LOOP;

  UPDATE public.cai_facturas
  SET    factura_actual = v_siguiente::TEXT
  WHERE  id = v_cai_row.id;

  RETURN QUERY
  SELECT
    v_siguiente,
    v_numero_formado,
    v_cai_row.cai,
    v_cai_row.rango_desde,
    v_cai_row.rango_hasta,
    v_cai_row.fecha_limite_emision,
    v_cai_row.numero_establecimiento,
    v_cai_row.punto_emision,
    v_cai_row.tipo_documento;
END;
$$;

COMMENT ON FUNCTION public.siguiente_numero_factura_sar(UUID)
  IS 'Reserva correlativo SAR FACTURA de forma atómica, evitando números ya usados en ventas/facturacion_sar.';


-- ============================================================================
-- 2) BLOQUE OPCIONAL: REORDENAR FACTURAS HISTÓRICAS (VENTAS + FACTURACION_SAR)
-- ============================================================================
-- ⚠️ SOLO si deseas renumerar facturas ya emitidas para cerrar huecos históricos.
--    Ejecuta primero el SELECT de previsualización.

-- --------------------------------------------------------------------------
-- 2.1 PREVISUALIZACIÓN
-- --------------------------------------------------------------------------
-- Cambia estos valores antes de ejecutar:
--   p_cai      = CAI a corregir
--   p_desde    = secuencial inicial deseado (normalmente 1)

WITH params AS (
  SELECT
    '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai,
    1::int AS p_desde
),
base AS (
  SELECT
    v.id,
    v.fecha_hora,
    v.cai,
    v.factura,
    v.numero_secuencial,
    split_part(v.factura, '-', 1) AS est,
    split_part(v.factura, '-', 2) AS pto,
    split_part(v.factura, '-', 3) AS tdoc,
    row_number() OVER (ORDER BY v.fecha_hora, v.id) + (SELECT p_desde - 1 FROM params) AS nuevo_secuencial
  FROM public.ventas v
  JOIN params p ON TRUE
  WHERE v.tipo_documento_fiscal = 'FACTURA'
    AND v.cai = p.p_cai
)
SELECT
  id,
  fecha_hora,
  factura AS factura_actual,
  (est || '-' || pto || '-' || tdoc || '-' || lpad(nuevo_secuencial::text, 8, '0')) AS factura_nueva,
  numero_secuencial AS sec_actual,
  nuevo_secuencial AS sec_nueva
FROM base
ORDER BY fecha_hora, id;


-- --------------------------------------------------------------------------
-- 2.2 APLICAR REORDENACIÓN (TRANSACCIONAL)
-- --------------------------------------------------------------------------
-- Descomenta y ejecuta en una sola corrida cuando valides la previsualización.

BEGIN;

-- 2.2.1 Validación previa: aborta si el número final chocará con filas
-- fuera del conjunto que se está reordenando.
DO $$
DECLARE
  v_conflicto text;
  v_conflicto_sec int;
  v_total bigint;
  v_rango_hasta int;
  v_rango_desde int;
BEGIN
  SELECT MIN(cf.rango_desde), MAX(cf.rango_hasta)
  INTO v_rango_desde, v_rango_hasta
  FROM public.cai_facturas cf
  WHERE cf.cai = '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'
    AND UPPER(COALESCE(cf.tipo_comprobante, '')) = 'FACTURA';

  SELECT COUNT(*)
  INTO v_total
  FROM public.ventas v
  WHERE v.tipo_documento_fiscal = 'FACTURA'
    AND v.cai = '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97';

  IF v_total > (v_rango_hasta - v_rango_desde + 1) THEN
    RAISE EXCEPTION
      'REORD-002: El lote (%) excede el rango del CAI (%..%).',
      v_total, v_rango_desde, v_rango_hasta;
  END IF;

  WITH params AS (
    SELECT
      '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai,
      1::int AS p_desde
  ),
  base AS (
    SELECT
      v.id,
      split_part(v.factura, '-', 1) AS est,
      split_part(v.factura, '-', 2) AS pto,
      split_part(v.factura, '-', 3) AS tdoc,
      row_number() OVER (ORDER BY v.fecha_hora, v.id) + (SELECT p_desde - 1 FROM params) AS nuevo_secuencial
    FROM public.ventas v
    JOIN params p ON TRUE
    WHERE v.tipo_documento_fiscal = 'FACTURA'
      AND v.cai = p.p_cai
  ),
  mapping AS (
    SELECT
      b.id,
      (b.est || '-' || b.pto || '-' || b.tdoc || '-' || lpad(b.nuevo_secuencial::text, 8, '0')) AS factura_nueva
    FROM base b
  ),
  conflictos AS (
    SELECT fs.numero_factura
    FROM public.facturacion_sar fs
    JOIN mapping m ON m.factura_nueva = fs.numero_factura
    WHERE fs.venta_id IS DISTINCT FROM m.id
      AND fs.venta_id NOT IN (SELECT id FROM mapping)
    LIMIT 1
  )
  SELECT numero_factura INTO v_conflicto FROM conflictos;

  IF v_conflicto IS NOT NULL THEN
    RAISE EXCEPTION
      'REORD-001: El número % ya existe en facturacion_sar fuera del lote a reordenar. Ajuste el filtro o amplíe el lote.',
      v_conflicto;
  END IF;

  -- Validación adicional: conflicto de secuencial final fuera del lote.
  WITH params AS (
    SELECT
      '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai,
      1::int AS p_desde
  ),
  base AS (
    SELECT
      v.id,
      row_number() OVER (ORDER BY v.fecha_hora, v.id) + (SELECT p_desde - 1 FROM params) AS nuevo_secuencial
    FROM public.ventas v
    JOIN params p ON TRUE
    WHERE v.tipo_documento_fiscal = 'FACTURA'
      AND v.cai = p.p_cai
  ),
  conflictos_sec AS (
    SELECT fs.numero_secuencial
    FROM public.facturacion_sar fs
    JOIN params p ON TRUE
    JOIN base b ON b.nuevo_secuencial = fs.numero_secuencial
    WHERE fs.cai = p.p_cai
      AND fs.venta_id IS DISTINCT FROM b.id
      AND fs.venta_id NOT IN (SELECT id FROM base)
    LIMIT 1
  )
  SELECT numero_secuencial INTO v_conflicto_sec FROM conflictos_sec;

  IF v_conflicto_sec IS NOT NULL THEN
    RAISE EXCEPTION
      'REORD-004: El secuencial % ya existe en facturacion_sar fuera del lote a reordenar.',
      v_conflicto_sec;
  END IF;
END $$;

-- 2.2.2 Fase temporal: mover a valores provisionales para evitar choque UNIQUE
WITH params AS (
  SELECT
    '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai,
    1::int AS p_desde
),
base AS (
  SELECT
    v.id,
    split_part(v.factura, '-', 1) AS est,
    split_part(v.factura, '-', 2) AS pto,
    split_part(v.factura, '-', 3) AS tdoc,
    row_number() OVER (ORDER BY v.fecha_hora, v.id) + (SELECT p_desde - 1 FROM params) AS nuevo_secuencial
  FROM public.ventas v
  JOIN params p ON TRUE
  WHERE v.tipo_documento_fiscal = 'FACTURA'
    AND v.cai = p.p_cai
),
mapping AS (
  SELECT
    b.id,
    b.nuevo_secuencial,
    (b.est || '-' || b.pto || '-' || b.tdoc || '-' || lpad(b.nuevo_secuencial::text, 8, '0')) AS factura_nueva,
    ('TMP-' || b.id::text) AS factura_tmp
  FROM base b
)
UPDATE public.ventas v
SET
  factura = m.factura_tmp
FROM mapping m
WHERE v.id = m.id;

WITH params AS (
  SELECT
    '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai,
    1::int AS p_desde
),
base AS (
  SELECT
    v.id,
    row_number() OVER (ORDER BY v.fecha_hora, v.id) + (SELECT p_desde - 1 FROM params) AS nuevo_secuencial
  FROM public.ventas v
  JOIN params p ON TRUE
  WHERE v.tipo_documento_fiscal = 'FACTURA'
    AND v.cai = p.p_cai
),
mapping AS (
  SELECT
    b.id,
    b.nuevo_secuencial,
    ('TMP-' || b.id::text) AS factura_tmp,
    ('4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text || '__TMP__' || b.id::text) AS cai_tmp
  FROM base b
)
UPDATE public.facturacion_sar fs
SET
  cai = m.cai_tmp,
  numero_factura = m.factura_tmp
FROM mapping m
WHERE fs.venta_id = m.id;

-- 2.2.3 Fase final: aplicar numeración definitiva
WITH params AS (
  SELECT
    '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai,
    1::int AS p_desde
),
base AS (
  SELECT
    v.id,
    split_part(v.factura, '-', 1) AS est,
    split_part(v.factura, '-', 2) AS pto,
    split_part(v.factura, '-', 3) AS tdoc,
    row_number() OVER (ORDER BY v.fecha_hora, v.id) + (SELECT p_desde - 1 FROM params) AS nuevo_secuencial
  FROM public.ventas v
  JOIN params p ON TRUE
  WHERE v.tipo_documento_fiscal = 'FACTURA'
    AND v.cai = p.p_cai
),
mapping AS (
  SELECT
    b.id,
    b.nuevo_secuencial,
    (b.est || '-' || b.pto || '-' || b.tdoc || '-' || lpad(b.nuevo_secuencial::text, 8, '0')) AS factura_nueva
  FROM base b
)
UPDATE public.ventas v
SET
  numero_secuencial = m.nuevo_secuencial,
  factura = m.factura_nueva
FROM mapping m
WHERE v.id = m.id;

WITH params AS (
  SELECT
    '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai,
    1::int AS p_desde
),
base AS (
  SELECT
    v.id,
    split_part(v.factura, '-', 1) AS est,
    split_part(v.factura, '-', 2) AS pto,
    split_part(v.factura, '-', 3) AS tdoc,
    row_number() OVER (ORDER BY v.fecha_hora, v.id) + (SELECT p_desde - 1 FROM params) AS nuevo_secuencial
  FROM public.ventas v
  JOIN params p ON TRUE
  WHERE v.tipo_documento_fiscal = 'FACTURA'
    AND v.cai = p.p_cai
),
mapping AS (
  SELECT
    b.id,
    b.nuevo_secuencial,
    (b.est || '-' || b.pto || '-' || b.tdoc || '-' || lpad(b.nuevo_secuencial::text, 8, '0')) AS factura_nueva,
    '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS cai_final
  FROM base b
)
UPDATE public.facturacion_sar fs
SET
  cai = m.cai_final,
  numero_secuencial = m.nuevo_secuencial,
  numero_factura = m.factura_nueva
FROM mapping m
WHERE fs.venta_id = m.id;

-- Alinear factura_actual del CAI al último secuencial emitido
WITH params AS (
  SELECT '4F5DDC-8CBC74-8B82E0-63BE03-0909F3-97'::text AS p_cai
), ult AS (
  SELECT COALESCE(MAX(numero_secuencial), 0) AS ultimo
  FROM public.ventas v
  JOIN params p ON TRUE
  WHERE v.tipo_documento_fiscal = 'FACTURA'
    AND v.cai = p.p_cai
)
UPDATE public.cai_facturas cf
SET factura_actual = ult.ultimo::text
FROM ult, params p
WHERE cf.cai = p.p_cai
  AND UPPER(COALESCE(cf.tipo_comprobante, '')) = 'FACTURA'
  AND cf.activo = TRUE;

COMMIT;

-- ============================================================================
-- FIN
-- ============================================================================
