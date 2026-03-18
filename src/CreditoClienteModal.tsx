// ============================================================
// CreditoClienteModal.tsx
// Modal del POS para seleccionar o crear un cliente de crédito.
// Se abre cuando el cajero presiona "Facturar a Crédito".
// ============================================================
import { useState, useEffect, useRef } from "react";
import type { ClienteCredito } from "./types/creditos";
import {
  buscarClientesCredito,
  crearClienteCredito,
  obtenerCuentaCobrar,
} from "./services/creditoService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClienteSeleccionado: (cliente: ClienteCredito, saldoActual: number) => void;
  theme?: "lite" | "dark";
}

// Regex de validación de DNI hondureño (ej: 1809-1966-00326)
const DNI_REGEX = /^\d{4}-\d{4}-\d{5}$/;

function formatearDni(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 13)}`;
}

export default function CreditoClienteModal({
  isOpen,
  onClose,
  onClienteSeleccionado,
  theme = "lite",
}: Props) {
  const [tab, setTab] = useState<"buscar" | "nuevo">("buscar");
  const [busqueda, setBusqueda] = useState("");
  const [clientes, setClientes] = useState<ClienteCredito[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seleccionando, setSeleccionando] = useState(false);

  // Formulario nuevo cliente
  const [fNombre, setFNombre] = useState("");
  const [fDni, setFDni] = useState("");
  const [fTelefono, setFTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errForm, setErrForm] = useState<string | null>(null);

  const busquedaRef = useRef<HTMLInputElement>(null);

  // ──── Reset al abrir ────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTab("buscar");
      setBusqueda("");
      setClientes([]);
      setError(null);
      setFNombre("");
      setFDni("");
      setFTelefono("");
      setErrForm(null);
      setTimeout(() => busquedaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ──── Buscar clientes ────────────────────────────────────────
  useEffect(() => {
    if (tab !== "buscar") return;
    if (busqueda.trim().length < 1) {
      // Carga todos cuando está vacío
      cargarTodos();
      return;
    }
    const t = setTimeout(() => buscar(busqueda.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, tab]);

  async function cargarTodos() {
    setCargando(true);
    setError(null);
    try {
      const data = await buscarClientesCredito("");
      setClientes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function buscar(termino: string) {
    setCargando(true);
    setError(null);
    try {
      const data = await buscarClientesCredito(termino);
      setClientes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function seleccionarCliente(cli: ClienteCredito) {
    setSeleccionando(true);
    try {
      const cuenta = await obtenerCuentaCobrar(cli.id);
      onClienteSeleccionado(cli, cuenta?.saldo_actual ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeleccionando(false);
    }
  }

  async function guardarNuevoCliente() {
    setErrForm(null);
    if (!fNombre.trim()) {
      setErrForm("El nombre es requerido.");
      return;
    }
    if (!DNI_REGEX.test(fDni)) {
      setErrForm("DNI inválido. Formato esperado: 1809-1966-00326");
      return;
    }
    if (!fTelefono.trim()) {
      setErrForm("El teléfono es requerido.");
      return;
    }

    setGuardando(true);
    try {
      const nuevo = await crearClienteCredito({
        nombre: fNombre.trim().toUpperCase(),
        dni: fDni,
        telefono: fTelefono.trim(),
        activo: true,
      });
      // Seleccionar inmediatamente al nuevo cliente
      onClienteSeleccionado(nuevo, 0);
    } catch (e: any) {
      setErrForm(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!isOpen) return null;

  // ──── Colores según tema ─────────────────────────────────────
  const bg = theme === "lite" ? "#fff" : "#1e2022";
  const bg2 = theme === "lite" ? "#f8fafc" : "#2a2d2f";
  const border = theme === "lite" ? "#e2e8f0" : "#3a3d3f";
  const text = theme === "lite" ? "#0f172a" : "#f5f5f5";
  const sub = theme === "lite" ? "#64748b" : "#94a3b8";
  const accent = "#7c3aed"; // morado para distinguir del POS de contado

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 11000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: bg,
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: text,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, #6d28d9 100%)`,
            padding: "18px 24px",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
            💳 Facturar a Crédito
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.8)",
              marginTop: 3,
            }}
          >
            Seleccione o registre al cliente
          </div>
        </div>

        {/* ── Tabs ── */}
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${border}`,
            flexShrink: 0,
          }}
        >
          {(["buscar", "nuevo"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "12px 0",
                fontWeight: 600,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
                background: tab === t ? bg : bg2,
                color: tab === t ? accent : sub,
                borderBottom:
                  tab === t ? `2px solid ${accent}` : "2px solid transparent",
                transition: "all 0.2s",
              }}
            >
              {t === "buscar" ? "🔍 Buscar cliente" : "➕ Nuevo cliente"}
            </button>
          ))}
        </div>

        {/* ── Contenido ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* TAB: BUSCAR */}
          {tab === "buscar" && (
            <>
              <input
                ref={busquedaRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o DNI (ej: 1809-1966-00326)"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  fontSize: 15,
                  background: bg2,
                  color: text,
                  marginBottom: 14,
                  boxSizing: "border-box",
                }}
              />

              {error && (
                <div
                  style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}
                >
                  ⚠ {error}
                </div>
              )}

              {cargando ? (
                <div style={{ textAlign: "center", padding: 24, color: sub }}>
                  Cargando...
                </div>
              ) : clientes.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: sub }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                  No se encontraron clientes
                  <br />
                  <button
                    onClick={() => setTab("nuevo")}
                    style={{
                      marginTop: 12,
                      padding: "8px 18px",
                      background: accent,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Registrar cliente nuevo
                  </button>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {clientes.map((cli) => (
                    <button
                      key={cli.id}
                      disabled={seleccionando}
                      onClick={() => seleccionarCliente(cli)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 16px",
                        background: bg2,
                        border: `1px solid ${border}`,
                        borderRadius: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        transition: "all 0.18s",
                        opacity: seleccionando ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          theme === "lite" ? "#ede9fe" : "#312e81";
                        e.currentTarget.style.borderColor = accent;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = bg2;
                        e.currentTarget.style.borderColor = border;
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${accent}, #6d28d9)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 18,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {cli.nombre.charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ fontWeight: 700, fontSize: 15, color: text }}
                        >
                          {cli.nombre}
                        </div>
                        <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
                          DNI: {cli.dni}
                          {cli.telefono && ` · Tel: ${cli.telefono}`}
                        </div>
                      </div>
                      <div style={{ color: accent, fontSize: 20 }}>›</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB: NUEVO CLIENTE */}
          {tab === "nuevo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: sub,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={fNombre}
                  onChange={(e) => setFNombre(e.target.value)}
                  placeholder="Ej: CARLOS ANTONIO MEJÍA"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    fontSize: 15,
                    background: bg2,
                    color: text,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: sub,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  DNI * (Formato: 1809-1966-00326)
                </label>
                <input
                  type="text"
                  value={fDni}
                  onChange={(e) => setFDni(formatearDni(e.target.value))}
                  placeholder="1809-1966-00326"
                  maxLength={15}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: `1px solid ${DNI_REGEX.test(fDni) ? "#22c55e" : border}`,
                    borderRadius: 10,
                    fontSize: 15,
                    background: bg2,
                    color: text,
                    boxSizing: "border-box",
                    letterSpacing: 1,
                  }}
                />
                {fDni.length > 0 && !DNI_REGEX.test(fDni) && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>
                    Formato incompleto
                  </div>
                )}
              </div>

              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: sub,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={fTelefono}
                  onChange={(e) => setFTelefono(e.target.value)}
                  placeholder="9999-9999"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    fontSize: 15,
                    background: bg2,
                    color: text,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {errForm && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "#dc2626",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  ⚠ {errForm}
                </div>
              )}

              <button
                onClick={guardarNuevoCliente}
                disabled={guardando}
                style={{
                  background: guardando
                    ? "#9ca3af"
                    : `linear-gradient(135deg, ${accent}, #6d28d9)`,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "13px 0",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: guardando ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                {guardando ? "Guardando..." : "✓ Registrar y seleccionar"}
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: `1px solid ${border}`,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "11px 0",
              background: "transparent",
              border: `1px solid ${border}`,
              borderRadius: 10,
              color: sub,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
