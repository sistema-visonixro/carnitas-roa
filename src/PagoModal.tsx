import { useState, useEffect, useRef } from "react";
import ZoomWrapper from "./ZoomWrapper";

type PagoItem = {
  id: string;
  tipo: "efectivo" | "tarjeta" | "transferencia" | "dolares";
  monto: number;
  usd_monto?: number;
  banco?: string;
  tarjeta?: string;
  factura?: string;
  autorizador?: string;
  referencia?: string;
};

type PaymentPayload = {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  totalPaid: number;
  tipoPagoString: string;
  pagos?: PagoItem[];
};

export default function PaymentModal({
  isOpen,
  onClose,
  totalPedido,
  onPagoConfirmado,
  exchangeRate = 25.0,
  theme = "lite",
}: {
  isOpen: boolean;
  onClose: () => void;
  totalPedido: number;
  onPagoConfirmado?: (p: PaymentPayload) => void;
  exchangeRate?: number;
  theme?: "lite" | "dark";
}) {
  const [pagos, setPagos] = useState<PagoItem[]>([]);
  const [tipo, setTipo] = useState<
    "efectivo" | "tarjeta" | "transferencia" | "dolares"
  >("efectivo");
  const [monto, setMonto] = useState<string>("");
  const [banco, setBanco] = useState<string>("");
  const [tarjeta, setTarjeta] = useState<string>("");
  const [factura, setFactura] = useState<string>("");
  const [autorizador, setAutorizador] = useState<string>("");
  const [referencia, setReferencia] = useState<string>("");
  const [usdAmount, setUsdAmount] = useState<number>(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingGenerating, setLoadingGenerating] = useState<boolean>(false);
  const montoInputRef = useRef<HTMLInputElement>(null);
  /**
   * Guard sincrónico contra doble-click: useRef porque su valor
   * no depende del ciclo de render de React (a diferencia de useState).
   * Se activa en el PRIMER click y se libera en el finally.
   */
  const isConfirmingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // limpiar formulario y lista al cerrar
      setPagos([]);
      setTipo("efectivo");
      setMonto("");
      setBanco("");
      setTarjeta("");
      setFactura("");
      setAutorizador("");
      setReferencia("");
      setConfirmDeleteId(null);
      setLoadingGenerating(false);
      // Liberar guard por si el modal se cierra externamente durante una operación
      isConfirmingRef.current = false;
    } else {
      // Auto-focus en el input de monto cuando se abre el modal
      setTimeout(() => {
        montoInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const parseNumber = (v: any) => {
    try {
      const s = String(v ?? "")
        .replace(",", ".")
        .trim();
      if (s === "" || s === "-") return 0;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  };

  const agregarPago = () => {
    const montoN = parseNumber(monto);
    if (montoN <= 0) return;
    const nuevo: PagoItem = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
      tipo,
      monto: Number(montoN.toFixed(2)),
      usd_monto:
        tipo === "dolares" ? Number((usdAmount || 0).toFixed(2)) : undefined,
      banco: banco || undefined,
      tarjeta: tarjeta || undefined,
      factura: factura || undefined,
      autorizador: autorizador || undefined,
      referencia: referencia || undefined,
    };
    setPagos((prev) => [...prev, nuevo]);
    // reset del formulario parcial
    setMonto("");
    setUsdAmount(0);
    setBanco("");
    setTarjeta("");
    setFactura("");
    setAutorizador("");
    setReferencia("");
    // Volver a enfocar el input de monto
    setTimeout(() => {
      montoInputRef.current?.focus();
    }, 100);
  };

  const eliminarPago = (id: string) => {
    setPagos((prev) => prev.filter((p) => p.id !== id));
  };

  const efectivoSum = pagos
    .filter((p) => p.tipo === "efectivo")
    .reduce((s, p) => s + p.monto, 0);
  const tarjetaSum = pagos
    .filter((p) => p.tipo === "tarjeta")
    .reduce((s, p) => s + p.monto, 0);
  const transferenciaSum = pagos
    .filter((p) => p.tipo === "transferencia")
    .reduce((s, p) => s + p.monto, 0);
  const dolaresSum = pagos
    .filter((p) => p.tipo === "dolares")
    .reduce((s, p) => s + p.monto, 0);

  const totalPaid = Number(
    (efectivoSum + tarjetaSum + transferenciaSum + dolaresSum).toFixed(2),
  );
  const remaining = Number((totalPedido - totalPaid).toFixed(2));
  const canConfirm = totalPaid >= totalPedido && totalPaid > 0;

  const currency = (v: number) =>
    new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" })
      .format(v)
      .replace("HNL", "L");

  const handleConfirm = () => {
    // Guard sincrónico: si ya hay una confirmación en curso, ignorar click adicional
    if (isConfirmingRef.current || loadingGenerating) {
      console.warn(
        "[PagoModal] handleConfirm ignorado: ya hay una operación en curso.",
      );
      return;
    }
    isConfirmingRef.current = true;

    (async () => {
      const parts: string[] = [];
      if (efectivoSum > 0) parts.push(`efectivo:(${efectivoSum.toFixed(2)})`);
      if (tarjetaSum > 0) parts.push(`tarjeta:(${tarjetaSum.toFixed(2)})`);
      if (transferenciaSum > 0)
        parts.push(`transferencia:(${transferenciaSum.toFixed(2)})`);
      const tipoPagoString = parts.join(",");
      try {
        setLoadingGenerating(true);
        if (onPagoConfirmado) {
          await onPagoConfirmado({
            efectivo: efectivoSum,
            tarjeta: tarjetaSum,
            transferencia: transferenciaSum,
            totalPaid,
            tipoPagoString,
            pagos,
          });
        }
      } catch (e) {
        console.warn("Error en handleConfirm:", e);
      } finally {
        isConfirmingRef.current = false;
        try {
          setLoadingGenerating(false);
        } catch (_) {}
        try {
          onClose();
        } catch (_) {}
      }
    })();
  };

  if (!isOpen) return null;

  // Estilos comunes según el theme
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 6,
    borderRadius: 6,
    fontSize: 13,
    background: theme === "lite" ? "white" : "#1a1a1a",
    color: theme === "lite" ? "#111" : "#f5f5f5",
    border: theme === "lite" ? "1px solid #ddd" : "1px solid #555",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    color: theme === "lite" ? "#111" : "#f5f5f5",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 11000,
      }}
    >
      <ZoomWrapper>
        <div
          style={{
            width: 1100,
            maxWidth: "99%",
            background: theme === "lite" ? "white" : "#2a2a2a",
            borderRadius: 10,
            padding: 16,
            maxHeight: "94vh",
            overflow: "auto",
            color: theme === "lite" ? "#111" : "#f5f5f5",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: theme === "lite" ? "#111" : "#f5f5f5",
              }}
            >
              Registrar Pago
            </h3>
            <button
              onClick={onClose}
              className="btn-opaque"
              style={{
                border: theme === "lite" ? "1px solid #ddd" : "1px solid #555",
                color: theme === "lite" ? "#111" : "#f5f5f5",
                background: "transparent",
              }}
            >
              Cerrar
            </button>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "1fr 420px",
              gap: 14,
              fontSize: 13,
            }}
          >
            {/* Encabezado prominente con Total a pagar */}
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme === "lite" ? "#111" : "#f5f5f5",
                }}
              >
                Total a pagar:
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 900,
                  color: "#1976d2",
                  marginTop: 4,
                }}
              >
                {currency(totalPedido)}
              </div>
            </div>
            {/* izquierda: mini tabla de pagos y totales */}
            <div style={{ color: theme === "lite" ? "#111" : "#f5f5f5" }}>
              Pedido
              <div style={{ marginBottom: 8 }}>
                Total a pagar: <strong>{currency(totalPedido)}</strong>
              </div>
              <div
                style={{
                  border:
                    theme === "lite" ? "1px solid #e6edf3" : "1px solid #444",
                  borderRadius: 8,
                  padding: 6,
                  marginBottom: 12,
                  fontSize: 13,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        borderBottom:
                          theme === "lite"
                            ? "1px solid #efefef"
                            : "1px solid #555",
                      }}
                    >
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Detalles</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            padding: 12,
                            color: theme === "lite" ? "#666" : "#999",
                          }}
                        >
                          No hay pagos registrados
                        </td>
                      </tr>
                    )}
                    {pagos.map((p) => (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom:
                            theme === "lite"
                              ? "1px solid #f5f5f5"
                              : "1px solid #444",
                        }}
                      >
                        <td style={{ padding: "6px 4px" }}>{p.tipo}</td>
                        <td style={{ padding: "6px 4px" }}>
                          {currency(p.monto)}
                        </td>
                        <td style={{ padding: "6px 4px", fontSize: 12 }}>
                          {p.tipo === "efectivo" && <span>—</span>}
                          {p.tipo === "tarjeta" && (
                            <span>
                              {p.banco || "-"} / {p.tarjeta || "-"} /{" "}
                              {p.factura || "-"}
                            </span>
                          )}
                          {p.tipo === "transferencia" && (
                            <span>
                              {p.banco || "-"} / {p.referencia || "-"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 4px", textAlign: "right" }}>
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="btn-opaque"
                            aria-label="Eliminar pago"
                            title="Eliminar pago"
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 6,
                              cursor: "pointer",
                              color: "#ef4444",
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    padding: 6,
                    borderRadius: 6,
                    border:
                      theme === "lite" ? "1px solid #e6edf3" : "1px solid #444",
                    minWidth: 140,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: theme === "lite" ? "#666" : "#999",
                    }}
                  >
                    Efectivo
                  </div>
                  <div style={{ fontWeight: 600 }}>{currency(efectivoSum)}</div>
                </div>
                <div
                  style={{
                    padding: 6,
                    borderRadius: 6,
                    border:
                      theme === "lite" ? "1px solid #e6edf3" : "1px solid #444",
                    minWidth: 140,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: theme === "lite" ? "#666" : "#999",
                    }}
                  >
                    Tarjeta
                  </div>
                  <div style={{ fontWeight: 600 }}>{currency(tarjetaSum)}</div>
                </div>
                <div
                  style={{
                    padding: 6,
                    borderRadius: 6,
                    border:
                      theme === "lite" ? "1px solid #e6edf3" : "1px solid #444",
                    minWidth: 140,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: theme === "lite" ? "#666" : "#999",
                    }}
                  >
                    Transferencia
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {currency(transferenciaSum)}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: theme === "lite" ? "#666" : "#999",
                    }}
                  >
                    Total ingresado
                  </div>
                  <div style={{ fontWeight: 700 }}>{currency(totalPaid)}</div>
                  <div
                    style={{
                      marginTop: 6,
                      color: remaining > 0 ? "#ef4444" : "#16a34a",
                    }}
                  >
                    {remaining > 0
                      ? `Falta ${currency(remaining)}`
                      : `Cambio ${currency(Math.abs(remaining))}`}
                  </div>
                </div>
              </div>
            </div>

            {/* derecha: formulario para agregar pago */}
            <div
              style={{
                border:
                  theme === "lite" ? "1px solid #e6edf3" : "1px solid #444",
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Tipo de pago</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTipo("efectivo");
                      setMonto("");
                      setUsdAmount(0);
                      setBanco("");
                      setTarjeta("");
                      setFactura("");
                      setAutorizador("");
                      setReferencia("");
                      setTimeout(() => montoInputRef.current?.focus(), 100);
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border:
                        tipo === "efectivo"
                          ? "3px solid #1976d2"
                          : "2px solid #ddd",
                      background:
                        tipo === "efectivo"
                          ? "#e3f2fd"
                          : theme === "lite"
                            ? "#fff"
                            : "#2a2a2a",
                      color:
                        tipo === "efectivo"
                          ? "#1976d2"
                          : theme === "lite"
                            ? "#333"
                            : "#f5f5f5",
                      fontWeight: tipo === "efectivo" ? 700 : 600,
                      fontSize: 15,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipo("tarjeta");
                      setMonto("");
                      setUsdAmount(0);
                      setBanco("");
                      setTarjeta("");
                      setFactura("");
                      setAutorizador("");
                      setReferencia("");
                      setTimeout(() => montoInputRef.current?.focus(), 100);
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border:
                        tipo === "tarjeta"
                          ? "3px solid #1976d2"
                          : "2px solid #ddd",
                      background:
                        tipo === "tarjeta"
                          ? "#e3f2fd"
                          : theme === "lite"
                            ? "#fff"
                            : "#2a2a2a",
                      color:
                        tipo === "tarjeta"
                          ? "#1976d2"
                          : theme === "lite"
                            ? "#333"
                            : "#f5f5f5",
                      fontWeight: tipo === "tarjeta" ? 700 : 600,
                      fontSize: 15,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    💳 Tarjeta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipo("transferencia");
                      setMonto("");
                      setUsdAmount(0);
                      setBanco("");
                      setTarjeta("");
                      setFactura("");
                      setAutorizador("");
                      setReferencia("");
                      setTimeout(() => montoInputRef.current?.focus(), 100);
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border:
                        tipo === "transferencia"
                          ? "3px solid #1976d2"
                          : "2px solid #ddd",
                      background:
                        tipo === "transferencia"
                          ? "#e3f2fd"
                          : theme === "lite"
                            ? "#fff"
                            : "#2a2a2a",
                      color:
                        tipo === "transferencia"
                          ? "#1976d2"
                          : theme === "lite"
                            ? "#333"
                            : "#f5f5f5",
                      fontWeight: tipo === "transferencia" ? 700 : 600,
                      fontSize: 15,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    🏦 Transferencia
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipo("dolares");
                      setMonto("");
                      setUsdAmount(0);
                      setBanco("");
                      setTarjeta("");
                      setFactura("");
                      setAutorizador("");
                      setReferencia("");
                      setTimeout(() => montoInputRef.current?.focus(), 100);
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border:
                        tipo === "dolares"
                          ? "3px solid #1976d2"
                          : "2px solid #ddd",
                      background:
                        tipo === "dolares"
                          ? "#e3f2fd"
                          : theme === "lite"
                            ? "#fff"
                            : "#2a2a2a",
                      color:
                        tipo === "dolares"
                          ? "#1976d2"
                          : theme === "lite"
                            ? "#333"
                            : "#f5f5f5",
                      fontWeight: tipo === "dolares" ? 700 : 600,
                      fontSize: 15,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    💵 Dólares
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>Monto</label>
                {tipo === "dolares" ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>$</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={usdAmount}
                        onChange={(e) => {
                          const v = parseNumber(e.target.value);
                          setUsdAmount(v);
                          const converted = Number(
                            (v * exchangeRate).toFixed(2),
                          );
                          setMonto(String(converted));
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            usdAmount > 0 &&
                            parseNumber(monto) > 0
                          ) {
                            e.preventDefault();
                            agregarPago();
                          }
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>L (convertido)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={monto}
                        readOnly
                        style={{
                          width: "100%",
                          padding: 6,
                          borderRadius: 6,
                          fontSize: 13,
                          background: theme === "lite" ? "#f9fafb" : "#1a1a1a",
                          color: theme === "lite" ? "#111" : "#f5f5f5",
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    ref={montoInputRef}
                    type="number"
                    min={0}
                    step="0.01"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const montoN = parseNumber(monto);
                        if (montoN <= 0) return;
                        agregarPago();
                      }
                    }}
                    style={inputStyle}
                  />
                )}
              </div>

              {tipo === "dolares" && (
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle}>
                    Tipo de cambio (Lps : {exchangeRate.toFixed(2)} por $)
                  </label>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  ></div>
                </div>
              )}

              {tipo === "efectivo" && (
                <div
                  style={{
                    fontSize: 13,
                    color: theme === "lite" ? "#444" : "#aaa",
                    marginBottom: 8,
                  }}
                >
                  Pago en efectivo: solo indique el monto y presione "Agregar".
                </div>
              )}

              {tipo === "tarjeta" && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Banco</label>
                    <select
                      value={banco}
                      onChange={(e) => setBanco(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- Seleccionar banco --</option>
                      <option value="BAC Honduras">BAC Honduras </option>
                      <option value="Banco Atlántida">Banco Atlántida</option>
                      <option value="Banco de Occidente">
                        Banco de Occidente{" "}
                      </option>
                      <option value="Banco Ficohsa">Banco Ficohsa</option>
                      <option value="Banco Banpaís">Banco Banpaís </option>
                      <option value="Banco Davivienda">
                        Banco Davivienda{" "}
                      </option>
                      <option value="Banco Promérica">Banco Promérica</option>
                      <option value="Banco Lafise">Banco Lafise</option>
                      <option value="Banco Ficensa">Banco Ficensa</option>
                      <option value="Banco de los Trabajadores">
                        Banco de los Trabajadores{" "}
                      </option>
                      <option value="Banco Azteca">Banco Azteca</option>
                      <option value="Banrural Honduras">
                        Banrural Honduras
                      </option>
                      <option value="Banco Hondureño del Café">
                        Banco Hondureño del Café
                      </option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Tarjeta (últimos 4)</label>
                    <input
                      value={tarjeta}
                      onChange={(e) => setTarjeta(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Factura</label>
                      <input
                        value={factura}
                        onChange={(e) => setFactura(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Autorizador</label>
                      <input
                        value={autorizador}
                        onChange={(e) => setAutorizador(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            parseNumber(monto) > 0 &&
                            banco &&
                            tarjeta &&
                            autorizador
                          ) {
                            agregarPago();
                          }
                        }}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </>
              )}

              {tipo === "transferencia" && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Banco</label>
                    <select
                      value={banco}
                      onChange={(e) => setBanco(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">-- Seleccionar banco --</option>
                      <option value="BAC Honduras">
                        BAC Honduras — (Banco de América Central Honduras)
                      </option>
                      <option value="Banco Atlántida">Banco Atlántida</option>
                      <option value="Banco de Occidente">
                        Banco de Occidente — Banocc
                      </option>
                      <option value="Banco Ficohsa">Banco Ficohsa</option>
                      <option value="Banco Banpaís">
                        Banco Banpaís — (Banco del País)
                      </option>
                      <option value="Banco Davivienda">
                        Banco Davivienda — Davi
                      </option>
                      <option value="Banco Promérica">Banco Promérica</option>
                      <option value="Banco Lafise">Banco Lafise</option>
                      <option value="Banco Ficensa">Banco Ficensa</option>
                      <option value="Banco de los Trabajadores">
                        Banco de los Trabajadores — BanTrab
                      </option>
                      <option value="Banco Azteca">Banco Azteca</option>
                      <option value="Banrural Honduras">
                        Banrural Honduras
                      </option>
                      <option value="Banco Hondureño del Café">
                        Banco Hondureño del Café
                      </option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Referencia</label>
                    <input
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          parseNumber(monto) > 0 &&
                          banco &&
                          referencia
                        ) {
                          agregarPago();
                        }
                      }}
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={agregarPago}
                  className="btn-opaque"
                  style={{
                    background: "#0ea5a4",
                    color: "white",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  Agregar
                </button>
                <button
                  onClick={() => {
                    setMonto(String((totalPedido - totalPaid).toFixed(2)));
                  }}
                  className="btn-opaque"
                  style={{
                    background: "transparent",
                    fontSize: 13,
                    border:
                      theme === "lite" ? "1px solid #ddd" : "1px solid #555",
                    color: theme === "lite" ? "#111" : "#f5f5f5",
                  }}
                >
                  Exacto
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 14,
            }}
          >
            <button
              onClick={onClose}
              className="btn-opaque"
              style={{
                background: "transparent",
                fontSize: 13,
                padding: "6px 10px",
                border: theme === "lite" ? "1px solid #ddd" : "1px solid #555",
                color: theme === "lite" ? "#111" : "#f5f5f5",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="btn-opaque"
              disabled={!canConfirm || loadingGenerating}
              style={{
                background:
                  canConfirm && !loadingGenerating ? "#16a34a" : "gray",
                color: "white",
                fontSize: 13,
                padding: "6px 12px",
              }}
            >
              Registrar y guardar venta
            </button>
          </div>
          {confirmDeleteId && (
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setConfirmDeleteId(null)}
              style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 12000,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 360,
                  background: theme === "lite" ? "white" : "#2a2a2a",
                  borderRadius: 8,
                  padding: 14,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  position: "relative",
                  color: theme === "lite" ? "#111" : "#f5f5f5",
                }}
              >
                <button
                  aria-label="Cerrar"
                  title="Cerrar"
                  onClick={() => setConfirmDeleteId(null)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: 8,
                    background: "transparent",
                    border: "none",
                    padding: 6,
                    cursor: "pointer",
                    color: "#666",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Confirmar eliminación
                </div>
                <div style={{ marginBottom: 12 }}>
                  ¿Eliminar este pago? Esta acción no se puede deshacer.
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="btn-opaque"
                    style={{
                      background: "transparent",
                      padding: "6px 10px",
                      border:
                        theme === "lite" ? "1px solid #ddd" : "1px solid #555",
                      color: theme === "lite" ? "#111" : "#f5f5f5",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDeleteId) {
                        eliminarPago(confirmDeleteId);
                        setConfirmDeleteId(null);
                      }
                    }}
                    className="btn-opaque"
                    style={{
                      background: "#ef4444",
                      color: "white",
                      padding: "6px 10px",
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
          {loadingGenerating && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 12500,
                background: "rgba(2,6,23,0.6)",
              }}
            >
              <div
                style={{
                  background:
                    theme === "lite"
                      ? "rgba(255,255,255,0.98)"
                      : "rgba(42,42,42,0.98)",
                  padding: 18,
                  borderRadius: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                  color: theme === "lite" ? "#111" : "#f5f5f5",
                }}
              >
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <g transform="translate(0,0)">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#e6edf3"
                      strokeWidth="3"
                      fill="none"
                    />
                    <path
                      d="M22 12a10 10 0 0 1-10 10"
                      stroke="#0ea5a4"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 12 12"
                        to="360 12 12"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </g>
                </svg>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  Generando factura
                </div>
              </div>
            </div>
          )}
        </div>
      </ZoomWrapper>
    </div>
  );
}
