import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface Producto {
  id?: string;
  codigo: number;
  nombre: string;
  imagen: string;
  precio: number;
  costo?: number;
  tipo: string;
  tipo_impuesto: string;
  impuesto: number;
  sub_total: number;
  subcategoria?: string;
}

interface InventarioViewProps {
  onBack: () => void;
}

// use centralized supabase client from src/supabaseClient.ts

function generarCodigo() {
  return Math.floor(100000 + Math.random() * 900000);
}

export default function InventarioView({ onBack }: InventarioViewProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Partial<Producto>>({
    tipo: "comida",
    tipo_impuesto: "venta",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);
  // filtro para mostrar tipo de producto: 'comida' | 'bebida' | 'complemento'
  const [filtroTipo, setFiltroTipo] = useState<
    "comida" | "bebida" | "complemento"
  >("comida");

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const { data, error } = await supabase.from("productos").select("*");
        if (error) throw error;
        setProductos(data || []);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar inventario");
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

  const calcularImpuesto = (precio: number, tipo_impuesto: string) => {
    if (tipo_impuesto === "venta") return precio * 0.15;
    if (tipo_impuesto === "alcohol") return precio * 0.18;
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let imagenUrl = form.imagen || "";
    const precio = form.precio || 0;
    const tipo_impuesto = form.tipo_impuesto || "venta";
    const impuesto = calcularImpuesto(precio, tipo_impuesto);
    const sub_total = precio + impuesto;

    try {
      if (imagenFile) {
        const extension = imagenFile.name.split(".").pop();
        const randomNum = Math.floor(Math.random() * 1000000000);
        const nombreArchivo = `${Date.now()}${randomNum}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("inventario")
          .upload(nombreArchivo, imagenFile, {
            upsert: true,
            contentType: imagenFile.type || "application/octet-stream",
          });
        if (uploadError)
          throw new Error("Error al subir imagen: " + uploadError.message);

        const { data } = supabase.storage
          .from("inventario")
          .getPublicUrl(nombreArchivo);
        imagenUrl = data.publicUrl;
      }

      const body = {
        codigo: form.codigo || generarCodigo(),
        nombre: form.nombre,
        precio,
        costo: form.costo ?? null,
        tipo: form.tipo,
        tipo_impuesto,
        impuesto,
        sub_total,
        imagen: imagenUrl,
        subcategoria: form.tipo === "comida" ? form.subcategoria || null : null,
      };

      // let result;
      if (editId) {
        const { error } = await supabase
          .from("productos")
          .update(body)
          .eq("id", editId)
          .select()
          .single();
        if (error) throw error;
        // result = data;
      } else {
        const { error } = await supabase
          .from("productos")
          .insert([body])
          .select()
          .single();
        if (error) throw error;
        // result = data;
      }

      setShowModal(false);
      setForm({ tipo: "comida", tipo_impuesto: "venta" });
      setImagenFile(null);
      setEditId(null);

      const { data: updated } = await supabase.from("productos").select("*");
      setProductos(updated || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Error al guardar producto");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar producto permanentemente?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
      setProductos(productos.filter((p) => p.id !== id));
      setLoading(false);
    } catch {
      setError("Error al eliminar producto");
      setLoading(false);
    }
  };

  const handleEdit = (producto: Producto) => {
    setEditId(producto.id ?? null);
    setForm(producto);
    setImagenFile(null);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditId(null);
    setForm({ tipo: "comida", tipo_impuesto: "venta" });
    setImagenFile(null);
    setShowModal(true);
  };

  const totalProductos = productos.length;
  const totalValor = productos.reduce((sum, p) => sum + p.sub_total, 0);
  const comidaCount = productos.filter((p) => p.tipo === "comida").length;
  const bebidaCount = productos.filter((p) => p.tipo === "bebida").length;
  const complementoCount = productos.filter(
    (p) => p.tipo === "complemento",
  ).length;

  return (
    <div
      className="inventario-enterprise"
      style={{
        width: "100vw",
        height: "100vh",
        minHeight: "100vh",
        minWidth: "100vw",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <style>{`
        body, #root {
          width: 100vw !important;
          height: 100vh !important;
          min-width: 100vw !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          display: block !important;
          max-width: none !important;
          background: unset !important;
        }
        :root {
          --primary: #ffffff;
          --secondary: #f8fafc;
          --accent: #3b82f6;
          --text-primary: #0f172a;
          --text-secondary: #64748b;
          --border: #e2e8f0;
          --shadow: 0 4px 20px rgba(0,0,0,0.06);
          --shadow-hover: 0 12px 32px rgba(0,0,0,0.12);
          --success: #10b981;
          --danger: #ef4444;
          --warning: #f59e0b;
        }

        .inventario-enterprise {
          min-height: 100vh;
          min-width: 100vw;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden;
        }

        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 1.5rem 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: #f1f5f9;
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-back:hover {
          background: #e2e8f0;
          border-color: var(--accent);
        }

        .page-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .btn-primary {
          background: linear-gradient(135deg, #2e7d32, #4caf50);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(46,125,50,0.4);
        }

        .main-content {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: var(--shadow);
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--accent);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .table-container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
          margin-bottom: 2rem;
          border: 1px solid var(--border);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th {
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border);
        }

        .table td {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }

  /* Cards para móvil: ocultas por defecto en escritorio */
  .cards-grid { display: none; }
  .mobile-filters { display: none; }
        .product-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .product-card img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; }
        .product-card .card-body { flex: 1; }
        .product-card .card-title { font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .product-card .card-meta { color: var(--text-secondary); font-size: 0.9rem; }

        .table tr:hover {
          background: rgba(255,255,255,0.05);
        }

        .product-image {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid var(--border);
        }

        .btn-table {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-right: 8px;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .btn-edit { 
          background: rgba(255,152,0,0.2); 
          color: #ff9800; 
        }

        .btn-edit:hover { background: rgba(255,152,0,0.3); }

        .btn-delete { 
          background: rgba(198,40,40,0.2); 
          color: #c62828; 
        }

        .btn-delete:hover { background: rgba(198,40,40,0.3); }

        .error {
          background: rgba(198,40,40,0.1);
          color: #c62828;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid var(--danger);
          margin-bottom: 1rem;
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15,23,42,0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          backdrop-filter: blur(20px);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 0;
          min-width: 520px;
          max-width: 92vw;
          max-height: 93vh;
          overflow-y: auto;
          box-shadow: 0 24px 64px rgba(0,0,0,0.22);
        }

        .modal-hero {
          background: linear-gradient(135deg, #1e3a5f 0%, #2e7d32 100%);
          border-radius: 24px 24px 0 0;
          padding: 1.75rem 2rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .modal-hero-info { flex: 1; }

        .modal-hero-badge {
          display: inline-block;
          background: rgba(255,255,255,0.18);
          color: #fff;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 20px;
          margin-bottom: 0.4rem;
        }

        .modal-hero-title {
          color: #fff;
          font-size: 1.35rem;
          font-weight: 700;
          margin: 0;
        }

        .modal-hero-close {
          background: rgba(255,255,255,0.15);
          border: none;
          color: #fff;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          font-size: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .modal-hero-close:hover { background: rgba(255,255,255,0.3); }

        .modal-body {
          padding: 1.75rem 2rem;
        }

        .modal-section {
          margin-bottom: 1.5rem;
        }

        .modal-section-title {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 0.85rem;
          padding-bottom: 0.4rem;
          border-bottom: 1px solid var(--border);
        }

        .price-preview {
          background: linear-gradient(135deg, #f0fdf4, #e0f2fe);
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          display: flex;
          gap: 1.5rem;
          align-items: center;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }

        .price-preview-item {
          text-align: center;
          flex: 1;
          min-width: 80px;
        }

        .price-preview-value {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .price-preview-value.ganancia-pos { color: #16a34a; }
        .price-preview-value.ganancia-neg { color: #dc2626; }

        .price-preview-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .form-label {
          display: block;
          color: var(--text-primary);
          font-weight: 600;
          margin-bottom: 0.4rem;
          font-size: 0.875rem;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .modal-title {
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.5rem;
          cursor: pointer;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close:hover {
          background: rgba(255,255,255,0.1);
          color: var(--text-primary);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-input, .form-select {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #4caf50;
          box-shadow: 0 0 0 3px rgba(76,175,80,0.1);
        }

        .form-file {
          padding: 12px;
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .header { padding: 1rem; flex-direction: column; gap: 1rem; }
          .main-content { padding: 1rem; }
          .form-grid { grid-template-columns: 1fr; }
          .modal { margin: 1rem; padding: 1.5rem; }
          /* En móvil ocultar tablas y mostrar cards */
          .table { display: none; }
          .table-container { box-shadow: none; }
          .cards-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; width: 100%; }
          .mobile-filters { display: flex; gap: 8px; margin-bottom: 1rem; flex-wrap: wrap; }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>
            ← Volver
          </button>
          <h1 className="page-title">Control de Inventario</h1>
        </div>
        <button className="btn-primary" onClick={handleNew}>
          ➕ Nuevo Producto
        </button>
      </header>

      <main className="main-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{totalProductos}</div>
            <div className="stat-label">Total Productos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{comidaCount}</div>
            <div className="stat-label">Comida</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{bebidaCount}</div>
            <div className="stat-label">Bebidas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{complementoCount}</div>
            <div className="stat-label">Complementos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">L {totalValor.toFixed(2)}</div>
            <div className="stat-label">Valor Total</div>
          </div>
        </div>
        {/* Cards view para móviles: mostramos todos los productos filtrados por tipo */}
        <div
          style={{
            width: "100%",
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 1rem",
          }}
        >
          {/* Filtros visibles en móvil (aparecen justo antes de las cards) */}
          <div className="mobile-filters">
            <button
              className="btn-table"
              style={{
                background:
                  filtroTipo === "comida"
                    ? "rgba(46,125,50,0.15)"
                    : "transparent",
                color: "#4caf50",
              }}
              onClick={() => setFiltroTipo("comida")}
            >
              🍽️ Comida
            </button>
            <button
              className="btn-table"
              style={{
                background:
                  filtroTipo === "bebida"
                    ? "rgba(255,152,0,0.12)"
                    : "transparent",
                color: "#ff9800",
              }}
              onClick={() => setFiltroTipo("bebida")}
            >
              🥤 Bebida
            </button>
            <button
              className="btn-table"
              style={{
                background:
                  filtroTipo === "complemento"
                    ? "rgba(156,39,176,0.12)"
                    : "transparent",
                color: "#9c27b0",
              }}
              onClick={() => setFiltroTipo("complemento")}
            >
              🧂 Complemento
            </button>
          </div>
          <div className="cards-grid">
            {productos
              .filter((p) => p.tipo === filtroTipo)
              .map((p) => (
                <div className="product-card" key={p.id}>
                  {p.imagen ? (
                    <img src={p.imagen} alt={p.nombre} />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 8,
                      }}
                    />
                  )}
                  <div className="card-body">
                    <div className="card-title">
                      {p.nombre}{" "}
                      <span
                        style={{
                          fontWeight: 600,
                          marginLeft: 8,
                          color: "var(--text-secondary)",
                        }}
                      >
                        #{p.codigo}
                      </span>
                    </div>
                    <div className="card-meta">
                      Precio:{" "}
                      <strong style={{ color: "#4caf50" }}>
                        L {p.precio.toFixed(2)}
                      </strong>
                      {p.costo != null && (
                        <>
                          {" "}
                          · Costo:{" "}
                          <strong style={{ color: "#f59e0b" }}>
                            L {p.costo.toFixed(2)}
                          </strong>
                        </>
                      )}
                    </div>
                    {p.costo != null && (
                      <div className="card-meta">
                        Ganancia:{" "}
                        <strong
                          style={{
                            color:
                              p.precio - p.costo >= 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          L {(p.precio - p.costo).toFixed(2)}
                        </strong>
                      </div>
                    )}
                    <div className="card-meta">
                      Impuesto: {p.tipo_impuesto === "venta" ? "15%" : "18%"} ·
                      Subtotal: L {p.sub_total.toFixed(2)}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <button
                      className="btn-table btn-edit"
                      onClick={() => handleEdit(p)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn-table btn-delete"
                      onClick={() => handleDelete(p.id!)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Error */}
        {error && <div className="error">⚠️ {error}</div>}

        {/* Filtro tipo (Todos / Comida / Bebida) */}
        <div
          style={{
            display: "flex",
            gap: 8,
            margin: "1rem 0",
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn-table"
            style={{
              background:
                filtroTipo === "comida"
                  ? "rgba(46,125,50,0.15)"
                  : "transparent",
              color: "#4caf50",
            }}
            onClick={() => setFiltroTipo("comida")}
          >
            🍽️ Comida
          </button>
          <button
            className="btn-table"
            style={{
              background:
                filtroTipo === "bebida"
                  ? "rgba(255,152,0,0.12)"
                  : "transparent",
              color: "#ff9800",
            }}
            onClick={() => setFiltroTipo("bebida")}
          >
            🥤 Bebida
          </button>
          <button
            className="btn-table"
            style={{
              background:
                filtroTipo === "complemento"
                  ? "rgba(156,39,176,0.12)"
                  : "transparent",
              color: "#9c27b0",
            }}
            onClick={() => setFiltroTipo("complemento")}
          >
            🧂 Complemento
          </button>
        </div>
        {/* Tablas separadas */}
        {loading ? (
          <div className="loading">⏳ Cargando inventario...</div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
              maxWidth: "1400px",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <h2
                style={{
                  color: "#fff",
                  marginBottom: "1rem",
                  marginTop: "2rem",
                  textAlign: "center",
                }}
              >
                {filtroTipo === "comida" && "🍽️ Comidas"}
                {filtroTipo === "bebida" && "🥤 Bebidas"}
                {filtroTipo === "complemento" && "🧂 Complementos"}
              </h2>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Imagen</th>
                      <th>Precio</th>
                      <th>Costo</th>
                      <th>Ganancia</th>
                      <th>Impuesto</th>
                      <th>Subtotal</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos
                      .filter((p) => p.tipo === filtroTipo)
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.codigo}</strong>
                          </td>
                          <td>{p.nombre}</td>
                          <td>
                            {p.imagen ? (
                              <img
                                src={p.imagen}
                                alt={p.nombre}
                                className="product-image"
                              />
                            ) : (
                              <span style={{ color: "#666" }}>Sin imagen</span>
                            )}
                          </td>
                          <td style={{ color: "#4caf50", fontWeight: 600 }}>
                            L {p.precio.toFixed(2)}
                          </td>
                          <td style={{ color: "#f59e0b", fontWeight: 600 }}>
                            {p.costo != null ? (
                              `L ${p.costo.toFixed(2)}`
                            ) : (
                              <span
                                style={{ color: "#94a3b8", fontSize: "0.8rem" }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            {p.costo != null ? (
                              <span
                                style={{
                                  fontWeight: 700,
                                  color:
                                    p.precio - p.costo >= 0
                                      ? "#16a34a"
                                      : "#dc2626",
                                }}
                              >
                                L {(p.precio - p.costo).toFixed(2)}
                              </span>
                            ) : (
                              <span
                                style={{ color: "#94a3b8", fontSize: "0.8rem" }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td>{p.tipo_impuesto === "venta" ? "15%" : "18%"}</td>
                          <td>L {p.sub_total.toFixed(2)}</td>
                          <td>
                            <button
                              className="btn-table btn-edit"
                              onClick={() => handleEdit(p)}
                            >
                              Editar
                            </button>
                            <button
                              className="btn-table btn-delete"
                              onClick={() => handleDelete(p.id!)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              {/* Hero Header */}
              <div className="modal-hero">
                <div className="modal-hero-info">
                  <div className="modal-hero-badge">
                    {editId ? "Editar registro" : "Nuevo registro"}
                  </div>
                  <h3 className="modal-hero-title">
                    {editId ? "✏️ Editar Producto" : "➕ Agregar Producto"}
                  </h3>
                </div>
                <button
                  className="modal-hero-close"
                  onClick={() => setShowModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <form onSubmit={handleSubmit}>
                  {/* SECCIÓN: Información básica */}
                  <div className="modal-section">
                    <div className="modal-section-title">
                      📋 Información básica
                    </div>
                    <div style={{ marginBottom: "1rem" }}>
                      <label className="form-label">
                        Nombre del Producto *
                      </label>
                      <input
                        className="form-input"
                        style={{ width: "100%", boxSizing: "border-box" }}
                        type="text"
                        placeholder="Ej: Pollo Asado, Coca Cola, Salsa BBQ"
                        value={form.nombre || ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, nombre: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="form-grid">
                      <div>
                        <label className="form-label">🏷️ Categoría</label>
                        <select
                          className="form-select"
                          style={{ width: "100%" }}
                          value={form.tipo || "comida"}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, tipo: e.target.value }))
                          }
                        >
                          <option value="comida">🍽️ Comida</option>
                          <option value="bebida">🥤 Bebida</option>
                          <option value="complemento">🧂 Complemento</option>
                        </select>
                      </div>
                      {form.tipo === "comida" && (
                        <div>
                          <label className="form-label">🍴 Subcategoría</label>
                          <input
                            type="text"
                            list="subcategorias-list"
                            className="form-input"
                            style={{ width: "100%", boxSizing: "border-box" }}
                            value={form.subcategoria || ""}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                subcategoria: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="ROSTIZADOS, FRITOS…"
                          />
                          <datalist id="subcategorias-list">
                            <option value="ROSTIZADOS" />
                            <option value="FRITOS" />
                            <option value="TACOS" />
                            <option value="ASADOS" />
                          </datalist>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECCIÓN: Precios */}
                  <div className="modal-section">
                    <div className="modal-section-title">💰 Precios</div>
                    <div
                      className="form-grid"
                      style={{ gridTemplateColumns: "1fr 1fr" }}
                    >
                      <div>
                        <label className="form-label">
                          Precio de Venta (L) *
                        </label>
                        <input
                          className="form-input"
                          style={{ width: "100%", boxSizing: "border-box" }}
                          type="number"
                          placeholder="0.00"
                          value={form.precio || ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              precio: Number(e.target.value),
                            }))
                          }
                          required
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="form-label">Costo (L)</label>
                        <input
                          className="form-input"
                          style={{ width: "100%", boxSizing: "border-box" }}
                          type="number"
                          placeholder="0.00"
                          value={form.costo ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              costo:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            }))
                          }
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                    {/* Preview de ganancia */}
                    <div className="price-preview">
                      <div className="price-preview-item">
                        <div className="price-preview-value">
                          L {(form.precio || 0).toFixed(2)}
                        </div>
                        <div className="price-preview-label">Precio venta</div>
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: "1.2rem" }}>
                        −
                      </div>
                      <div className="price-preview-item">
                        <div className="price-preview-value">
                          L {(form.costo ?? 0).toFixed(2)}
                        </div>
                        <div className="price-preview-label">Costo</div>
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: "1.2rem" }}>
                        =
                      </div>
                      <div className="price-preview-item">
                        <div
                          className={`price-preview-value ${
                            form.costo != null
                              ? (form.precio || 0) - form.costo >= 0
                                ? "ganancia-pos"
                                : "ganancia-neg"
                              : ""
                          }`}
                        >
                          {form.costo != null
                            ? `L ${((form.precio || 0) - form.costo).toFixed(2)}`
                            : "—"}
                        </div>
                        <div className="price-preview-label">Ganancia</div>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN: Impuesto */}
                  <div className="modal-section">
                    <div className="modal-section-title">📊 Impuesto</div>
                    <select
                      className="form-select"
                      style={{ width: "100%" }}
                      value={form.tipo_impuesto || "venta"}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tipo_impuesto: e.target.value,
                        }))
                      }
                    >
                      <option value="venta">🧾 Venta (15%)</option>
                      <option value="alcohol">🍺 Alcohol (18%)</option>
                    </select>
                  </div>

                  {/* SECCIÓN: Imagen */}
                  <div className="modal-section">
                    <div className="modal-section-title">
                      📷 Imagen del Producto
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setImagenFile(e.target.files?.[0] || null)
                      }
                      className="form-file"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                    {form.imagen && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <img
                          src={form.imagen}
                          alt="preview"
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 8,
                            objectFit: "cover",
                            border: "1px solid var(--border)",
                          }}
                        />
                        <small style={{ color: "var(--text-secondary)" }}>
                          ✅ Imagen actual
                        </small>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      padding: "14px",
                      fontSize: "1rem",
                    }}
                  >
                    {loading
                      ? "⏳ Guardando..."
                      : editId
                        ? "💾 Guardar Cambios"
                        : "✅ Crear Producto"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
