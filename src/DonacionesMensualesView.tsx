import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

interface DonacionRow {
  fecha_hora: string;
  factura: string;
  cajero: string;
  caja: string;
  cliente?: string;
  productos: string;
  platillos: number;
  bebidas: number;
}

interface MesOption {
  value: string; // "YYYY-MM"
  label: string;
}

export default function DonacionesMensualesView({
  onBack,
}: {
  onBack?: () => void;
}) {
  const [donaciones, setDonaciones] = useState<DonacionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [mesesDisponibles, setMesesDisponibles] = useState<MesOption[]>([]);

  // Generar últimos 12 meses disponibles
  useEffect(() => {
    const opciones: MesOption[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("es-HN", {
        year: "numeric",
        month: "long",
      });
      opciones.push({ value, label });
    }
    setMesesDisponibles(opciones);
  }, []);

  useEffect(() => {
    fetchDonaciones();
    // eslint-disable-next-line
  }, [mesSeleccionado]);

  async function fetchDonaciones() {
    setLoading(true);
    try {
      const [year, month] = mesSeleccionado.split("-").map(Number);
      const desde = new Date(year, month - 1, 1).toISOString();
      const hasta = new Date(year, month, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from("facturas")
        .select("fecha_hora, factura, cajero, caja, cliente, productos")
        .eq("es_donacion", true)
        .gte("fecha_hora", desde)
        .lte("fecha_hora", hasta)
        .order("fecha_hora", { ascending: false });

      if (error) throw error;

      const rows: DonacionRow[] = (data || []).map((f: any) => {
        let platillos = 0;
        let bebidas = 0;
        try {
          const prods =
            typeof f.productos === "string"
              ? JSON.parse(f.productos)
              : f.productos;
          if (Array.isArray(prods)) {
            for (const p of prods) {
              const qty = parseFloat(p.cantidad || 1);
              if (p.tipo === "comida") platillos += qty;
              else if (p.tipo === "bebida") bebidas += qty;
            }
          }
        } catch (_) {}
        return { ...f, platillos, bebidas };
      });

      setDonaciones(rows);
    } catch (err) {
      console.error("Error cargando donaciones:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalPlatillos = donaciones.reduce((s, d) => s + d.platillos, 0);
  const totalBebidas = donaciones.reduce((s, d) => s + d.bebidas, 0);
  const totalFacturas = donaciones.length;

  const mesLabel =
    mesesDisponibles.find((m) => m.value === mesSeleccionado)?.label ||
    mesSeleccionado;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#7c3aed",
              fontWeight: 800,
              fontSize: 28,
            }}
          >
            🎁 Donaciones Mensuales
          </h2>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: 14 }}>
            Platillos y bebidas regalados (autorizados por Admin)
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "#7c3aed",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 18px",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ← Volver
          </button>
        )}
      </div>

      {/* Filtro de mes */}
      <div
        style={{
          background: "#f8fafc",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <label
          style={{ fontWeight: 700, color: "#7c3aed", fontSize: 15 }}
          htmlFor="select-mes"
        >
          Filtrar por mes:
        </label>
        <select
          id="select-mes"
          value={mesSeleccionado}
          onChange={(e) => setMesSeleccionado(e.target.value)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "2px solid #7c3aed",
            fontSize: 14,
            fontWeight: 600,
            color: "#1e1b4b",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          {mesesDisponibles.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <span style={{ color: "#64748b", fontSize: 13 }}>
          Mostrando: <strong>{mesLabel}</strong>
        </span>
      </div>

      {/* Tarjetas resumen */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Total Donaciones",
            value: totalFacturas,
            icon: "🎁",
            color: "#7c3aed",
            bg: "#f5f3ff",
          },
          {
            label: "Platillos Donados",
            value: Math.round(totalPlatillos),
            icon: "🍖",
            color: "#dc2626",
            bg: "#fef2f2",
          },
          {
            label: "Bebidas Donadas",
            value: Math.round(totalBebidas),
            icon: "🥤",
            color: "#0284c7",
            bg: "#f0f9ff",
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: card.bg,
              borderRadius: 12,
              padding: "16px 18px",
              textAlign: "center",
              border: `2px solid ${card.color}22`,
            }}
          >
            <div style={{ fontSize: 28 }}>{card.icon}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: card.color,
                marginTop: 4,
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#7c3aed" }}>
          Cargando donaciones...
        </div>
      ) : donaciones.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            color: "#94a3b8",
            fontSize: 16,
            background: "#f8fafc",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
          No hay donaciones registradas en {mesLabel}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "#7c3aed",
                  color: "#fff",
                  textAlign: "left",
                }}
              >
                {[
                  "Fecha/Hora",
                  "Factura",
                  "Cajero",
                  "Caja",
                  "Cliente",
                  "Platillos",
                  "Bebidas",
                  "Productos",
                ].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", fontWeight: 700 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {donaciones.map((d, i) => {
                const productosStr = (() => {
                  try {
                    const arr =
                      typeof d.productos === "string"
                        ? JSON.parse(d.productos)
                        : d.productos;
                    if (Array.isArray(arr))
                      return arr
                        .map((p: any) => `${p.nombre} ×${p.cantidad}`)
                        .join(", ");
                  } catch (_) {}
                  return "—";
                })();

                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: i % 2 === 0 ? "#fff" : "#faf5ff",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: 13,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(d.fecha_hora).toLocaleString("es-HN", {
                        timeZone: "America/Tegucigalpa",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      {d.factura}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{d.cajero || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{d.caja || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>{d.cliente || "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          background: "#fef2f2",
                          color: "#dc2626",
                          padding: "2px 10px",
                          borderRadius: 20,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {Math.round(d.platillos)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          background: "#f0f9ff",
                          color: "#0284c7",
                          padding: "2px 10px",
                          borderRadius: 20,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        {Math.round(d.bebidas)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontSize: 12,
                        color: "#64748b",
                        maxWidth: 240,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {productosStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totales */}
            <tfoot>
              <tr
                style={{
                  background: "#7c3aed",
                  color: "#fff",
                  fontWeight: 800,
                }}
              >
                <td colSpan={5} style={{ padding: "10px 12px" }}>
                  TOTAL DEL MES
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  {Math.round(totalPlatillos)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                  {Math.round(totalBebidas)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
