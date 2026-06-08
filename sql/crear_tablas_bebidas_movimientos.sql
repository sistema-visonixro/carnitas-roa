-- Crea tablas para registrar movimientos de inventario de bebidas
-- 1) bebidas_entradas: para registros manuales de ingreso
-- 2) bebidas_salidas_defecto: para salidas por ajustes/merma/consumo interno

CREATE TABLE IF NOT EXISTS bebidas_entradas (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad >= 0),
  nota TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_bebidas_entradas_producto_id ON bebidas_entradas(producto_id);

CREATE TABLE IF NOT EXISTS bebidas_salidas_defecto (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad >= 0),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_bebidas_salidas_defecto_producto_id ON bebidas_salidas_defecto(producto_id);

-- Nota: `producto_id` debe corresponder a `productos.id` (FK opcional):
-- ALTER TABLE bebidas_entradas ADD CONSTRAINT fk_bebidas_entradas_productos FOREIGN KEY (producto_id) REFERENCES productos(id);
-- ALTER TABLE bebidas_salidas_defecto ADD CONSTRAINT fk_bebidas_salidas_defecto_productos FOREIGN KEY (producto_id) REFERENCES productos(id);
