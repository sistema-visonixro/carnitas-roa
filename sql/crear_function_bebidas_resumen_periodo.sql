-- Función que devuelve resumen de movimientos de bebidas entre un rango de fecha/hora
-- Los parámetros `start_ts` y `end_ts` deben ser TIMESTAMP SIN ZONA expresados
-- en hora local de Honduras (zona 'America/Tegucigalpa').
-- Ej: SELECT * FROM fn_bebidas_resumen_periodo('2026-06-01 00:00:00', '2026-06-07 23:59:59');

CREATE OR REPLACE FUNCTION fn_bebidas_resumen_periodo(start_ts timestamp, end_ts timestamp)
RETURNS TABLE (
  producto_id bigint,
  nombre text,
  entradas numeric,
  salidas_por_venta numeric,
  salidas_por_defecto numeric,
  total numeric
)
LANGUAGE sql STABLE
AS $$
  WITH prod AS (
    SELECT * FROM productos WHERE COALESCE(tipo,'') = 'bebida'
  ),
  entradas AS (
    SELECT producto_id, SUM(cantidad)::numeric AS entradas
    FROM bebidas_entradas
    WHERE (created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN start_ts AND end_ts
    GROUP BY producto_id
  ),
  salidas_defecto AS (
    SELECT producto_id, SUM(cantidad)::numeric AS salidas_defecto
    FROM bebidas_salidas_defecto
    WHERE (created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN start_ts AND end_ts
    GROUP BY producto_id
  ),
  salidas_venta AS (
    SELECT (item->>'id') AS producto_id_text, SUM((item->>'cantidad')::numeric) AS salidas_por_venta
    FROM ventas, jsonb_array_elements(COALESCE(ventas.productos::jsonb, '[]'::jsonb)) AS item
    WHERE (ventas.created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN start_ts AND end_ts
      AND ventas.tipo NOT IN ('ANULADA')
    GROUP BY producto_id_text
  )
  SELECT
    p.id AS producto_id,
    p.nombre,
    COALESCE(e.entradas, 0)::numeric AS entradas,
    COALESCE(sv.salidas_por_venta, 0)::numeric AS salidas_por_venta,
    COALESCE(sd.salidas_defecto, 0)::numeric AS salidas_por_defecto,
    (
      COALESCE(e.entradas, 0) - COALESCE(sv.salidas_por_venta, 0) - COALESCE(sd.salidas_defecto, 0)
    )::numeric AS total
  FROM prod p
  LEFT JOIN entradas e ON e.producto_id::text = p.id::text
  LEFT JOIN salidas_venta sv ON sv.producto_id_text = p.id::text
  LEFT JOIN salidas_defecto sd ON sd.producto_id::text = p.id::text
  ORDER BY p.nombre;
$$;

-- Ejemplos de uso:
-- 1) Rango local Honduras (sin zona en parámetros):
--    SELECT * FROM fn_bebidas_resumen_periodo('2026-06-01 00:00:00','2026-06-07 23:59:59');

-- 2) Si prefieres pasar timestamps con zona, conviértelos a hora local cuando llames:
--    SELECT * FROM fn_bebidas_resumen_periodo((timestamp with time zone '2026-06-01 00:00:00 America/Tegucigalpa')::timestamp,
--                                              (timestamp with time zone '2026-06-07 23:59:59 America/Tegucigalpa')::timestamp);

-- 3) Para obtener "datos actuales" (sin filtro de fecha), usa la vista `v_bebidas_inventario_resumen`:
--    SELECT * FROM v_bebidas_inventario_resumen ORDER BY nombre;
