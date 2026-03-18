-- ============================================================
-- PARCHE: Corregir políticas RLS de complementos_opciones
-- Problema: políticas basadas en auth.role()='authenticated'
--           fallan porque el sistema usa anon key, no Supabase Auth.
-- Solución: política pública igual que el resto de tablas del proyecto.
-- ============================================================

-- 1. Eliminar políticas incorrectas
DROP POLICY IF EXISTS "Lectura publica complementos"   ON complementos_opciones;
DROP POLICY IF EXISTS "Escritura autenticados complementos" ON complementos_opciones;

-- 2. Crear política de acceso público completo (anon key)
CREATE POLICY "acceso_publico_complementos"
  ON complementos_opciones FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
