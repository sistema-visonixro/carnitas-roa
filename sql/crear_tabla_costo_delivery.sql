-- ============================================================
-- Tabla: costo_delivery
-- Propósito: Registrar el ingreso por envío de cada delivery
-- PROCESADO. Se inserta cuando el cajero marca el pedido como
-- "entregado" en el Punto de Venta, ANTES de eliminar el pedido
-- de pedidos_envio.  Así el dato persiste aunque el pedido se borre.
-- ============================================================

-- Si ya existe con FK CASCADE (versión anterior), ejecutar primero:
--   ALTER TABLE public.costo_delivery
--     DROP CONSTRAINT IF EXISTS costo_delivery_pedido_id_fkey;
--   ALTER TABLE public.costo_delivery ADD COLUMN IF NOT EXISTS cliente text;
--   ALTER TABLE public.costo_delivery ADD COLUMN IF NOT EXISTS tipo_pago text;
-- O simplemente: DROP TABLE IF EXISTS public.costo_delivery;  (si está vacía)

CREATE TABLE IF NOT EXISTS public.costo_delivery (
  id          bigserial PRIMARY KEY,
  pedido_id   bigint,                       -- referencia informativa, SIN FK (el pedido se elimina)
  monto       numeric(12,2) NOT NULL DEFAULT 0,
  fecha       text NOT NULL,                -- "YYYY-MM-DD HH:MM:SS" (fecha del pedido)
  cliente     text,
  cajero_id   text,
  caja        text,
  tipo_pago   text,
  created_at  timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_costo_delivery_pedido  ON public.costo_delivery (pedido_id);
CREATE INDEX IF NOT EXISTS idx_costo_delivery_cajero  ON public.costo_delivery (cajero_id);
CREATE INDEX IF NOT EXISTS idx_costo_delivery_fecha   ON public.costo_delivery (fecha);
CREATE INDEX IF NOT EXISTS idx_costo_delivery_created ON public.costo_delivery (created_at);

-- ============================================================
-- FLUJO:
--   1. Cajero marca pedido como "Entregado" en Punto de Venta.
--   2. ANTES de delete en pedidos_envio, el frontend inserta
--      un registro aquí con monto = costo_envio del pedido.
--   3. El pedido se borra de pedidos_envio (cola operativa).
--   4. El módulo Ganancias Netas consulta ESTA tabla para los
--      ingresos de delivery históricos → los datos ya no se pierden.
-- ============================================================

-- Vista de resumen (opcional, útil en Supabase dashboard)
CREATE OR REPLACE VIEW public.v_delivery_ingreso_diario AS
SELECT
  DATE(cd.created_at) AS dia,
  COUNT(*)            AS total_pedidos,
  SUM(cd.monto)       AS ingreso_envio
FROM public.costo_delivery cd
GROUP BY DATE(cd.created_at)
ORDER BY dia DESC;
