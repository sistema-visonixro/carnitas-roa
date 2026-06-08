import { useState } from "react";
import { supabase } from "../supabaseClient";

type Producto = {
  id: string;
  nombre: string;
  stock?: number;
};

export default function RegistrarMovimientosBebidasModal({
  productos,
  mode,
  onClose,
}: {
  productos: Producto[];
  mode: "ingreso" | "salida";
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function setVal(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const rows = Object.entries(values)
        .map(([k, v]) => ({ id: k, qty: Number(v) }))
        .filter((r) => Number.isFinite(r.qty) && r.qty > 0);

      if (rows.length === 0) {
        alert("No hay cantidades ingresadas");
        setLoading(false);
        return;
      }

      if (mode === "ingreso") {
        const inserts = rows.map((r) => ({
          producto_id: String(r.id),
          cantidad: r.qty,
        }));
        const { error } = await supabase
          .from("bebidas_entradas_v2")
          .insert(inserts);
        if (error) throw error;
      } else {
        const inserts = rows.map((r) => ({
          producto_id: String(r.id),
          cantidad: r.qty,
        }));
        const { error } = await supabase
          .from("bebidas_salidas_defecto_v2")
          .insert(inserts);
        if (error) throw error;
      }

      onClose();
    } catch (err: any) {
      console.error(err);
      alert("Error al registrar movimientos: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inv-modal-wrapper">
      <div className="inv-modal-header">
        <div>
          <h3 className="inv-modal-title">
            {mode === "ingreso"
              ? "📥 Registrar Ingreso"
              : "📤 Registrar Salida por Defecto"}
          </h3>
          <p className="inv-modal-subtitle">
            {productos.length} productos disponibles
          </p>
        </div>
        <button
          className="inv-modal-close"
          onClick={onClose}
          disabled={loading}
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className="inv-modal-body">
        {productos.length === 0 ? (
          <div
            style={{
              padding: "32px 20px",
              textAlign: "center",
              color: "#94a3b8",
            }}
          >
            <p style={{ fontSize: "14px", margin: 0 }}>
              ⚠️ No hay productos bebida disponibles
            </p>
            <p
              style={{
                fontSize: "12px",
                margin: "8px 0 0 0",
                color: "#cbd5e1",
              }}
            >
              Verifica que existan productos tipo "bebida" en la tabla
            </p>
          </div>
        ) : (
          <div className="inv-modal-lines">
            {productos.map((p) => (
              <div key={p.id} className="inv-line-item">
                <div className="inv-line-info">
                  <span className="inv-line-label">{p.nombre}</span>
                </div>
                <div className="inv-line-input-wrapper">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={values[p.id] ?? ""}
                    onChange={(e) => setVal(p.id, e.target.value)}
                    className="inv-line-input"
                    disabled={loading}
                  />
                  <span className="inv-line-unit">u</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inv-modal-footer">
        <button
          className="inv-btn secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          className="inv-btn primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Guardando..." : "✓ Guardar Movimientos"}
        </button>
      </div>
    </div>
  );
}
