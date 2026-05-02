-- =============================================================
-- ARCHIVO MAESTRO DE ACTUALIZACIONES SQL (SUPABASE)
-- =============================================================
-- Nombre solicitado: "actualizacion sql"
-- Regla de trabajo: a partir de ahora, agregar aquí los SQL que se
-- ejecutarán en Supabase para actualizaciones del sistema.
--
-- Fecha: 2026-05-01
-- =============================================================

-- [ACT-2026-05-01-001]
-- Nuevos interruptores en configuraciones POS para pedidos por teléfono:
-- 1) pedidos_telefono_cobro_automatico
-- 2) cobrar_delivery_en_pedidos
ALTER TABLE public.configuraciones_pos
  ADD COLUMN IF NOT EXISTS pedidos_telefono_cobro_automatico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobrar_delivery_en_pedidos boolean NOT NULL DEFAULT true;

-- Asegurar fila singleton inicial
INSERT INTO public.configuraciones_pos (
  id,
  credito_habilitado,
  piezas_habilitado,
  complementos_habilitado,
  descuento_habilitado,
  menu_bloqueado,
  tipo_venta,
  pedidos_telefono_cobro_automatico,
  cobrar_delivery_en_pedidos
)
VALUES (1, true, true, true, true, false, 'ambos', false, true)
ON CONFLICT (id) DO UPDATE
SET
  pedidos_telefono_cobro_automatico = COALESCE(configuraciones_pos.pedidos_telefono_cobro_automatico, false),
  cobrar_delivery_en_pedidos = COALESCE(configuraciones_pos.cobrar_delivery_en_pedidos, true);

-- Verificación rápida
SELECT
  id,
  credito_habilitado,
  piezas_habilitado,
  complementos_habilitado,
  descuento_habilitado,
  menu_bloqueado,
  tipo_venta,
  pedidos_telefono_cobro_automatico,
  cobrar_delivery_en_pedidos,
  updated_at
FROM public.configuraciones_pos
ORDER BY id;
