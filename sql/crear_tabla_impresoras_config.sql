-- =============================================================
-- TABLA: impresoras_config
-- Guarda la configuración de impresoras USB por cajero/global.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.impresoras_config (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cajero_id       UUID        REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo            TEXT        NOT NULL CHECK (tipo IN ('recibo', 'comanda')),
  nombre          TEXT        NOT NULL DEFAULT '',
  vendor_id       INTEGER     NOT NULL,
  product_id      INTEGER     NOT NULL,
  modo_impresion  TEXT        NOT NULL DEFAULT 'navegador'
                                CHECK (modo_impresion IN ('navegador', 'silenciosa')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Una fila por (cajero, tipo)
  CONSTRAINT uq_impresoras_cajero_tipo UNIQUE (cajero_id, tipo)
);

-- Índice para búsquedas rápidas por cajero
CREATE INDEX IF NOT EXISTS idx_impresoras_cajero ON public.impresoras_config (cajero_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at_impresoras()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impresoras_updated_at ON public.impresoras_config;
CREATE TRIGGER trg_impresoras_updated_at
  BEFORE UPDATE ON public.impresoras_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_impresoras();

-- RLS: cada cajero solo ve/modifica su propia configuración
ALTER TABLE public.impresoras_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cajero_propio" ON public.impresoras_config
  USING (cajero_id = auth.uid())
  WITH CHECK (cajero_id = auth.uid());

-- Los administradores pueden ver todas las configuraciones
CREATE POLICY "admin_ver_todo" ON public.impresoras_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'admin'
    )
  );

-- =============================================================
-- Verificar resultado
-- =============================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'impresoras_config'
ORDER BY ordinal_position;
