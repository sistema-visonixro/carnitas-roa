-- =============================================================
-- Trigger: rellena facturas_id en pagosf automáticamente
--
-- Problema: pagosf se inserta antes que facturas en el flujo de
-- venta, por lo que facturas_id queda NULL al momento del INSERT.
--
-- Solución (dos triggers):
--   1. trg_pagosf_set_facturas_id  → al insertar en pagosf,
--      busca facturas.id por número de factura y lo asigna.
--   2. trg_facturas_sync_pagosf    → al insertar en facturas,
--      actualiza pagosf que tenga el mismo número pero sin id.
--
-- Ambos casos se manejan solos, sin cambios en el frontend.
-- =============================================================


-- ─── 1. Función ejecutada al INSERT en pagosf ────────────────
CREATE OR REPLACE FUNCTION pagosf_auto_set_facturas_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actuar si facturas_id llegó NULL
  IF NEW.facturas_id IS NULL THEN
    SELECT id
      INTO NEW.facturas_id
      FROM public.facturas
     WHERE factura = NEW.factura
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar si ya existía y recrear
DROP TRIGGER IF EXISTS trg_pagosf_set_facturas_id ON public.pagosf;

CREATE TRIGGER trg_pagosf_set_facturas_id
  BEFORE INSERT OR UPDATE ON public.pagosf
  FOR EACH ROW
  EXECUTE FUNCTION pagosf_auto_set_facturas_id();


-- ─── 2. Función ejecutada al INSERT en facturas ──────────────
--    Rellena pagosf que ya existan con el mismo número de factura
--    pero con facturas_id todavía NULL (caso offline/sync tardía).
CREATE OR REPLACE FUNCTION facturas_sync_pagosf_id()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.pagosf
     SET facturas_id = NEW.id
   WHERE factura     = NEW.factura
     AND facturas_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar si ya existía y recrear
DROP TRIGGER IF EXISTS trg_facturas_sync_pagosf ON public.facturas;

CREATE TRIGGER trg_facturas_sync_pagosf
  AFTER INSERT ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION facturas_sync_pagosf_id();


-- =============================================================
-- Corrección retroactiva: rellena los registros existentes en
-- pagosf que tienen facturas_id = NULL pero sí existe la factura
-- =============================================================
UPDATE public.pagosf pf
   SET facturas_id = f.id
  FROM public.facturas f
 WHERE f.factura       = pf.factura
   AND pf.facturas_id  IS NULL;

-- Verificación: no debería quedar ningún registro sin facturas_id
-- cuando la factura correspondiente existe en la tabla facturas.
SELECT
  pf.id,
  pf.factura,
  pf.facturas_id,
  f.id AS facturas_real_id
FROM public.pagosf pf
LEFT JOIN public.facturas f ON f.factura = pf.factura
WHERE pf.facturas_id IS NULL
ORDER BY pf.fecha_hora DESC
LIMIT 20;
