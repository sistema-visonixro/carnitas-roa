-- =============================================================
-- Vista: platillos del día (desde apertura activa del cajero)
-- Fuente: ventas.productos (JSON) filtrando solo tipo = comida
-- Horario de referencia: America/Tegucigalpa
-- =============================================================

DROP VIEW IF EXISTS public.v_platillos_periodos;

CREATE VIEW public.v_platillos_periodos AS
WITH parametros AS (
  SELECT
    timezone('America/Tegucigalpa', now())::date AS hoy_hn
),
apertura_activa AS (
  SELECT
    c.cajero_id,
    MAX(COALESCE(c.fecha_apertura, c.fecha)) AS fecha_apertura_activa
  FROM public.cierres c
  WHERE c.cajero_id IS NOT NULL
    AND (
      c.estado = 'APERTURA'
      OR c.tipo_registro = 'apertura'
    )
  GROUP BY c.cajero_id
),
items AS (
  SELECT
    v.cajero_id,
    COALESCE(v.tipo, '')                                AS tipo_venta,
    COALESCE(v.es_donacion, FALSE)                      AS es_donacion,
    v.fecha_hora                                         AS fecha_hora,
    v.fecha_hora::date                                   AS fecha_hn,
    COALESCE(NULLIF(trim(item ->> 'nombre'), ''), 'SIN NOMBRE') AS nombre_producto,
    COALESCE((item ->> 'cantidad')::numeric, 1)         AS cantidad,
    item ->> 'tipo'                                     AS item_tipo
  FROM public.ventas v
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN v.productos IS NOT NULL
       AND v.productos::text <> ''
       AND v.productos::text <> 'null'
      THEN v.productos::jsonb
      ELSE '[]'::jsonb
    END
  ) AS item
),
base AS (
  SELECT
    i.cajero_id,
    i.nombre_producto,
    i.cantidad,
    i.tipo_venta,
    i.es_donacion,
    i.fecha_hora,
    i.fecha_hn,
    p.hoy_hn,
    COALESCE(a.fecha_apertura_activa, '-infinity'::timestamp) AS fecha_apertura_activa
  FROM items i
  JOIN parametros p ON TRUE
  LEFT JOIN apertura_activa a ON a.cajero_id = i.cajero_id
  WHERE i.item_tipo = 'comida'
)
SELECT
  cajero_id,
  nombre_producto,

  -- Hoy
  SUM(CASE WHEN fecha_hora >= fecha_apertura_activa AND fecha_hn = hoy_hn AND tipo_venta NOT IN ('DEVOLUCION', 'CREDITO') AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END) AS vendidos_dia,
  SUM(CASE WHEN fecha_hora >= fecha_apertura_activa AND fecha_hn = hoy_hn AND tipo_venta = 'CREDITO' AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END) AS credito_dia,
  SUM(CASE WHEN fecha_hora >= fecha_apertura_activa AND fecha_hn = hoy_hn AND tipo_venta  = 'DEVOLUCION' THEN cantidad ELSE 0 END) AS devolucion_dia,
  SUM(CASE WHEN fecha_hora >= fecha_apertura_activa AND fecha_hn = hoy_hn AND tipo_venta NOT IN ('DEVOLUCION', 'CREDITO') AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END)
  +
  SUM(CASE WHEN fecha_hora >= fecha_apertura_activa AND fecha_hn = hoy_hn AND tipo_venta = 'CREDITO' AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END)
  -
  SUM(CASE WHEN fecha_hora >= fecha_apertura_activa AND fecha_hn = hoy_hn AND tipo_venta  = 'DEVOLUCION' THEN cantidad ELSE 0 END) AS total_dia

FROM base
GROUP BY cajero_id, nombre_producto;

GRANT SELECT ON public.v_platillos_periodos TO authenticated;
GRANT SELECT ON public.v_platillos_periodos TO anon;
GRANT SELECT ON public.v_platillos_periodos TO service_role;
