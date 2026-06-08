import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import RegistrarMovimientosBebidasModal from "../components/RegistrarMovimientosBebidasModal";
import "../styles/inventario-bebidas.css";

// Tipados correctos
type Producto = {
  id: string;
  nombre: string;
  stock?: number;
};

type RowData = {
  producto_id: string;
  nombre: string;
  entradas?: number;
  salidas_por_venta?: number;
  salidas_por_defecto?: number;
  total?: number;
};

interface Props {
  onBack: () => void;
}

export default function InventarioBebidas({ onBack }: Props) {
  // Estados faltantes reconstruidos
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [showDatosActuales, setShowDatosActuales] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RowData[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Estados para el Modal y su animación
  const [modalMode, setModalMode] = useState<"ingreso" | "salida" | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Cargar productos tipo bebida
  const cargarProductos = async () => {
    try {
      console.log("Iniciando carga de productos...");

      // Cargar TODOS los productos sin filtro (no incluir columnas inexistentes)
      const { data: allData, error: errorAll } = await supabase
        .from("productos")
        .select("id, nombre, tipo")
        .order("nombre");

      if (errorAll) {
        console.error("Error cargando productos:", errorAll.message);
        throw errorAll;
      }

      console.log("Todos los productos:", allData);

      // Filtrar solo bebidas en el frontend
      const bebidasFiltered = (allData || []).filter((p: any) => {
        const t = (p.tipo || "").toString().trim().toLowerCase();
        return t === "bebida";
      });

      console.log("Productos bebida después de filtrar:", bebidasFiltered);
      setProductos(bebidasFiltered);

      if (bebidasFiltered.length === 0) {
        console.warn("No se encontraron productos con tipo='bebida'");
      }
    } catch (err: any) {
      console.error("Error cargando productos:", err);
      alert("Error cargando bebidas: " + err.message);
    }
  };

  // Función para cargar resumén de inventario
  const cargarResumenPeriodo = async () => {
    setLoading(true);
    try {
      let data;

      if (showDatosActuales) {
        // Usar vista para datos actuales
        const { data: viewData, error } = await supabase
          .from("v_bebidas_salida_ventas_desde_20260607")
          .select("*")
          .order("nombre");

        if (error) throw error;

        // Transformar los datos de la vista a RowData
        data = (viewData || []).map((row: any) => ({
          producto_id: row.producto_id,
          nombre: row.nombre,
          entradas: Number(row.entradas || 0),
          salidas_por_venta: Number(row.vendido_desde || 0),
          salidas_por_defecto: Number(row.salidas_defecto || 0),
          total: Number(row.total_estimado || 0),
        }));

        console.log("Datos transformados desde vista:", data);
      } else {
        if (!start || !end) {
          alert("Por favor ingresa ambas fechas");
          setLoading(false);
          return;
        }

        // Convertir a timestamps de Honduras (UTC-6)
        const startDt = new Date(start);
        const endDt = new Date(end);
        const startTs = startDt.toISOString();
        const endTs = endDt.toISOString();

        // Llamar RPC con rango
        const { data: rpcData, error } = await supabase.rpc(
          "fn_bebidas_resumen_periodo_v2",
          { start_ts: startTs, end_ts: endTs },
        );

        if (error) throw error;

        // Transformar datos del RPC también
        data = (rpcData || []).map((row: any) => ({
          producto_id: row.producto_id,
          nombre: row.nombre,
          entradas: Number(row.entradas || 0),
          salidas_por_venta: Number(row.vendido_desde || 0),
          salidas_por_defecto: Number(row.salidas_defecto || 0),
          total: Number(row.total_estimado || 0),
        }));

        console.log("Datos transformados desde RPC:", data);
      }

      setRows(data || []);
    } catch (err: any) {
      console.error("Error cargando resumen:", err);
      alert("Error al cargar inventario: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cargar productos al montar (una sola vez)
  useEffect(() => {
    cargarProductos();
  }, []);

  // Cargar resumen cuando cambia el filtro
  useEffect(() => {
    cargarResumenPeriodo();
  }, [showDatosActuales]);

  // Manejador profesional para animar la salida del modal antes de desmontarlo
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setModalMode(null);
      setIsClosing(false);
      cargarResumenPeriodo();
    }, 300); // 300ms coincide con la animación CSS
  };

  return (
    <div className="inv-panel fade-in">
      {/* Cabecera Principal */}
      <div className="inv-header-section">
        <div className="inv-header-content">
          <button
            className="inv-btn-back"
            onClick={onBack}
            title="Volver al Punto de Venta"
          >
            ← Volver
          </button>
          <div className="inv-header-title">
            <h2>🍹 Inventario de Bebidas</h2>
            <p>Control de entradas, salidas y stock disponible</p>
          </div>
        </div>
        <div className="inv-header-actions">
          <button
            className="inv-btn success"
            onClick={() => setModalMode("ingreso")}
          >
            ➕ Registrar Ingreso
          </button>
          <button
            className="inv-btn danger"
            onClick={() => setModalMode("salida")}
          >
            ➖ Registrar Salida
          </button>
        </div>
      </div>

      {/* Filtros y Controles */}
      <div className="inv-filter-section">
        <div className="inv-filter-group">
          <label className="inv-filter-label">
            📅 Rango de fechas (Zona Honduras)
          </label>
          <div className="inv-filter-inputs">
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="inv-input-field"
              placeholder="Desde"
            />
            <span className="inv-filter-separator">hasta</span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="inv-input-field"
              placeholder="Hasta"
            />
          </div>
          <div className="inv-filter-buttons">
            <button
              className="inv-btn secondary"
              onClick={() => {
                setShowDatosActuales(false);
                cargarResumenPeriodo();
              }}
            >
              🔍 Filtrar
            </button>
            <button
              className="inv-btn secondary"
              onClick={() => {
                setShowDatosActuales(true);
                cargarResumenPeriodo();
              }}
            >
              ✓ Datos actuales
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Datos */}
      <div className="inv-data-section">
        <div className="inv-data-header">
          <h3>Resumen de Inventario</h3>
          <span className="inv-data-count">
            {rows.length} producto{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
        {loading ? (
          <div className="inv-loading-state">
            <div className="inv-spinner"></div>
            <p>Cargando inventario...</p>
          </div>
        ) : (
          <div className="inv-table-scroll">
            <table className="inv-data-table">
              <thead>
                <tr>
                  <th className="inv-col-product">Producto</th>
                  <th className="inv-col-number">Entradas</th>
                  <th className="inv-col-number">Salidas por Venta</th>
                  <th className="inv-col-number">Salidas por Defecto</th>
                  <th className="inv-col-total">Total Stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="inv-empty-row">
                    <td colSpan={5}>
                      📭 No hay datos para mostrar en este período
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.producto_id} className="inv-data-row">
                      <td className="inv-col-product">
                        <span className="inv-product-badge">🥤</span>
                        {r.nombre}
                      </td>
                      <td className="inv-col-number inv-value-positive">
                        +{Number(r.entradas ?? 0)}
                      </td>
                      <td className="inv-col-number inv-value-warning">
                        −{Number(r.salidas_por_venta ?? 0)}
                      </td>
                      <td className="inv-col-number inv-value-danger">
                        −{Number(r.salidas_por_defecto ?? 0)}
                      </td>
                      <td className="inv-col-total inv-value-total">
                        {Number(r.total ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Wrapper del Modal para Animaciones */}
      {modalMode && (
        <div className={`modal-overlay ${isClosing ? "fade-out" : "fade-in"}`}>
          <div
            className={`modal-content ${isClosing ? "slide-down" : "slide-up"}`}
          >
            <RegistrarMovimientosBebidasModal
              mode={modalMode}
              productos={productos}
              onClose={handleCloseModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
