-- =============================================================
--  MIGRACIÓN: facturas + pagosf  →  ventas
--  Copia todos los registros históricos de facturas (con sus
--  pagos correspondientes de pagosf) a la nueva tabla ventas.
--  Los datos en facturas y pagosf NO se eliminan; se conservan
--  como respaldo hasta confirmar que todo funciona correctamente.
-- =============================================================

-- ─── Insertar en ventas desde facturas LEFT JOIN pagosf ───────────────────────
INSERT INTO public.ventas (
    fecha_hora,
    cajero,
    cajero_id,
    caja,
    cai,
    factura,
    tipo,
    cliente,
    tipo_orden,
    productos,
    sub_total,
    isv_15,
    isv_18,
    descuento,
    total,
    es_donacion,
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
    operation_id,
    created_at
)
SELECT
    f.fecha_hora,
    f.cajero,
    f.cajero_id,
    f.caja,
    f.cai,
    f.factura,
    -- Determinar tipo según contexto
    CASE
        WHEN f.factura LIKE 'DEV-%'          THEN 'DEVOLUCION'
        WHEN f.tipo_venta = 'credito'         THEN 'CREDITO'
        ELSE                                       'CONTADO'
    END                                                             AS tipo,
    f.cliente,
    COALESCE(f.tipo_orden, 'PARA LLEVAR')                          AS tipo_orden,
    f.productos,
    -- Montos: convertir de text a numeric con fallback a 0
    COALESCE(NULLIF(TRIM(f.sub_total::TEXT), '')::NUMERIC, 0)      AS sub_total,
    COALESCE(NULLIF(TRIM(f.isv_15::TEXT),   ''), '0')::NUMERIC     AS isv_15,
    COALESCE(NULLIF(TRIM(f.isv_18::TEXT),   ''), '0')::NUMERIC     AS isv_18,
    COALESCE(f.descuento, 0)                                        AS descuento,
    COALESCE(NULLIF(TRIM(f.total::TEXT),    ''), '0')::NUMERIC     AS total,
    COALESCE(f.es_donacion, FALSE)                                  AS es_donacion,
    -- Datos de pago desde pagosf (0 si no existe registro de pago)
    COALESCE(p.efectivo,       0)  AS efectivo,
    COALESCE(p.tarjeta,        0)  AS tarjeta,
    COALESCE(p.transferencia,  0)  AS transferencia,
    COALESCE(p.dolares,        0)  AS dolares,
    COALESCE(p.dolares_usd,    0)  AS dolares_usd,
    COALESCE(p.delivery,       0)  AS delivery,
    COALESCE(p.total_recibido, NULLIF(TRIM(f.total::TEXT), '')::NUMERIC, 0) AS total_recibido,
    COALESCE(p.cambio,         0)  AS cambio,
    p.banco                        AS banco,
    p.tarjeta_num                  AS tarjeta_num,
    p.autorizacion                 AS autorizacion,
    p.ref_transferencia            AS ref_transferencia,
    f.operation_id,
    COALESCE(f.fecha_hora, NOW())  AS created_at
FROM public.facturas f
LEFT JOIN public.pagosf p ON p.factura = f.factura
ON CONFLICT (factura) DO NOTHING;   -- Idempotente: re-ejecución segura

-- ─── Verificar resultado ─────────────────────────────────────────────────────
SELECT
    COUNT(*)                                  AS total_ventas_migradas,
    COUNT(*) FILTER (WHERE tipo = 'CONTADO')  AS contado,
    COUNT(*) FILTER (WHERE tipo = 'CREDITO')  AS credito,
    COUNT(*) FILTER (WHERE tipo = 'DEVOLUCION') AS devoluciones,
    MIN(fecha_hora)                           AS primera_venta,
    MAX(fecha_hora)                           AS ultima_venta
FROM public.ventas;

-- ─── Comparar totales originales ─────────────────────────────────────────────
SELECT
    'facturas originales' AS fuente,
    COUNT(*)              AS filas
FROM public.facturas
UNION ALL
SELECT
    'ventas migradas',
    COUNT(*)
FROM public.ventas;
