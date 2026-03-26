-- Agrega la columna es_donacion a la tabla facturas
-- Permite marcar facturas registradas como donación (platillo regalado)
-- Fecha: 2026-03-26

ALTER TABLE facturas
ADD COLUMN IF NOT EXISTS es_donacion BOOLEAN DEFAULT FALSE;

-- Índice para consultas eficientes de donaciones
CREATE INDEX IF NOT EXISTS idx_facturas_es_donacion
  ON facturas (es_donacion)
  WHERE es_donacion = TRUE;

-- Comentario en la columna
COMMENT ON COLUMN facturas.es_donacion IS 
  'Indica si la factura corresponde a un platillo/pedido donado (regalado). El total se registra como 0. Requiere autorización de un administrador.';
