-- =============================================================
--  RPC: obtener_siguiente_factura(p_cajero_id TEXT)
--
--  Obtiene y avanza el contador factura_actual de cai_facturas
--  de forma ATÓMICA usando SELECT ... FOR UPDATE.
--
--  IMPORTANTE: verifica que el número asignado NO exista ya en
--  la tabla `ventas` para ese mismo cajero (la constraint
--  uq_ventas_factura_cajero es UNIQUE por (factura, cajero_id),
--  cada CAI del SAR tiene su propio rango independiente).
--
--  RETORNA:
--    - El número a usar en esta venta (string)
--    - 'LIMITE_ALCANZADO' si se agota el rango
--    - NULL si no existe CAI asignado para este cajero
-- =============================================================

CREATE OR REPLACE FUNCTION public.obtener_siguiente_factura(p_cajero_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_factura_actual TEXT;
    v_rango_desde    INTEGER;
    v_rango_hasta    INTEGER;
    v_num            INTEGER;
    v_existe         BOOLEAN;
BEGIN
    -- Bloquear la fila exacta de este cajero para evitar condición de carrera.
    SELECT factura_actual, rango_desde, rango_hasta
    INTO   v_factura_actual, v_rango_desde, v_rango_hasta
    FROM   public.cai_facturas
    WHERE  cajero_id = p_cajero_id::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Determinar número inicial
    IF v_factura_actual IS NULL OR TRIM(v_factura_actual) = '' THEN
        v_num := v_rango_desde;
    ELSE
        BEGIN
            v_num := v_factura_actual::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            v_num := v_rango_desde;
        END;
    END IF;

    -- Avanzar hasta encontrar un número que NO exista todavía en ventas
    -- para este cajero (resincroniza si el contador quedó atrasado).
    -- La constraint uq_ventas_factura_cajero es UNIQUE(factura, cajero_id).
    LOOP
        IF v_num > v_rango_hasta THEN
            RETURN 'LIMITE_ALCANZADO';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.ventas
            WHERE  factura   = v_num::TEXT
            AND    cajero_id = p_cajero_id::UUID
        ) INTO v_existe;

        EXIT WHEN NOT v_existe;   -- número libre → usar este

        v_num := v_num + 1;       -- ya existe → probar el siguiente
    END LOOP;

    -- Guardar el SIGUIENTE a usar (v_num + 1) en el contador
    UPDATE public.cai_facturas
    SET    factura_actual = (v_num + 1)::TEXT
    WHERE  cajero_id = p_cajero_id::UUID;

    RETURN v_num::TEXT;
END;
$$;

-- ─── Permisos ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.obtener_siguiente_factura(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_siguiente_factura(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.obtener_siguiente_factura(TEXT) TO public;

-- ─── Función auxiliar: solo lectura (para display en UI, sin incrementar) ─────
CREATE OR REPLACE FUNCTION public.ver_factura_actual(p_cajero_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_factura_actual TEXT;
    v_rango_desde    INTEGER;
    v_rango_hasta    INTEGER;
    v_num            INTEGER;
    v_existe         BOOLEAN;
BEGIN
    SELECT factura_actual, rango_desde, rango_hasta
    INTO   v_factura_actual, v_rango_desde, v_rango_hasta
    FROM   public.cai_facturas
    WHERE  cajero_id = p_cajero_id::UUID;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF v_factura_actual IS NULL OR TRIM(v_factura_actual) = '' THEN
        v_num := v_rango_desde;
    ELSE
        BEGIN
            v_num := v_factura_actual::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            v_num := v_rango_desde;
        END;
    END IF;

    -- Avanzar hasta encontrar el próximo número libre para este cajero.
    -- La constraint uq_ventas_factura_cajero es UNIQUE(factura, cajero_id).
    LOOP
        IF v_num > v_rango_hasta THEN
            RETURN 'LIMITE_ALCANZADO';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.ventas
            WHERE  factura   = v_num::TEXT
            AND    cajero_id = p_cajero_id::UUID
        ) INTO v_existe;

        EXIT WHEN NOT v_existe;

        v_num := v_num + 1;
    END LOOP;

    RETURN v_num::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ver_factura_actual(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ver_factura_actual(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ver_factura_actual(TEXT) TO public;

