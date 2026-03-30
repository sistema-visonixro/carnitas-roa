import { useState, useEffect } from "react";
import {
  type PrinterConfig,
  type TipoImpresora,
  type ModoImpresion,
  cargarPrinterConfig,
  guardarPrinterConfig,
} from "./utils/printerConfig";
import {
  webUsbSoportado,
  solicitarImpresora,
  imprimirPrueba,
} from "./utils/webUsbPrinter";

// ── Tipos locales ────────────────────────────────────────────────────────────

interface ImpresorasViewProps {
  onBack: () => void;
}

interface FilaImpresora {
  tipo: TipoImpresora;
  label: string;
  icono: string;
  color: string;
  desc: string;
}

const FILAS: FilaImpresora[] = [
  {
    tipo: "recibo",
    label: "Impresora de Recibos",
    icono: "🧾",
    color: "#1565c0",
    desc: "Ticket para el cliente con totales e ISV",
  },
  {
    tipo: "comanda",
    label: "Impresora de Comanda",
    icono: "🍽️",
    color: "#2e7d32",
    desc: "Orden de cocina con productos y complementos",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const usuarioActual: any = (() => {
  try {
    const s = localStorage.getItem("usuario");
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
})();

// ── Componente principal ─────────────────────────────────────────────────────

export default function ImpresorasView({ onBack }: ImpresorasViewProps) {
  const [configs, setConfigs] = useState<
    Record<TipoImpresora, PrinterConfig | null>
  >({
    recibo: null,
    comanda: null,
  });
  const [loading, setLoading] = useState(true);

  // Modal de configuración
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipoActivo, setTipoActivo] = useState<TipoImpresora>("recibo");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState<TipoImpresora | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(
    null,
  );

  // Datos del modal
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoVendor, setNuevoVendor] = useState(0);
  const [nuevoProduct, setNuevoProduct] = useState(0);
  const [nuevoModo, setNuevoModo] = useState<ModoImpresion>("navegador");

  const soportado = webUsbSoportado();

  // ── Cargar configuraciones al montar ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cfgRecibo, cfgComanda] = await Promise.all([
          cargarPrinterConfig("recibo", usuarioActual?.id),
          cargarPrinterConfig("comanda", usuarioActual?.id),
        ]);
        setConfigs({ recibo: cfgRecibo, comanda: cfgComanda });
      } catch (err) {
        console.error("Error cargando config de impresoras:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Abrir modal para configurar una impresora ─────────────────────────────
  function abrirModal(tipo: TipoImpresora) {
    const cfg = configs[tipo];
    setTipoActivo(tipo);
    setNuevoNombre(cfg?.nombre ?? "");
    setNuevoVendor(cfg?.vendorId ?? 0);
    setNuevoProduct(cfg?.productId ?? 0);
    setNuevoModo(cfg?.modoImpresion ?? "navegador");
    setMsg(null);
    setModalAbierto(true);
  }

  // ── Seleccionar impresora USB desde el diálogo del navegador ─────────────
  async function seleccionarUSB() {
    if (!soportado) {
      alert("WebUSB no está disponible. Usa Chrome o Edge para esta función.");
      return;
    }
    try {
      const info = await solicitarImpresora();
      if (!info) return; // usuario canceló
      setNuevoNombre(info.nombre);
      setNuevoVendor(info.vendorId);
      setNuevoProduct(info.productId);
      setMsg({
        tipo: "ok",
        texto: `✓ Impresora detectada: ${info.nombre} (VID:${info.vendorId.toString(16).toUpperCase()} PID:${info.productId.toString(16).toUpperCase()})`,
      });
    } catch (err: any) {
      setMsg({
        tipo: "err",
        texto: "Error al detectar impresora: " + err.message,
      });
    }
  }

  // ── Guardar configuración ─────────────────────────────────────────────────
  async function guardar() {
    if (!nuevoVendor || !nuevoProduct) {
      setMsg({
        tipo: "err",
        texto: "Debes seleccionar una impresora USB primero.",
      });
      return;
    }
    setGuardando(true);
    setMsg(null);
    try {
      const cfg: PrinterConfig = {
        tipo: tipoActivo,
        nombre: nuevoNombre || `Impresora USB ${nuevoVendor.toString(16)}`,
        vendorId: nuevoVendor,
        productId: nuevoProduct,
        modoImpresion: nuevoModo,
      };
      await guardarPrinterConfig(cfg, usuarioActual?.id ?? "");
      setConfigs((prev) => ({ ...prev, [tipoActivo]: cfg }));
      setMsg({ tipo: "ok", texto: "✓ Configuración guardada correctamente" });
      setTimeout(() => {
        setModalAbierto(false);
        setMsg(null);
      }, 1200);
    } catch (err: any) {
      setMsg({ tipo: "err", texto: "Error al guardar: " + err.message });
    } finally {
      setGuardando(false);
    }
  }

  // ── Cambiar modo de impresión directamente desde la lista ─────────────────
  async function cambiarModo(tipo: TipoImpresora, modo: ModoImpresion) {
    const cfg = configs[tipo];
    if (!cfg) return;
    const nueva: PrinterConfig = { ...cfg, modoImpresion: modo };
    try {
      await guardarPrinterConfig(nueva, usuarioActual?.id ?? "");
      setConfigs((prev) => ({ ...prev, [tipo]: nueva }));
    } catch (err) {
      console.error("Error cambiando modo:", err);
    }
  }

  // ── Imprimir página de prueba ─────────────────────────────────────────────
  async function probarImpresora(tipo: TipoImpresora) {
    const cfg = configs[tipo];
    if (!cfg) {
      alert("Primero configura la impresora.");
      return;
    }
    if (cfg.modoImpresion === "navegador") {
      // Prueba por navegador: abrir ventana
      const w = window.open("", "", "width=400,height=600");
      if (w) {
        w.document.write(
          `<html><head><title>Prueba</title></head><body style="font-family:monospace;text-align:center;padding:20px">
            <h2>*** IMPRESORA OK ***</h2>
            <p>${cfg.nombre}</p>
            <p>Modo: Navegador</p>
            <p>${new Date().toLocaleString("es-HN")}</p>
          </body></html>`,
        );
        w.document.close();
        w.print();
      }
      return;
    }
    // Prueba silenciosa por WebUSB
    setProbando(tipo);
    try {
      await imprimirPrueba(cfg.vendorId, cfg.productId);
      alert("✓ Página de prueba enviada a la impresora");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setProbando(null);
    }
  }

  // ── Fila de la lista de impresoras ────────────────────────────────────────
  function FilaImpresora({ fila }: { fila: FilaImpresora }) {
    const cfg = configs[fila.tipo];
    const tieneConfig = !!cfg;

    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
          border: `2px solid ${tieneConfig ? fila.color + "33" : "#e2e8f0"}`,
          padding: "22px 26px",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Icono */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: tieneConfig ? fila.color + "15" : "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            flexShrink: 0,
          }}
        >
          {fila.icono}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#0f172a" }}>
            {fila.label}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            {fila.desc}
          </div>
          {tieneConfig ? (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  background: fila.color + "15",
                  color: fila.color,
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {cfg!.nombre}
              </span>
              <span
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  padding: "3px 10px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              >
                VID:{cfg!.vendorId.toString(16).toUpperCase()} PID:
                {cfg!.productId.toString(16).toUpperCase()}
              </span>
            </div>
          ) : (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "#94a3b8",
                fontStyle: "italic",
              }}
            >
              Sin configurar
            </div>
          )}
        </div>

        {/* Selector de modo */}
        {tieneConfig && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "flex-start",
              minWidth: 140,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Modo de impresión
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["navegador", "silenciosa"] as ModoImpresion[]).map((modo) => (
                <button
                  key={modo}
                  onClick={() => cambiarModo(fila.tipo, modo)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border:
                      cfg!.modoImpresion === modo
                        ? `2px solid ${fila.color}`
                        : "2px solid #e2e8f0",
                    background:
                      cfg!.modoImpresion === modo ? fila.color + "15" : "#fff",
                    color: cfg!.modoImpresion === modo ? fila.color : "#64748b",
                    fontWeight: cfg!.modoImpresion === modo ? 700 : 500,
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textTransform: "capitalize",
                  }}
                >
                  {modo === "navegador" ? "🖨️ Navegador" : "⚡ Silenciosa"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {tieneConfig && (
            <button
              disabled={probando === fila.tipo}
              onClick={() => probarImpresora(fila.tipo)}
              title="Imprimir página de prueba"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "2px solid #e2e8f0",
                background: "#fff",
                color: "#64748b",
                fontWeight: 600,
                fontSize: 13,
                cursor: probando === fila.tipo ? "not-allowed" : "pointer",
                opacity: probando === fila.tipo ? 0.6 : 1,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (probando !== fila.tipo)
                  e.currentTarget.style.borderColor = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              {probando === fila.tipo ? "📤 Enviando..." : "🔍 Probar"}
            </button>
          )}
          <button
            onClick={() => abrirModal(fila.tipo)}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: fila.color,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: `0 3px 10px ${fila.color}44`,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
          >
            {tieneConfig ? "✏️ Editar" : "➕ Configurar"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#f8fafc 0%,#e8f0fe 100%)",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 28,
          }}
        >
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: "2px solid #e2e8f0",
              borderRadius: 10,
              width: 40,
              height: 40,
              fontSize: 18,
              cursor: "pointer",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#94a3b8";
              e.currentTarget.style.background = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.background = "transparent";
            }}
          >
            ←
          </button>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              🖨️ Configuración de Impresoras
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 14,
                color: "#64748b",
              }}
            >
              Conecta y configura tus impresoras térmicas USB (ESC/POS)
            </p>
          </div>
        </div>

        {/* Alerta de soporte */}
        {!soportado && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fbbf24",
              borderRadius: 12,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <strong style={{ color: "#92400e" }}>WebUSB no disponible</strong>
              <p style={{ margin: "4px 0 0", color: "#78350f", fontSize: 13 }}>
                Tu navegador no soporta WebUSB. El modo <b>Silenciosa</b> no
                funcionará. Usa <b>Google Chrome</b> o <b>Microsoft Edge</b>{" "}
                para habilitar la impresión directa por USB. El modo{" "}
                <b>Navegador</b> sí funcionará en cualquier navegador.
              </p>
            </div>
          </div>
        )}

        {/* Explicación de modos */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            marginBottom: 24,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "#1565c0",
                marginBottom: 4,
              }}
            >
              🖨️ Modo Navegador
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              Abre el diálogo de impresión del sistema. Compatible con todos los
              navegadores. Requiere confirmar en cada impresión.
            </p>
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: "#0f9960",
                marginBottom: 4,
              }}
            >
              ⚡ Modo Silenciosa (WebUSB)
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              Envía bytes ESC/POS directo al USB sin diálogos. Solo Chrome /
              Edge. Requiere HTTPS. Una vez configurada, no necesita
              confirmación.
            </p>
          </div>
        </div>

        {/* Lista de impresoras */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
            Cargando configuración...
          </div>
        ) : (
          FILAS.map((fila) => <FilaImpresora key={fila.tipo} fila={fila} />)
        )}

        {/* Nota al pie */}
        <div
          style={{
            marginTop: 28,
            fontSize: 12,
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          La configuración se guarda localmente en el dispositivo y se
          sincroniza con la nube automáticamente. Si cambias de equipo, abre
          esta pantalla para volver a seleccionar la impresora USB (el diálogo
          de autorización debe abrirse al menos una vez por equipo/navegador).
        </div>
      </div>

      {/* ── Modal de configuración ──────────────────────────────────────── */}
      {modalAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalAbierto(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "32px 36px",
              minWidth: 360,
              maxWidth: 520,
              width: "92%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Header modal */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {FILAS.find((f) => f.tipo === tipoActivo)?.icono}{" "}
                  {tipoActivo === "recibo"
                    ? "Impresora de Recibos"
                    : "Impresora de Comanda"}
                </h3>
                <p
                  style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}
                >
                  Selecciona el dispositivo USB y elige el modo de impresión
                </p>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#94a3b8",
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Botón seleccionar USB */}
            <button
              onClick={seleccionarUSB}
              disabled={!soportado}
              style={{
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                border: "2px dashed #3b82f6",
                background: "#eff6ff",
                color: "#1d4ed8",
                fontWeight: 700,
                fontSize: 15,
                cursor: soportado ? "pointer" : "not-allowed",
                opacity: soportado ? 1 : 0.5,
                transition: "all 0.15s",
                marginBottom: 18,
              }}
              onMouseEnter={(e) => {
                if (soportado) e.currentTarget.style.background = "#dbeafe";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#eff6ff";
              }}
            >
              🔌 Seleccionar impresora USB del sistema
            </button>

            {/* Dispositivo detectado o captura manual */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Nombre del dispositivo
              </label>
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej: Impresora Epson TM-T20"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "2px solid #e2e8f0",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Vendor ID (hex)
                </label>
                <input
                  value={
                    nuevoVendor
                      ? "0x" + nuevoVendor.toString(16).toUpperCase()
                      : ""
                  }
                  readOnly
                  placeholder="Auto-detectado"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "2px solid #e2e8f0",
                    fontSize: 13,
                    fontFamily: "monospace",
                    background: "#f9fafb",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Product ID (hex)
                </label>
                <input
                  value={
                    nuevoProduct
                      ? "0x" + nuevoProduct.toString(16).toUpperCase()
                      : ""
                  }
                  readOnly
                  placeholder="Auto-detectado"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "2px solid #e2e8f0",
                    fontSize: 13,
                    fontFamily: "monospace",
                    background: "#f9fafb",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Modo de impresión */}
            <div style={{ marginBottom: 22 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 10,
                }}
              >
                Modo de impresión
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {(
                  [
                    {
                      value: "navegador" as ModoImpresion,
                      label: "🖨️ Navegador",
                      desc: "Abre diálogo del sistema",
                    },
                    {
                      value: "silenciosa" as ModoImpresion,
                      label: "⚡ Silenciosa",
                      desc: "WebUSB directo, sin diálogos",
                    },
                  ] as { value: ModoImpresion; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNuevoModo(opt.value)}
                    disabled={opt.value === "silenciosa" && !soportado}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      border:
                        nuevoModo === opt.value
                          ? "2px solid #1d4ed8"
                          : "2px solid #e2e8f0",
                      background: nuevoModo === opt.value ? "#eff6ff" : "#fff",
                      color: nuevoModo === opt.value ? "#1d4ed8" : "#374151",
                      fontWeight: nuevoModo === opt.value ? 700 : 500,
                      cursor:
                        opt.value === "silenciosa" && !soportado
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        opt.value === "silenciosa" && !soportado ? 0.5 : 1,
                      textAlign: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 15 }}>{opt.label}</div>
                    <div
                      style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}
                    >
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mensaje de estado */}
            {msg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: msg.tipo === "ok" ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${msg.tipo === "ok" ? "#86efac" : "#fca5a5"}`,
                  color: msg.tipo === "ok" ? "#166534" : "#991b1b",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 18,
                }}
              >
                {msg.texto}
              </div>
            )}

            {/* Botones del modal */}
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setModalAbierto(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "2px solid #e2e8f0",
                  background: "transparent",
                  color: "#64748b",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{
                  padding: "10px 28px",
                  borderRadius: 8,
                  border: "none",
                  background: guardando ? "#94a3b8" : "#1d4ed8",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: guardando ? "not-allowed" : "pointer",
                  boxShadow: "0 3px 10px rgba(29,78,216,0.3)",
                  transition: "all 0.15s",
                }}
              >
                {guardando ? "Guardando..." : "💾 Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
