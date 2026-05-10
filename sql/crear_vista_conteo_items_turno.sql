-- =============================================================
-- Vista: conteo de platillos/bebidas por turno de caja
-- Respeta rango [fecha_apertura, fecha_cierre) de cada apertura
-- =============================================================

CREATE OR REPLACE VIEW public.v_conteo_items_turno AS
WITH turnos AS (
  SELECT
    c.id                                             AS apertura_id,
    c.cajero_id,
    c.caja,
    COALESCE(c.fecha_apertura, c.fecha)             AS fecha_apertura,
    COALESCE(
      CASE
        WHEN c.estado = 'CIERRE' OR c.tipo_registro = 'cierre'
          THEN COALESCE(c.fecha_cierre, c.fecha)
        ELSE NULL
      END,
      (
        SELECT MIN(COALESCE(c2.fecha_cierre, c2.fecha))
        FROM public.cierres c2
        WHERE c2.cajero_id = c.cajero_id
          AND c2.caja      = c.caja
          AND (c2.estado = 'CIERRE' OR c2.tipo_registro = 'cierre')
          AND COALESCE(c2.fecha_cierre, c2.fecha) > COALESCE(c.fecha_apertura, c.fecha)
      ),
      NOW()
    )                                               AS fecha_cierre
  FROM public.cierres c
  WHERE c.cajero_id IS NOT NULL
    AND COALESCE(c.fecha_apertura, c.fecha) IS NOT NULL
    AND (
      c.estado = 'APERTURA'
      OR c.tipo_registro = 'apertura'
      OR c.fecha_apertura IS NOT NULL
    )
),
items_expandidos AS (
  SELECT
    t.apertura_id,
    t.cajero_id,
    t.caja,
    t.fecha_apertura,
    t.fecha_cierre,
    v.es_donacion,
    v.tipo                                              AS venta_tipo,
    item ->> 'tipo'                                     AS item_tipo,
    COALESCE((item ->> 'cantidad')::numeric, 1)         AS cantidad
  FROM turnos t
  JOIN public.ventas v
    ON  v.cajero_id  = t.cajero_id
    AND v.fecha_hora >= t.fecha_apertura
    AND v.fecha_hora <  t.fecha_cierre
    AND v.tipo       != 'CREDITO'
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN v.productos IS NOT NULL
       AND v.productos::text != ''
       AND v.productos::text != 'null'
      THEN v.productos::jsonb
      ELSE '[]'::jsonb
    END
  ) AS item
),
conteos AS (
  SELECT
    apertura_id,
    cajero_id,
    caja,
    fecha_apertura,
    fecha_cierre,
    SUM(
      CASE WHEN item_tipo = 'comida' AND (es_donacion IS NOT TRUE)
        THEN CASE WHEN venta_tipo = 'DEVOLUCION' THEN -cantidad ELSE cantidad END
        ELSE 0
      END
    ) AS platillos_vendidos,
    SUM(
      CASE WHEN item_tipo = 'bebida' AND (es_donacion IS NOT TRUE)
        THEN CASE WHEN venta_tipo = 'DEVOLUCION' THEN -cantidad ELSE cantidad END
        ELSE 0
      END
    ) AS bebidas_vendidas,
    SUM(CASE WHEN item_tipo = 'comida' AND es_donacion = TRUE THEN cantidad ELSE 0 END) AS platillos_donados,
    SUM(CASE WHEN item_tipo = 'bebida' AND es_donacion = TRUE THEN cantidad ELSE 0 END) AS bebidas_donadas
  FROM items_expandidos
  GROUP BY apertura_id, cajero_id, caja, fecha_apertura, fecha_cierre
)
SELECT
  t.apertura_id,
  t.cajero_id,
  t.caja,
  t.fecha_apertura,
  t.fecha_cierre,
  COALESCE(c.platillos_vendidos, 0)                                   AS platillos_vendidos,
  COALESCE(c.bebidas_vendidas,   0)                                   AS bebidas_vendidas,
  COALESCE(c.platillos_donados,  0)                                   AS platillos_donados,
  COALESCE(c.bebidas_donadas,    0)                                   AS bebidas_donadas,
  COALESCE(c.platillos_vendidos, 0) + COALESCE(c.platillos_donados, 0) AS total_platillos,
  COALESCE(c.bebidas_vendidas,   0) + COALESCE(c.bebidas_donadas,   0) AS total_bebidas
FROM turnos t
LEFT JOIN conteos c
  ON c.apertura_id = t.apertura_id;

GRANT SELECT ON public.v_conteo_items_turno TO authenticated;
GRANT SELECT ON public.v_conteo_items_turno TO anon;
GRANT SELECT ON public.v_conteo_items_turno TO service_role;
