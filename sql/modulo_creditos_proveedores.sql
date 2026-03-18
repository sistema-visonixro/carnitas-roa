-- ====================================================================
-- MÓDULO DE VENTAS A CRÉDITO, CUENTAS POR COBRAR,
-- PROVEEDORES Y CUENTAS POR PAGAR
-- Sistema POS Carnitas Roa
-- Versión: 1.0.0
-- Fecha: 2026-03-18
-- ====================================================================
-- INSTRUCCIONES:
--   1. Ejecutar en Supabase SQL Editor en el orden que aparece.
--   2. Todas las tablas usan RLS con política pública (sin autenticación).
--   3. No se rompe ninguna tabla existente; solo se AGREGAN nuevas.
-- ====================================================================


-- ============================================================
-- SECCIÓN 1: CLIENTES DE CRÉDITO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clientes_credito (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT          NOT NULL,
    dni         TEXT          NOT NULL,
    telefono    TEXT,
    direccion   TEXT,
    email       TEXT,
    limite_credito NUMERIC(12,2) DEFAULT 0,
    activo      BOOLEAN       DEFAULT TRUE,
    observaciones TEXT,
    creado_por  TEXT,
    creado_en   TIMESTAMPTZ   DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT clientes_credito_dni_unique UNIQUE (dni)
);

COMMENT ON TABLE  public.clientes_credito                  IS 'Clientes autorizados para compras a crédito';
COMMENT ON COLUMN public.clientes_credito.dni              IS 'DNI en formato 1809-1966-00326';
COMMENT ON COLUMN public.clientes_credito.limite_credito   IS 'Límite de crédito en Lempiras (0 = sin límite)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_clientes_credito_dni
    ON public.clientes_credito(dni);
CREATE INDEX IF NOT EXISTS idx_clientes_credito_nombre
    ON public.clientes_credito(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_credito_activo
    ON public.clientes_credito(activo);

-- RLS (sin restricción - acceso público)
ALTER TABLE public.clientes_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_credito_select_public"
    ON public.clientes_credito FOR SELECT TO public USING (true);
CREATE POLICY "clientes_credito_insert_public"
    ON public.clientes_credito FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "clientes_credito_update_public"
    ON public.clientes_credito FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "clientes_credito_delete_public"
    ON public.clientes_credito FOR DELETE TO public USING (true);


-- ============================================================
-- SECCIÓN 2: CUENTAS POR COBRAR
-- Una fila por cliente; lleva el saldo acumulado en tiempo real.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cuentas_por_cobrar (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id      UUID          NOT NULL REFERENCES public.clientes_credito(id) ON DELETE RESTRICT,
    saldo_actual    NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_facturado NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_pagado    NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado          TEXT          NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo','cancelado')),
    ultima_compra   TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ   DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT cuentas_por_cobrar_cliente_unique UNIQUE (cliente_id)
);

COMMENT ON TABLE  public.cuentas_por_cobrar              IS 'Saldo consolidado de crédito por cliente';
COMMENT ON COLUMN public.cuentas_por_cobrar.saldo_actual IS 'total_facturado - total_pagado';

-- Índices
CREATE INDEX IF NOT EXISTS idx_cxc_cliente_id
    ON public.cuentas_por_cobrar(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cxc_estado
    ON public.cuentas_por_cobrar(estado);

-- RLS
ALTER TABLE public.cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cxc_select_public" ON public.cuentas_por_cobrar FOR SELECT TO public USING (true);
CREATE POLICY "cxc_insert_public" ON public.cuentas_por_cobrar FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "cxc_update_public" ON public.cuentas_por_cobrar FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "cxc_delete_public" ON public.cuentas_por_cobrar FOR DELETE TO public USING (true);


-- ============================================================
-- SECCIÓN 3: FACTURAS DE CRÉDITO
-- Referencia la factura SAR original + datos de la cuenta.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facturas_credito (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_numero      TEXT          NOT NULL,          -- Número SAR del sistema
    cliente_id          UUID          NOT NULL REFERENCES public.clientes_credito(id) ON DELETE RESTRICT,
    cuenta_cobrar_id    UUID          NOT NULL REFERENCES public.cuentas_por_cobrar(id) ON DELETE RESTRICT,
    cajero_id           TEXT,
    cajero              TEXT,
    caja                TEXT,
    cai                 TEXT,
    productos           JSONB         NOT NULL,
    sub_total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    isv_15              NUMERIC(12,2)          DEFAULT 0,
    isv_18              NUMERIC(12,2)          DEFAULT 0,
    total               NUMERIC(12,2) NOT NULL,
    saldo_anterior      NUMERIC(12,2)          DEFAULT 0,  -- Saldo del cliente ANTES de esta factura
    nuevo_saldo         NUMERIC(12,2) NOT NULL,             -- Saldo DESPUÉS de esta factura
    estado              TEXT          NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','parcial','pagado','vencido')),
    fecha_vencimiento   TIMESTAMPTZ,
    fecha_hora          TIMESTAMPTZ   DEFAULT NOW(),
    observaciones       TEXT,
    tipo_orden          TEXT,                               -- PARA LLEVAR, COMER AQUÍ, etc.
    creado_en           TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE  public.facturas_credito                      IS 'Facturas emitidas a crédito (ventas a crédito)';
COMMENT ON COLUMN public.facturas_credito.saldo_anterior       IS 'Saldo del cliente antes de esta factura';
COMMENT ON COLUMN public.facturas_credito.nuevo_saldo          IS 'Saldo del cliente después de esta factura';
COMMENT ON COLUMN public.facturas_credito.factura_numero       IS 'Número SAR correlativo del sistema';

-- Índices
CREATE INDEX IF NOT EXISTS idx_fc_cliente_id
    ON public.facturas_credito(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fc_cuenta_cobrar_id
    ON public.facturas_credito(cuenta_cobrar_id);
CREATE INDEX IF NOT EXISTS idx_fc_estado
    ON public.facturas_credito(estado);
CREATE INDEX IF NOT EXISTS idx_fc_fecha_hora
    ON public.facturas_credito(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_fc_factura_numero
    ON public.facturas_credito(factura_numero);

-- RLS
ALTER TABLE public.facturas_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fc_select_public" ON public.facturas_credito FOR SELECT TO public USING (true);
CREATE POLICY "fc_insert_public" ON public.facturas_credito FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "fc_update_public" ON public.facturas_credito FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "fc_delete_public" ON public.facturas_credito FOR DELETE TO public USING (true);


-- ============================================================
-- SECCIÓN 4: PAGOS DE CRÉDITO (ABONOS DE CLIENTES)
-- Se registra AQUÍ el ingreso real a caja (no al facturar).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pagos_credito (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id          UUID          NOT NULL REFERENCES public.clientes_credito(id) ON DELETE RESTRICT,
    cuenta_cobrar_id    UUID          NOT NULL REFERENCES public.cuentas_por_cobrar(id) ON DELETE RESTRICT,
    factura_credito_id  UUID          REFERENCES public.facturas_credito(id) ON DELETE SET NULL,
    monto               NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    tipo_pago           TEXT          NOT NULL
                            CHECK (tipo_pago IN ('efectivo','tarjeta','transferencia','dolares')),
    referencia          TEXT,
    banco               TEXT,
    usd_monto           NUMERIC(12,2),
    cajero_id           TEXT,
    cajero              TEXT,
    caja                TEXT,
    observacion         TEXT,
    saldo_antes         NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_despues       NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_hora          TIMESTAMPTZ   DEFAULT NOW(),
    creado_en           TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE  public.pagos_credito                   IS 'Abonos y pagos recibidos de clientes de crédito';
COMMENT ON COLUMN public.pagos_credito.monto             IS 'Monto abonado en Lempiras';
COMMENT ON COLUMN public.pagos_credito.factura_credito_id IS 'Si el pago es para una factura específica; NULL = abono general';

-- Índices
CREATE INDEX IF NOT EXISTS idx_pc_cliente_id
    ON public.pagos_credito(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pc_cuenta_cobrar_id
    ON public.pagos_credito(cuenta_cobrar_id);
CREATE INDEX IF NOT EXISTS idx_pc_factura_credito_id
    ON public.pagos_credito(factura_credito_id);
CREATE INDEX IF NOT EXISTS idx_pc_fecha_hora
    ON public.pagos_credito(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_pc_cajero_id
    ON public.pagos_credito(cajero_id);

-- RLS
ALTER TABLE public.pagos_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_credito_select_public" ON public.pagos_credito FOR SELECT TO public USING (true);
CREATE POLICY "pagos_credito_insert_public" ON public.pagos_credito FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "pagos_credito_update_public" ON public.pagos_credito FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "pagos_credito_delete_public" ON public.pagos_credito FOR DELETE TO public USING (true);


-- ============================================================
-- SECCIÓN 5: COLUMNA TIPO_VENTA EN TABLA FACTURAS EXISTENTE
-- Permite distinguir contado vs crédito sin romper el código actual.
-- ============================================================

ALTER TABLE public.facturas
    ADD COLUMN IF NOT EXISTS tipo_venta TEXT DEFAULT 'contado'
        CHECK (tipo_venta IN ('contado','credito'));

ALTER TABLE public.facturas
    ADD COLUMN IF NOT EXISTS cliente_credito_id UUID REFERENCES public.clientes_credito(id);

COMMENT ON COLUMN public.facturas.tipo_venta          IS 'contado = venta normal; credito = venta a crédito';
COMMENT ON COLUMN public.facturas.cliente_credito_id   IS 'FK al cliente de crédito; NULL si es venta de contado';

CREATE INDEX IF NOT EXISTS idx_facturas_tipo_venta
    ON public.facturas(tipo_venta);

-- ============================================================
-- SECCIÓN 6: FUNCIÓN TRANSACCIONAL - CONFIRMAR VENTA A CRÉDITO
-- Ejecuta de forma atómica:
--   1. Inserta en facturas (tipo_venta='credito')
--   2. Inserta en facturas_credito
--   3. Actualiza (o crea) cuentas_por_cobrar
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirmar_venta_credito(
    p_factura_numero      TEXT,
    p_cliente_id          UUID,
    p_cajero_id           TEXT,
    p_cajero              TEXT,
    p_caja                TEXT,
    p_cai                 TEXT,
    p_productos           JSONB,
    p_sub_total           NUMERIC,
    p_isv_15              NUMERIC,
    p_isv_18              NUMERIC,
    p_total               NUMERIC,
    p_fecha_hora          TEXT,
    p_tipo_orden          TEXT DEFAULT 'PARA LLEVAR',
    p_dias_vencimiento    INT  DEFAULT 30,
    p_observaciones       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_cuenta_id       UUID;
    v_saldo_anterior  NUMERIC := 0;
    v_nuevo_saldo     NUMERIC;
    v_factura_id      UUID;
    v_fecha_vcto      TIMESTAMPTZ;
BEGIN
    -- 1. Obtener o crear cuenta por cobrar del cliente
    SELECT id, saldo_actual INTO v_cuenta_id, v_saldo_anterior
        FROM public.cuentas_por_cobrar
        WHERE cliente_id = p_cliente_id;

    IF v_cuenta_id IS NULL THEN
        INSERT INTO public.cuentas_por_cobrar
            (cliente_id, saldo_actual, total_facturado, total_pagado, estado, ultima_compra)
        VALUES
            (p_cliente_id, 0, 0, 0, 'activo', NOW())
        RETURNING id INTO v_cuenta_id;

        v_saldo_anterior := 0;
    END IF;

    -- 2. Calcular nuevo saldo
    v_nuevo_saldo   := v_saldo_anterior + p_total;
    v_fecha_vcto    := NOW() + (p_dias_vencimiento || ' days')::INTERVAL;

    -- 3. Insertar en facturas (tabla existente, tipo_venta='credito')
    --    Solo para registro histórico y reportes de ventas generales.
    INSERT INTO public.facturas
        (fecha_hora, cajero, cajero_id, caja, cai, factura, cliente,
         productos, sub_total, isv_15, isv_18, total,
         tipo_venta, cliente_credito_id)
    VALUES
        (p_fecha_hora::TIMESTAMPTZ, p_cajero, p_cajero_id, p_caja, p_cai,
         p_factura_numero, (SELECT nombre FROM public.clientes_credito WHERE id = p_cliente_id),
         p_productos::TEXT, p_sub_total, p_isv_15, p_isv_18, p_total,
         'credito', p_cliente_id);

    -- 4. Insertar en facturas_credito
    INSERT INTO public.facturas_credito
        (factura_numero, cliente_id, cuenta_cobrar_id, cajero_id, cajero,
         caja, cai, productos, sub_total, isv_15, isv_18, total,
         saldo_anterior, nuevo_saldo, estado, fecha_vencimiento,
         fecha_hora, observaciones, tipo_orden)
    VALUES
        (p_factura_numero, p_cliente_id, v_cuenta_id, p_cajero_id, p_cajero,
         p_caja, p_cai, p_productos, p_sub_total, p_isv_15, p_isv_18, p_total,
         v_saldo_anterior, v_nuevo_saldo, 'pendiente', v_fecha_vcto,
         p_fecha_hora::TIMESTAMPTZ, p_observaciones, p_tipo_orden)
    RETURNING id INTO v_factura_id;

    -- 5. Actualizar cuenta por cobrar
    UPDATE public.cuentas_por_cobrar
        SET saldo_actual    = v_nuevo_saldo,
            total_facturado = total_facturado + p_total,
            ultima_compra   = NOW(),
            actualizado_en  = NOW()
        WHERE id = v_cuenta_id;

    RETURN jsonb_build_object(
        'ok',              true,
        'factura_id',      v_factura_id,
        'cuenta_id',       v_cuenta_id,
        'saldo_anterior',  v_saldo_anterior,
        'nuevo_saldo',     v_nuevo_saldo
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'ok',    false,
        'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.confirmar_venta_credito IS
    'Crea una venta a crédito de forma atómica: factura + factura_credito + actualiza CxC';


-- ============================================================
-- SECCIÓN 7: FUNCIÓN TRANSACCIONAL - REGISTRAR PAGO DE CRÉDITO
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_pago_credito(
    p_cliente_id         UUID,
    p_monto              NUMERIC,
    p_tipo_pago          TEXT,
    p_cajero_id          TEXT,
    p_cajero             TEXT,
    p_caja               TEXT,
    p_factura_credito_id UUID    DEFAULT NULL,
    p_referencia         TEXT    DEFAULT NULL,
    p_banco              TEXT    DEFAULT NULL,
    p_usd_monto          NUMERIC DEFAULT NULL,
    p_observacion        TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_cuenta_id        UUID;
    v_saldo_antes      NUMERIC;
    v_saldo_despues    NUMERIC;
    v_pago_id          UUID;
BEGIN
    -- 1. Obtener cuenta por cobrar
    SELECT id, saldo_actual INTO v_cuenta_id, v_saldo_antes
        FROM public.cuentas_por_cobrar
        WHERE cliente_id = p_cliente_id;

    IF v_cuenta_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El cliente no tiene cuenta por cobrar registrada');
    END IF;

    IF p_monto <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El monto debe ser mayor que cero');
    END IF;

    -- 2. Calcular nuevo saldo (no puede quedar negativo)
    v_saldo_despues := GREATEST(0, v_saldo_antes - p_monto);

    -- 3. Insertar pago
    INSERT INTO public.pagos_credito
        (cliente_id, cuenta_cobrar_id, factura_credito_id,
         monto, tipo_pago, referencia, banco, usd_monto,
         cajero_id, cajero, caja, observacion,
         saldo_antes, saldo_despues, fecha_hora)
    VALUES
        (p_cliente_id, v_cuenta_id, p_factura_credito_id,
         p_monto, p_tipo_pago, p_referencia, p_banco, p_usd_monto,
         p_cajero_id, p_cajero, p_caja, p_observacion,
         v_saldo_antes, v_saldo_despues, NOW())
    RETURNING id INTO v_pago_id;

    -- 4. Actualizar cuenta por cobrar
    UPDATE public.cuentas_por_cobrar
        SET saldo_actual  = v_saldo_despues,
            total_pagado  = total_pagado + p_monto,
            actualizado_en = NOW()
        WHERE id = v_cuenta_id;

    -- 5. Si el pago es para una factura específica, actualizar su estado
    IF p_factura_credito_id IS NOT NULL THEN
        UPDATE public.facturas_credito
            SET estado = CASE
                    WHEN (SELECT SUM(monto) FROM public.pagos_credito
                          WHERE factura_credito_id = p_factura_credito_id) >=
                         (SELECT total FROM public.facturas_credito WHERE id = p_factura_credito_id)
                    THEN 'pagado'
                    ELSE 'parcial'
                END,
                actualizado_en = NOW()     -- columna añadida abajo
            WHERE id = p_factura_credito_id;
    END IF;

    -- 6. Registrar también en la tabla 'pagos' del sistema (para que entre al cierre de caja)
    --    ESTO ES LO CLAVE: el ingreso de caja ocurre AQUÍ, no al facturar.
    INSERT INTO public.pagos
        (tipo, monto, referencia, banco, fecha_hora, cajero, cajero_id,
         cliente, factura_venta, recibido, cambio)
    VALUES
        (p_tipo_pago, p_monto, 'PAGO_CREDITO:' || p_cliente_id::TEXT,
         p_banco, NOW(), p_cajero, p_cajero_id,
         (SELECT nombre FROM public.clientes_credito WHERE id = p_cliente_id),
         'CREDITO', p_monto, 0);

    RETURN jsonb_build_object(
        'ok',            true,
        'pago_id',       v_pago_id,
        'saldo_antes',   v_saldo_antes,
        'saldo_despues', v_saldo_despues
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.registrar_pago_credito IS
    'Registra abono de cliente: actualiza CxC + tabla pagos para cierre de caja';


-- ============================================================
-- SECCIÓN 8: COLUMNA actualizado_en EN facturas_credito
-- (la función la referencia; mejor crearla explícitamente)
-- ============================================================

ALTER TABLE public.facturas_credito
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ DEFAULT NOW();


-- ============================================================
-- SECCIÓN 9: VISTA RESUMEN DE CRÉDITOS
-- Útil para el dashboard sin joins complejos en el frontend.
-- ============================================================

CREATE OR REPLACE VIEW public.v_creditos_resumen AS
SELECT
    cl.id              AS cliente_id,
    cl.nombre          AS cliente_nombre,
    cl.dni,
    cl.telefono,
    cl.activo          AS cliente_activo,
    cxc.id             AS cuenta_id,
    cxc.saldo_actual,
    cxc.total_facturado,
    cxc.total_pagado,
    cxc.ultima_compra,
    cxc.estado         AS cuenta_estado,
    (SELECT COUNT(*) FROM public.facturas_credito fc
     WHERE fc.cliente_id = cl.id AND fc.estado IN ('pendiente','parcial'))
                       AS facturas_pendientes,
    (SELECT COUNT(*) FROM public.facturas_credito fc
     WHERE fc.cliente_id = cl.id AND fc.estado = 'vencido')
                       AS facturas_vencidas
FROM public.clientes_credito cl
LEFT JOIN public.cuentas_por_cobrar cxc ON cxc.cliente_id = cl.id
WHERE cl.activo = TRUE;

COMMENT ON VIEW public.v_creditos_resumen IS
    'Vista consolidada de créditos por cliente (solo activos)';


-- ============================================================
-- SECCIÓN 10: PROVEEDORES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proveedores (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comercial TEXT    NOT NULL,
    rtn_dni          TEXT,
    telefono         TEXT,
    email            TEXT,
    direccion        TEXT,
    contacto         TEXT,             -- Nombre del contacto en el proveedor
    observaciones    TEXT,
    activo           BOOLEAN DEFAULT TRUE,
    creado_por       TEXT,
    creado_en        TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.proveedores IS 'Catálogo de proveedores del negocio';

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre
    ON public.proveedores(nombre_comercial);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo
    ON public.proveedores(activo);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prov_select_public" ON public.proveedores FOR SELECT TO public USING (true);
CREATE POLICY "prov_insert_public" ON public.proveedores FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "prov_update_public" ON public.proveedores FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "prov_delete_public" ON public.proveedores FOR DELETE TO public USING (true);


-- ============================================================
-- SECCIÓN 11: CUENTAS POR PAGAR
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cuentas_por_pagar (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id     UUID          NOT NULL REFERENCES public.proveedores(id) ON DELETE RESTRICT,
    numero_documento TEXT,                           -- Factura o doc del proveedor
    concepto         TEXT          NOT NULL,
    monto_total      NUMERIC(12,2) NOT NULL CHECK (monto_total > 0),
    saldo_pendiente  NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_pagado     NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_emision    TIMESTAMPTZ   DEFAULT NOW(),
    fecha_vencimiento TIMESTAMPTZ,
    estado           TEXT          NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','parcial','pagado','vencido')),
    cajero_id        TEXT,
    cajero           TEXT,
    observaciones    TEXT,
    creado_en        TIMESTAMPTZ   DEFAULT NOW(),
    actualizado_en   TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE  public.cuentas_por_pagar                     IS 'Deudas con proveedores (cuentas por pagar)';
COMMENT ON COLUMN public.cuentas_por_pagar.numero_documento    IS 'Número de factura o documento del proveedor';

CREATE INDEX IF NOT EXISTS idx_cxp_proveedor_id
    ON public.cuentas_por_pagar(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_cxp_estado
    ON public.cuentas_por_pagar(estado);
CREATE INDEX IF NOT EXISTS idx_cxp_fecha_vencimiento
    ON public.cuentas_por_pagar(fecha_vencimiento);

ALTER TABLE public.cuentas_por_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cxp_select_public" ON public.cuentas_por_pagar FOR SELECT TO public USING (true);
CREATE POLICY "cxp_insert_public" ON public.cuentas_por_pagar FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "cxp_update_public" ON public.cuentas_por_pagar FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "cxp_delete_public" ON public.cuentas_por_pagar FOR DELETE TO public USING (true);


-- ============================================================
-- SECCIÓN 12: PAGOS A PROVEEDORES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pagos_proveedores (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id     UUID          NOT NULL REFERENCES public.proveedores(id) ON DELETE RESTRICT,
    cuenta_pagar_id  UUID          NOT NULL REFERENCES public.cuentas_por_pagar(id) ON DELETE RESTRICT,
    monto            NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    tipo_pago        TEXT          NOT NULL
                         CHECK (tipo_pago IN ('efectivo','tarjeta','transferencia','cheque')),
    referencia       TEXT,
    banco            TEXT,
    cajero_id        TEXT,
    cajero           TEXT,
    observacion      TEXT,
    saldo_antes      NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_despues    NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_hora       TIMESTAMPTZ   DEFAULT NOW(),
    creado_en        TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.pagos_proveedores IS 'Abonos y pagos realizados a proveedores';

CREATE INDEX IF NOT EXISTS idx_pp_proveedor_id
    ON public.pagos_proveedores(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_pp_cuenta_pagar_id
    ON public.pagos_proveedores(cuenta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_pp_fecha_hora
    ON public.pagos_proveedores(fecha_hora);

ALTER TABLE public.pagos_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_select_public" ON public.pagos_proveedores FOR SELECT TO public USING (true);
CREATE POLICY "pp_insert_public" ON public.pagos_proveedores FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "pp_update_public" ON public.pagos_proveedores FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "pp_delete_public" ON public.pagos_proveedores FOR DELETE TO public USING (true);


-- ============================================================
-- SECCIÓN 13: FUNCIÓN TRANSACCIONAL - REGISTRAR PAGO A PROVEEDOR
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor(
    p_proveedor_id    UUID,
    p_cuenta_pagar_id UUID,
    p_monto           NUMERIC,
    p_tipo_pago       TEXT,
    p_cajero_id       TEXT,
    p_cajero          TEXT,
    p_referencia      TEXT  DEFAULT NULL,
    p_banco           TEXT  DEFAULT NULL,
    p_observacion     TEXT  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_saldo_antes   NUMERIC;
    v_saldo_despues NUMERIC;
    v_pago_id       UUID;
BEGIN
    -- 1. Obtener saldo actual de la cuenta por pagar
    SELECT saldo_pendiente INTO v_saldo_antes
        FROM public.cuentas_por_pagar
        WHERE id = p_cuenta_pagar_id AND proveedor_id = p_proveedor_id;

    IF v_saldo_antes IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Cuenta por pagar no encontrada');
    END IF;

    IF p_monto <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El monto debe ser mayor que cero');
    END IF;

    IF p_monto > v_saldo_antes THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El monto supera el saldo pendiente');
    END IF;

    -- 2. Calcular nuevo saldo
    v_saldo_despues := v_saldo_antes - p_monto;

    -- 3. Insertar pago
    INSERT INTO public.pagos_proveedores
        (proveedor_id, cuenta_pagar_id, monto, tipo_pago,
         referencia, banco, cajero_id, cajero, observacion,
         saldo_antes, saldo_despues, fecha_hora)
    VALUES
        (p_proveedor_id, p_cuenta_pagar_id, p_monto, p_tipo_pago,
         p_referencia, p_banco, p_cajero_id, p_cajero, p_observacion,
         v_saldo_antes, v_saldo_despues, NOW())
    RETURNING id INTO v_pago_id;

    -- 4. Actualizar cuenta por pagar
    UPDATE public.cuentas_por_pagar
        SET saldo_pendiente = v_saldo_despues,
            total_pagado    = total_pagado + p_monto,
            estado          = CASE
                                WHEN v_saldo_despues = 0     THEN 'pagado'
                                WHEN v_saldo_despues < monto_total THEN 'parcial'
                                ELSE 'pendiente'
                              END,
            actualizado_en  = NOW()
        WHERE id = p_cuenta_pagar_id;

    RETURN jsonb_build_object(
        'ok',            true,
        'pago_id',       v_pago_id,
        'saldo_antes',   v_saldo_antes,
        'saldo_despues', v_saldo_despues
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.registrar_pago_proveedor IS
    'Registra pago a proveedor de forma atómica: actualiza saldo CxP';


-- ============================================================
-- SECCIÓN 14: VISTA RESUMEN CUENTAS POR PAGAR
-- ============================================================

CREATE OR REPLACE VIEW public.v_cxp_resumen AS
SELECT
    p.id               AS proveedor_id,
    p.nombre_comercial AS proveedor,
    p.rtn_dni,
    p.telefono,
    p.activo           AS proveedor_activo,
    COUNT(cxp.id)      AS total_facturas,
    SUM(CASE WHEN cxp.estado IN ('pendiente','parcial') THEN cxp.saldo_pendiente ELSE 0 END)
                       AS saldo_pendiente_total,
    SUM(cxp.total_pagado) AS total_pagado,
    MIN(CASE WHEN cxp.estado IN ('pendiente','parcial') THEN cxp.fecha_vencimiento END)
                       AS proxima_fecha_vencimiento
FROM public.proveedores p
LEFT JOIN public.cuentas_por_pagar cxp ON cxp.proveedor_id = p.id
WHERE p.activo = TRUE
GROUP BY p.id, p.nombre_comercial, p.rtn_dni, p.telefono, p.activo;

COMMENT ON VIEW public.v_cxp_resumen IS
    'Vista consolidada de cuentas por pagar por proveedor';


-- ============================================================
-- SECCIÓN 15: TRIGGER - MARCAR FACTURAS CRÉDITO COMO VENCIDAS
-- Función reutilizable para actualizar estado de vencidas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.actualizar_estados_vencidos()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Marcar facturas de crédito vencidas
    UPDATE public.facturas_credito
        SET estado = 'vencido', actualizado_en = NOW()
        WHERE estado IN ('pendiente','parcial')
          AND fecha_vencimiento < NOW();

    -- Marcar cuentas por pagar vencidas
    UPDATE public.cuentas_por_pagar
        SET estado = 'vencido', actualizado_en = NOW()
        WHERE estado IN ('pendiente','parcial')
          AND fecha_vencimiento < NOW();
END;
$$;

COMMENT ON FUNCTION public.actualizar_estados_vencidos IS
    'Actualiza a vencido las facturas y cuentas por pagar con fecha pasada';


-- ============================================================
-- SECCIÓN 16: VERIFICACIÓN FINAL
-- ============================================================

DO $$
DECLARE
    v_tablas TEXT[] := ARRAY[
        'clientes_credito',
        'cuentas_por_cobrar',
        'facturas_credito',
        'pagos_credito',
        'proveedores',
        'cuentas_por_pagar',
        'pagos_proveedores'
    ];
    v_tabla TEXT;
    v_exists BOOLEAN;
BEGIN
    FOREACH v_tabla IN ARRAY v_tablas LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = v_tabla
        ) INTO v_exists;

        IF v_exists THEN
            RAISE NOTICE '✓ Tabla "%" creada correctamente', v_tabla;
        ELSE
            RAISE WARNING '✗ Tabla "%" NO fue creada', v_tabla;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '=== Módulo de Créditos y Proveedores instalado correctamente ===';
END;
$$;
