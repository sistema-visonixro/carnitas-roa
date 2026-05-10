-- Agrega columna de control para corrección administrativa de cierres
ALTER TABLE public.cierres
ADD COLUMN IF NOT EXISTS correccion boolean NOT NULL DEFAULT false;

-- Normaliza datos históricos (por seguridad)
UPDATE public.cierres
SET correccion = false
WHERE correccion IS DISTINCT FROM false;
