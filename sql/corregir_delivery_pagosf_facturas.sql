-- =============================================================
-- Delivery: Diagnóstico y corrección retroactiva (v2)
--
-- MODELO CORRECTO en pagosf:
--   efectivo / tarjeta / transferencia / dolares = monto SOLO productos
--   delivery                                     = costo de envío
--   total_recibido                               = productos + delivery
--
-- Al LEER (resumen de caja, cierre, dashboard) se suma:
--   total método = método + delivery
--
-- PROBLEMA detectado:
--   En algunos registros el delivery fue sumado dentro del campo
--   del método de pago además de almacenarse en delivery, causando
--   que al leer se sume dos veces.
--   Ejemplo incorrecto:
--     transferencia=400, delivery=100, total_recibido=400
--     → al leer: 400 + 100 = 500  (incorrecto)
--   Ejemplo correcto:
--     transferencia=300, delivery=100, total_recibido=400
--     → al leer: 300 + 100 = 400  (correcto)
--
-- DETECCIÓN de registro incorrecto:
--   método + delivery > total_recibido
--   → el delivery ya está incluido en el método → restar delivery del método
-- =============================================================


-- =============================================================
-- 1. DIAGNÓSTICO: ver todos los registros delivery con su estado
-- =============================================================
SELECT
  pf.id,
  f.factura    AS num_factura,
  f.fecha_hora,
  f.cajero,
  f.cliente,
  f.total      AS total_factura,
  pf.efectivo,
  pf.tarjeta,
  pf.transferencia,
  pf.dolares,
  pf.delivery,
  pf.total_recibido,

  -- Detectar el estado de cada registro
  CASE
    WHEN ROUND((COALESCE(pf.efectivo,0) + COALESCE(pf.tarjeta,0) +
                COALESCE(pf.transferencia,0) + COALESCE(pf.dolares,0))::numeric
               + COALESCE(pf.delivery,0)::numeric, 2)
         > ROUND(pf.total_recibido::numeric, 2)
    THEN '⚠  delivery DUPLICADO en método (necesita corrección)'
    ELSE '✅ correcto: método solo productos, delivery separado'
  END AS estado

FROM public.pagosf pf
LEFT JOIN public.facturas f ON f.factura = pf.factura
WHERE pf.delivery > 0
ORDER BY pf.fecha_hora DESC;


-- =============================================================
-- 2. CORRECCIÓN: restar delivery del método donde fue duplicado
--    Condición: método + delivery > total_recibido
--    Corrección: método = total_recibido - delivery  (= solo productos)
-- =============================================================

-- Efectivo
UPDATE public.pagosf
SET efectivo = ROUND((total_recibido - delivery)::numeric, 2)
WHERE delivery > 0
  AND efectivo > 0
  AND tarjeta = 0
  AND transferencia = 0
  AND dolares = 0
  AND ROUND((efectivo + delivery)::numeric, 2) > ROUND(total_recibido::numeric, 2);

-- Tarjeta
UPDATE public.pagosf
SET tarjeta = ROUND((total_recibido - delivery)::numeric, 2)
WHERE delivery > 0
  AND tarjeta > 0
  AND efectivo = 0
  AND transferencia = 0
  AND dolares = 0
  AND ROUND((tarjeta + delivery)::numeric, 2) > ROUND(total_recibido::numeric, 2);

-- Transferencia
UPDATE public.pagosf
SET transferencia = ROUND((total_recibido - delivery)::numeric, 2)
WHERE delivery > 0
  AND transferencia > 0
  AND efectivo = 0
  AND tarjeta = 0
  AND dolares = 0
  AND ROUND((transferencia + delivery)::numeric, 2) > ROUND(total_recibido::numeric, 2);

-- Dólares
UPDATE public.pagosf
SET dolares = ROUND((total_recibido - delivery)::numeric, 2)
WHERE delivery > 0
  AND dolares > 0
  AND efectivo = 0
  AND tarjeta = 0
  AND transferencia = 0
  AND ROUND((dolares + delivery)::numeric, 2) > ROUND(total_recibido::numeric, 2);


-- =============================================================
-- 3. CORRECCIÓN DE facturas.total
--    El total en facturas debe ser = productos + delivery.
--    Si facturas.total == total_recibido ya está bien (incluye delivery).
--    Si facturas.total < total_recibido → no incluye delivery → corregir.
-- =============================================================
UPDATE public.facturas f
SET total = pf.total_recibido
FROM public.pagosf pf
WHERE pf.factura = f.factura
  AND pf.delivery > 0
  AND UPPER(f.tipo_orden) = 'DELIVERY'
  AND ROUND(f.total::numeric, 2) < ROUND(pf.total_recibido::numeric, 2);


-- =============================================================
-- 4. VERIFICACIÓN FINAL
--    Después de correr las correcciones NO debe quedar ninguna
--    fila con estado "DUPLICADO".
-- =============================================================
SELECT
  pf.id,
  pf.factura,
  pf.fecha_hora,
  pf.efectivo,
  pf.tarjeta,
  pf.transferencia,
  pf.dolares,
  pf.delivery,
  pf.total_recibido,
  f.total AS total_factura,
  CASE
    WHEN ROUND((COALESCE(pf.efectivo,0) + COALESCE(pf.tarjeta,0) +
                COALESCE(pf.transferencia,0) + COALESCE(pf.dolares,0))::numeric
               + COALESCE(pf.delivery,0)::numeric, 2)
         > ROUND(pf.total_recibido::numeric, 2)
    THEN '⚠  TODAVÍA DUPLICADO'
    ELSE '✅ OK'
  END AS estado
FROM public.pagosf pf
LEFT JOIN public.facturas f ON f.factura = pf.factura
WHERE pf.delivery > 0
ORDER BY pf.fecha_hora DESC;



-- =============================================================
-- 1. DIAGNÓSTICO: ver facturas de tipo DELIVERY con su pago
-- =============================================================
SELECT
  f.id         AS factura_db_id,
  f.factura    AS num_factura,
  f.fecha_hora,
  f.cajero,
  f.cliente,
  f.total      AS total_factura,

  pf.efectivo,
  pf.tarjeta,
  pf.transferencia,
  pf.dolares,
  pf.delivery  AS costo_delivery,
  pf.total_recibido,

  -- Detectar si el delivery YA está incluido en el método de pago
  -- (total_recibido == efectivo+tarjeta+transf+dolares → ya está incluido;
  --  total_recibido == efectivo+tarjeta+transf+dolares+delivery → NO incluido aún)
  CASE
    WHEN ROUND(
           COALESCE(pf.efectivo,0) + COALESCE(pf.tarjeta,0) +
           COALESCE(pf.transferencia,0) + COALESCE(pf.dolares,0)
           + COALESCE(pf.delivery, 0), 2
         ) = ROUND(pf.total_recibido, 2)
    THEN 'delivery NO incluido en método de pago (dato viejo)'
    ELSE 'delivery YA incluido en método de pago (dato nuevo)'
  END AS estado_delivery

FROM public.facturas f
JOIN public.pagosf pf ON pf.factura = f.factura
WHERE UPPER(f.tipo_orden) = 'DELIVERY'
  AND pf.delivery > 0
ORDER BY f.fecha_hora DESC;


-- =============================================================
-- 2. CORRECCIÓN RETROACTIVA EN pagosf
--    Solo aplica a filas donde delivery aún NO está incluido
--    en el método de pago (datos previos a la corrección del
--    frontend).
--
--    Regla: detectar el método usando total_recibido.
--    Si efectivo + tarjeta + transf + dolares + delivery == total_recibido
--    → el delivery no está contabilizado en ninguna columna de pago.
--    → sumarlo al método que tenga valor > 0.
--
--    EJECUTAR SOLO UNA VEZ. El SELECT de diagnóstico de arriba
--    debe mostrar 0 filas con "dato viejo" después de esta corrección.
-- =============================================================

-- Efectivo: el método de pago fue efectivo
UPDATE public.pagosf
SET efectivo = efectivo + delivery
WHERE delivery > 0
  AND efectivo > 0
  AND tarjeta = 0
  AND transferencia = 0
  AND dolares = 0
  -- Solo rows viejos: el delivery todavía no está en efectivo
  AND ROUND(efectivo + delivery, 2) = ROUND(total_recibido, 2);

-- Tarjeta: el método de pago fue tarjeta
UPDATE public.pagosf
SET tarjeta = tarjeta + delivery
WHERE delivery > 0
  AND tarjeta > 0
  AND efectivo = 0
  AND transferencia = 0
  AND dolares = 0
  AND ROUND(tarjeta + delivery, 2) = ROUND(total_recibido, 2);

-- Transferencia: el método de pago fue transferencia
UPDATE public.pagosf
SET transferencia = transferencia + delivery
WHERE delivery > 0
  AND transferencia > 0
  AND efectivo = 0
  AND tarjeta = 0
  AND dolares = 0
  AND ROUND(transferencia + delivery, 2) = ROUND(total_recibido, 2);

-- Dólares: el método de pago fue dólares
UPDATE public.pagosf
SET dolares = dolares + delivery
WHERE delivery > 0
  AND dolares > 0
  AND efectivo = 0
  AND tarjeta = 0
  AND transferencia = 0
  AND ROUND(dolares + delivery, 2) = ROUND(total_recibido, 2);


-- =============================================================
-- 3. CORRECCIÓN RETROACTIVA EN facturas.total
--    Sumar el costo de delivery a facturas que tienen tipo_orden
--    = DELIVERY y cuyo total no incluye el delivery todavía.
--
--    Detectamos: total en facturas coincide con (total_recibido - delivery)
--    en pagosf → el delivery no fue sumado al total de la factura.
-- =============================================================
UPDATE public.facturas f
SET total = f.total + pf.delivery
FROM public.pagosf pf
WHERE pf.factura    = f.factura
  AND pf.delivery   > 0
  AND UPPER(f.tipo_orden) = 'DELIVERY'
  -- Solo rows viejos: total en facturas no incluye delivery
  AND ROUND(f.total::numeric, 2) = ROUND((pf.total_recibido - pf.delivery)::numeric, 2);


-- =============================================================
-- 4. VERIFICACIÓN FINAL
--    Después de correr las correcciones, esta consulta debe
--    devolver 0 filas con "delivery NO incluido".
-- =============================================================
SELECT
  f.factura    AS num_factura,
  f.fecha_hora,
  f.cajero,
  f.cliente,
  f.total      AS total_factura,
  pf.efectivo,
  pf.tarjeta,
  pf.transferencia,
  pf.delivery  AS costo_delivery,
  pf.total_recibido,
  CASE
    WHEN ROUND(
           COALESCE(pf.efectivo,0) + COALESCE(pf.tarjeta,0) +
           COALESCE(pf.transferencia,0) + COALESCE(pf.dolares,0)
           + COALESCE(pf.delivery, 0), 2
         ) = ROUND(pf.total_recibido, 2)
    THEN '⚠ delivery NO incluido en columna de pago'
    ELSE '✅ delivery ya incluido correctamente'
  END AS estado
FROM public.facturas f
JOIN public.pagosf pf ON pf.factura = f.factura
WHERE UPPER(f.tipo_orden) = 'DELIVERY'
  AND pf.delivery > 0
ORDER BY f.fecha_hora DESC;
