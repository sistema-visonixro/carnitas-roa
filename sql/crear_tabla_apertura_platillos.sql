-- ======================================================================
--  Tabla: apertura_platillos
--  Propósito: Registrar cuántos platillos (inventario físico) hay en caja
--             al momento de aperturar el turno. Se relaciona con la tabla
--             cierres (registro de apertura).
--
--  Uso: Al aperturar caja el cajero ingresa la cantidad de cada platillo
--       que tiene disponible. Sirve como inventario inicial del turno.
-- ======================================================================

CREATE TABLE IF NOT EXISTS apertura_platillos (
  id            BIGSERIAL PRIMARY KEY,
  apertura_id   BIGINT         NOT NULL,  -- FK al id del registro en cierres (estado=APERTURA)
  cajero_id     UUID           NOT NULL,
  caja          TEXT           NOT NULL,
  nombre_producto TEXT         NOT NULL,
  cantidad      INTEGER        NOT NULL DEFAULT 0,
  fecha_registro TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_apertura_platillos_cierre
    FOREIGN KEY (apertura_id) REFERENCES cierres(id) ON DELETE CASCADE
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_apertura_platillos_apertura_id
  ON apertura_platillos (apertura_id);

CREATE INDEX IF NOT EXISTS idx_apertura_platillos_cajero_id
  ON apertura_platillos (cajero_id);

-- RLS: solo el cajero dueño puede ver/insertar sus registros
ALTER TABLE apertura_platillos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cajero_own_apertura_platillos"
  ON apertura_platillos
  FOR ALL
  USING (cajero_id = auth.uid()::uuid)
  WITH CHECK (cajero_id = auth.uid()::uuid);

-- Permitir que admins vean todo (opcional, ajusta según tus roles)
CREATE POLICY "admin_all_apertura_platillos"
  ON apertura_platillos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()::uuid
        AND rol = 'Admin'
    )
  );
