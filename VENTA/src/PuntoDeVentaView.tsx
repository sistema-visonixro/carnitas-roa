import { useEffect, useState } from "react";
import { supabase } from "../../src/supabaseClient";
import { formatToHondurasLocal } from "../../src/utils/fechas";

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  tipo: "comida" | "bebida";
  imagen?: string;
}

interface Seleccion {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  tipo: "comida" | "bebida";
}

// use centralized supabase client from src/supabaseClient.ts

// Obtener usuario actual de localStorage
const usuarioActual = (() => {
  try {
    const stored = localStorage.getItem("usuario");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
})();

export default function PuntoDeVentaView() {
  const [facturaActual, setFacturaActual] = useState<string>("");
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [identidadCliente, setIdentidadCliente] = useState("");
  const [canjearPuntos, setCanjearPuntos] = useState(false);
  const [puntosDisponibles, setPuntosDisponibles] = useState<number | null>(
    null,
  );
  const [caiInfo, setCaiInfo] = useState<{
    caja_asignada: string;
    nombre_cajero: string;
    cai: string;
  } | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [seleccionados, setSeleccionados] = useState<Seleccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"comida" | "bebida">("comida");

  // Obtener datos de CAI y factura actual
  useEffect(() => {
    async function fetchCaiYFactura() {
      if (!usuarioActual) return;
      // Usar id y caja del usuario logueado
      const { data: caiData } = await supabase
        .from("cai_facturas")
        .select("*")
        .eq("cajero_id", usuarioActual.id)
        .eq("caja_asignada", usuarioActual.caja)
        .single();
      if (caiData) {
        setCaiInfo({
          caja_asignada: caiData.caja_asignada,
          nombre_cajero: usuarioActual.usuario,
          cai: caiData.cai,
        });
        const rango_inicio = parseInt(caiData.rango_desde);
        const rango_fin = parseInt(caiData.rango_hasta);
        const caja = caiData.caja_asignada;
        const { data: facturasData } = await supabase
          .from("facturas")
          .select("factura")
          .eq("cajero_id", usuarioActual.id)
          .eq("caja", caja);
        let maxFactura = rango_inicio - 1;
        if (facturasData && facturasData.length > 0) {
          for (const f of facturasData) {
            const num = parseInt(f.factura);
            if (Number.isFinite(num) && num > maxFactura) {
              maxFactura = num;
            }
          }
          if (!Number.isFinite(maxFactura)) {
            setFacturaActual(rango_inicio.toString());
          } else if (maxFactura + 1 > rango_fin) {
            setFacturaActual("Límite alcanzado");
          } else {
            setFacturaActual((maxFactura + 1).toString());
          }
        } else {
          setFacturaActual(rango_inicio.toString());
        }
      } else {
        setFacturaActual("");
      }
    }
    fetchCaiYFactura();
  }, []);

  // Fetch products from Supabase
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const { data, error } = await supabase.from("productos").select("*");
        if (error) throw error;
        setProductos(data);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar productos");
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

  // Bloquear scroll global al montar
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Add product to selection
  const agregarProducto = (producto: Producto) => {
    setSeleccionados((prev) => {
      const existe = prev.find((p) => p.id === producto.id);
      if (existe) {
        return prev.map((p) =>
          p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p,
        );
      }
      return [...prev, { ...producto, cantidad: 1, tipo: producto.tipo }];
    });
  };

  // Remove product from selection
  const eliminarProducto = (id: string) => {
    setSeleccionados((prev) => {
      const existe = prev.find((p) => p.id === id);
      if (existe && existe.cantidad > 1) {
        return prev.map((p) =>
          p.id === id ? { ...p, cantidad: p.cantidad - 1 } : p,
        );
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  // Clear all selected products
  const limpiarSeleccion = () => {
    setSeleccionados([]);
  };

  // Calculate total
  const total = seleccionados.reduce(
    (sum, p) => sum + p.precio * p.cantidad,
    0,
  );

  // Filter products by type
  const productosFiltrados = productos.filter((p) => p.tipo === activeTab);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(255,255,255,0.95)",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        zIndex: 999,
      }}
    >
      {/* Botón cerrar sesión y volver si es admin */}
      <div
        style={{
          position: "absolute",
          top: 18,
          right: 32,
          display: "flex",
          gap: 12,
          zIndex: 10000,
        }}
      >
        {usuarioActual?.rol === "admin" && (
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 2px 8px #1976d222",
            }}
          >
            Volver
          </button>
        )}
        <button
          onClick={() => {
            localStorage.removeItem("usuario");
            window.location.reload();
          }}
          style={{
            background: "#d32f2f",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 22px",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 2px 8px #d32f2f22",
          }}
        >
          Cerrar sesión
        </button>
      </div>
      <h1
        style={{
          color: "#1976d2",
          marginBottom: 24,
          textAlign: "center",
          width: "100%",
          fontSize: "2.8rem",
          fontWeight: 800,
          letterSpacing: 2,
          background: "linear-gradient(90deg, #1976d2 60%, #388e3c 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          paddingTop: 32,
          paddingBottom: 8,
        }}
      >
        {caiInfo
          ? `${caiInfo.nombre_cajero} | Caja: ${caiInfo.caja_asignada}`
          : "Punto de Venta - Comedor"}
      </h1>
      {facturaActual && (
        <div
          style={{
            textAlign: "center",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: facturaActual === "Límite alcanzado" ? "#d32f2f" : "#388e3c",
            marginBottom: 12,
          }}
        >
          {facturaActual === "Límite alcanzado"
            ? "¡Límite de facturas alcanzado!"
            : `Factura actual: ${facturaActual}`}
        </div>
      )}
      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

      <div
        style={{
          display: "flex",
          gap: 24,
          width: "100%",
          height: "calc(100vh - 2px)",
          justifyContent: "center",
          alignItems: "stretch",
          marginBottom: "2px",
        }}
      >
        {/* Menu Section */}
        <div style={{ flex: 2, minWidth: 0 }}>
          {/* Tabs for Comida/Bebida */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
              borderBottom: "2px solid #e0e0e0",
            }}
          >
            <button
              onClick={() => setActiveTab("comida")}
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 18,
                fontWeight: activeTab === "comida" ? 700 : 400,
                color: activeTab === "comida" ? "#388e3c" : "#666",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === "comida" ? "3px solid #388e3c" : "none",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              Comidas
            </button>
            <button
              onClick={() => setActiveTab("bebida")}
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 18,
                fontWeight: activeTab === "bebida" ? 700 : 400,
                color: activeTab === "bebida" ? "#1976d2" : "#666",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === "bebida" ? "3px solid #1976d2" : "none",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              Bebidas
            </button>
          </div>

          {/* Product Grid */}
          {loading ? (
            <p style={{ textAlign: "center" }}>Cargando...</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 28,
                maxHeight: "60vh",
                overflowY: "auto",
                paddingRight: 8,
              }}
            >
              {productosFiltrados.map((p) => (
                <div
                  key={p.id}
                  onClick={() => agregarProducto(p)}
                  style={{
                    background: "#fff",
                    borderRadius: 18,
                    padding: 24,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    transition: "transform 0.2s",
                    minHeight: 260,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "scale(1.07)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  {p.imagen && (
                    <img
                      src={p.imagen}
                      alt={p.nombre}
                      style={{
                        width: 180,
                        height: 180,
                        objectFit: "cover",
                        borderRadius: 16,
                        marginBottom: 18,
                        boxShadow: "0 4px 16px #1976d222",
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 22,
                      color: activeTab === "comida" ? "#388e3c" : "#1976d2",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    {p.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      color: "#333",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    L {p.precio.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Summary Section */}
        <div
          style={{
            flex: 1,
            minWidth: 300,
            background: "#fffde7",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2
            style={{ color: "#fbc02d", marginBottom: 16, textAlign: "center" }}
          >
            Pedido Actual
          </h2>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#fbc02d",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            L {total.toFixed(2)}
          </div>
          {seleccionados.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center" }}>
              No hay productos seleccionados
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                flex: 1,
                overflowY: "auto",
                marginBottom: 16,
              }}
            >
              {seleccionados.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    background: "#fff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <span
                    style={{
                      flex: 2,
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#1976d2",
                    }}
                  >
                    {p.nombre}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: "#333",
                      textAlign: "center",
                    }}
                  >
                    L {p.precio.toFixed(2)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: "#388e3c",
                      textAlign: "center",
                    }}
                  >
                    x{p.cantidad}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    L {(p.precio * p.cantidad).toFixed(2)}
                  </span>
                  <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                    <button
                      onClick={() =>
                        agregarProducto(
                          productos.find((prod) => prod.id === p.id)!,
                        )
                      }
                      style={{
                        background: "#388e3c",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => eliminarProducto(p.id)}
                      style={{
                        background: "#d32f2f",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      −
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={limpiarSeleccion}
              style={{
                background: "#d32f2f",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
                opacity: seleccionados.length === 0 ? 0.5 : 1,
              }}
              disabled={seleccionados.length === 0}
            >
              Limpiar
            </button>
            <button
              style={{
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
                opacity: seleccionados.length === 0 ? 0.5 : 1,
              }}
              disabled={seleccionados.length === 0}
              onClick={() => setShowClienteModal(true)}
            >
              Confirmar Pedido
            </button>
          </div>
        </div>
      </div>

      {/* Modal para nombre del cliente */}
      {showClienteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 8px 32px rgba(25, 118, 210, 0.18)",
              padding: 32,
              minWidth: 350,
              maxWidth: 420,
              width: "100%",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <h3 style={{ color: "#1976d2", marginBottom: 12 }}>
              Cliente / Identidad
            </h3>
            <input
              type="text"
              placeholder="Nombre del cliente (opcional)"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value.toUpperCase())}
              style={{
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
                marginBottom: 8,
              }}
            />
            <input
              type="text"
              placeholder="Número de identidad (ej: 0801199901234)"
              value={identidadCliente}
              onChange={(e) => setIdentidadCliente(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <button
                onClick={async () => {
                  if (!identidadCliente.trim()) return;
                  const { data } = await supabase
                    .from("puntos_clientes")
                    .select("puntos")
                    .eq("identidad", identidadCliente)
                    .single();
                  setPuntosDisponibles(data?.puntos ?? 0);
                }}
                style={{
                  background: "#1976d2",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "8px 12px",
                }}
              >
                Buscar puntos
              </button>
              {puntosDisponibles !== null && (
                <div style={{ fontSize: 14, color: "#333" }}>
                  Puntos: <b>{puntosDisponibles}</b>
                </div>
              )}
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <input
                type="checkbox"
                checked={canjearPuntos}
                onChange={(e) => setCanjearPuntos(e.target.checked)}
              />{" "}
              Canjear puntos (1 punto = LPS 1)
            </label>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button
                onClick={() => {
                  setShowClienteModal(false);
                  setNombreCliente("");
                }}
                style={{
                  background: "#d32f2f",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (nombreCliente.trim()) {
                    setShowClienteModal(false);
                    setShowFacturaModal(true);
                  }
                }}
                style={{
                  background: "#1976d2",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: 16,
                }}
                disabled={!nombreCliente.trim()}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para requerir factura */}
      {showFacturaModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 8px 32px rgba(25, 118, 210, 0.18)",
              padding: 32,
              minWidth: 350,
              maxWidth: 420,
              width: "100%",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <h3 style={{ color: "#1976d2", marginBottom: 12 }}>
              ¿Requiere factura?
            </h3>
            <div style={{ display: "flex", gap: 32, justifyContent: "center" }}>
              <button
                onClick={async () => {
                  setShowFacturaModal(false);
                  setTimeout(async () => {
                    // Comanda con nombre del cliente y mejor formato
                    const comandaHtml = `
                      <div style='font-family:monospace; width:58mm; margin:0; padding:0;'>
                        <div style='font-size:20px; font-weight:700; color:#388e3c; text-align:center; margin-bottom:6px;'>COMANDA COCINA</div>
                        <div style='font-size:16px; font-weight:600; color:#222; text-align:center; margin-bottom:10px;'>Cliente: <b>${nombreCliente}</b></div>
                        <ul style='list-style:none; padding:0; margin-bottom:0;'>
                          ${seleccionados
                            .filter((p) => p.tipo === "comida")
                            .map(
                              (p) =>
                                `<li style='font-size:17px; margin-bottom:8px; border-bottom:1px dashed #eee; text-align:left;'><span style='font-weight:700; font-size:18px; color:#d32f2f;'>${p.cantidad}x</span> <span style='font-weight:700;'>${p.nombre}</span> <span style='float:right;'>L ${p.precio.toFixed(2)}</span></li>`,
                            )
                            .join("")}
                        </ul>
                      </div>
                    `;
                    // Comprobante con nombre, precio y cantidad
                    const comprobanteHtml = `
                      <div style='font-family:monospace; width:58mm; margin:0; padding:0;'>
                        <div style='font-size:20px; font-weight:700; color:#1976d2; text-align:center; margin-bottom:6px;'>COMPROBANTE CLIENTE</div>
                        <div style='font-size:16px; font-weight:600; color:#222; text-align:center; margin-bottom:10px;'>Cliente: <b>${nombreCliente}</b></div>
                        <ul style='list-style:none; padding:0; margin-bottom:0;'>
                          ${seleccionados.map((p) => `<li style='font-size:17px; margin-bottom:8px; border-bottom:1px dashed #eee; text-align:left;'><span style='font-weight:700; font-size:18px; color:#1565c0;'>${p.cantidad}x</span> <span style='font-weight:700;'>${p.nombre}</span> <span style='float:right;'>L ${p.precio.toFixed(2)}</span></li>`).join("")}
                        </ul>
                        <div style='font-weight:700; font-size:18px; margin-top:12px; text-align:right;'>Total: L ${total.toFixed(2)}</div>
                      </div>
                    `;
                    // Imprimir comanda
                    const printWindow = window.open(
                      "",
                      "",
                      "height=600,width=400",
                    );
                    if (printWindow) {
                      printWindow.document.write(
                        `<html><head><title>Comanda Cocina</title></head><body>${comandaHtml}</body></html>`,
                      );
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                      printWindow.close();
                    }
                    // Imprimir comprobante
                    const printWindow2 = window.open(
                      "",
                      "",
                      "height=600,width=400",
                    );
                    if (printWindow2) {
                      printWindow2.document.write(
                        `<html><head><title>Comprobante Cliente</title></head><body>${comprobanteHtml}</body></html>`,
                      );
                      printWindow2.document.close();
                      printWindow2.focus();
                      printWindow2.print();
                      printWindow2.close();
                    }
                    // Guardar venta en la tabla 'facturas' con nuevos campos
                    try {
                      const subTotal = seleccionados.reduce((sum, p) => {
                        if (p.tipo === "comida") {
                          return sum + (p.precio / 1.15) * p.cantidad;
                        } else if (p.tipo === "bebida") {
                          return sum + (p.precio / 1.18) * p.cantidad;
                        } else {
                          return sum + p.precio * p.cantidad;
                        }
                      }, 0);
                      const isv15 = seleccionados
                        .filter((p) => p.tipo === "comida")
                        .reduce(
                          (sum, p) =>
                            sum + (p.precio - p.precio / 1.15) * p.cantidad,
                          0,
                        );
                      const isv18 = seleccionados
                        .filter((p) => p.tipo === "bebida")
                        .reduce(
                          (sum, p) =>
                            sum + (p.precio - p.precio / 1.18) * p.cantidad,
                          0,
                        );
                      if (facturaActual === "Límite alcanzado") {
                        alert(
                          "¡Se ha alcanzado el límite de facturas para este cajero!",
                        );
                        return;
                      }
                      const factura = facturaActual;
                      const venta = {
                        fecha_hora: formatToHondurasLocal(),
                        cajero: usuarioActual?.usuario || "",
                        cajero_id: usuarioActual?.id || null,
                        caja:
                          caiInfo?.caja_asignada || usuarioActual?.caja || "",
                        cai: caiInfo && caiInfo.cai ? caiInfo.cai : "",
                        factura,
                        cliente: nombreCliente,
                        productos: JSON.stringify(
                          seleccionados.map((p) => ({
                            id: p.id,
                            nombre: p.nombre,
                            precio: p.precio,
                            cantidad: p.cantidad,
                            tipo: p.tipo,
                          })),
                        ),
                        sub_total: subTotal.toFixed(2),
                        isv_15: isv15.toFixed(2),
                        isv_18: isv18.toFixed(2),
                        total: seleccionados
                          .reduce((sum, p) => sum + p.precio * p.cantidad, 0)
                          .toFixed(2),
                      };
                      await supabase.from("facturas").insert([venta]);
                      // Manejo de puntos: canje y acumulación
                      try {
                        if (identidadCliente && identidadCliente.trim()) {
                          const cantidadPlatillos = seleccionados.reduce(
                            (s, p) =>
                              s + (p.tipo === "comida" ? p.cantidad : 0),
                            0,
                          );
                          const puntosGanados = 7 * cantidadPlatillos;
                          const { data: puntosData } = await supabase
                            .from("puntos_clientes")
                            .select("*")
                            .eq("identidad", identidadCliente)
                            .single();
                          let actuales = puntosData?.puntos ?? 0;
                          let puntosCanjeados = 0;
                          if (canjearPuntos && actuales > 0) {
                            puntosCanjeados = Math.min(
                              actuales,
                              Math.round(parseFloat(venta.total)),
                            );
                            actuales = actuales - puntosCanjeados;
                            await supabase
                              .from("puntos_historial")
                              .insert([
                                {
                                  identidad: identidadCliente,
                                  factura,
                                  puntos: -puntosCanjeados,
                                  descripcion: `Canje puntos - factura ${factura}`,
                                },
                              ]);
                          }
                          actuales = actuales + puntosGanados;
                          await supabase
                            .from("puntos_clientes")
                            .upsert(
                              {
                                identidad: identidadCliente,
                                nombre: nombreCliente,
                                puntos: actuales,
                              },
                              { onConflict: "identidad" },
                            );
                          if (puntosGanados > 0) {
                            await supabase
                              .from("puntos_historial")
                              .insert([
                                {
                                  identidad: identidadCliente,
                                  factura,
                                  puntos: puntosGanados,
                                  descripcion: `Acumulación ${puntosGanados} pts por venta ${factura}`,
                                },
                              ]);
                          }
                          if (puntosCanjeados > 0) {
                            const totalFinal = Math.max(
                              0,
                              parseFloat(venta.total) - puntosCanjeados,
                            );
                            await supabase
                              .from("facturas")
                              .update({ total: totalFinal.toFixed(2) })
                              .eq("factura", factura);
                          }
                        }
                      } catch (err) {
                        console.error("Error al procesar puntos:", err);
                      }
                      // Actualizar el número de factura actual en la vista
                      if (facturaActual !== "Límite alcanzado") {
                        setFacturaActual(
                          (parseInt(facturaActual) + 1).toString(),
                        );
                      }
                    } catch (err) {
                      console.error("Error al guardar la venta:", err);
                    }
                    // Limpiar selección después de imprimir
                    limpiarSeleccion();
                    setNombreCliente("");
                  }, 300);
                }}
                style={{
                  background: "#388e3c",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "10px 32px",
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                Sí
              </button>
              <button
                onClick={async () => {
                  setShowFacturaModal(false);
                  setTimeout(async () => {
                    const comandaHtml = `
                      <div style='font-family:monospace; width:58mm; margin:0; padding:0;'>
                        <div style='font-size:20px; font-weight:700; color:#388e3c; text-align:center; margin-bottom:6px;'>COMANDA COCINA</div>
                        <div style='font-size:16px; font-weight:600; color:#222; text-align:center; margin-bottom:10px;'>Cliente: <b>${nombreCliente}</b></div>
                        <ul style='list-style:none; padding:0; margin-bottom:0;'>
                          ${seleccionados
                            .filter((p) => p.tipo === "comida")
                            .map(
                              (p) =>
                                `<li style='font-size:17px; margin-bottom:8px; border-bottom:1px dashed #eee; text-align:left;'><span style='font-weight:700; font-size:18px; color:#d32f2f;'>${p.cantidad}x</span> <span style='font-weight:700;'>${p.nombre}</span> <span style='float:right;'>L ${p.precio.toFixed(2)}</span></li>`,
                            )
                            .join("")}
                        </ul>
                      </div>
                    `;
                    const comprobanteHtml = `
                      <div style='font-family:monospace; width:58mm; margin:0; padding:0;'>
                        <div style='font-size:20px; font-weight:700; color:#1976d2; text-align:center; margin-bottom:6px;'>COMPROBANTE CLIENTE</div>
                        <div style='font-size:16px; font-weight:600; color:#222; text-align:center; margin-bottom:10px;'>Cliente: <b>${nombreCliente}</b></div>
                        <ul style='list-style:none; padding:0; margin-bottom:0;'>
                          ${seleccionados.map((p) => `<li style='font-size:17px; margin-bottom:8px; border-bottom:1px dashed #eee; text-align:left;'><span style='font-weight:700; font-size:18px; color:#1565c0;'>${p.cantidad}x</span> <span style='font-weight:700;'>${p.nombre}</span> <span style='float:right;'>L ${p.precio.toFixed(2)}</span></li>`).join("")}
                        </ul>
                        <div style='font-weight:700; font-size:18px; margin-top:12px; text-align:right;'>Total: L ${total.toFixed(2)}</div>
                      </div>
                    `;
                    const printWindow = window.open(
                      "",
                      "",
                      "height=600,width=400",
                    );
                    if (printWindow) {
                      printWindow.document.write(
                        `<html><head><title>Comanda Cocina</title></head><body>${comandaHtml}</body></html>`,
                      );
                      printWindow.document.close();
                      printWindow.focus();
                      printWindow.print();
                      printWindow.close();
                    }
                    const printWindow2 = window.open(
                      "",
                      "",
                      "height=600,width=400",
                    );
                    if (printWindow2) {
                      printWindow2.document.write(
                        `<html><head><title>Comprobante Cliente</title></head><body>${comprobanteHtml}</body></html>`,
                      );
                      printWindow2.document.close();
                      printWindow2.focus();
                      printWindow2.print();
                      printWindow2.close();
                    }
                    try {
                      // Cálculo correcto de sub_total, isv_15, isv_18 y total
                      const subTotal = seleccionados.reduce((sum, p) => {
                        if (p.tipo === "comida") {
                          return sum + (p.precio / 1.15) * p.cantidad;
                        } else if (p.tipo === "bebida") {
                          return sum + (p.precio / 1.18) * p.cantidad;
                        } else {
                          return sum + p.precio * p.cantidad;
                        }
                      }, 0);
                      const isv15 = seleccionados
                        .filter((p) => p.tipo === "comida")
                        .reduce(
                          (sum, p) =>
                            sum + (p.precio - p.precio / 1.15) * p.cantidad,
                          0,
                        );
                      const isv18 = seleccionados
                        .filter((p) => p.tipo === "bebida")
                        .reduce(
                          (sum, p) =>
                            sum + (p.precio - p.precio / 1.18) * p.cantidad,
                          0,
                        );
                      if (facturaActual === "Límite alcanzado") {
                        alert(
                          "¡Se ha alcanzado el límite de facturas para este cajero!",
                        );
                        return;
                      }
                      const factura = facturaActual;
                      const venta = {
                        fecha_hora: formatToHondurasLocal(),
                        cajero: usuarioActual?.nombre || "",
                        cajero_id: usuarioActual?.id || null,
                        caja: caiInfo?.caja_asignada || "",
                        cai: caiInfo && caiInfo.cai ? caiInfo.cai : "",
                        factura,
                        cliente: nombreCliente,
                        productos: JSON.stringify(
                          seleccionados.map((p) => ({
                            id: p.id,
                            nombre: p.nombre,
                            precio: p.precio,
                            cantidad: p.cantidad,
                            tipo: p.tipo,
                          })),
                        ),
                        sub_total: subTotal.toFixed(2),
                        isv_15: isv15.toFixed(2),
                        isv_18: isv18.toFixed(2),
                        total: seleccionados
                          .reduce((sum, p) => sum + p.precio * p.cantidad, 0)
                          .toFixed(2),
                      };
                      await supabase.from("facturas").insert([venta]);
                      // Manejo de puntos: canje y acumulación (segundo branch)
                      try {
                        if (identidadCliente && identidadCliente.trim()) {
                          const cantidadPlatillos = seleccionados.reduce(
                            (s, p) =>
                              s + (p.tipo === "comida" ? p.cantidad : 0),
                            0,
                          );
                          const puntosGanados = 7 * cantidadPlatillos;
                          const { data: puntosData } = await supabase
                            .from("puntos_clientes")
                            .select("*")
                            .eq("identidad", identidadCliente)
                            .single();
                          let actuales = puntosData?.puntos ?? 0;
                          let puntosCanjeados = 0;
                          if (canjearPuntos && actuales > 0) {
                            puntosCanjeados = Math.min(
                              actuales,
                              Math.round(parseFloat(venta.total)),
                            );
                            actuales = actuales - puntosCanjeados;
                            await supabase
                              .from("puntos_historial")
                              .insert([
                                {
                                  identidad: identidadCliente,
                                  factura,
                                  puntos: -puntosCanjeados,
                                  descripcion: `Canje puntos - factura ${factura}`,
                                },
                              ]);
                          }
                          actuales = actuales + puntosGanados;
                          await supabase
                            .from("puntos_clientes")
                            .upsert(
                              {
                                identidad: identidadCliente,
                                nombre: nombreCliente,
                                puntos: actuales,
                              },
                              { onConflict: "identidad" },
                            );
                          if (puntosGanados > 0) {
                            await supabase
                              .from("puntos_historial")
                              .insert([
                                {
                                  identidad: identidadCliente,
                                  factura,
                                  puntos: puntosGanados,
                                  descripcion: `Acumulación ${puntosGanados} pts por venta ${factura}`,
                                },
                              ]);
                          }
                          if (puntosCanjeados > 0) {
                            const totalFinal = Math.max(
                              0,
                              parseFloat(venta.total) - puntosCanjeados,
                            );
                            await supabase
                              .from("facturas")
                              .update({ total: totalFinal.toFixed(2) })
                              .eq("factura", factura);
                          }
                        }
                      } catch (err) {
                        console.error("Error al procesar puntos:", err);
                      }
                      if (facturaActual !== "Límite alcanzado") {
                        setFacturaActual(
                          (parseInt(facturaActual) + 1).toString(),
                        );
                      }
                    } catch (err) {
                      console.error("Error al guardar la venta:", err);
                    }
                    limpiarSeleccion();
                    setNombreCliente("");
                  }, 300);
                }}
                style={{
                  background: "#1976d2",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "10px 32px",
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
