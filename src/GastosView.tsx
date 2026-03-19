import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

interface GastosViewProps {
  onBack?: () => void;
}

interface Gasto {
  id: number;
  fecha: string;
  monto: string;
  motivo: string;
}

export default function GastosView({ onBack }: GastosViewProps) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  // Obtener usuario actual desde localStorage para aplicar filtros por cajero
  const usuarioActual = (() => {
    try {
      const stored = localStorage.getItem("usuario");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoTotal, setMontoTotal] = useState(0);
  const [nuevoGasto, setNuevoGasto] = useState({
    fecha: "",
    monto: "",
    motivo: "",
    cajero_id: "",
    caja: "",
  });
  const [cajeros, setCajeros] = useState<
    Array<{ id: string; nombre: string; rol?: string }>
  >([]);
  const [cajaOptions, setCajaOptions] = useState<string[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editGasto, setEditGasto] = useState({
    fecha: "",
    monto: "",
    motivo: "",
  });
  const [loading, setLoading] = useState(false);
  const [showModalGasto, setShowModalGasto] = useState(false);

  useEffect(() => {
    fetchGastos();
    // Cargar lista de cajeros para que el admin pueda asignar al crear un gasto
    (async () => {
      try {
        const { data } = await supabase
          .from("usuarios")
          .select("id,nombre,rol")
          .in("rol", ["cajero", "Admin"]);
        setCajeros(data || []);
      } catch (e) {
        console.warn("No se pudo obtener la lista de cajeros:", e);
      }
    })();
  }, []);

  async function fetchGastos() {
    setLoading(true);
    try {
      // Construir query base
      let query = supabase
        .from("gastos")
        .select("*")
        .order("fecha", { ascending: false });

      // Si hay filtro por fecha
      if (fechaDesde && fechaHasta) {
        query = supabase
          .from("gastos")
          .select("*")
          .gte("fecha", fechaDesde)
          .lte("fecha", fechaHasta)
          .order("fecha", { ascending: false });
      }

      // Si el usuario es cajero, limitar los gastos a los de su cajero_id y caja asignada
      if (usuarioActual && usuarioActual.rol === "cajero") {
        // Determinar caja asignada (intentar leerla desde una tabla cai_facturas)
        let cajaAsignada = null as string | null;
        try {
          const { data: caiData } = await supabase
            .from("cai_facturas")
            .select("caja_asignada")
            .eq("cajero_id", usuarioActual.id)
            .single();
          cajaAsignada = caiData?.caja_asignada || null;
        } catch (e) {
          // ignore and proceed without caja filter if lookup fails
          cajaAsignada = null;
        }
        query = query.eq("cajero_id", usuarioActual.id);
        if (cajaAsignada) query = query.eq("caja", cajaAsignada);
      }
      const { data } = await query;
      setGastos(data || []);
      calcularTotal(data || []);
    } catch (error) {
      console.error("Error fetching gastos:", error);
    } finally {
      setLoading(false);
    }
  }

  function calcularTotal(data: Gasto[]) {
    const total = data.reduce(
      (sum, g) => sum + parseFloat(g.monto?.toString() || "0"),
      0,
    );
    setMontoTotal(total);
  }

  async function agregarGasto() {
    if (!nuevoGasto.fecha || !nuevoGasto.monto || !nuevoGasto.motivo) return;
    setLoading(true);
    try {
      // Preparar objeto a insertar
      const insertObj: any = {
        fecha: nuevoGasto.fecha,
        monto: nuevoGasto.monto,
        motivo: nuevoGasto.motivo,
      };

      // Si el usuario es cajero, añadir cajero_id y caja
      const stored = localStorage.getItem("usuario");
      const usuario = stored ? JSON.parse(stored) : null;
      if (usuario && usuario.rol === "cajero") {
        insertObj.cajero_id = usuario.id;
        // intentar obtener caja asignada
        try {
          const { data: caiData } = await supabase
            .from("cai_facturas")
            .select("caja_asignada")
            .eq("cajero_id", usuario.id)
            .single();
          insertObj.caja = caiData?.caja_asignada || null;
        } catch (e) {
          insertObj.caja = null;
        }
      }

      await supabase.from("gastos").insert([insertObj]);
      setNuevoGasto({
        fecha: "",
        monto: "",
        motivo: "",
        cajero_id: "",
        caja: "",
      });
      fetchGastos();
    } catch (error) {
      console.error("Error adding gasto:", error);
      alert("Error al guardar el gasto: " + (error as any).message);
    } finally {
      setLoading(false);
    }
  }

  async function eliminarGasto(id: number) {
    if (!window.confirm("¿Eliminar este gasto permanentemente?")) return;
    setLoading(true);
    try {
      await supabase.from("gastos").delete().eq("id", id);
      fetchGastos();
    } catch (error) {
      console.error("Error deleting gasto:", error);
    }
  }

  async function guardarEdicion() {
    if (!editGasto.fecha || !editGasto.monto || !editGasto.motivo) return;
    setLoading(true);
    try {
      await supabase.from("gastos").update(editGasto).eq("id", editId);
      setEditId(null);
      setEditGasto({ fecha: "", monto: "", motivo: "" });
      fetchGastos();
    } catch (error) {
      console.error("Error updating gasto:", error);
    }
  }

  const totalGastos = gastos.length;
  const promedioGasto =
    totalGastos > 0 ? (montoTotal / totalGastos).toFixed(2) : "0.00";

  return (
    <div
      className="gastos-enterprise"
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
        .gastos-enterprise {
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
          --info: #3b82f6;
        }

        .gastos-enterprise {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2rem;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: rgba(255,255,255,0.1);
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

        .page-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
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
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--danger);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .filters {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
        }

        .filter-input {
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--info), #42a5f5);
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

        .form-section {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .form-input {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .table-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th {
          background: rgba(255,255,255,0.08);
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

        .table tr:hover {
          background: rgba(255,255,255,0.05);
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

        .btn-delete { 
          background: rgba(198,40,40,0.2); 
          color: #c62828; 
        }

        .btn-save { 
          background: var(--success); 
          color: white; 
        }

        .btn-cancel { 
          background: var(--danger); 
          color: white; 
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        /* Gasto Card (Mobile) */
        .cards-grid { display: none; }
        .gasto-card {
           background: #fff;
           border: 1px solid var(--border);
           border-radius: 12px;
           padding: 16px;
           box-shadow: 0 4px 6px rgba(0,0,0,0.02);
           display: flex;
           flex-direction: column;
        }
        .gasto-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-hover); }
        .gasto-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px; }
        .gasto-card-monto { font-size: 20px; font-weight: 800; color: var(--danger); }
        .gasto-card-fecha { font-size: 13px; color: var(--text-secondary); font-family: monospace; }
        .gasto-card-motivo { font-size: 14px; color: var(--text-primary); margin-bottom: 16px; line-height: 1.5; }
        .gasto-card-actions { display: flex; gap: 8px; }

        @media (max-width: 768px) {
          .header { flex-direction: column; gap: 1rem; padding: 1rem; }
          .page-title { font-size: 1.25rem; }
          .filters { grid-template-columns: 1fr; padding: 1rem; }
          .filter-input { width: 100%; box-sizing: border-box; }
          .btn-primary { width: 100%; justify-content: center; }
          .gastos-enterprise { padding: 1rem; }
          .table { display: none; }
          .table-container { background: transparent; box-shadow: none; border-radius: 0; }
          .cards-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
          .stats-grid { grid-template-columns: 1fr; }
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }

        .modal-box {
          background: #fff;
          border-radius: 16px;
          padding: 2rem;
          width: 100%;
          max-width: 540px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          animation: slideUp 0.25s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 1.5rem 0;
        }

        .modal-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        @media (max-width: 520px) {
          .modal-form-grid { grid-template-columns: 1fr; }
          .modal-box { padding: 1.25rem; }
        }

        .modal-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 4px;
          display: block;
        }

        .modal-input {
          background: #f8fafc;
          border: 1.5px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text-primary);
          font-size: 0.95rem;
          width: 100%;
          transition: border-color 0.2s;
        }

        .modal-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }

        .modal-field { display: flex; flex-direction: column; }
        .modal-field-full { grid-column: 1 / -1; display: flex; flex-direction: column; }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        .btn-modal-cancel {
          background: #f1f5f9;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-modal-cancel:hover { background: #e2e8f0; }

        .btn-add-gasto {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
        }

        .btn-add-gasto:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(16,185,129,0.35);
        }
      `}</style>

      <div className="container">
        <header className="header">
          <div className="header-left">
            {onBack && (
              <button className="btn-back" onClick={onBack}>
                ← Volver
              </button>
            )}
            <h1 className="page-title">💸 Control de Gastos</h1>
          </div>
          <button
            className="btn-add-gasto"
            onClick={() => setShowModalGasto(true)}
          >
            ➕ Registrar Gasto
          </button>
        </header>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">
              L{" "}
              {montoTotal.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-label">Total Gastos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalGastos}</div>
            <div className="stat-label">Registros</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">L {promedioGasto}</div>
            <div className="stat-label">Promedio</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters">
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="filter-input"
            placeholder="Desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="filter-input"
            placeholder="Hasta"
          />
          <button
            className="btn-primary"
            onClick={fetchGastos}
            disabled={loading}
          >
            {loading ? "⏳" : "🔍"} Filtrar
          </button>
        </div>

        {/* Tabla */}
        {/* Tabla / Cards Container */}
        <div className="table-container">
          {loading ? (
            <div className="loading">⏳ Cargando gastos...</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Motivo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((g) => (
                    <tr key={g.id}>
                      <td>{g.fecha}</td>
                      <td style={{ color: "var(--danger)", fontWeight: 700 }}>
                        L {parseFloat(g.monto).toFixed(2)}
                      </td>
                      <td>{g.motivo}</td>
                      <td>
                        <button
                          onClick={() => {
                            setEditId(g.id);
                            setEditGasto({
                              fecha: g.fecha,
                              monto: g.monto,
                              motivo: g.motivo,
                            });
                          }}
                          className="btn-table btn-edit"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => eliminarGasto(g.id)}
                          className="btn-table btn-delete"
                        >
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {gastos.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No hay gastos registrados en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Mobile Cards View */}
              <div className="cards-grid">
                {gastos.map((g) => (
                  <div key={g.id} className="gasto-card">
                    <div className="gasto-card-header">
                      <div className="gasto-card-fecha">📅 {g.fecha}</div>
                      <div className="gasto-card-monto">L {parseFloat(g.monto).toFixed(2)}</div>
                    </div>
                    <div className="gasto-card-motivo">{g.motivo}</div>
                    <div className="gasto-card-actions">
                      <button
                        onClick={() => {
                          setEditId(g.id);
                          setEditGasto({ fecha: g.fecha, monto: g.monto, motivo: g.motivo });
                        }}
                        className="btn-back" style={{ flex: 1, justifyContent: "center", padding: "10px", color: "#f59e0b", borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.05)" }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => eliminarGasto(g.id)}
                        className="btn-back" style={{ flex: 1, justifyContent: "center", padding: "10px", color: "#ef4444", borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Editar Gasto */}
      {editId !== null && (
        <div className="modal-overlay" onClick={() => setEditId(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">✏️ Editar Gasto</h2>
            <div className="modal-form-grid">
              <div className="modal-field">
                <label className="modal-label">Fecha *</label>
                <input
                  type="date"
                  value={editGasto.fecha}
                  onChange={(e) =>
                    setEditGasto({ ...editGasto, fecha: e.target.value })
                  }
                  className="modal-input"
                  required
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Monto (L) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={editGasto.monto}
                  onChange={(e) =>
                    setEditGasto({ ...editGasto, monto: e.target.value })
                  }
                  className="modal-input"
                  required
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="modal-field-full">
                <label className="modal-label">Motivo *</label>
                <input
                  type="text"
                  placeholder="Descripción del gasto..."
                  value={editGasto.motivo}
                  onChange={(e) =>
                    setEditGasto({ ...editGasto, motivo: e.target.value })
                  }
                  className="modal-input"
                  required
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-modal-cancel"
                onClick={() => setEditId(null)}
              >
                Cancelar
              </button>
              <button
                className="btn-add-gasto"
                onClick={guardarEdicion}
                disabled={
                  loading ||
                  !editGasto.fecha ||
                  !editGasto.monto ||
                  !editGasto.motivo
                }
                style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
              >
                {loading ? "⏳ Guardando..." : "💾 Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Gasto */}
      {showModalGasto && (
        <div className="modal-overlay" onClick={() => setShowModalGasto(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">➕ Registrar Nuevo Gasto</h2>
            <div className="modal-form-grid">
              <div className="modal-field">
                <label className="modal-label">Fecha *</label>
                <input
                  type="date"
                  value={nuevoGasto.fecha}
                  onChange={(e) =>
                    setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })
                  }
                  className="modal-input"
                  required
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">Monto (L) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={nuevoGasto.monto}
                  onChange={(e) =>
                    setNuevoGasto({ ...nuevoGasto, monto: e.target.value })
                  }
                  className="modal-input"
                  required
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="modal-field-full">
                <label className="modal-label">Motivo *</label>
                <input
                  type="text"
                  placeholder="Descripción del gasto..."
                  value={nuevoGasto.motivo}
                  onChange={(e) =>
                    setNuevoGasto({ ...nuevoGasto, motivo: e.target.value })
                  }
                  className="modal-input"
                  required
                />
              </div>
              {/* Para admins: elegir cajero y caja asignada */}
              {usuarioActual && usuarioActual.rol === "Admin" && (
                <>
                  <div className="modal-field">
                    <label className="modal-label">Cajero (opcional)</label>
                    <select
                      value={nuevoGasto.cajero_id}
                      onChange={async (e) => {
                        const selId = e.target.value;
                        setNuevoGasto({
                          ...nuevoGasto,
                          cajero_id: selId,
                          caja: "",
                        });
                        try {
                          const { data: caiData } = await supabase
                            .from("cai_facturas")
                            .select("caja_asignada")
                            .eq("cajero_id", selId)
                            .single();
                          const cajaAsig = caiData?.caja_asignada;
                          if (cajaAsig) {
                            setNuevoGasto((s) => ({ ...s, caja: cajaAsig }));
                            setCajaOptions([cajaAsig]);
                          } else {
                            const { data: all } = await supabase
                              .from("cai_facturas")
                              .select("caja_asignada");
                            const opts = (all || [])
                              .map((r: any) => r.caja_asignada)
                              .filter(Boolean);
                            setCajaOptions(opts);
                          }
                        } catch (err) {
                          console.warn(
                            "No se pudo obtener caja asignada:",
                            err,
                          );
                        }
                      }}
                      className="modal-input"
                    >
                      <option value="">Seleccionar cajero</option>
                      {cajeros.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                          {c.rol === "Admin" ? " (Admin)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Caja (opcional)</label>
                    <select
                      value={nuevoGasto.caja}
                      onChange={(e) =>
                        setNuevoGasto({ ...nuevoGasto, caja: e.target.value })
                      }
                      className="modal-input"
                    >
                      <option value="">Seleccionar caja</option>
                      {cajaOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn-modal-cancel"
                onClick={() => {
                  setShowModalGasto(false);
                  setNuevoGasto({
                    fecha: "",
                    monto: "",
                    motivo: "",
                    cajero_id: "",
                    caja: "",
                  });
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-add-gasto"
                onClick={async () => {
                  await agregarGasto();
                  setShowModalGasto(false);
                }}
                disabled={
                  loading ||
                  !nuevoGasto.fecha ||
                  !nuevoGasto.monto ||
                  !nuevoGasto.motivo
                }
              >
                {loading ? "⏳ Guardando..." : "✅ Guardar Gasto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
