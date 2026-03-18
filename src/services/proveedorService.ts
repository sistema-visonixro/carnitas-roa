// ============================================================
// Servicio de Proveedores y Cuentas por Pagar
// ============================================================
import { supabase } from "../supabaseClient";
import type {
  Proveedor,
  ProveedorInput,
  CuentaPorPagar,
  CuentaPorPagarInput,
  PagoProveedor,
  CxpResumen,
  PagoProveedorPayload,
  ResultadoPagoProveedor,
} from "../types/creditos";

// ─────────────────────────────────────────────────────────────
// PROVEEDORES
// ─────────────────────────────────────────────────────────────

export async function obtenerProveedores(
  soloActivos = true,
): Promise<Proveedor[]> {
  let query = supabase
    .from("proveedores")
    .select("*")
    .order("nombre_comercial");

  if (soloActivos) query = query.eq("activo", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function buscarProveedores(termino: string): Promise<Proveedor[]> {
  const t = termino.trim();
  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .eq("activo", true)
    .or(`nombre_comercial.ilike.%${t}%,rtn_dni.ilike.%${t}%`)
    .order("nombre_comercial")
    .limit(20);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function crearProveedor(
  input: ProveedorInput,
): Promise<Proveedor> {
  const { data, error } = await supabase
    .from("proveedores")
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function actualizarProveedor(
  id: string,
  cambios: Partial<ProveedorInput>,
): Promise<Proveedor> {
  const { data, error } = await supabase
    .from("proveedores")
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function desactivarProveedor(id: string): Promise<void> {
  const { error } = await supabase
    .from("proveedores")
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ─────────────────────────────────────────────────────────────
// CUENTAS POR PAGAR
// ─────────────────────────────────────────────────────────────

export async function obtenerCuentasPorPagar(
  proveedorId?: string,
  soloActivas = false,
): Promise<CuentaPorPagar[]> {
  let query = supabase
    .from("cuentas_por_pagar")
    .select("*, proveedores(nombre_comercial, telefono)")
    .order("fecha_vencimiento", { ascending: true });

  if (proveedorId) query = query.eq("proveedor_id", proveedorId);
  if (soloActivas) query = query.in("estado", ["pendiente", "parcial"]);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    ...row,
    proveedor: row.proveedores,
  }));
}

export async function crearCuentaPorPagar(
  input: CuentaPorPagarInput,
): Promise<CuentaPorPagar> {
  const registro = {
    ...input,
    saldo_pendiente: input.monto_total,
    total_pagado: 0,
    estado: "pendiente",
  };

  const { data, error } = await supabase
    .from("cuentas_por_pagar")
    .insert([registro])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function actualizarCuentaPorPagar(
  id: string,
  cambios: Partial<CuentaPorPagarInput>,
): Promise<CuentaPorPagar> {
  const { data, error } = await supabase
    .from("cuentas_por_pagar")
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ─────────────────────────────────────────────────────────────
// PAGOS A PROVEEDORES
// ─────────────────────────────────────────────────────────────

/**
 * Registra el pago a proveedor usando la función SQL transaccional.
 */
export async function registrarPagoProveedor(
  payload: PagoProveedorPayload,
): Promise<ResultadoPagoProveedor> {
  const { data, error } = await supabase.rpc("registrar_pago_proveedor", {
    p_proveedor_id: payload.proveedor_id,
    p_cuenta_pagar_id: payload.cuenta_pagar_id,
    p_monto: payload.monto,
    p_tipo_pago: payload.tipo_pago,
    p_cajero_id: payload.cajero_id,
    p_cajero: payload.cajero,
    p_referencia: payload.referencia ?? null,
    p_banco: payload.banco ?? null,
    p_observacion: payload.observacion ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return data as ResultadoPagoProveedor;
}

export async function obtenerPagosProveedor(
  proveedorId: string,
): Promise<PagoProveedor[]> {
  const { data, error } = await supabase
    .from("pagos_proveedores")
    .select("*")
    .eq("proveedor_id", proveedorId)
    .order("fecha_hora", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────
// RESUMEN CxP
// ─────────────────────────────────────────────────────────────

export async function obtenerResumenCxP(): Promise<CxpResumen[]> {
  const { data, error } = await supabase
    .from("v_cxp_resumen")
    .select("*")
    .order("saldo_pendiente_total", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CxpResumen[];
}
