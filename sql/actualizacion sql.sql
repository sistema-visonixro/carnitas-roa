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


-- =============================================================
-- [ACT-2026-05-01-002]
-- Módulo Estado de Resultados: tablas compras, planilla,
-- costos_operativos
-- =============================================================

-- COMPRAS (registro contable, sin afectar inventario)
CREATE TABLE IF NOT EXISTS public.compras (
  id          bigserial PRIMARY KEY,
  fecha       date        NOT NULL DEFAULT CURRENT_DATE,
  proveedor   text        NOT NULL DEFAULT '',
  descripcion text        NOT NULL DEFAULT '',
  monto       numeric(12,2) NOT NULL DEFAULT 0,
  metodo_pago text        NOT NULL DEFAULT 'efectivo',
  notas       text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_compras" ON public.compras;
CREATE POLICY "allow_all_compras" ON public.compras FOR ALL USING (true) WITH CHECK (true);

-- PLANILLA (pagos de nómina)
CREATE TABLE IF NOT EXISTS public.planilla (
  id          bigserial PRIMARY KEY,
  fecha_pago  date        NOT NULL DEFAULT CURRENT_DATE,
  empleado    text        NOT NULL DEFAULT '',
  cargo       text        NOT NULL DEFAULT '',
  periodo     text        NOT NULL DEFAULT 'QUINCENAL',   -- QUINCENAL | MENSUAL
  monto       numeric(12,2) NOT NULL DEFAULT 0,
  notas       text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planilla ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_planilla" ON public.planilla;
CREATE POLICY "allow_all_planilla" ON public.planilla FOR ALL USING (true) WITH CHECK (true);

-- COSTOS OPERATIVOS (gastos fijos recurrentes)
CREATE TABLE IF NOT EXISTS public.costos_operativos (
  id          bigserial PRIMARY KEY,
  fecha       date        NOT NULL DEFAULT CURRENT_DATE,
  descripcion text        NOT NULL DEFAULT '',
  categoria   text        NOT NULL DEFAULT 'OTRO',        -- ALQUILER | AGUA | LUZ | GAS | OTRO
  monto       numeric(12,2) NOT NULL DEFAULT 0,
  notas       text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.costos_operativos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_costos_operativos" ON public.costos_operativos;
CREATE POLICY "allow_all_costos_operativos" ON public.costos_operativos FOR ALL USING (true) WITH CHECK (true);

-- Verificación
SELECT 'compras' AS tabla, COUNT(*) FROM public.compras
UNION ALL
SELECT 'planilla', COUNT(*) FROM public.planilla
UNION ALL
SELECT 'costos_operativos', COUNT(*) FROM public.costos_operativos;


-- =============================================================
-- [ACT-2026-05-01-003]
-- FIX permisos/RLS para evitar 401 Unauthorized en tablas nuevas
-- =============================================================

-- Asegurar RLS habilitado
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_operativos ENABLE ROW LEVEL SECURITY;

-- Re-crear políticas (idempotente)
DROP POLICY IF EXISTS "allow_all_compras" ON public.compras;
CREATE POLICY "allow_all_compras"
ON public.compras
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_planilla" ON public.planilla;
CREATE POLICY "allow_all_planilla"
ON public.planilla
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_costos_operativos" ON public.costos_operativos;
CREATE POLICY "allow_all_costos_operativos"
ON public.costos_operativos
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Grants explícitos de tabla
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compras TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.planilla TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.costos_operativos TO anon, authenticated;

-- Grants para secuencias BIGSERIAL
GRANT USAGE, SELECT ON SEQUENCE public.compras_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.planilla_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.costos_operativos_id_seq TO anon, authenticated;

-- Verificación rápida de políticas/grants
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('compras', 'planilla', 'costos_operativos')
ORDER BY tablename, policyname;

-- ─────────────────────────────────────────────────────────────────────────────
-- [ACT-2026-05-02-001] Agregar complemento_id a recetas_detalle
--   Permite vincular un producto tipo "complemento" como ingrediente de receta.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Agregar columna complemento_id (referencia a productos)
ALTER TABLE public.recetas_detalle
  ADD COLUMN IF NOT EXISTS complemento_id uuid
  REFERENCES public.productos(id) ON DELETE RESTRICT;

-- 2. Hacer insumo_id nullable (antes era NOT NULL)
ALTER TABLE public.recetas_detalle
  ALTER COLUMN insumo_id DROP NOT NULL;

-- 3. Constraint: exactamente uno debe estar presente (insumo O complemento)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'recetas_detalle_item_check'
      AND table_name = 'recetas_detalle'
  ) THEN
    ALTER TABLE public.recetas_detalle
      ADD CONSTRAINT recetas_detalle_item_check CHECK (
        (insumo_id IS NOT NULL AND complemento_id IS NULL) OR
        (insumo_id IS NULL AND complemento_id IS NOT NULL)
      );
  END IF;
END $$;

-- 4. Índice para búsquedas por complemento_id
CREATE INDEX IF NOT EXISTS idx_recetas_detalle_complemento
  ON public.recetas_detalle(complemento_id);

-- Verificar
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'recetas_detalle'
ORDER BY ordinal_position;
