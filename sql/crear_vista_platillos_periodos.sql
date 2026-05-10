-- =============================================================
-- Vista: platillos del turno (desde apertura de caja)
-- Fuente: ventas.productos (JSON) filtrando solo tipo = comida
-- Rango: fecha_apertura del turno -> fecha_cierre del turno (o NOW si sigue abierto)
-- =============================================================

DROP VIEW IF EXISTS public.v_platillos_periodos;

CREATE VIEW public.v_platillos_periodos AS
WITH ultimo_turno AS (
  SELECT DISTINCT ON (c.cajero_id)
    c.cajero_id,
    COALESCE(c.fecha_apertura, c.fecha) AS fecha_apertura_turno,
    COALESCE(
      CASE
        WHEN c.estado = 'CIERRE' OR c.tipo_registro = 'cierre'
          THEN COALESCE(c.fecha_cierre, c.fecha)
        ELSE NULL
      END,
      c.fecha_cierre,
      NOW()
    ) AS fecha_cierre_turno
  FROM public.cierres c
  WHERE c.cajero_id IS NOT NULL
    AND (
      c.estado IN ('APERTURA', 'CIERRE')
      OR c.tipo_registro IN ('apertura', 'cierre')
      OR c.fecha_apertura IS NOT NULL
    )
  ORDER BY c.cajero_id, COALESCE(c.fecha_apertura, c.fecha) DESC, c.id DESC
),
items AS (
  SELECT
    v.cajero_id,
    COALESCE(v.tipo, '')                                AS tipo_venta,
    COALESCE(v.es_donacion, FALSE)                      AS es_donacion,
    v.fecha_hora                                         AS fecha_hora,
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
    t.fecha_apertura_turno,
    t.fecha_cierre_turno
  FROM items i
  JOIN ultimo_turno t ON t.cajero_id = i.cajero_id
  WHERE i.item_tipo = 'comida'
    AND i.fecha_hora >= t.fecha_apertura_turno
    AND i.fecha_hora <  t.fecha_cierre_turno
)
SELECT
  cajero_id,
  nombre_producto,

  -- Turno (apertura -> cierre/now)
  SUM(CASE WHEN tipo_venta NOT IN ('DEVOLUCION', 'CREDITO') AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END) AS vendidos_dia,
  SUM(CASE WHEN tipo_venta = 'CREDITO' AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END) AS credito_dia,
  SUM(CASE WHEN tipo_venta = 'DEVOLUCION' THEN cantidad ELSE 0 END) AS devolucion_dia,
  SUM(CASE WHEN tipo_venta NOT IN ('DEVOLUCION', 'CREDITO') AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END)
  +
  SUM(CASE WHEN tipo_venta = 'CREDITO' AND es_donacion IS NOT TRUE THEN cantidad ELSE 0 END)
  -
  SUM(CASE WHEN tipo_venta = 'DEVOLUCION' THEN cantidad ELSE 0 END) AS total_dia

FROM base
GROUP BY cajero_id, nombre_producto;

GRANT SELECT ON public.v_platillos_periodos TO authenticated;
GRANT SELECT ON public.v_platillos_periodos TO anon;
GRANT SELECT ON public.v_platillos_periodos TO service_role;
