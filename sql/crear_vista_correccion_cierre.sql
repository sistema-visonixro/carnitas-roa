-- =============================================================
-- Vista para corrección de cierres
-- Nombre solicitado: "correccio de cierre"
-- Implementación SQL válida: public.correccion_de_cierre
-- =============================================================

ALTER TABLE public.cierres
ADD COLUMN IF NOT EXISTS correccion boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.correccion_de_cierre AS
SELECT
  c.id                                                          AS cierre_id,
  c.cajero_id,
  c.cajero,
  c.caja,
  COALESCE(c.fecha_apertura, c.fecha)                          AS fecha_apertura,
  COALESCE(c.fecha_cierre,   c.fecha)                          AS fecha_cierre,

  -- Datos del sistema tomados directamente de v_resumen_turnos3
  -- (misma lógica que usa el cierre de caja, garantiza valores idénticos)
  ROUND(COALESCE(vrt.efectivo_neto,  0), 2)                    AS efectivo_dia,
  ROUND(COALESCE(vrt.tarjeta,        0), 2)                    AS tarjeta_dia,
  ROUND(COALESCE(vrt.transferencia,  0), 2)                    AS transferencias_dia,
  ROUND(COALESCE(vrt.dolares_usd,    0), 2)                    AS dolares_dia,
  ROUND(COALESCE(vrt.gastos,         0), 2)                    AS gastos_dia,
  ROUND(COALESCE(vrt.cambio_devuelto,0), 2)                    AS cambio_dia,
  ROUND(COALESCE(vrt.efectivo_bruto, 0), 2)                    AS efectivo_bruto_dia,
  0::numeric(12,2)                                             AS fondo_fijo_dia,

  -- Valores registrados en el cierre original
  ROUND(COALESCE(c.fondo_fijo_registrado,     0), 2)           AS fondo_fijo_registrado_actual,
  ROUND(COALESCE(c.efectivo_registrado,        0), 2)           AS efectivo_registrado_actual,
  ROUND(COALESCE(c.monto_tarjeta_registrado,   0), 2)           AS tarjeta_registrada_actual,
  ROUND(COALESCE(c.transferencias_registradas, 0), 2)           AS transferencias_registradas_actual,
  ROUND(COALESCE(c.dolares_registrado,         0), 2)           AS dolares_registrados_actual,
  COALESCE(c.observacion, '')                                  AS observacion_actual,

  -- Conteos de platillos/bebidas desde v_resumen_turnos3
  COALESCE(vrt.platillos_vendidos, 0)                          AS platillos_vendidos,
  COALESCE(vrt.bebidas_vendidas,   0)                          AS bebidas_vendidas,
  COALESCE(vrt.platillos_donados,  0)                          AS platillos_donados,
  COALESCE(vrt.bebidas_donadas,    0)                          AS bebidas_donadas,
  COALESCE(vrt.total_platillos,    0)                          AS total_platillos,
  COALESCE(vrt.total_bebidas,      0)                          AS total_bebidas,

  -- Diferencia registrada al momento del cierre
  ROUND(COALESCE(c.diferencia, 0), 2)                          AS diferencia_total_actual,
  ROUND(COALESCE(vrt.dolares_lps, 0), 2)                       AS dolares_lps_dia

FROM public.cierres c
-- Unir con v_resumen_turnos3 usando el mismo cierre_id
-- v_resumen_turnos3.apertura_id = cierres.id (registros con fecha_apertura)
LEFT JOIN public.v_resumen_turnos3 vrt
  ON vrt.apertura_id = c.id

WHERE (c.estado = 'CIERRE' OR c.tipo_registro = 'cierre')
  AND COALESCE(c.correccion, false) = true;

GRANT SELECT ON public.correccion_de_cierre TO authenticated;
GRANT SELECT ON public.correccion_de_cierre TO anon;
GRANT SELECT ON public.correccion_de_cierre TO service_role;
