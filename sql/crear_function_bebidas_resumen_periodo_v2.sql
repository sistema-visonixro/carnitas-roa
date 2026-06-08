-- Función v2: resumen de movimientos de bebidas entre un rango de fecha/hora
-- Usa tablas bebidas_entradas_v2 y bebidas_salidas_defecto_v2 y extrae ventas desde ventas.productos

CREATE OR REPLACE FUNCTION fn_bebidas_resumen_periodo_v2(start_ts timestamp, end_ts timestamp)
RETURNS TABLE (
  producto_id text,
  nombre text,
  entradas numeric,
  salidas_por_venta numeric,
  salidas_por_defecto numeric,
  total numeric
)
LANGUAGE sql STABLE
AS $$
WITH prod AS (
  SELECT id::text AS id_text, nombre FROM productos WHERE COALESCE(tipo,'') = 'bebida'
),
entradas AS (
  SELECT producto_id::text AS producto_id_text, SUM(cantidad)::numeric AS entradas
  FROM bebidas_entradas_v2
  WHERE (created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN start_ts AND end_ts
  GROUP BY producto_id::text
),
salidas_defecto AS (
  SELECT producto_id::text AS producto_id_text, SUM(cantidad)::numeric AS salidas_defecto
  FROM bebidas_salidas_defecto_v2
  WHERE (created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN start_ts AND end_ts
  GROUP BY producto_id::text
),
salidas_venta AS (
  SELECT (item->>'id') AS producto_id_text, SUM((item->>'cantidad')::numeric) AS salidas_por_venta
  FROM ventas, jsonb_array_elements(COALESCE(ventas.productos::jsonb, '[]'::jsonb)) AS item
  WHERE (ventas.created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN start_ts AND end_ts
    AND (ventas.tipo IS NULL OR ventas.tipo NOT IN ('ANULADA'))
  GROUP BY producto_id_text
)
SELECT
  p.id_text AS producto_id,
  p.nombre,
  COALESCE(e.entradas, 0)::numeric AS entradas,
  COALESCE(sv.salidas_por_venta, 0)::numeric AS salidas_por_venta,
  COALESCE(sd.salidas_defecto, 0)::numeric AS salidas_por_defecto,
  (
    COALESCE(e.entradas, 0) - COALESCE(sv.salidas_por_venta, 0) - COALESCE(sd.salidas_defecto, 0)
  )::numeric AS total
FROM prod p
LEFT JOIN entradas e ON e.producto_id_text = p.id_text
LEFT JOIN salidas_venta sv ON sv.producto_id_text = p.id_text
LEFT JOIN salidas_defecto sd ON sd.producto_id_text = p.id_text
ORDER BY p.nombre;
$$;

-- Uso: SELECT * FROM fn_bebidas_resumen_periodo_v2('2026-06-01 00:00:00','2026-06-07 23:59:59');
