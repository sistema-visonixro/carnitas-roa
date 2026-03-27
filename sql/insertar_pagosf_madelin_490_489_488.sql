-- =============================================================
--  Insertar en pagosf las facturas faltantes de Madelin Matute
--  Fecha: 2026-03-26
--  Facturas: 490, 489, 488
--
--  ⚠  NOTA sobre 490 y 489:
--    Se desconoce el billete exacto entregado por el cliente,
--    por lo que se registra:
--      efectivo      = total de la venta (cobro exacto)
--      total_recibido= total de la venta
--      cambio        = 0
--    Si hubo cambio, ajusta los valores antes de ejecutar.
--
--  ⚠  NOTA sobre 488:
--    Ya fue incluida en insertar_pagosf_madelin_faltantes_20260326.sql
--    con efectivo=500 / cambio=260. Se incluye aquí con los mismos
--    valores y el guarda NOT EXISTS la omitirá si ya existe.
--
--  El trigger trg_pagosf_set_facturas_id rellena facturas_id
--  automáticamente al insertar.
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
    -- factura | efectivo | tarjeta | transf | dolares | dolares_usd | delivery | total_recibido | cambio | cajero          | cajero_id                                    | cliente | fecha_hora
    ('490',  25.00, 0.00, 0.00, 0.00, 0.00, 0.00,  25.00,  0.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'OUYH',   '2026-03-26 20:57:09'::timestamp),
    ('489', 230.00, 0.00, 0.00, 0.00, 0.00, 0.00, 230.00,  0.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'FREDDY', '2026-03-26 20:50:32'::timestamp),
    ('488', 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 500.00, 260.00, 'Madelin Matute', '0fa32a3d-2176-4fca-be88-c72bef079dd4', 'TRICIA', '2026-03-26 20:45:55'::timestamp)
) AS v(factura, efectivo, tarjeta, transferencia, dolares, dolares_usd, delivery, total_recibido, cambio, cajero, cajero_id, cliente, fecha_hora)
WHERE NOT EXISTS (
  SELECT 1 FROM pagosf pf WHERE pf.factura = v.factura
);

-- =============================================================
-- Verificación: las 3 facturas insertadas
-- =============================================================
SELECT
  pf.id,
  pf.factura,
  pf.facturas_id,
  pf.efectivo,
  pf.total_recibido,
  pf.cambio,
  pf.cliente,
  pf.fecha_hora
FROM pagosf pf
WHERE pf.factura IN ('488', '489', '490')
  AND pf.cajero_id = '0fa32a3d-2176-4fca-be88-c72bef079dd4'
ORDER BY pf.factura;
