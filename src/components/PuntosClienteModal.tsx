import { useState } from "react";

interface PuntosClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  fetchPuntos: (identidad: string) => Promise<any | null>;
  fetchProductosComida: () => Promise<any[]>;
  onCanjear: (
    identidad: string,
    clienteNombre: string | null,
    producto: any,
  ) => Promise<void>;
}

export default function PuntosClienteModal({
  isOpen,
  onClose,
  fetchPuntos,
  fetchProductosComida,
  onCanjear,
}: PuntosClienteModalProps) {
  const [identidad, setIdentidad] = useState("");
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState<any | null>(null);
  const [productos, setProductos] = useState<any[] | null>(null);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [selectedProd, setSelectedProd] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConsultar = async () => {
    setLoading(true);
    setError(null);
    setCliente(null);
    try {
      const c = await fetchPuntos(identidad.trim());
      if (!c) {
        setError("Cliente no encontrado o sin puntos registrados.");
        setCliente(null);
      } else {
        setCliente(c);
      }
    } catch (e: any) {
      setError(e?.message || "Error consultando puntos");
    } finally {
      setLoading(false);
    }
  };

  const handleMostrarProductos = async () => {
    setLoadingProductos(true);
    try {
      const prods = await fetchProductosComida();
      setProductos(prods || []);
    } catch (e) {
      setProductos([]);
    } finally {
      setLoadingProductos(false);
    }
  };

  const handleSeleccionar = (p: any) => {
    setSelectedProd(p);
    setConfirmOpen(true);
  };

  const handleConfirmCanjear = async () => {
    if (!selectedProd) return;
    setError(null);
    try {
      const precio = Number(selectedProd.precio || 0);
      const puntosCliente = Number(cliente?.puntos || 0);
      if (puntosCliente < precio)
        throw new Error("Puntos insuficientes para canjear este producto");
      await onCanjear(identidad.trim(), cliente?.nombre || null, selectedProd);
      // refresh cliente puntos
      const refreshed = await fetchPuntos(identidad.trim());
      setCliente(refreshed);
      setConfirmOpen(false);
    } catch (e: any) {
      setError(e?.message || "Error al canjear");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200000,
        padding: 12,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg,#ffffff, #f8fafc)",
          borderRadius: 12,
          width: "min(820px, 96vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 16,
          boxShadow: "0 20px 40px rgba(2,6,23,0.12)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 20, color: "#064e3b" }}>
              Puntos Cliente
            </h3>
            <div style={{ fontSize: 12, color: "#475569" }}>
              Consultar y canjear puntos por platillos
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 6,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            value={identidad}
            onChange={(e) => setIdentidad(e.target.value)}
            placeholder="Número de identidad"
            style={{
              padding: 10,
              flex: 1,
              minWidth: 180,
              borderRadius: 8,
              border: "1px solid #e6e9ef",
            }}
          />
          <button
            onClick={handleConsultar}
            disabled={loading || !identidad.trim()}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#06b6d4",
              color: "#fff",
              border: "none",
            }}
          >
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </div>

        {error && (
          <div style={{ color: "#9f1239", marginTop: 10 }}>{error}</div>
        )}

        {cliente && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>
                {cliente.nombre || "—"}
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Identidad: {cliente.identidad}
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#065f46" }}>
                {cliente.puntos || 0} pts
              </div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Equivalente Lps: {cliente.puntos || 0}
              </div>
            </div>
            <div>
              <button
                onClick={async () => {
                  await handleMostrarProductos();
                }}
                className="btn-modern"
                style={{
                  marginLeft: 12,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  color: "#92400e",
                }}
              >
                Canjear
              </button>
            </div>
          </div>
        )}

        {loadingProductos && (
          <div style={{ marginTop: 12 }}>Cargando productos…</div>
        )}

        {productos && productos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8, color: "#0f172a" }}>
              Seleccione platillo para canjear
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                maxHeight: 360,
                overflowY: "auto",
                padding: 2,
              }}
            >
              {productos.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>
                    {p.nombre}
                  </div>
                  <div style={{ color: "#64748b" }}>
                    L {Number(p.precio || 0).toFixed(2)}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => handleSeleccionar(p)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "#e0f2fe",
                        border: "1px solid #bae6fd",
                        color: "#0369a1",
                      }}
                    >
                      Seleccionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {confirmOpen && selectedProd && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              border: "1px dashed #cbd5e1",
              borderRadius: 10,
              background: "#fff7ed",
            }}
          >
            <div style={{ fontWeight: 900, color: "#92400e" }}>
              Confirmar canje
            </div>
            <div style={{ marginTop: 8, color: "#0f172a" }}>
              Se generará el canje del platillo{" "}
              <strong>{selectedProd.nombre}</strong> y se registrará la venta
              con monto 0.
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ marginLeft: "auto", color: "#475569" }}>
                Precio requerido:{" "}
                <strong>L {Number(selectedProd.precio || 0).toFixed(2)}</strong>
              </div>
              <div style={{ minWidth: 220, textAlign: "right" }}>
                <button
                  onClick={handleConfirmCanjear}
                  disabled={
                    !cliente ||
                    Number(cliente.puntos || 0) <
                      Number(selectedProd.precio || 0)
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background:
                      Number(cliente?.puntos || 0) >=
                      Number(selectedProd.precio || 0)
                        ? "#10b981"
                        : "#94a3b8",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  Confirmar canje
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  style={{
                    marginLeft: 8,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#efefef",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
            {cliente &&
              Number(cliente.puntos || 0) <
                Number(selectedProd.precio || 0) && (
                <div
                  style={{ marginTop: 8, color: "#9f1239", fontWeight: 700 }}
                >
                  Puntos insuficientes para canjear este producto.
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
