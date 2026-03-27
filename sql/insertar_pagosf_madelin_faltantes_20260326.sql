-- =============================================================
--  Insertar en pagosf las 3 facturas que no se migraron
--  Cajero: Madelin Matute | Fecha: 2026-03-26
--  Facturas: 486, 487, 488
--
--  NOTA: el trigger trg_pagosf_set_facturas_id rellena
--  facturas_id automáticamente al momento del INSERT.
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
  v.fecha_hora
FROM (
  VALUES
    -- factura | efectivo | tarjeta | transf | dolares(L) | dolares_usd | delivery | total_recibido | cambio | cajero | cajero_id | cliente | fecha_hora
    ('488', 500.00, 0.00, 0.00,   0.00,  0.00, 0.00, 500.00, 260.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'TRICIA',  '2026-03-26 20:45:55'::timestamp),
    ('487',   0.00, 0.00, 0.00, 500.00, 20.00, 0.00, 500.00,  70.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'OMAR',    '2026-03-26 20:17:34'::timestamp),
    ('486', 500.00, 0.00, 0.00,   0.00,  0.00, 0.00, 500.00,  70.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'KATHERIN','2026-03-26 20:07:53'::timestamp)
) AS v(factura, efectivo, tarjeta, transferencia, dolares, dolares_usd, delivery, total_recibido, cambio, cajero, cajero_id, cliente, fecha_hora)
-- Evitar duplicados si ya existen en pagosf
WHERE NOT EXISTS (
  SELECT 1 FROM pagosf pf WHERE pf.factura = v.factura
);

-- =============================================================
-- Verificación: las 3 facturas con sus datos y facturas_id
-- (el trigger debió rellenar facturas_id automáticamente)
-- =============================================================
SELECT
  pf.id,
  pf.factura,
  pf.facturas_id,
  pf.efectivo,
  pf.dolares,
  pf.dolares_usd,
  pf.total_recibido,
  pf.cambio,
  pf.cliente,
  pf.fecha_hora
FROM pagosf pf
WHERE pf.factura IN ('486', '487', '488')
  AND pf.cajero_id = '0fa32a3d-2176-4fca-be88-c72bef079dd4'
ORDER BY pf.factura;
