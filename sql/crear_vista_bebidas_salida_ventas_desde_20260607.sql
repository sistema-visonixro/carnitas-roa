-- Vista: resumen de salidas por venta para productos tipo 'bebida'
-- Suma las cantidades vendidas (restando devoluciones) desde las ventas
-- a partir del 2026-06-07 (inclusive). También agrega entradas y salidas por defecto
-- desde las tablas `bebidas_entradas_v2` y `bebidas_salidas_defecto_v2`.

CREATE OR REPLACE VIEW v_bebidas_salida_ventas_desde_20260607 AS
SELECT
  p.id AS producto_id,
  p.nombre,
  COALESCE(s.vendido_desde, 0)::numeric AS vendido_desde,
  COALESCE(e.entradas, 0)::numeric AS entradas,
  COALESCE(sd.salidas_defecto, 0)::numeric AS salidas_defecto,
  -- total estimado como entradas - ventas - salidas_defecto
  (COALESCE(e.entradas, 0) - COALESCE(s.vendido_desde, 0) - COALESCE(sd.salidas_defecto, 0))::numeric AS total_estimado
FROM productos p
-- Salidas por venta desde 2026-06-07 (suma, restando devoluciones)
LEFT JOIN (
  SELECT
    (item->>'id') AS producto_id_text,
    SUM(
      CASE
        WHEN v.tipo IN ('DEVOLUCION','DEVUELTA') THEN -((item->>'cantidad')::numeric)
        WHEN v.tipo IN ('ANULADA') THEN 0
        ELSE ((item->>'cantidad')::numeric)
      END
    )::numeric AS vendido_desde
  FROM ventas v,
       jsonb_array_elements(COALESCE(v.productos::jsonb, '[]'::jsonb)) AS item
  WHERE v.created_at >= (timestamp with time zone '2026-06-07 00:00:00 America/Tegucigalpa')
    AND (v.tipo IS NULL OR v.tipo NOT IN ('ANULADA'))
  GROUP BY producto_id_text
) s ON s.producto_id_text = p.id::text
-- Entradas registradas manualmente
LEFT JOIN (
  SELECT producto_id::text AS producto_id_text, SUM(cantidad)::numeric AS entradas
  FROM bebidas_entradas_v2
  GROUP BY producto_id::text
) e ON e.producto_id_text = p.id::text
-- Salidas por defecto (merma/ajustes)
LEFT JOIN (
  SELECT producto_id::text AS producto_id_text, SUM(cantidad)::numeric AS salidas_defecto
  FROM bebidas_salidas_defecto_v2
  GROUP BY producto_id::text
) sd ON sd.producto_id_text = p.id::text
WHERE COALESCE(p.tipo, '') = 'bebida'
ORDER BY p.nombre;

-- Uso: SELECT * FROM v_bebidas_salida_ventas_desde_20260607;
