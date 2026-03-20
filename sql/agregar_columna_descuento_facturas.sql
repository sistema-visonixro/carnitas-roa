-- ============================================================
-- MIGRACIÓN: Agregar columna 'descuento' a la tabla facturas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN public.facturas.descuento IS
  'Descuento fijo aplicado en el POS (en Lempiras). NULL = sin descuento.';
