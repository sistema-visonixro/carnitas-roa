import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { STORE, getAll, upsertOne, deleteById } from "./utils/localDB";

interface CostosOperativosViewProps {
  onBack?: () => void;
}

interface CostoOperativo {
  id: number;
  fecha: string;
  descripcion: string;
  categoria: string; // ALQUILER | AGUA | LUZ | GAS | OTRO
  monto: number;
  notas: string;
  created_at?: string;
}

const CATEGORIAS = [
  "ALQUILER",
  "AGUA",
  "LUZ",
  "GAS",
  "INTERNET",
  "TELEFONO",
  "OTRO",
];

const fmtLps = (n: number) =>
  "L. " +
  Number(n).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const CAT_COLORS: Record<string, string> = {
  ALQUILER: "#f59e0b",
  AGUA: "#38bdf8",
  LUZ: "#facc15",
  GAS: "#f97316",
  INTERNET: "#818cf8",
  TELEFONO: "#34d399",
  OTRO: "#94a3b8",
};

export default function CostosOperativosView({
  onBack,
}: CostosOperativosViewProps) {
  const [lista, setLista] = useState<CostoOperativo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<CostoOperativo | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [fechaDesde, setFechaDesde] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [fechaHasta, setFechaHasta] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [form, setForm] = useState<Omit<CostoOperativo, "id" | "created_at">>({
    fecha: new Date().toISOString().slice(0, 10),
    descripcion: "",
    categoria: "OTRO",
    monto: 0,
    notas: "",
  });

  useEffect(() => {
    cargar();
  }, [fechaDesde, fechaHasta]);

  async function cargar() {
    setLoading(true);
    try {
      const local = await getAll<CostoOperativo>(STORE.COSTOS_OPERATIVOS);
      const filtrados = local.filter(
        (c) => c.fecha >= fechaDesde && c.fecha <= fechaHasta,
      );
      filtrados.sort((a, b) => b.fecha.localeCompare(a.fecha));
      setLista(filtrados);
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }

  function abrirNuevo() {
    setEditItem(null);
    setNuevaCategoria("");
    setForm({
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: "",
      categoria: "OTRO",
      monto: 0,
      notas: "",
    });
    setShowModal(true);
  }

  function abrirEditar(item: CostoOperativo) {
    setEditItem(item);
    setNuevaCategoria("");
    setForm({
      fecha: item.fecha,
      descripcion: item.descripcion,
      categoria: item.categoria,
      monto: item.monto,
      notas: item.notas,
    });
    setShowModal(true);
  }

  async function guardar() {
    const categoriaFinal =
      form.categoria === "__nueva__"
        ? nuevaCategoria.trim().toUpperCase()
        : (form.categoria || "OTRO").trim().toUpperCase();

    if (form.categoria === "__nueva__" && !categoriaFinal) {
      alert("Escribe una categoría nueva.");
      return;
    }

    if (!form.fecha || !form.descripcion || Number(form.monto) <= 0) {
      alert("Completa fecha, descripción y monto.");
      return;
    }
    setLoading(true);
    try {
      const isOnline = navigator.onLine;
      if (editItem) {
        const updated: CostoOperativo = {
          ...editItem,
          ...form,
          categoria: categoriaFinal,
          monto: Number(form.monto),
        };
        await upsertOne(STORE.COSTOS_OPERATIVOS, updated);
        if (isOnline) {
          await supabase
            .from("costos_operativos")
            .update({
              fecha: updated.fecha,
              descripcion: updated.descripcion,
              categoria: updated.categoria,
              monto: updated.monto,
              notas: updated.notas,
            })
            .eq("id", updated.id);
        }
      } else {
        const tmpId = -Date.now();
        const nuevo: CostoOperativo = {
          id: tmpId,
          ...form,
          categoria: categoriaFinal,
          monto: Number(form.monto),
        };
        await upsertOne(STORE.COSTOS_OPERATIVOS, nuevo);
        if (isOnline) {
          const { data, error } = await supabase
            .from("costos_operativos")
            .insert([
              {
                fecha: nuevo.fecha,
                descripcion: nuevo.descripcion,
                categoria: nuevo.categoria,
                monto: nuevo.monto,
                notas: nuevo.notas,
              },
            ])
            .select()
            .single();
          if (!error && data) {
            await deleteById(STORE.COSTOS_OPERATIVOS, tmpId);
            await upsertOne(STORE.COSTOS_OPERATIVOS, data);
          }
        }
      }
      setShowModal(false);
      await cargar();
    } catch (e) {
      console.error(e);
      alert("Error al guardar.");
    } finally {
      setLoading(false);
    }
  }

  async function eliminar(item: CostoOperativo) {
    if (!confirm(`¿Eliminar "${item.descripcion}"?`)) return;
    setLoading(true);
    try {
      await deleteById(STORE.COSTOS_OPERATIVOS, item.id);
      if (navigator.onLine && item.id > 0)
        await supabase.from("costos_operativos").delete().eq("id", item.id);
      await cargar();
    } catch {
      alert("Error al eliminar.");
    } finally {
      setLoading(false);
    }
  }

  const total = lista.reduce((s, c) => s + Number(c.monto), 0);
  const categoriasDisponibles = Array.from(
    new Set([
      ...CATEGORIAS,
      ...lista.map((c) => (c.categoria || "").toUpperCase()).filter(Boolean),
      ...(form.categoria && form.categoria !== "__nueva__"
        ? [form.categoria.toUpperCase()]
        : []),
    ]),
  );

  // Totales por categoría
  const porCat: Record<string, number> = {};
  lista.forEach((c) => {
    porCat[c.categoria] = (porCat[c.categoria] || 0) + Number(c.monto);
  });

  return (
    <div
      className="costos-operativos-view"
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "16px",
        color: "#0f172a",
      }}
    >
      <style>{`
        .costos-operativos-view input,
        .costos-operativos-view select,
        .costos-operativos-view textarea {
          color: #0f172a !important;
          background: #fff;
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 22,
            }}
          >
            ←
          </button>
        )}
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          🏢 Costos Operativos
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
          alignItems: "flex-end",
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            style={{
              display: "block",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "6px 10px",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            style={{
              display: "block",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "6px 10px",
            }}
          />
        </div>
        <button
          onClick={abrirNuevo}
          style={{
            padding: "8px 20px",
            background: "#0f766e",
            color: "#0f172a",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          + Nuevo Costo
        </button>
      </div>

      {/* Total */}
      <div
        style={{
          background: "#f0fdfa",
          border: "1px solid #99f6e4",
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, color: "#0f766e" }}>
          Total costos del período
        </span>
        <span style={{ fontWeight: 800, fontSize: 18, color: "#0f766e" }}>
          {fmtLps(total)}
        </span>
      </div>

      {/* Resumen por categoría */}
      {Object.keys(porCat).length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {Object.entries(porCat).map(([cat, mto]) => (
            <div
              key={cat}
              style={{
                background: "#fff",
                border: `2px solid ${CAT_COLORS[cat] || "#e2e8f0"}`,
                borderRadius: 10,
                padding: "6px 14px",
                fontSize: 13,
              }}
            >
              <span
                style={{ color: CAT_COLORS[cat] || "#64748b", fontWeight: 700 }}
              >
                {cat}
              </span>
              : {fmtLps(mto)}
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#64748b" }}>Cargando...</p>
      ) : lista.length === 0 ? (
        <p style={{ textAlign: "center", color: "#94a3b8" }}>
          Sin costos operativos en este período.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#fff",
                borderLeft: `4px solid ${CAT_COLORS[c.categoria] || "#e2e8f0"}`,
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700 }}>
                  {c.descripcion}
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: CAT_COLORS[c.categoria] || "#64748b",
                      background: "#f8fafc",
                      padding: "2px 7px",
                      borderRadius: 6,
                    }}
                  >
                    {c.categoria}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {c.fecha}
                  {c.notas ? ` · ${c.notas}` : ""}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {fmtLps(c.monto)}
              </div>
              <button
                onClick={() => abrirEditar(c)}
                style={{
                  padding: "4px 12px",
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ✏️
              </button>
              <button
                onClick={() => eliminar(c)}
                style={{
                  padding: "4px 12px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#dc2626",
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
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
              padding: 24,
              width: "100%",
              maxWidth: 460,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h3
              style={{
                margin: "0 0 16px",
                fontSize: 18,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {editItem ? "Editar Costo" : "Nuevo Costo Operativo"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 13 }}>
                Fecha *
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Descripción *
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  placeholder="Ej: Alquiler mes de mayo"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Categoría
                <select
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({ ...form, categoria: e.target.value })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                >
                  {categoriasDisponibles.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__nueva__">+ Crear categoría nueva</option>
                </select>
              </label>
              {form.categoria === "__nueva__" && (
                <label style={{ fontSize: 13 }}>
                  Nueva categoría
                  <input
                    type="text"
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    placeholder="Ej: MANTENIMIENTO"
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 4,
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  />
                </label>
              )}
              <label style={{ fontSize: 13 }}>
                Monto (L.) *
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monto}
                  onChange={(e) =>
                    setForm({ ...form, monto: parseFloat(e.target.value) || 0 })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                />
              </label>
              <label style={{ fontSize: 13 }}>
                Notas
                <input
                  type="text"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Opcional"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#f1f5f9",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#0f766e",
                  color: "#0f172a",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
