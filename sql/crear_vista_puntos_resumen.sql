-- Vista que muestra el último nombre conocido y el total de puntos
-- La vista toma el último nombre registrado en `puntos_clientes`
-- y la suma acumulada de `puntos` desde `puntos_historial`.
CREATE OR REPLACE VIEW v_puntos_clientes_resumen AS
SELECT
  pc.identidad,
  (
    SELECT nombre
    FROM puntos_clientes pc2
    WHERE pc2.identidad = pc.identidad
    ORDER BY COALESCE(pc2.updated_at, now()) DESC
    LIMIT 1
  ) AS nombre,
  COALESCE(SUM(ph.puntos), 0) AS puntos
FROM (
  SELECT DISTINCT identidad FROM puntos_clientes
) pc
LEFT JOIN puntos_historial ph ON ph.identidad = pc.identidad
GROUP BY pc.identidad;

-- Recomendaciones para asegurar unicidad de identidad en `puntos_clientes`:
-- 1) Identificar duplicados:
--    SELECT identidad, count(*) FROM puntos_clientes GROUP BY identidad HAVING count(*)>1;
-- 2) Conservar el registro más reciente por identidad y eliminar los demás
--    (hacer backup antes):
--    BEGIN;
--    CREATE TABLE puntos_clientes_backup AS TABLE puntos_clientes;
--    CREATE TEMP TABLE tmp_keep AS
--      SELECT DISTINCT ON (identidad) * FROM puntos_clientes ORDER BY identidad, COALESCE(created_at, now()) DESC;
--    TRUNCATE puntos_clientes;
--    INSERT INTO puntos_clientes SELECT * FROM tmp_keep;
--    COMMIT;
-- 3) Crear índice único:
--    CREATE UNIQUE INDEX idx_puntos_clientes_identidad ON puntos_clientes (identidad);

-- Nota: la vista `v_puntos_clientes_resumen` debe usarse para consultas
-- de puntos en la app y en el modal `Puntos Cliente`.
