-- Ejemplos: insertar ingresos y salidas por defecto

-- Registrar un ingreso masivo (puede ejecutarse desde Supabase SQL editor o API):
-- INSERT INTO bebidas_entradas (producto_id, cantidad, nota, created_by) VALUES
--   (123, 10, 'Recepción proveedor', 'usuario1'),
--   (124, 20, 'Recepción proveedor', 'usuario1');

-- Registrar una salida por defecto (ajuste/merma):
-- INSERT INTO bebidas_salidas_defecto (producto_id, cantidad, motivo, created_by) VALUES
--   (123, 2, 'Merma', 'usuario1'),
--   (124, 1, 'Muestra', 'usuario1');

-- Consultas de ejemplo:
-- 1) Mostrar datos actuales (sin rango):
--    SELECT * FROM v_bebidas_inventario_resumen ORDER BY nombre;

-- 2) Mostrar historial entre fechas (hora local Honduras):
--    SELECT * FROM fn_bebidas_resumen_periodo('2026-06-01 00:00:00','2026-06-07 23:59:59');

-- 3) Consultar movimientos detallados por producto entre fechas:
--    -- Entradas
--    SELECT * FROM bebidas_entradas WHERE (created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN '2026-06-01 00:00:00' AND '2026-06-07 23:59:59' AND producto_id = 123;
--    -- Salidas por defecto
--    SELECT * FROM bebidas_salidas_defecto WHERE (created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN '2026-06-01 00:00:00' AND '2026-06-07 23:59:59' AND producto_id = 123;
--    -- Salidas por venta (desglosadas desde ventas.productos)
--    SELECT v.id AS venta_id, v.created_at, item
--    FROM ventas v, jsonb_array_elements(v.productos) item
--    WHERE (v.created_at AT TIME ZONE 'America/Tegucigalpa') BETWEEN '2026-06-01 00:00:00' AND '2026-06-07 23:59:59'
--      AND (item->>'id')::bigint = 123;
