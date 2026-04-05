// Tipos agregados para corregir errores de compilación
export interface Factura {
  id: number;
  fecha_hora: string;
  factura: string;
  cai: string;
  cajero: string;
  caja?: string;
  sub_total: string;
  isv_15: string;
  isv_18: string;
  total: string;
  productos: string;
  cliente: string;
  es_donacion?: boolean;
  tipo_orden?: string;
  tipo?: string;
  efectivo?: number;
  tarjeta?: number;
  transferencia?: number;
  dolares?: number;
  dolares_usd?: number;
  delivery?: number;
}

export interface FacturasEmitidasViewProps {
  onBack?: () => void;
}
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function FacturasEmitidasView({
  onBack,
}: FacturasEmitidasViewProps) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalFactura, setModalFactura] = useState<Factura | null>(null);
  const [soloDonaciones, setSoloDonaciones] = useState(false);
  const [pagosPorFacturaMap, _setPagosPorFacturaMap] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    fetchFacturas();
    // eslint-disable-next-line
  }, [soloDonaciones]);

  async function fetchFacturas() {
    setLoading(true);
    let query = supabase.from("ventas").select("*");
    if (desde && hasta) {
      query = query
        .gte("fecha_hora", desde)
        .lte("fecha_hora", hasta + " 23:59:59");
    }
    if (soloDonaciones) {
      query = query.eq("es_donacion", true);
    }
    const { data, error } = await query.order("fecha_hora", {
      ascending: false,
    });
    if (!error && data) {
      setFacturas(data as Factura[]);
      // Construir mapa factura -> tipo_pago desde los propios datos de ventas
      const newMap = new Map<string, string>();
      for (const f of data as Factura[]) {
        let tipoPago = "efectivo";
        if ((f.tarjeta ?? 0) > 0) tipoPago = "tarjeta";
        else if ((f.transferencia ?? 0) > 0) tipoPago = "transferencia";
        else if ((f.dolares ?? 0) > 0) tipoPago = "dolares";
        newMap.set(f.factura, tipoPago);
      }
      _setPagosPorFacturaMap(newMap);
    }
    setLoading(false);
  }

  function handleFiltrar() {
    fetchFacturas();
  }

  return (
    <div
      style={{
        padding: 32,
        background: "linear-gradient(135deg, #e3f0ff 0%, #f8faff 100%)",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 4px 24px #0002",
          padding: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 8,
          }}
        >
          <h2
            style={{
              color: "#1976d2",
              fontWeight: 800,
              fontSize: 32,
              margin: 0,
              letterSpacing: 1,
            }}
          >
            Facturas Emitidas
          </h2>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: "#1976d2",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                padding: "8px 18px",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              ← Volver a Reporte de Ventas
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            marginBottom: 32,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <label style={{ fontWeight: 600, color: "#1976d2" }}>
              Desde:
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                style={{
                  marginLeft: 8,
                  padding: 6,
                  borderRadius: 6,
                  border: "1px solid #b0c4de",
                  fontSize: 15,
                }}
              />
            </label>
            <label style={{ fontWeight: 600, color: "#1976d2" }}>
              Hasta:
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                style={{
                  marginLeft: 8,
                  padding: 6,
                  borderRadius: 6,
                  border: "1px solid #b0c4de",
                  fontSize: 15,
                }}
              />
            </label>
            <button
              onClick={handleFiltrar}
              style={{
                background: "#1976d2",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                padding: "8px 24px",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: "0 2px 8px #1976d233",
              }}
            >
              Filtrar
            </button>
            <button
              onClick={() => setSoloDonaciones((prev) => !prev)}
              style={{
                background: soloDonaciones ? "#7c3aed" : "transparent",
                color: soloDonaciones ? "#fff" : "#7c3aed",
                borderRadius: 8,
                border: "2px solid #7c3aed",
                padding: "8px 18px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              🎁 {soloDonaciones ? "Ver Todas" : "Solo Donaciones"}
            </button>
          </div>
          <div style={{ fontWeight: 600, color: "#1976d2", fontSize: 18 }}>
            Total facturas: {facturas.length}
            {soloDonaciones && (
              <span
                style={{
                  marginLeft: 10,
                  background: "#7c3aed",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "2px 10px",
                  fontSize: 13,
                }}
              >
                🎁 Solo Donaciones
              </span>
            )}
          </div>
        </div>

        {/* Cards view para móviles (oculto en escritorio por CSS) */}
        <div className="cards-grid" style={{ marginTop: 8 }}>
          {facturas.map((f) => (
            <div
              key={f.id}
              className="factura-card"
              onClick={() => setModalFactura(f)}
            >
              <div className="fc-left">#{f.id}</div>
              <div className="fc-body">
                <div className="fc-title">{f.factura}</div>
                <div className="fc-sub">
                  {f.cajero} · {f.caja || "—"}
                </div>
                <div className="fc-date">
                  {f.fecha_hora?.replace("T", " ").slice(0, 19)}
                </div>
              </div>
              <div className="fc-right">
                <div className="fc-amount">
                  L {parseFloat(f.total).toFixed(2)}
                </div>
                <div className="fc-chevron">›</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div
                className="loader"
                style={{
                  margin: "0 auto",
                  width: 48,
                  height: 48,
                  border: "6px solid #1976d2",
                  borderTop: "6px solid #fff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ color: "#1976d2", fontWeight: 600, marginTop: 16 }}>
                Cargando...
              </p>
            </div>
          ) : (
            (() => {
              // Definir grupos de pago
              const grupos: {
                key: string;
                label: string;
                icon: string;
                color: string;
                bg: string;
                headerBg: string;
              }[] = [
                {
                  key: "efectivo",
                  label: "Efectivo",
                  icon: "💵",
                  color: "#16a34a",
                  bg: "#f0fdf4",
                  headerBg: "#16a34a",
                },
                {
                  key: "tarjeta",
                  label: "Tarjeta",
                  icon: "💳",
                  color: "#1976d2",
                  bg: "#eff6ff",
                  headerBg: "#1976d2",
                },
                {
                  key: "transferencia",
                  label: "Transferencia",
                  icon: "🏦",
                  color: "#7c3aed",
                  bg: "#f5f3ff",
                  headerBg: "#7c3aed",
                },
                {
                  key: "dolares",
                  label: "Dólares",
                  icon: "💱",
                  color: "#d97706",
                  bg: "#fef9c3",
                  headerBg: "#d97706",
                },
                {
                  key: "donacion",
                  label: "Donaciones",
                  icon: "🎁",
                  color: "#9333ea",
                  bg: "#fdf4ff",
                  headerBg: "#9333ea",
                },
              ];
              // Clasificar cada factura en su grupo
              const grouped: Record<string, Factura[]> = {
                efectivo: [],
                tarjeta: [],
                transferencia: [],
                dolares: [],
                donacion: [],
              };
              for (const f of facturas) {
                if (f.es_donacion) {
                  grouped["donacion"].push(f);
                  continue;
                }
                const tipo = (
                  pagosPorFacturaMap.get(f.factura) || "efectivo"
                ).toLowerCase();
                const key = tipo.includes("tarjeta")
                  ? "tarjeta"
                  : tipo.includes("transfer")
                    ? "transferencia"
                    : tipo.includes("dolar") || tipo === "dolares"
                      ? "dolares"
                      : "efectivo";
                grouped[key].push(f);
              }
              const totalGeneral = facturas.reduce(
                (s, f) => s + parseFloat(f.total || "0"),
                0,
              );

              // Helper para renderizar tabla de un grupo
              const renderTabla = (
                lista: Factura[],
                color: string,
                bg: string,
              ) => {
                const subtotal = lista.reduce(
                  (s, f) => s + parseFloat(f.total || "0"),
                  0,
                );
                const thStyle: React.CSSProperties = {
                  padding: "8px 10px",
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                };
                const tdStyle: React.CSSProperties = {
                  padding: "7px 10px",
                  fontSize: 13,
                  borderBottom: "1px solid #f0f0f0",
                };
                return (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      className="desktop-table"
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        background: "#fff",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      <thead>
                        <tr style={{ background: bg }}>
                          <th style={{ ...thStyle, color }}>Fecha/Hora</th>
                          <th style={{ ...thStyle, color }}>Factura</th>
                          <th style={{ ...thStyle, color }}>CAI</th>
                          <th style={{ ...thStyle, color }}>Cajero</th>
                          <th style={{ ...thStyle, color }}>Caja</th>
                          <th style={{ ...thStyle, color, textAlign: "right" }}>
                            Sub Total
                          </th>
                          <th style={{ ...thStyle, color, textAlign: "right" }}>
                            ISV 15%
                          </th>
                          <th style={{ ...thStyle, color, textAlign: "right" }}>
                            ISV 18%
                          </th>
                          <th style={{ ...thStyle, color, textAlign: "right" }}>
                            Total
                          </th>
                          <th style={{ ...thStyle, color }}>Productos</th>
                          <th style={{ ...thStyle, color }}>Cliente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((f) => (
                          <tr
                            key={f.id}
                            style={{
                              cursor: "pointer",
                              transition: "background 0.15s",
                            }}
                            onClick={() => setModalFactura(f)}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = bg + "88")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "")
                            }
                          >
                            <td style={tdStyle}>
                              {f.fecha_hora?.replace("T", " ").slice(0, 19)}
                            </td>
                            <td style={tdStyle}>
                              {f.factura}
                              {f.es_donacion && (
                                <span
                                  style={{
                                    marginLeft: 5,
                                    background: "#7c3aed",
                                    color: "#fff",
                                    borderRadius: 5,
                                    padding: "1px 6px",
                                    fontSize: 10,
                                    fontWeight: 700,
                                  }}
                                >
                                  🎁 DON.
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                maxWidth: 90,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {f.cai}
                            </td>
                            <td style={tdStyle}>{f.cajero}</td>
                            <td style={tdStyle}>{f.caja || ""}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {parseFloat(f.sub_total || "0").toFixed(2)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {parseFloat(f.isv_15 || "0").toFixed(2)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {parseFloat(f.isv_18 || "0").toFixed(2)}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                textAlign: "right",
                                fontWeight: 700,
                                color: f.es_donacion ? "#7c3aed" : color,
                              }}
                            >
                              {f.es_donacion
                                ? "🎁 0.00"
                                : parseFloat(f.total || "0").toFixed(2)}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                maxWidth: 160,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: "#555",
                              }}
                            >
                              {(() => {
                                try {
                                  const arr = JSON.parse(f.productos);
                                  return Array.isArray(arr)
                                    ? arr
                                        .map(
                                          (p: any) =>
                                            `${p.nombre}(${p.cantidad})`,
                                        )
                                        .join(", ")
                                    : "";
                                } catch {
                                  return "";
                                }
                              })()}
                            </td>
                            <td style={tdStyle}>{f.cliente}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: bg }}>
                          <td
                            colSpan={8}
                            style={{
                              ...tdStyle,
                              fontWeight: 700,
                              color,
                              textAlign: "right",
                            }}
                          >
                            Subtotal ({lista.length} facturas):
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              fontWeight: 800,
                              fontSize: 14,
                              color,
                              textAlign: "right",
                            }}
                          >
                            L {subtotal.toFixed(2)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              };

              return (
                <div>
                  {grupos.map((g) => {
                    const lista = grouped[g.key];
                    if (!lista || lista.length === 0) return null;
                    return (
                      <div key={g.key} style={{ marginBottom: 28 }}>
                        {/* Encabezado del grupo */}
                        <div
                          style={{
                            background: g.headerBg,
                            color: "#fff",
                            borderRadius: "10px 10px 0 0",
                            padding: "12px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <span style={{ fontSize: 24 }}>{g.icon}</span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 18 }}>
                                {g.label}
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.88 }}>
                                {lista.length} factura
                                {lista.length !== 1 ? "s" : ""}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontWeight: 900, fontSize: 22 }}>
                            L{" "}
                            {lista
                              .reduce(
                                (s, f) => s + parseFloat(f.total || "0"),
                                0,
                              )
                              .toFixed(2)}
                          </div>
                        </div>
                        <div
                          style={{
                            border: `1px solid ${g.color}33`,
                            borderTop: "none",
                            borderRadius: "0 0 10px 10px",
                            overflow: "hidden",
                          }}
                        >
                          {renderTabla(lista, g.color, g.bg)}
                        </div>
                      </div>
                    );
                  })}

                  {/* Total General */}
                  {facturas.length > 0 && (
                    <div
                      style={{
                        background: "linear-gradient(135deg,#1976d2,#0d47a1)",
                        color: "#fff",
                        borderRadius: 14,
                        padding: "18px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 16,
                        boxShadow: "0 4px 18px #1976d233",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 20 }}>
                          💰 TOTAL GENERAL
                        </div>
                        <div
                          style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}
                        >
                          {facturas.length} facturas en total
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 32 }}>
                        L {totalGeneral.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
        {onBack && (
          <div style={{ textAlign: "right", marginTop: 40 }}>
            <button
              onClick={onBack}
              style={{
                background: "#1976d2",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                padding: "10px 32px",
                fontWeight: 700,
                fontSize: 18,
                cursor: "pointer",
                boxShadow: "0 2px 8px #1976d233",
              }}
            >
              Volver
            </button>
          </div>
        )}

        {/* Modal de detalles de factura */}
        {modalFactura && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "#0007",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 4px 24px #0003",
                padding: 32,
                minWidth: 340,
                maxWidth: 480,
                position: "relative",
              }}
            >
              <h3
                style={{
                  color: "#1976d2",
                  fontWeight: 800,
                  fontSize: 24,
                  marginBottom: 18,
                }}
              >
                Detalle de Factura
              </h3>
              <table style={{ width: "100%", fontSize: 16 }}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      ID:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      {modalFactura.id}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      Fecha/Hora:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      {modalFactura.fecha_hora?.replace("T", " ").slice(0, 19)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      Factura:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      {modalFactura.factura}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      CAI:
                    </td>
                    <td
                      style={{
                        color: "#1a1a2e",
                        paddingBottom: 6,
                        wordBreak: "break-all",
                      }}
                    >
                      {modalFactura.cai}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      Cajero:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      {modalFactura.cajero}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      Caja:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      {modalFactura.caja || ""}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      Cliente:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      {modalFactura.cliente}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      Sub Total:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      L {parseFloat(modalFactura.sub_total).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      ISV 15%:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      L {parseFloat(modalFactura.isv_15).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      ISV 18%:
                    </td>
                    <td style={{ color: "#1a1a2e", paddingBottom: 6 }}>
                      L {parseFloat(modalFactura.isv_18).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        paddingBottom: 6,
                      }}
                    >
                      Total:
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: "#1976d2",
                        fontSize: 18,
                        paddingBottom: 6,
                      }}
                    >
                      L {parseFloat(modalFactura.total).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: 600,
                        color: "#1976d2",
                        verticalAlign: "top",
                        paddingTop: 4,
                      }}
                    >
                      Productos:
                    </td>
                    <td style={{ color: "#1a1a2e" }}>
                      {(() => {
                        try {
                          const arr = JSON.parse(modalFactura.productos);
                          if (Array.isArray(arr)) {
                            return (
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {arr.map((p: any, idx: number) => (
                                  <li
                                    key={idx}
                                    style={{
                                      color: "#1a1a2e",
                                      marginBottom: 4,
                                    }}
                                  >
                                    {p.nombre} — Cant: {p.cantidad} — L{" "}
                                    {p.precio}
                                  </li>
                                ))}
                              </ul>
                            );
                          }
                        } catch {
                          return "";
                        }
                        return "";
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
              <button
                onClick={() => setModalFactura(null)}
                style={{
                  position: "absolute",
                  top: 18,
                  right: 18,
                  background: "#1976d2",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "6px 18px",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
				@media (max-width: 768px) {
					/* esconder la tabla en móvil y mostrar las cards */
					.desktop-table { display: none !important; }
					.cards-grid { display: grid !important; gap: 12px; }
					.factura-card { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; background: #fff; box-shadow: 0 8px 24px rgba(7,23,48,0.06); border: 1px solid rgba(25,118,210,0.06); cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; }
					.factura-card:hover { transform: translateY(-4px); box-shadow: 0 14px 34px rgba(7,23,48,0.09); }
					.fc-left { width: 56px; height: 56px; border-radius: 10px; background: linear-gradient(180deg, #eaf4ff 0%, #fff 100%); display:flex; align-items:center; justify-content:center; color:#0b4f9a; font-weight:800; }
					.fc-body { flex: 1; min-width: 0; }
					.fc-title { font-weight: 800; color: #0b4f9a; font-size: 15px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
					.fc-sub { color: #6b7280; font-size: 13px; margin-bottom: 4px; }
					.fc-date { color: #94a3b8; font-size: 12px; }
					.fc-right { text-align: right; display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
					.fc-amount { font-weight: 900; color: #1976d2; font-size: 15px; }
					.fc-chevron { color: #cbd5e1; font-size: 20px; }
				}
			`}</style>
    </div>
  );
}
