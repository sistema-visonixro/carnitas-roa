// ============================================================
// Servicio de Créditos: Clientes, CxC, Facturas y Pagos
// ============================================================
import { supabase } from "../supabaseClient";
import type {
  ClienteCredito,
  ClienteCreditoInput,
  FacturaCredito,
  PagoCredito,
  CuentaPorCobrar,
  CreditoResumen,
  VentaCreditoPayload,
  PagoCreditoPayload,
  ResultadoVentaCredito,
  ResultadoPagoCredito,
  FiltroFechas,
  ReporteCreditosData,
} from "../types/creditos";

// ─────────────────────────────────────────────────────────────
// CLIENTES DE CRÉDITO
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene todos los clientes activos.
 */
export async function obtenerClientesCredito(): Promise<ClienteCredito[]> {
  const { data, error } = await supabase
    .from("clientes_credito")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Busca clientes por DNI o nombre (búsqueda parcial).
 */
export async function buscarClientesCredito(
  termino: string,
): Promise<ClienteCredito[]> {
  const t = termino.trim();
  const { data, error } = await supabase
    .from("clientes_credito")
    .select("*")
    .eq("activo", true)
    .or(`nombre.ilike.%${t}%,dni.ilike.%${t}%`)
    .order("nombre")
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Verifica si ya existe un cliente con el mismo DNI.
 */
export async function existeClienteConDni(
  dni: string,
  excluirId?: string,
): Promise<boolean> {
  let query = supabase.from("clientes_credito").select("id").eq("dni", dni);

  if (excluirId) query = query.neq("id", excluirId);

  const { data } = await query.maybeSingle();
  return data !== null;
}

/**
 * Crea un nuevo cliente de crédito.
 * Valida DNI único antes de insertar.
 */
export async function crearClienteCredito(
  input: ClienteCreditoInput,
): Promise<ClienteCredito> {
  const dniDuplicado = await existeClienteConDni(input.dni);
  if (dniDuplicado) {
    throw new Error(`Ya existe un cliente con el DNI: ${input.dni}`);
  }

  const { data, error } = await supabase
    .from("clientes_credito")
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Actualiza un cliente de crédito existente.
 */
export async function actualizarClienteCredito(
  id: string,
  cambios: Partial<ClienteCreditoInput>,
): Promise<ClienteCredito> {
  if (cambios.dni) {
    const duplicado = await existeClienteConDni(cambios.dni, id);
    if (duplicado) {
      throw new Error(`Ya existe otro cliente con el DNI: ${cambios.dni}`);
    }
  }

  const { data, error } = await supabase
    .from("clientes_credito")
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Desactiva (soft-delete) un cliente.
 */
export async function desactivarClienteCredito(id: string): Promise<void> {
  const { error } = await supabase
    .from("clientes_credito")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────────────────────
// CUENTAS POR COBRAR
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene la cuenta por cobrar de un cliente.
 * Devuelve null si no existe (primera compra).
 */
export async function obtenerCuentaCobrar(
  clienteId: string,
): Promise<CuentaPorCobrar | null> {
  const { data, error } = await supabase
    .from("cuentas_por_cobrar")
    .select("*")
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

// ─────────────────────────────────────────────────────────────
// VISTA RESUMEN DE CRÉDITOS
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene el resumen de créditos desde la vista v_creditos_resumen.
 */
export async function obtenerResumenCreditos(): Promise<CreditoResumen[]> {
  const { data, error } = await supabase
    .from("v_creditos_resumen")
    .select("*")
    .order("saldo_actual", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CreditoResumen[];
}

// ─────────────────────────────────────────────────────────────
// VENTAS A CRÉDITO (usa función SQL transaccional)
// ─────────────────────────────────────────────────────────────

/**
 * Confirma una venta a crédito de forma atómica.
 * Llama a la función PostgreSQL confirmar_venta_credito().
 */
export async function confirmarVentaCredito(
  payload: VentaCreditoPayload,
): Promise<ResultadoVentaCredito> {
  const { data, error } = await supabase.rpc("confirmar_venta_credito", {
    p_factura_numero: payload.factura_numero,
    p_cliente_id: payload.cliente_id,
    p_cajero_id: payload.cajero_id,
    p_cajero: payload.cajero,
    p_caja: payload.caja,
    p_cai: payload.cai,
    p_productos: payload.productos,
    p_sub_total: payload.sub_total,
    p_isv_15: payload.isv_15,
    p_isv_18: payload.isv_18,
    p_total: payload.total,
    p_fecha_hora: payload.fecha_hora,
    p_tipo_orden: payload.tipo_orden ?? "PARA LLEVAR",
    p_dias_vencimiento: payload.dias_vencimiento ?? 30,
    p_observaciones: payload.observaciones ?? null,
  });

  if (error) return { ok: false, error: error.message };
  const result = data as ResultadoVentaCredito;
  return result;
}

// ─────────────────────────────────────────────────────────────
// FACTURAS DE CRÉDITO
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene todas las facturas de un cliente (paginadas).
 */
export async function obtenerFacturasCliente(
  clienteId: string,
  soloActivas = false,
): Promise<FacturaCredito[]> {
  let query = supabase
    .from("facturas_credito")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("fecha_hora", { ascending: false });

  if (soloActivas) {
    query = query.in("estado", ["pendiente", "parcial"]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    ...row,
    productos:
      typeof row.productos === "string"
        ? JSON.parse(row.productos)
        : row.productos,
  }));
}

/**
 * Obtiene facturas pendientes de un rango de fechas (admin).
 */
export async function obtenerFacturasCredito(
  filtro: Partial<FiltroFechas> & { estado?: string },
): Promise<FacturaCredito[]> {
  let query = supabase
    .from("facturas_credito")
    .select("*, clientes_credito(nombre, dni, telefono)")
    .order("fecha_hora", { ascending: false });

  if (filtro.desde) query = query.gte("fecha_hora", filtro.desde);
  if (filtro.hasta) query = query.lte("fecha_hora", filtro.hasta);
  if (filtro.estado && filtro.estado !== "todos") {
    query = query.eq("estado", filtro.estado);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    ...row,
    productos:
      typeof row.productos === "string"
        ? JSON.parse(row.productos)
        : row.productos,
    cliente: row.clientes_credito,
  }));
}

// ─────────────────────────────────────────────────────────────
// PAGOS DE CRÉDITO
// ─────────────────────────────────────────────────────────────

/**
 * Registra un pago/abono de cliente (usa función SQL transaccional).
 * El ingreso a caja se registra también en la tabla 'pagos'.
 */
export async function registrarPagoCredito(
  payload: PagoCreditoPayload,
): Promise<ResultadoPagoCredito> {
  const { data, error } = await supabase.rpc("registrar_pago_credito", {
    p_cliente_id: payload.cliente_id,
    p_monto: payload.monto,
    p_tipo_pago: payload.tipo_pago,
    p_cajero_id: payload.cajero_id,
    p_cajero: payload.cajero,
    p_caja: payload.caja ?? "",
    p_factura_credito_id: payload.factura_credito_id ?? null,
    p_referencia: payload.referencia ?? null,
    p_banco: payload.banco ?? null,
    p_usd_monto: payload.usd_monto ?? null,
    p_observacion: payload.observacion ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return data as ResultadoPagoCredito;
}

/**
 * Historial de pagos de un cliente.
 */
export async function obtenerPagosCliente(
  clienteId: string,
): Promise<PagoCredito[]> {
  const { data, error } = await supabase
    .from("pagos_credito")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("fecha_hora", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────
// REPORTES
// ─────────────────────────────────────────────────────────────

/**
 * Genera los datos del reporte de ventas a crédito.
 */
export async function obtenerDatosReporteCreditos(
  filtro: FiltroFechas,
): Promise<ReporteCreditosData> {
  const [
    { data: facturasCredito },
    { data: pagosCredito },
    { data: facturasContado },
  ] = await Promise.all([
    supabase
      .from("facturas_credito")
      .select("total, estado, cliente_id")
      .gte("fecha_hora", filtro.desde)
      .lte("fecha_hora", filtro.hasta),

    supabase
      .from("pagos_credito")
      .select("monto, cliente_id")
      .gte("fecha_hora", filtro.desde)
      .lte("fecha_hora", filtro.hasta),

    supabase
      .from("ventas")
      .select("total")
      .eq("tipo", "CONTADO")
      .gte("fecha_hora", filtro.desde)
      .lte("fecha_hora", filtro.hasta),
  ]);

  const totalFacturadoCredito = (facturasCredito ?? []).reduce(
    (s: number, f: any) => s + Number(f.total),
    0,
  );
  const totalCobrado = (pagosCredito ?? []).reduce(
    (s: number, p: any) => s + Number(p.monto),
    0,
  );
  const totalContado = (facturasContado ?? []).reduce(
    (s: number, f: any) => s + Number(f.total),
    0,
  );

  // Saldo pendiente global desde la vista
  const { data: vistaCxC } = await supabase
    .from("v_creditos_resumen")
    .select("saldo_actual");

  const saldoPendienteTotal = (vistaCxC ?? []).reduce(
    (s: number, r: any) => s + Number(r.saldo_actual),
    0,
  );

  // Facturas vencidas
  const facturasVencidas = (facturasCredito ?? []).filter(
    (f: any) => f.estado === "vencido",
  ).length;

  // Top deudores
  const { data: topDeudores } = await supabase
    .from("v_creditos_resumen")
    .select("cliente_nombre, saldo_actual")
    .gt("saldo_actual", 0)
    .order("saldo_actual", { ascending: false })
    .limit(5);

  const promedio =
    totalFacturadoCredito > 0
      ? Math.round((totalCobrado / totalFacturadoCredito) * 100)
      : 0;

  return {
    total_facturado_credito: totalFacturadoCredito,
    total_cobrado_credito: totalCobrado,
    saldo_pendiente_total: saldoPendienteTotal,
    clientes_con_deuda: (vistaCxC ?? []).filter(
      (r: any) => Number(r.saldo_actual) > 0,
    ).length,
    facturas_vencidas: facturasVencidas,
    promedio_recuperacion: promedio,
    contado_vs_credito: {
      contado: totalContado,
      credito: totalFacturadoCredito,
    },
    top_deudores: (topDeudores ?? []).map((r: any) => ({
      cliente: r.cliente_nombre,
      saldo: Number(r.saldo_actual),
    })),
  };
}
