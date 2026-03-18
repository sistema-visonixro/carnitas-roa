// ============================================================
// ProveedoresCxPView.tsx
// Módulo financiero: Proveedores y Cuentas por Pagar.
// Permite gestionar proveedores, registrar deudas y
// registrar pagos a proveedores.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import type {
  Proveedor,
  ProveedorInput,
  CuentaPorPagar,
  CuentaPorPagarInput,
  TipoPagoProveedor,
} from "./types/creditos";
import {
  obtenerProveedores,
  crearProveedor,
  actualizarProveedor,
  desactivarProveedor,
  obtenerCuentasPorPagar,
  crearCuentaPorPagar,
  registrarPagoProveedor,
} from "./services/proveedorService";
import { useDatosNegocio } from "./useDatosNegocio";

type SubVista =
  | "listaProveedores"
  | "formProveedor"
  | "listaCxP"
  | "formCxP"
  | "pagoCxP";

const TIPO_PAGO_PROV: { value: TipoPagoProveedor; label: string }[] = [
  { value: "efectivo",      label: "Efectivo" },
  { value: "tarjeta",       label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque",        label: "Cheque" },
];

function estadoBadge(estado: string) {
  const cfg: Record<string, { bg: string; color: string }> = {
    pendiente: { bg: "#fef3c7", color: "#92400e" },
    parcial:   { bg: "#dbeafe", color: "#1e40af" },
    pagado:    { bg: "#dcfce7", color: "#14532d" },
    vencido:   { bg: "#fee2e2", color: "#b91c1c" },
  };
  const c = cfg[estado] ?? cfg.pendiente;
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
    }}>
      {estado}
    </span>
  );
}

interface Props { onBack?: () => void; }

export default function ProveedoresCxPView({ onBack: _onBack }: Props) {
  const { datos: negocio } = useDatosNegocio();
  const usuario = (() => {
    try { return JSON.parse(localStorage.getItem("usuario") ?? "{}"); } catch { return {}; }
  })();

  const [subVista, setSubVista] = useState<SubVista>("listaProveedores");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cuentasPagar, setCuentasPagar] = useState<CuentaPorPagar[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Form proveedor
  const [editProv, setEditProv] = useState<Proveedor | null>(null);
  const [fNombre, setFNombre]   = useState("");
  const [fRtn, setFRtn]         = useState("");
  const [fTel, setFTel]         = useState("");
  const [fEmail, setFEmail]     = useState("");
  const [fDir, setFDir]         = useState("");
  const [fContacto, setFContacto] = useState("");
  const [fObs, setFObs]         = useState("");
  const [guardandoProv, setGuardandoProv] = useState(false);
  const [errProv, setErrProv]   = useState<string | null>(null);

  // Form CxP
  const [provSlc, setProvSlc]   = useState<Proveedor | null>(null);
  const [fConcepto, setFConcepto] = useState("");
  const [fNumDoc, setFNumDoc]   = useState("");
  const [fMonto, setFMonto]     = useState("");
  const [fFechaEmision, setFFechaEmision] = useState(new Date().toISOString().split("T")[0]);
  const [fFechaVcto, setFFechaVcto] = useState("");
  const [fObsCxP, setFObsCxP]   = useState("");
  const [guardandoCxP, setGuardandoCxP] = useState(false);
  const [errCxP, setErrCxP]     = useState<string | null>(null);

  // Pago CxP
  const [cxpSlc, setCxpSlc]     = useState<CuentaPorPagar | null>(null);
  const [montoPago, setMontoPago] = useState("");
  const [tipoPago, setTipoPago]   = useState<TipoPagoProveedor>("efectivo");
  const [refPago, setRefPago]     = useState("");
  const [bancoPago, setBancoPago] = useState("");
  const [obsPago, setObsPago]     = useState("");
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [exitoPago, setExitoPago] = useState<string | null>(null);
  const [errPago, setErrPago]     = useState<string | null>(null);

  // ──── Carga ────────────────────────────────────────────────
  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    setError(null);
    try { setProveedores(await obtenerProveedores()); }
    catch (e: any) { setError(e.message); }
    finally { setCargando(false); }
  }, []);

  const cargarCuentasPagar = useCallback(async (provId?: string) => {
    setCargando(true);
    setError(null);
    try { setCuentasPagar(await obtenerCuentasPorPagar(provId)); }
    catch (e: any) { setError(e.message); }
    finally { setCargando(false); }
  }, []);

  useEffect(() => {
    if (subVista === "listaProveedores") cargarProveedores();
    if (subVista === "listaCxP") cargarCuentasPagar(provSlc?.id);
  }, [subVista, cargarProveedores, cargarCuentasPagar, provSlc]);

  // ──── Proveedor helpers ────────────────────────────────────
  function abrirNuevoProveedor() {
    setEditProv(null);
    setFNombre(""); setFRtn(""); setFTel(""); setFEmail("");
    setFDir(""); setFContacto(""); setFObs(""); setErrProv(null);
    setSubVista("formProveedor");
  }

  function abrirEditarProveedor(p: Proveedor) {
    setEditProv(p);
    setFNombre(p.nombre_comercial); setFRtn(p.rtn_dni ?? "");
    setFTel(p.telefono ?? ""); setFEmail(p.email ?? "");
    setFDir(p.direccion ?? ""); setFContacto(p.contacto ?? ""); setFObs(p.observaciones ?? "");
    setErrProv(null);
    setSubVista("formProveedor");
  }

  async function guardarProveedor() {
    if (!fNombre.trim()) { setErrProv("El nombre es requerido."); return; }
    setGuardandoProv(true); setErrProv(null);
    try {
      const input: ProveedorInput = {
        nombre_comercial: fNombre.trim(),
        rtn_dni:  fRtn || undefined,
        telefono: fTel || undefined,
        email:    fEmail || undefined,
        direccion: fDir || undefined,
        contacto: fContacto || undefined,
        observaciones: fObs || undefined,
        activo: true,
        creado_por: usuario.nombre ?? "",
      };
      if (editProv) await actualizarProveedor(editProv.id, input);
      else          await crearProveedor(input);
      await cargarProveedores();
      setSubVista("listaProveedores");
    } catch (e: any) { setErrProv(e.message); }
    finally { setGuardandoProv(false); }
  }

  async function desactivar(p: Proveedor) {
    if (!confirm(`¿Desactivar proveedor "${p.nombre_comercial}"?`)) return;
    try { await desactivarProveedor(p.id); await cargarProveedores(); }
    catch (e: any) { setError(e.message); }
  }

  // ──── CxP helpers ─────────────────────────────────────────
  function abrirNuevaCxP(prov: Proveedor) {
    setProvSlc(prov);
    setFConcepto(""); setFNumDoc(""); setFMonto("");
    setFFechaEmision(new Date().toISOString().split("T")[0]);
    setFFechaVcto(""); setFObsCxP(""); setErrCxP(null);
    setSubVista("formCxP");
  }

  async function guardarCxP() {
    if (!provSlc) return;
    if (!fConcepto.trim()) { setErrCxP("El concepto es requerido."); return; }
    const montoN = parseFloat(fMonto.replace(",", "."));
    if (!montoN || montoN <= 0) { setErrCxP("Monto inválido."); return; }
    setGuardandoCxP(true); setErrCxP(null);
    try {
      const input: CuentaPorPagarInput = {
        proveedor_id:     provSlc.id,
        concepto:         fConcepto.trim(),
        numero_documento: fNumDoc || undefined,
        monto_total:      montoN,
        saldo_pendiente:  montoN,
        fecha_emision:    fFechaEmision ? new Date(fFechaEmision).toISOString() : undefined,
        fecha_vencimiento: fFechaVcto ? new Date(fFechaVcto).toISOString() : undefined,
        estado:           "pendiente",
        cajero_id:  usuario.id   ?? "",
        cajero:     usuario.nombre ?? "",
        observaciones: fObsCxP || undefined,
      };
      await crearCuentaPorPagar(input);
      setSubVista("listaProveedores");
    } catch (e: any) { setErrCxP(e.message); }
    finally { setGuardandoCxP(false); }
  }

  // ──── Pago CxP ─────────────────────────────────────────────
  function abrirPago(cxp: CuentaPorPagar, prov: Proveedor) {
    setCxpSlc(cxp); setProvSlc(prov);
    setMontoPago(""); setTipoPago("efectivo");
    setRefPago(""); setBancoPago(""); setObsPago("");
    setExitoPago(null); setErrPago(null);
    setSubVista("pagoCxP");
  }

  async function confirmarPago() {
    if (!cxpSlc || !provSlc) return;
    const montoN = parseFloat(montoPago.replace(",", "."));
    if (!montoN || montoN <= 0) { setErrPago("Monto inválido."); return; }
    setProcesandoPago(true); setErrPago(null);
    try {
      const result = await registrarPagoProveedor({
        proveedor_id:    provSlc.id,
        cuenta_pagar_id: cxpSlc.id,
        monto:           montoN,
        tipo_pago:       tipoPago,
        cajero_id:       usuario.id   ?? "",
        cajero:          usuario.nombre ?? "",
        referencia: refPago   || undefined,
        banco:      bancoPago || undefined,
        observacion: obsPago  || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      setExitoPago(
        `Pago registrado. Saldo anterior: L ${result.saldo_antes?.toFixed(2)} → Nuevo saldo: L ${result.saldo_despues?.toFixed(2)}`,
      );
    } catch (e: any) { setErrPago(e.message); }
    finally { setProcesandoPago(false); }
  }

  function imprimirEstadoProveedor(prov: Proveedor, cxps: CuentaPorPagar[]) {
    const filas = cxps.map(c => `<tr>
      <td>${c.numero_documento ?? "—"}</td>
      <td>${c.concepto}</td>
      <td>${c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString("es-HN") : "—"}</td>
      <td>${c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString("es-HN") : "—"}</td>
      <td style="text-align:right">L ${Number(c.monto_total).toFixed(2)}</td>
      <td style="text-align:right">L ${Number(c.total_pagado).toFixed(2)}</td>
      <td style="text-align:right;font-weight:700">L ${Number(c.saldo_pendiente).toFixed(2)}</td>
      <td>${c.estado}</td>
    </tr>`).join("");

    const totalPend = cxps.reduce((s, c) => s + Number(c.saldo_pendiente), 0);

    const html = `<html><head><title>Estado Proveedor</title>
    <style>
      body { font-family: Arial; font-size:11px; padding:16px; }
      table { width:100%; border-collapse:collapse; margin-top:12px; }
      th { background:#f5f5f5; padding:6px 8px; text-align:left; border:1px solid #ddd; }
      td { padding:6px 8px; border:1px solid #ddd; }
      h1 { font-size:16px; } h2 { font-size:13px; }
      .center { text-align:center; }
      .total { font-size:15px; font-weight:900; color:#dc2626; margin-top:8px; }
    </style></head><body>
    <h1 class="center">${negocio?.nombre_negocio ?? "SISTEMA POS"}</h1>
    ${negocio?.rtn ? `<div class="center">RTN: ${negocio.rtn}</div>` : ""}
    <div class="center">${negocio?.direccion ?? ""}</div>
    <hr />
    <h2>ESTADO DE CUENTA — PROVEEDOR</h2>
    <div><strong>Proveedor:</strong> ${prov.nombre_comercial}</div>
    ${prov.rtn_dni ? `<div><strong>RTN/DNI:</strong> ${prov.rtn_dni}</div>` : ""}
    ${prov.telefono ? `<div><strong>Tel:</strong> ${prov.telefono}</div>` : ""}
    <div class="total">Saldo total pendiente: L ${totalPend.toFixed(2)}</div>
    <table>
      <thead><tr>
        <th>Doc.</th><th>Concepto</th><th>Emisión</th><th>Vencimiento</th>
        <th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div style="margin-top:14px;font-size:10px;text-align:center">Generado: ${new Date().toLocaleString("es-HN")}</div>
    </body></html>`;

    const w = window.open("", "", "height=700,width=1000");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onload = () => { setTimeout(() => { w.focus(); w.print(); w.close(); }, 400); };
    }
  }

  // ──── Filtros ────────────────────────────────────────────────
  const provsFiltrados = proveedores.filter(p =>
    p.nombre_comercial.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.rtn_dni ?? "").includes(busqueda),
  );

  const totalDeudaProv = cuentasPagar
    .filter(c => c.estado !== "pagado")
    .reduce((s, c) => s + Number(c.saldo_pendiente), 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#0f172a", paddingBottom: 24 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
            🏭 Proveedores y CxP
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
            Módulo financiero · Cuentas por pagar
          </div>
        </div>
        {!["listaProveedores"].includes(subVista) && (
          <button
            onClick={() => { setSubVista("listaProveedores"); setExitoPago(null); }}
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}>
            ← Proveedores
          </button>
        )}
      </div>

      <div style={{ padding: "20px 24px" }}>

        {/* ════ LISTA DE PROVEEDORES ════ */}
        {subVista === "listaProveedores" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <input
                type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar proveedor..."
                style={{ flex: 1, minWidth: 200, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}
              />
              <button
                onClick={abrirNuevoProveedor}
                style={{ padding: "9px 20px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                + Nuevo proveedor
              </button>
              <button
                onClick={() => { cargarCuentasPagar(); setSubVista("listaCxP"); }}
                style={{ padding: "9px 20px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                Ver todas las CxP
              </button>
            </div>

            {error && <div style={{ color: "#ef4444", marginBottom: 12 }}>⚠ {error}</div>}

            {cargando ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando...</div>
            ) : provsFiltrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                Sin proveedores. Agrega el primero.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Nombre comercial", "RTN/DNI", "Teléfono", "Contacto", "Acciones"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {provsFiltrados.map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>{p.nombre_comercial}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{p.rtn_dni ?? "—"}</td>
                        <td style={{ padding: "10px 12px" }}>{p.telefono ?? "—"}</td>
                        <td style={{ padding: "10px 12px" }}>{p.contacto ?? "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={() => abrirEditarProveedor(p)}
                              style={{ padding: "5px 10px", background: "#0f766e15", color: "#0f766e", border: "1px solid #0f766e40", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                              Editar
                            </button>
                            <button onClick={() => abrirNuevaCxP(p)}
                              style={{ padding: "5px 10px", background: "#f59e0b15", color: "#92400e", border: "1px solid #f59e0b40", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                              + CxP
                            </button>
                            <button onClick={() => { setProvSlc(p); cargarCuentasPagar(p.id); setSubVista("listaCxP"); }}
                              style={{ padding: "5px 10px", background: "#3b82f615", color: "#1e40af", border: "1px solid #3b82f640", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                              Ver CxP
                            </button>
                            <button onClick={() => desactivar(p)}
                              style={{ padding: "5px 10px", background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                              Desactivar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ════ FORM PROVEEDOR ════ */}
        {subVista === "formProveedor" && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>
              {editProv ? "Editar proveedor" : "Nuevo proveedor"}
            </div>
            {errProv && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", marginBottom: 14 }}>⚠ {errProv}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Nombre comercial *", val: fNombre, set: setFNombre, full: true },
                { label: "RTN / DNI",          val: fRtn,    set: setFRtn },
                { label: "Teléfono",           val: fTel,    set: setFTel },
                { label: "Email",              val: fEmail,  set: setFEmail },
                { label: "Dirección",          val: fDir,    set: setFDir, full: true },
                { label: "Contacto",           val: fContacto, set: setFContacto },
                { label: "Observaciones",      val: fObs,    set: setFObs, full: true },
              ].map((f) => (
                <div key={f.label} style={f.full ? { gridColumn: "1 / -1" } : {}}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type="text" value={f.val} onChange={(e) => f.set(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={() => setSubVista("listaProveedores")}
                style={{ flex: 1, padding: "11px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={guardarProveedor} disabled={guardandoProv}
                style={{ flex: 2, padding: "11px", background: guardandoProv ? "#9ca3af" : "#0f766e", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: guardandoProv ? "not-allowed" : "pointer" }}>
                {guardandoProv ? "Guardando..." : "✓ Guardar"}
              </button>
            </div>
          </div>
        )}

        {/* ════ LISTA CxP ════ */}
        {subVista === "listaCxP" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {provSlc ? `CxP: ${provSlc.nombre_comercial}` : "Todas las CxP"}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  Saldo pendiente total:
                  <strong style={{ color: "#ef4444", marginLeft: 4 }}>
                    L {totalDeudaProv.toFixed(2)}
                  </strong>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {provSlc && (
                  <button
                    onClick={() => imprimirEstadoProveedor(provSlc, cuentasPagar)}
                    style={{ padding: "8px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                    🖨 Imprimir
                  </button>
                )}
                {provSlc && (
                  <button
                    onClick={() => abrirNuevaCxP(provSlc)}
                    style={{ padding: "8px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                    + Nueva CxP
                  </button>
                )}
              </div>
            </div>

            {error && <div style={{ color: "#ef4444", marginBottom: 12 }}>⚠ {error}</div>}

            {cargando ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando...</div>
            ) : cuentasPagar.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Sin cuentas por pagar.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Proveedor", "Doc.", "Concepto", "Emisión", "Vencimiento", "Total", "Pagado", "Saldo", "Estado", ""].map(h => (
                        <th key={h} style={{ padding: "9px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasPagar.map((c, i) => {
                      const prov = proveedores.find(p => p.id === c.proveedor_id);
                      return (
                        <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "9px 10px", fontWeight: 700 }}>{prov?.nombre_comercial ?? "—"}</td>
                          <td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{c.numero_documento ?? "—"}</td>
                          <td style={{ padding: "9px 10px" }}>{c.concepto}</td>
                          <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>{c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString("es-HN") : "—"}</td>
                          <td style={{ padding: "9px 10px", whiteSpace: "nowrap", color: c.estado === "vencido" ? "#dc2626" : undefined }}>
                            {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString("es-HN") : "—"}
                          </td>
                          <td style={{ padding: "9px 10px", fontWeight: 700 }}>L {Number(c.monto_total).toFixed(2)}</td>
                          <td style={{ padding: "9px 10px", color: "#16a34a" }}>L {Number(c.total_pagado).toFixed(2)}</td>
                          <td style={{ padding: "9px 10px", fontWeight: 700, color: Number(c.saldo_pendiente) > 0 ? "#ef4444" : "#16a34a" }}>
                            L {Number(c.saldo_pendiente).toFixed(2)}
                          </td>
                          <td style={{ padding: "9px 10px" }}>{estadoBadge(c.estado)}</td>
                          <td style={{ padding: "9px 10px" }}>
                            {c.estado !== "pagado" && prov && (
                              <button onClick={() => abrirPago(c, prov)}
                                style={{ padding: "5px 10px", background: "#16a34a15", color: "#16a34a", border: "1px solid #16a34a40", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                                Registrar pago
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ════ FORM CxP ════ */}
        {subVista === "formCxP" && provSlc && (
          <div style={{ maxWidth: 540 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Nueva Cuenta por Pagar</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Proveedor: {provSlc.nombre_comercial}</div>
            {errCxP && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#dc2626", marginBottom: 14 }}>⚠ {errCxP}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Concepto *", val: fConcepto, set: setFConcepto },
                { label: "Número de documento / Factura",  val: fNumDoc,    set: setFNumDoc },
                { label: "Monto total (L) *", val: fMonto, set: setFMonto, type: "number" },
                { label: "Fecha de emisión",  val: fFechaEmision, set: setFFechaEmision, type: "date" },
                { label: "Fecha de vencimiento", val: fFechaVcto, set: setFFechaVcto, type: "date" },
                { label: "Observaciones", val: fObsCxP, set: setFObsCxP },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type ?? "text"} value={f.val} onChange={(e) => f.set(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <button onClick={() => setSubVista("listaProveedores")}
                  style={{ flex: 1, padding: "11px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={guardarCxP} disabled={guardandoCxP}
                  style={{ flex: 2, padding: "11px", background: guardandoCxP ? "#9ca3af" : "#0f766e", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: guardandoCxP ? "not-allowed" : "pointer" }}>
                  {guardandoCxP ? "Guardando..." : "✓ Registrar deuda"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════ PAGO CxP ════ */}
        {subVista === "pagoCxP" && cxpSlc && provSlc && (
          <div style={{ maxWidth: 500 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Registrar pago a proveedor</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              {provSlc.nombre_comercial} · {cxpSlc.concepto}
              <strong style={{ color: "#ef4444", marginLeft: 6 }}>
                Saldo: L {Number(cxpSlc.saldo_pendiente).toFixed(2)}
              </strong>
            </div>

            {exitoPago && (
              <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", color: "#14532d", fontWeight: 600, marginBottom: 14 }}>
                ✅ {exitoPago}
              </div>
            )}
            {errPago && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 14 }}>
                ⚠ {errPago}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Método de pago</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TIPO_PAGO_PROV.map(t => (
                    <button key={t.value} onClick={() => setTipoPago(t.value)}
                      style={{ padding: "8px 14px", border: `2px solid ${tipoPago === t.value ? "#0f766e" : "#e2e8f0"}`, borderRadius: 8,
                        background: tipoPago === t.value ? "#0f766e15" : "#fff", color: "#0f172a", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Monto a pagar (L) *</label>
                <input type="number" value={montoPago} onChange={(e) => setMontoPago(e.target.value)}
                  placeholder="0.00" step={0.01} max={cxpSlc.saldo_pendiente} autoFocus
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 16, fontWeight: 700, boxSizing: "border-box" }} />
                <button onClick={() => setMontoPago(Number(cxpSlc.saldo_pendiente).toFixed(2))}
                  style={{ marginTop: 6, padding: "5px 12px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                  Total: L {Number(cxpSlc.saldo_pendiente).toFixed(2)}
                </button>
              </div>

              {(tipoPago === "tarjeta" || tipoPago === "transferencia" || tipoPago === "cheque") && (
                <div style={{ display: "flex", gap: 10 }}>
                  <input type="text" value={bancoPago} onChange={(e) => setBancoPago(e.target.value)}
                    placeholder="Banco" style={{ flex: 1, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />
                  <input type="text" value={refPago} onChange={(e) => setRefPago(e.target.value)}
                    placeholder="Referencia / Nº cheque" style={{ flex: 1, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />
                </div>
              )}

              <input type="text" value={obsPago} onChange={(e) => setObsPago(e.target.value)}
                placeholder="Observación opcional"
                style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />

              <button onClick={confirmarPago} disabled={procesandoPago || !montoPago}
                style={{ padding: "13px 0", background: procesandoPago ? "#9ca3af" : "linear-gradient(135deg, #0f766e, #0d9488)",
                  color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16,
                  cursor: procesandoPago ? "not-allowed" : "pointer" }}>
                {procesandoPago ? "Registrando..." : `✓ Pagar L ${parseFloat(montoPago || "0").toFixed(2)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
