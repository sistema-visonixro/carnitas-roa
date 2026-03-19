-- Establecer valor por defecto para fecha_hora en gastos
-- Ejecutar en Supabase: Dashboard → SQL Editor

-- Poner DEFAULT NOW() para que inserts sin fecha_hora no fallen
ALTER TABLE public.gastos
ALTER COLUMN fecha_hora SET DEFAULT now();

-- Verificar el cambio (opcional)
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'gastos' AND column_name = 'fecha_hora';
