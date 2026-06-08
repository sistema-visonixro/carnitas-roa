-- Vista resumen de inventario de bebidas
-- Muestra por producto (tipo = 'bebida'):
-- nombre, entradas (from bebidas_entradas), salidas_por_venta (from ventas->productos),
-- salidas_por_defecto (from bebidas_salidas_defecto) y total estimado.

CREATE OR REPLACE VIEW v_bebidas_inventario_resumen AS
SELECT
  p.id AS producto_id,
  p.nombre,
  COALESCE(e.entradas, 0)::numeric AS entradas,
  COALESCE(sv.salidas_por_venta, 0)::numeric AS salidas_por_venta,
  COALESCE(sd.salidas_defecto, 0)::numeric AS salidas_por_defecto,
  (
    COALESCE(p.stock, 0) + COALESCE(e.entradas, 0) - COALESCE(sv.salidas_por_venta, 0) - COALESCE(sd.salidas_defecto, 0)
  )::numeric AS total
FROM productos p
LEFT JOIN (
  SELECT producto_id::text AS producto_id_text, SUM(cantidad) AS entradas
  FROM bebidas_entradas
  GROUP BY producto_id::text
) e ON e.producto_id_text = p.id::text
LEFT JOIN (
  -- extrae cantidades desde ventas.productos (asegura jsonb y compara por texto para evitar
  -- errores si `productos.id` es uuid o bigint en distinto tipo)
  SELECT (item->>'id') AS producto_id_text, SUM((item->>'cantidad')::numeric) AS salidas_por_venta
  FROM ventas, jsonb_array_elements(COALESCE(ventas.productos::jsonb, '[]'::jsonb)) AS item
  WHERE ventas.tipo NOT IN ('ANULADA')
  GROUP BY producto_id_text
) sv ON sv.producto_id_text = p.id::text
LEFT JOIN (
  SELECT producto_id::text AS producto_id_text, SUM(cantidad) AS salidas_defecto
  FROM bebidas_salidas_defecto
  GROUP BY producto_id::text
) sd ON sd.producto_id_text = p.id::text
WHERE COALESCE(p.tipo, '') = 'bebida';
  (
    COALESCE(e.entradas, 0) - COALESCE(sv.salidas_por_venta, 0) - COALESCE(sd.salidas_defecto, 0)
  )::numeric AS total
--    Si tu columna tiene otro nombre (por ejemplo `existencia`, `cantidad`), cámbiala.
-- 2) Para ver datos históricos entre fechas (filtro por rango) usa la función
--    `fn_bebidas_resumen_periodo(start_ts, end_ts)` proporcionada en
--    `crear_function_bebidas_resumen_periodo.sql` o consulta directamente las tablas
--    `bebidas_entradas`, `bebidas_salidas_defecto` y la extracción desde `ventas` con
--    filtros `created_at AT TIME ZONE 'America/Tegucigalpa' BETWEEN start_ts AND end_ts`.
