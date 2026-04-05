-- =============================================================
--  MIGRACIÓN: Corregir constraint de factura en tabla ventas
--
--  El SAR asigna rangos de facturas POR CAJERO (cada cajero tiene
--  su propio CAI con su propio rango independiente).
--  La constraint debe ser UNIQUE(factura, cajero_id), NO solo UNIQUE(factura).
--
--  EJECUTAR EN SUPABASE SQL EDITOR
-- =============================================================

-- 1. Eliminar la constraint global incorrecta (si existe)
ALTER TABLE public.ventas
  DROP CONSTRAINT IF EXISTS ventas_factura_key;

-- 2. Crear constraint correcta: única por (factura, cajero_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_ventas_factura_cajero'
  ) THEN
    ALTER TABLE public.ventas
      ADD CONSTRAINT uq_ventas_factura_cajero UNIQUE (factura, cajero_id);
  END IF;
END$$;

-- 3. Índice de apoyo para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ventas_factura_cajero
  ON public.ventas (factura, cajero_id);

-- Verificar resultado
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.ventas'::regclass
  AND conname IN ('ventas_factura_key', 'uq_ventas_factura_cajero');
