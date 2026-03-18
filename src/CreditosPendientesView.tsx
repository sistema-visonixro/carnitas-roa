// ============================================================
// CreditosPendientesView.tsx
// Vista del panel de administración para gestión de créditos.
// Incluye: lista de deudas, estado de cuenta, registrar pagos
// e impresión de estados de cuenta.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import type {
  CreditoResumen,
  FacturaCredito,
  PagoCredito,
  TipoPagoCredito,
} from "./types/creditos";
import {
  obtenerResumenCreditos,
  obtenerFacturasCliente,
  obtenerPagosCliente,
  registrarPagoCredito,
} from "./services/creditoService";
import { useDatosNegocio } from "./useDatosNegocio";

type SubVista = "lista" | "estadoCuenta" | "pago";

const TIPOS_PAGO: { value: TipoPagoCredito; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "dolares", label: "Dólares" },
];

function estadoBadge(estado: string) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
    parcial: { bg: "#dbeafe", color: "#1e40af", label: "Parcial" },
    pagado: { bg: "#dcfce7", color: "#14532d", label: "Pagado" },
    vencido: { bg: "#fee2e2", color: "#b91c1c", label: "Vencido" },
    activo: { bg: "#dcfce7", color: "#14532d", label: "Activo" },
    cancelado: { bg: "#f1f5f9", color: "#475569", label: "Cancelado" },
  };
  const c = cfg[estado] ?? cfg.pendiente;
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {c.label}
    </span>
  );
}

interface Props {
  onBack?: () => void;
}

export default function CreditosPendientesView({ onBack: _onBack }: Props) {
  const { datos: negocio } = useDatosNegocio();
  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") ?? "{}");
    } catch {
      return {};
    }
  })();

  const [subVista, setSubVista] = useState<SubVista>("lista");
  const [resumen, setResumen] = useState<CreditoResumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [clienteActivo, setClienteActivo] = useState<CreditoResumen | null>(
    null,
  );

  // Estado de cuenta
  const [facturas, setFacturas] = useState<FacturaCredito[]>([]);
  const [pagos, setPagos] = useState<PagoCredito[]>([]);
  const [cargandoDet, setCargandoDet] = useState(false);

  // Registrar pago
  const [montoPago, setMontoPago] = useState("");
  const [tipoPago, setTipoPago] = useState<TipoPagoCredito>("efectivo");
  const [refPago, setRefPago] = useState("");
  const [bancoPago, setBancoPago] = useState("");
  const [obsPago, setObsPago] = useState("");
  const [facturaPago, setFacturaPago] = useState<string | null>(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [errPago, setErrPago] = useState<string | null>(null);

  // ──── Carga inicial ────────────────────────────────────────
  const cargarResumen = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerResumenCreditos();
      setResumen(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  async function verEstadoCuenta(item: CreditoResumen) {
    setClienteActivo(item);
    setCargandoDet(true);
    setError(null);
    setExito(null);
    try {
      const [facs, pags] = await Promise.all([
        obtenerFacturasCliente(item.cliente_id),
        obtenerPagosCliente(item.cliente_id),
      ]);
      setFacturas(facs);
      setPagos(pags);
      setSubVista("estadoCuenta");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargandoDet(false);
    }
  }

  function irAPago(item: CreditoResumen) {
    setClienteActivo(item);
    setMontoPago("");
    setTipoPago("efectivo");
    setRefPago("");
    setBancoPago("");
    setObsPago("");
    setFacturaPago(null);
    setErrPago(null);
    setExito(null);
    setSubVista("pago");
  }

  async function confirmarPago() {
    if (!clienteActivo) return;
    const montoN = parseFloat(montoPago.replace(",", "."));
    if (!montoN || montoN <= 0) {
      setErrPago("Monto inválido.");
      return;
    }
    if (montoN > clienteActivo.saldo_actual) {
      setErrPago(
        `El monto supera el saldo (L ${clienteActivo.saldo_actual.toFixed(2)}).`,
      );
      return;
    }
    setProcesandoPago(true);
    setErrPago(null);
    try {
      const result = await registrarPagoCredito({
        cliente_id: clienteActivo.cliente_id,
        monto: montoN,
        tipo_pago: tipoPago,
        cajero_id: usuario.id ?? "",
        cajero: usuario.nombre ?? "",
        factura_credito_id: facturaPago ?? undefined,
        referencia: refPago || undefined,
        banco: bancoPago || undefined,
        observacion: obsPago || undefined,
      });
      if (!result.ok) throw new Error(result.error);
      setExito(
        `Pago registrado. Saldo anterior: L ${result.saldo_antes?.toFixed(2)} → Nuevo saldo: L ${result.saldo_despues?.toFixed(2)}`,
      );
      await cargarResumen();
      const clienteActualizado = resumen.find(
        (r) => r.cliente_id === clienteActivo.cliente_id,
      );
      if (clienteActualizado) setClienteActivo(clienteActualizado);
    } catch (e: any) {
      setErrPago(e.message);
    } finally {
      setProcesandoPago(false);
    }
  }

  function imprimirEstadoCuenta() {
    if (!clienteActivo) return;

    // Unificar movimientos cronológicos
    const movs: {
      fecha: string;
      concepto: string;
      cargo: number;
      abono: number;
    }[] = [
      ...facturas.map((f) => ({
        fecha: f.fecha_hora,
        concepto: `Factura #${f.factura_numero}`,
        cargo: f.total,
        abono: 0,
      })),
      ...pagos.map((p) => ({
        fecha: p.fecha_hora,
        concepto: `Pago (${p.tipo_pago})`,
        cargo: 0,
        abono: p.monto,
      })),
    ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    let saldoCorr = 0;
    const filas = movs
      .map((m) => {
        saldoCorr += m.cargo - m.abono;
        return `<tr>
        <td>${new Date(m.fecha).toLocaleDateString("es-HN")}</td>
        <td>${m.concepto}</td>
        <td style="text-align:right">${m.cargo ? "L " + m.cargo.toFixed(2) : ""}</td>
        <td style="text-align:right">${m.abono ? "L " + m.abono.toFixed(2) : ""}</td>
        <td style="text-align:right;font-weight:700">L ${saldoCorr.toFixed(2)}</td>
      </tr>`;
      })
      .join("");

    const html = `<html><head><title>Estado de Cuenta</title>
      <style>
        body { font-family: Arial, sans-serif; font-size:11px; margin:0; padding:16px; }
        h1 { font-size:16px; margin:4px 0; } h2 { font-size:13px; margin:4px 0; }
        table { width:100%; border-collapse:collapse; margin-top:12px; }
        th { background:#f0f0f0; padding:5px 8px; text-align:left; border:1px solid #ddd; }
        td { padding:5px 8px; border:1px solid #ddd; }
        .center { text-align:center; } .header { margin-bottom:14px; }
        .saldo { font-size:18px; font-weight:900; color:#dc2626; margin-top:8px; }
      </style></head><body>
      <div class="header">
        <h1 class="center">${negocio?.nombre_negocio ?? "SISTEMA POS"}</h1>
        ${negocio?.rtn ? `<div class="center">RTN: ${negocio.rtn}</div>` : ""}
        <div class="center">${negocio?.direccion ?? ""}</div>
        <div class="center">${negocio?.celular ?? ""}</div>
      </div>
      <hr />
      <h2>ESTADO DE CUENTA</h2>
      <div><strong>Cliente:</strong> ${clienteActivo.cliente_nombre}</div>
      <div><strong>DNI:</strong> ${clienteActivo.dni}</div>
      ${clienteActivo.telefono ? `<div><strong>Tel:</strong> ${clienteActivo.telefono}</div>` : ""}
      <div><strong>Fecha:</strong> ${new Date().toLocaleString("es-HN")}</div>
      <div class="saldo">Saldo Pendiente: L ${clienteActivo.saldo_actual.toFixed(2)}</div>
      <table>
        <thead>
          <tr>
            <th>Fecha</th><th>Concepto</th>
            <th>Cargo</th><th>Abono</th><th>Saldo</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div style="margin-top:16px;font-size:10px;text-align:center">
        Generado: ${new Date().toLocaleString("es-HN")}
      </div>
      </body></html>`;

    const w = window.open("", "", "height=700,width=900");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onload = () => {
        setTimeout(() => {
          w.focus();
          w.print();
          w.close();
        }, 400);
      };
    }
  }

  // ──── Filtro de búsqueda ────────────────────────────────────
  const resumenFiltrado = resumen.filter(
    (r) =>
      r.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.dni.includes(busqueda),
  );

  // ──── Totales ────────────────────────────────────────────────
  const totalDeuda = resumen.reduce((s, r) => s + r.saldo_actual, 0);

  return (
    <div
      style={{
        padding: "0 0 24px",
        fontFamily: "Inter, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
          padding: "20px 24px",
          borderRadius: "0 0 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
            💳 Créditos Pendientes
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.8)",
              marginTop: 2,
            }}
          >
            Cuentas por cobrar · Gestión de créditos
          </div>
        </div>
        {subVista !== "lista" && (
          <button
            onClick={() => {
              setSubVista("lista");
              setClienteActivo(null);
              setExito(null);
            }}
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Lista
          </button>
        )}
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* ════════════════════════════════════════ SUB-VISTA: LISTA */}
        {subVista === "lista" && (
          <>
            {/* Tarjeta resumen */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Total adeudado",
                  value: `L ${totalDeuda.toFixed(2)}`,
                  color: "#ef4444",
                },
                {
                  label: "Clientes activos",
                  value: String(resumen.length),
                  color: "#7c3aed",
                },
                {
                  label: "Con deuda",
                  value: String(
                    resumen.filter((r) => r.saldo_actual > 0).length,
                  ),
                  color: "#f59e0b",
                },
                {
                  label: "Vencidos",
                  value: String(
                    resumen.reduce((s, r) => s + r.facturas_vencidas, 0),
                  ),
                  color: "#dc2626",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "14px 20px",
                    minWidth: 140,
                    flex: "1 0 130px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {c.label}
                  </div>
                  <div
                    style={{ fontSize: 20, fontWeight: 900, color: c.color }}
                  >
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Buscador */}
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o DNI..."
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                fontSize: 14,
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />

            {error && (
              <div style={{ color: "#ef4444", marginBottom: 12 }}>
                ⚠ {error}
              </div>
            )}

            {cargando ? (
              <div
                style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}
              >
                Cargando créditos...
              </div>
            ) : resumenFiltrado.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}
              >
                No hay clientes de crédito registrados.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {[
                        "Cliente",
                        "DNI",
                        "Teléfono",
                        "Saldo",
                        "Facturas pend.",
                        "Última compra",
                        "Estado",
                        "Acciones",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            borderBottom: "2px solid #e2e8f0",
                            fontWeight: 700,
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumenFiltrado.map((r, i) => (
                      <tr
                        key={r.cliente_id}
                        style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                      >
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                          {r.cliente_nombre}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontFamily: "monospace",
                          }}
                        >
                          {r.dni}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {r.telefono ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 12px",
                            fontWeight: 700,
                            color: r.saldo_actual > 0 ? "#ef4444" : "#16a34a",
                          }}
                        >
                          L {r.saldo_actual.toFixed(2)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          {r.facturas_pendientes > 0 ? (
                            <span
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                                borderRadius: 99,
                                padding: "2px 8px",
                                fontWeight: 700,
                              }}
                            >
                              {r.facturas_pendientes}
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td
                          style={{ padding: "10px 12px", whiteSpace: "nowrap" }}
                        >
                          {r.ultima_compra
                            ? new Date(r.ultima_compra).toLocaleDateString(
                                "es-HN",
                              )
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {r.facturas_vencidas > 0
                            ? estadoBadge("vencido")
                            : r.saldo_actual > 0
                              ? estadoBadge("pendiente")
                              : estadoBadge("pagado")}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => verEstadoCuenta(r)}
                              style={{
                                padding: "5px 10px",
                                background: "#7c3aed15",
                                color: "#7c3aed",
                                border: "1px solid #7c3aed40",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              Ver cuenta
                            </button>
                            {r.saldo_actual > 0 && (
                              <button
                                onClick={() => irAPago(r)}
                                style={{
                                  padding: "5px 10px",
                                  background: "#16a34a15",
                                  color: "#16a34a",
                                  border: "1px solid #16a34a40",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontWeight: 600,
                                  fontSize: 12,
                                }}
                              >
                                Registrar pago
                              </button>
                            )}
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

        {/* ════════════════════════════════════════ SUB-VISTA: ESTADO DE CUENTA */}
        {subVista === "estadoCuenta" && clienteActivo && (
          <>
            {/* Encabezado cliente */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 20,
                background: "#f8fafc",
                borderRadius: 14,
                padding: "16px 20px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {clienteActivo.cliente_nombre}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  DNI: {clienteActivo.dni}
                  {clienteActivo.telefono &&
                    ` · Tel: ${clienteActivo.telefono}`}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Saldo pendiente
                </div>
                <div
                  style={{ fontSize: 28, fontWeight: 900, color: "#ef4444" }}
                >
                  L {clienteActivo.saldo_actual.toFixed(2)}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={imprimirEstadoCuenta}
                    style={{
                      padding: "6px 12px",
                      background: "#7c3aed",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    🖨 Imprimir
                  </button>
                  {clienteActivo.saldo_actual > 0 && (
                    <button
                      onClick={() => irAPago(clienteActivo)}
                      style={{
                        padding: "6px 12px",
                        background: "#16a34a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      💰 Registrar pago
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Resumen financiero */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Total facturado",
                  value: `L ${clienteActivo.total_facturado.toFixed(2)}`,
                  color: "#ef4444",
                },
                {
                  label: "Total pagado",
                  value: `L ${clienteActivo.total_pagado.toFixed(2)}`,
                  color: "#16a34a",
                },
                {
                  label: "Saldo actual",
                  value: `L ${clienteActivo.saldo_actual.toFixed(2)}`,
                  color: "#7c3aed",
                },
              ].map((c) => (
                <div
                  key={c.label}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    flex: "1 0 120px",
                  }}
                >
                  <div
                    style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}
                  >
                    {c.label}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: c.color,
                      marginTop: 2,
                    }}
                  >
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            {cargandoDet ? (
              <div
                style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}
              >
                Cargando...
              </div>
            ) : (
              <>
                {/* Facturas */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 10,
                    color: "#475569",
                  }}
                >
                  Facturas ({facturas.length})
                </div>
                {facturas.length === 0 ? (
                  <p style={{ color: "#94a3b8" }}>Sin facturas registradas.</p>
                ) : (
                  <div style={{ overflowX: "auto", marginBottom: 24 }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {[
                            "Factura",
                            "Fecha",
                            "Total",
                            "Saldo ant.",
                            "Nuevo saldo",
                            "Estado",
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "8px 10px",
                                textAlign: "left",
                                borderBottom: "1px solid #e2e8f0",
                                color: "#64748b",
                                fontWeight: 700,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {facturas.map((f, i) => (
                          <tr
                            key={f.id}
                            style={{
                              background: i % 2 === 0 ? "#fff" : "#fafafa",
                            }}
                          >
                            <td
                              style={{ padding: "8px 10px", fontWeight: 700 }}
                            >
                              #{f.factura_numero}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {new Date(f.fecha_hora).toLocaleDateString(
                                "es-HN",
                              )}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                fontWeight: 700,
                                color: "#ef4444",
                              }}
                            >
                              L {f.total.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              L {f.saldo_anterior.toFixed(2)}
                            </td>
                            <td
                              style={{ padding: "8px 10px", fontWeight: 700 }}
                            >
                              L {f.nuevo_saldo.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {estadoBadge(f.estado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagos */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 10,
                    color: "#475569",
                  }}
                >
                  Historial de pagos ({pagos.length})
                </div>
                {pagos.length === 0 ? (
                  <p style={{ color: "#94a3b8" }}>Sin pagos registrados.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {[
                            "Fecha",
                            "Monto",
                            "Tipo",
                            "Saldo ant.",
                            "Saldo nuevo",
                            "Cajero",
                            "Obs.",
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "8px 10px",
                                textAlign: "left",
                                borderBottom: "1px solid #e2e8f0",
                                color: "#64748b",
                                fontWeight: 700,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pagos.map((p, i) => (
                          <tr
                            key={p.id}
                            style={{
                              background: i % 2 === 0 ? "#fff" : "#fafafa",
                            }}
                          >
                            <td style={{ padding: "8px 10px" }}>
                              {new Date(p.fecha_hora).toLocaleString("es-HN")}
                            </td>
                            <td
                              style={{
                                padding: "8px 10px",
                                fontWeight: 700,
                                color: "#16a34a",
                              }}
                            >
                              L {p.monto.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {p.tipo_pago}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              L {p.saldo_antes.toFixed(2)}
                            </td>
                            <td
                              style={{ padding: "8px 10px", fontWeight: 700 }}
                            >
                              L {p.saldo_despues.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {p.cajero ?? "—"}
                            </td>
                            <td
                              style={{ padding: "8px 10px", color: "#64748b" }}
                            >
                              {p.observacion ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════ SUB-VISTA: REGISTRAR PAGO */}
        {subVista === "pago" && clienteActivo && (
          <div style={{ maxWidth: 540 }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
              Registrar pago — {clienteActivo.cliente_nombre}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              Saldo pendiente:{" "}
              <strong style={{ color: "#ef4444" }}>
                L {clienteActivo.saldo_actual.toFixed(2)}
              </strong>
            </div>

            {exito && (
              <div
                style={{
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#14532d",
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                ✅ {exito}
              </div>
            )}
            {errPago && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#dc2626",
                  marginBottom: 16,
                }}
              >
                ⚠ {errPago}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Factura específica */}
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Abonar a (opcional)
                </label>
                <select
                  value={facturaPago ?? ""}
                  onChange={(e) => setFacturaPago(e.target.value || null)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <option value="">Abono general al saldo</option>
                  {facturas
                    .filter((f) => f.estado !== "pagado")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        Factura #{f.factura_numero} — L {f.total.toFixed(2)} (
                        {f.estado})
                      </option>
                    ))}
                </select>
              </div>

              {/* Método de pago */}
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Método de pago
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TIPOS_PAGO.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTipoPago(t.value)}
                      style={{
                        padding: "8px 14px",
                        border: `2px solid ${tipoPago === t.value ? "#7c3aed" : "#e2e8f0"}`,
                        borderRadius: 8,
                        background: tipoPago === t.value ? "#7c3aed15" : "#fff",
                        color: "#0f172a",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monto */}
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Monto a cobrar (L) *
                </label>
                <input
                  type="number"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  placeholder="0.00"
                  step={0.01}
                  max={clienteActivo.saldo_actual}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
                <button
                  onClick={() =>
                    setMontoPago(clienteActivo.saldo_actual.toFixed(2))
                  }
                  style={{
                    marginTop: 6,
                    padding: "5px 12px",
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Total: L {clienteActivo.saldo_actual.toFixed(2)}
                </button>
              </div>

              {/* Banco / Referencia */}
              {(tipoPago === "tarjeta" || tipoPago === "transferencia") && (
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    value={bancoPago}
                    onChange={(e) => setBancoPago(e.target.value)}
                    placeholder="Banco"
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <input
                    type="text"
                    value={refPago}
                    onChange={(e) => setRefPago(e.target.value)}
                    placeholder="Referencia"
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                </div>
              )}

              {/* Fecha + observación */}
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Observación
                </label>
                <input
                  type="text"
                  value={obsPago}
                  onChange={(e) => setObsPago(e.target.value)}
                  placeholder="Notas opcionales..."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                onClick={confirmarPago}
                disabled={procesandoPago || !montoPago}
                style={{
                  padding: "13px 0",
                  background: procesandoPago
                    ? "#9ca3af"
                    : "linear-gradient(135deg, #16a34a, #14532d)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: procesandoPago ? "not-allowed" : "pointer",
                }}
              >
                {procesandoPago
                  ? "Registrando..."
                  : `✓ Confirmar pago L ${parseFloat(montoPago || "0").toFixed(2)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
