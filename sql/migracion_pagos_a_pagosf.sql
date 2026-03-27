-- =============================================================
--  MIGRACIÓN LIMPIA: pagos (múltiples filas) → pagosf (una fila por factura)
--
--  Pasos:
--    1. Vacía pagosf por completo (TRUNCATE) para empezar de cero.
--    2. Agrupa todos los pagos de la tabla pagos por número de factura.
--    3. Hace LEFT JOIN con facturas para obtener facturas_id.
--    4. Inserta la fila consolidada en pagosf.
--
--  Ejecutar UNA sola vez (o cuando se quiera rehacer desde cero).
-- =============================================================

-- ─── 0. VISTA PREVIA (solo consulta, no modifica nada) ─────────
SELECT
  COUNT(DISTINCT COALESCE(factura_venta, factura)) AS facturas_unicas,
  COUNT(*)                                          AS filas_en_pagos
FROM pagos
WHERE COALESCE(factura_venta, factura) IS NOT NULL
  AND COALESCE(factura_venta, factura) <> '';

-- ─── 1. LIMPIAR pagosf (migración limpia desde cero) ──────────
TRUNCATE TABLE pagosf RESTART IDENTITY;

-- ─── 2. MIGRACIÓN PRINCIPAL ────────────────────────────────────
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
  banco,
  tarjeta_num,
  autorizacion,
  ref_transferencia,
  cajero,
  cajero_id,
  cliente,
  facturas_id,
  fecha_hora
)
SELECT
  -- Número de factura (usa factura_venta; si es NULL, usa factura)
  COALESCE(p.factura_venta, p.factura)                                        AS factura,

  -- Efectivo: suma excluyendo filas de CAMBIO y DELIVERY
  GREATEST(0, SUM(
    CASE
      WHEN p.tipo = 'efectivo'
       AND COALESCE(p.referencia, '') NOT IN ('CAMBIO', 'DELIVERY')
      THEN COALESCE(p.monto, 0)
      ELSE 0
    END
  ))                                                                           AS efectivo,

  -- Tarjeta
  GREATEST(0, SUM(
    CASE WHEN p.tipo = 'tarjeta' THEN COALESCE(p.monto, 0) ELSE 0 END
  ))                                                                           AS tarjeta,

  -- Transferencia
  GREATEST(0, SUM(
    CASE WHEN p.tipo = 'transferencia' THEN COALESCE(p.monto, 0) ELSE 0 END
  ))                                                                           AS transferencia,

  -- Dólares (monto en Lempiras)
  GREATEST(0, SUM(
    CASE WHEN p.tipo = 'dolares' THEN COALESCE(p.monto, 0) ELSE 0 END
  ))                                                                           AS dolares,

  -- Dólares (USD original)
  GREATEST(0, SUM(
    CASE WHEN p.tipo = 'dolares' THEN COALESCE(p.usd_monto, 0) ELSE 0 END
  ))                                                                           AS dolares_usd,

  -- Delivery (fila con referencia = 'DELIVERY')
  GREATEST(0, SUM(
    CASE
      WHEN COALESCE(p.referencia, '') = 'DELIVERY'
      THEN COALESCE(p.monto, 0)
      ELSE 0
    END
  ))                                                                           AS delivery,

  -- Total recibido y cambio (tomados del primer pago que los tenga)
  COALESCE(MAX(p.recibido), 0)                                                AS total_recibido,
  COALESCE(MAX(p.cambio),   0)                                                AS cambio,

  -- Detalles pago con tarjeta
  MAX(CASE WHEN p.tipo = 'tarjeta' THEN p.banco       END)                   AS banco,
  MAX(CASE WHEN p.tipo = 'tarjeta' THEN p.tarjeta     END)                   AS tarjeta_num,
  MAX(CASE WHEN p.tipo = 'tarjeta' THEN p.autorizador END)                   AS autorizacion,

  -- Referencia transferencia (excluye 'CAMBIO' y 'DELIVERY')
  MAX(CASE
    WHEN p.tipo = 'transferencia'
     AND COALESCE(p.referencia, '') NOT IN ('CAMBIO', 'DELIVERY')
    THEN p.referencia
  END)                                                                        AS ref_transferencia,

  -- Metadatos del cajero y cliente
  MAX(p.cajero)                                                               AS cajero,
  MAX(p.cajero_id)::TEXT                                                      AS cajero_id,
  MAX(p.cliente)                                                              AS cliente,

  -- ID de la fila correspondiente en la tabla facturas (INTEGER, integridad referencial)
  MAX(f.id)                                                                   AS facturas_id,

  -- Fecha/hora más temprana del grupo (momento de la venta)
  MIN(p.fecha_hora)                                                           AS fecha_hora

FROM pagos p
LEFT JOIN facturas f
  ON f.factura = COALESCE(p.factura_venta, p.factura)

WHERE COALESCE(p.factura_venta, p.factura) IS NOT NULL
  AND COALESCE(p.factura_venta, p.factura) <> ''

GROUP BY COALESCE(p.factura_venta, p.factura);

-- ─── 3. VERIFICACIÓN POST-MIGRACIÓN ────────────────────────────
-- Compara totales entre pagos y pagosf
SELECT
  'pagosf'                                                               AS tabla,
  COUNT(*)                                                               AS filas,
  COUNT(facturas_id)                                                     AS con_facturas_id,
  ROUND(SUM(efectivo + tarjeta + transferencia + dolares + delivery), 2) AS total_lps
FROM pagosf

UNION ALL

SELECT
  'pagos (original)'                                                     AS tabla,
  COUNT(DISTINCT COALESCE(factura_venta, factura))                       AS filas,
  NULL                                                                   AS con_facturas_id,
  ROUND(SUM(
    CASE
      WHEN NOT (tipo = 'efectivo' AND COALESCE(referencia,'') = 'CAMBIO')
      THEN COALESCE(monto, 0)
      ELSE 0
    END
  ), 2)                                                                  AS total_lps
FROM pagos
WHERE COALESCE(factura_venta, factura) IS NOT NULL;

-- Facturas sin match en pagosf (deberían ser 0 si la migración fue completa)
SELECT COUNT(*) AS facturas_sin_pago
FROM facturas f
LEFT JOIN pagosf pf ON pf.factura = f.factura
WHERE pf.id IS NULL
  AND f.es_donacion IS DISTINCT FROM TRUE;
