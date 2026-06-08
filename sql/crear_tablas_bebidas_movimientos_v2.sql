-- Crear tablas de movimientos para inventario de bebidas (v2)
-- Producto_id se guarda como TEXT para evitar incompatibilidades bigint vs uuid

CREATE TABLE IF NOT EXISTS bebidas_entradas_v2 (
  id BIGSERIAL PRIMARY KEY,
  producto_id TEXT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad >= 0),
  nota TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_bebidas_entradas_v2_producto_id ON bebidas_entradas_v2(producto_id);

CREATE TABLE IF NOT EXISTS bebidas_salidas_defecto_v2 (
  id BIGSERIAL PRIMARY KEY,
  producto_id TEXT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad >= 0),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_bebidas_salidas_defecto_v2_producto_id ON bebidas_salidas_defecto_v2(producto_id);

-- Estas tablas son independientes; puedes migrar datos desde las tablas anteriores
-- (si existen) a estas nuevas tablas, por ejemplo:
-- INSERT INTO bebidas_entradas_v2(producto_id, cantidad, nota, created_at, created_by)
--   SELECT producto_id::text, cantidad, nota, created_at, created_by FROM bebidas_entradas;
