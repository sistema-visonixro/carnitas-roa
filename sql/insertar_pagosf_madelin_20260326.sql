-- =============================================================
--  Insertar en pagosf los registros que no se migraron
--  Cajero: Madelin Matute | Fecha: 2026-03-26
-- =============================================================

INSERT INTO pagosf (
  factura,
  efectivo,
  tarjeta,
  transferencia,
  dolares,
  dolares_usd,
  delivery,
  total_recibido,
  cambio,
  cajero,
  cajero_id,
  cliente,
  facturas_id,
  fecha_hora
)
SELECT
  v.factura,
  v.efectivo,
  v.tarjeta,
  v.transferencia,
  v.dolares,
  v.dolares_usd,
  v.delivery,
  v.total_recibido,
  v.cambio,
  v.cajero,
  v.cajero_id,
  v.cliente,
  f.id  AS facturas_id,
  v.fecha_hora
FROM (
  VALUES
    -- factura, efectivo, tarjeta, trans, dolares, dolares_usd, delivery, total_recibido, cambio, cajero, cajero_id, cliente, fecha_hora
    ('488', 500.00, 0.00, 0.00,   0.00,  0.00, 0.00, 500.00, 260.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'TRICIA',  '2026-03-26 20:45:53'::timestamp),
    ('487',   0.00, 0.00, 0.00, 500.00, 20.00, 0.00, 500.00,  70.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'OMAR',    '2026-03-26 20:17:33'::timestamp),
    ('486', 500.00, 0.00, 0.00,   0.00,  0.00, 0.00, 500.00,  70.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'KATHERIN','2026-03-26 20:07:52'::timestamp),
    ('485', 500.00, 0.00, 0.00,   0.00,  0.00, 0.00, 500.00, 200.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'ADAN',    '2026-03-26 20:06:47'::timestamp),
    ('484', 200.00, 0.00, 0.00,   0.00,  0.00, 0.00, 200.00,  20.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'JHOSETH', '2026-03-26 20:02:31'::timestamp),
    ('483',  80.00, 0.00, 0.00,   0.00,  0.00, 0.00,  80.00,   0.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'KEVIN',   '2026-03-26 19:34:06'::timestamp)
) AS v(factura, efectivo, tarjeta, transferencia, dolares, dolares_usd, delivery, total_recibido, cambio, cajero, cajero_id, cliente, fecha_hora)
LEFT JOIN facturas f ON f.factura = v.factura
-- Evitar duplicados si ya existe la factura en pagosf
WHERE NOT EXISTS (
  SELECT 1 FROM pagosf pf WHERE pf.factura = v.factura
);

-- Verificación: deben aparecer las 6 filas insertadas
SELECT factura, efectivo, dolares, dolares_usd, cambio, cliente, fecha_hora
FROM pagosf
WHERE cajero_id = '0fa32a3d-2176-4fca-be88-c72bef079dd4'
  AND fecha_hora::date = '2026-03-26'
ORDER BY fecha_hora;
