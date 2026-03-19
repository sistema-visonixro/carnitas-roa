-- Agregar columnas cajero_id y caja a la tabla gastos si no existen
-- Ejecutar en Supabase: Dashboard → SQL Editor

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS cajero_id uuid;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS caja text;

-- Crear índices para consultas por cajero y caja
CREATE INDEX IF NOT EXISTS idx_gastos_cajero_id ON gastos(cajero_id);
CREATE INDEX IF NOT EXISTS idx_gastos_caja ON gastos(caja);

-- Nota: Si hay políticas RLS, asegúrate de actualizar las políticas
-- para permitir inserciones/actualizaciones por los roles apropiados.
