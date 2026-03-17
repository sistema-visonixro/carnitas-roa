import { useState } from "react";
import { supabase } from "./supabaseClient";

interface GananciasNetasViewProps {
  onBack: () => void;
}

interface KPIs {
  totalVentas: number;
  totalCosto: number;
  gananciaBruta: number;
  deliveryIngresos: number;
  totalGastos: number;
  gananciaNeta: number;
  totalFacturas: number;
  totalPedidosDelivery: number;
  productosSinCosto: number;
}

interface CategoriaStat {
  categoria: string;
  icono: string;
  color: string;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  ganancia: number;
  margen: number;
}

interface SubcategoriaStat {
  subcategoria: string;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  ganancia: number;
}

interface ProductoStat {
  id: string;
  nombre: string;
  tipo: string;
  subcategoria: string;
  precio: number;
  costo: number | null;
  cantidadVendida: number;
  ingresoTotal: number;
  costoTotal: number;
  ganancia: number;
}

interface DeliveryDia {
  fecha: string;
  pedidos: number;
  totalVentas: number;
  ingresoEnvio: number;
}

// Helpers
function hoy() {
  return new Date().toISOString().split("T")[0];
}
function inicioMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const COLORES: Record<string, string> = {
  comida: "#16a34a",
  bebida: "#2563eb",
  complemento: "#7c3aed",
};
const ICONOS: Record<string, string> = {
  comida: "🍽️",
  bebida: "🥤",
  complemento: "🧂",
};

export default function GananciasNetasView({
  onBack,
}: GananciasNetasViewProps) {
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const [loading, setLoading] = useState(false);
  const [calculado, setCalculado] = useState(false);
  const [error, setError] = useState("");

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [porCategoria, setPorCategoria] = useState<CategoriaStat[]>([]);
  const [porSubcategoria, setPorSubcategoria] = useState<SubcategoriaStat[]>(
    [],
  );
  const [topProductos, setTopProductos] = useState<ProductoStat[]>([]);
  const [deliveryDias, setDeliveryDias] = useState<DeliveryDia[]>([]);
  const [activeTab, setActiveTab] = useState<
    "categoria" | "subcategoria" | "productos" | "delivery"
  >("categoria");

  async function calcular() {
    if (!desde || !hasta) {
      setError("Selecciona las fechas de inicio y fin.");
      return;
    }
    setError("");
    setLoading(true);
    setCalculado(false);

    try {
      const desdeStr = `${desde} 00:00:00`;
      const hastaStr = `${hasta} 23:59:59`;

      // ── 1. Cargar facturas del rango ──────────────────────────────
      let todasFacturas: any[] = [];
      let offset = 0;
      const PG = 1000;
      while (true) {
        const { data, error: e } = await supabase
          .from("facturas")
          .select("id, factura, productos, total, fecha_hora")
          .gte("fecha_hora", desdeStr)
          .lte("fecha_hora", hastaStr)
          .order("fecha_hora", { ascending: false })
          .range(offset, offset + PG - 1);
        if (e) throw e;
        if (!data || data.length === 0) break;
        todasFacturas = [...todasFacturas, ...data];
        if (data.length < PG) break;
        offset += PG;
      }

      // ── 2. Cargar todos los productos (con costo) ─────────────────
      const { data: productosDB, error: eProd } = await supabase
        .from("productos")
        .select("id, nombre, precio, costo, tipo, subcategoria");
      if (eProd) throw eProd;

      const prodMap = new Map<string, any>();
      (productosDB || []).forEach((p: any) => prodMap.set(p.id, p));

      // ── 3. Cargar ingresos delivery del rango (tabla costo_delivery) ──
      let todosEnvios: any[] = [];
      let offsetEnv = 0;
      while (true) {
        const { data: envData, error: eEnv } = await supabase
          .from("costo_delivery")
          .select("id, monto, fecha, created_at, cliente")
          .gte("created_at", desdeStr)
          .lte("created_at", hastaStr)
          .order("created_at", { ascending: false })
          .range(offsetEnv, offsetEnv + PG - 1);
        if (eEnv) break; // tabla puede no existir aún
        if (!envData || envData.length === 0) break;
        todosEnvios = [...todosEnvios, ...envData];
        if (envData.length < PG) break;
        offsetEnv += PG;
      }

      // ── 5. Calcular ───────────────────────────────────────────────
      // Acumuladores por producto
      const prodStats = new Map<
        string,
        {
          nombre: string;
          tipo: string;
          subcategoria: string;
          precio: number;
          costo: number | null;
          cantidadVendida: number;
          ingresoTotal: number;
          costoTotal: number;
        }
      >();

      let totalVentas = 0;
      let totalCosto = 0;
      let productosSinCosto = new Set<string>();

      todasFacturas.forEach((fact: any) => {
        let items: any[] = [];
        try {
          items =
            typeof fact.productos === "string"
              ? JSON.parse(fact.productos || "[]")
              : fact.productos || [];
        } catch {
          return;
        }
        if (!Array.isArray(items)) return;

        items.forEach((item: any) => {
          const prod = prodMap.get(item.id);
          const cantidad = Number(item.cantidad) || 1;
          const precio = Number(item.precio) || Number(prod?.precio) || 0;
          const ingreso = precio * cantidad;

          totalVentas += ingreso;

          const nombre = item.nombre || prod?.nombre || "Desconocido";
          const tipo = prod?.tipo || "comida";
          const subcategoria = prod?.subcategoria || "";
          const costo = prod?.costo != null ? Number(prod.costo) : null;
          const costoTotal = costo != null ? costo * cantidad : 0;
          if (costo == null) productosSinCosto.add(item.id);
          totalCosto += costoTotal;

          if (item.id) {
            const existing = prodStats.get(item.id);
            if (existing) {
              existing.cantidadVendida += cantidad;
              existing.ingresoTotal += ingreso;
              existing.costoTotal += costoTotal;
            } else {
              prodStats.set(item.id, {
                nombre,
                tipo,
                subcategoria,
                precio,
                costo,
                cantidadVendida: cantidad,
                ingresoTotal: ingreso,
                costoTotal,
              });
            }
          }
        });
      });

      // Agrupar por categoría
      const catMap = new Map<
        string,
        { cantidadVendida: number; ingresoTotal: number; costoTotal: number }
      >();
      const subcatMap = new Map<
        string,
        { cantidadVendida: number; ingresoTotal: number; costoTotal: number }
      >();

      prodStats.forEach((stat) => {
        const cat = stat.tipo;
        const existing = catMap.get(cat);
        if (existing) {
          existing.cantidadVendida += stat.cantidadVendida;
          existing.ingresoTotal += stat.ingresoTotal;
          existing.costoTotal += stat.costoTotal;
        } else {
          catMap.set(cat, {
            cantidadVendida: stat.cantidadVendida,
            ingresoTotal: stat.ingresoTotal,
            costoTotal: stat.costoTotal,
          });
        }

        if (cat === "comida" && stat.subcategoria) {
          const sc = stat.subcategoria;
          const exSc = subcatMap.get(sc);
          if (exSc) {
            exSc.cantidadVendida += stat.cantidadVendida;
            exSc.ingresoTotal += stat.ingresoTotal;
            exSc.costoTotal += stat.costoTotal;
          } else {
            subcatMap.set(sc, {
              cantidadVendida: stat.cantidadVendida,
              ingresoTotal: stat.ingresoTotal,
              costoTotal: stat.costoTotal,
            });
          }
        }
      });

      const categoriasResult: CategoriaStat[] = Array.from(catMap.entries())
        .map(([cat, v]) => {
          const ganancia = v.ingresoTotal - v.costoTotal;
          const margen =
            v.ingresoTotal > 0 ? (ganancia / v.ingresoTotal) * 100 : 0;
          return {
            categoria: cat,
            icono: ICONOS[cat] || "📦",
            color: COLORES[cat] || "#64748b",
            ...v,
            ganancia,
            margen,
          };
        })
        .sort((a, b) => b.ganancia - a.ganancia);

      const subCategoriasResult: SubcategoriaStat[] = Array.from(
        subcatMap.entries(),
      )
        .map(([sc, v]) => ({
          subcategoria: sc,
          ...v,
          ganancia: v.ingresoTotal - v.costoTotal,
        }))
        .sort((a, b) => b.ganancia - a.ganancia);

      const topProd: ProductoStat[] = Array.from(prodStats.entries())
        .map(([id, v]) => ({
          id,
          ganancia: v.ingresoTotal - v.costoTotal,
          ...v,
        }))
        .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
        .slice(0, 20);

      // Delivery — usar campo `monto` de costo_delivery
      const deliveryIngresos = todosEnvios.reduce(
        (s, e) => s + parseFloat(e.monto || 0),
        0,
      );

      // Agrupar delivery por día
      const deliveryByDia = new Map<
        string,
        { pedidos: number; totalVentas: number; ingresoEnvio: number }
      >();
      todosEnvios.forEach((e: any) => {
        const dia = (e.created_at || e.fecha || "").substring(0, 10);
        const existing = deliveryByDia.get(dia);
        if (existing) {
          existing.pedidos++;
          existing.totalVentas += parseFloat(e.monto || 0);
          existing.ingresoEnvio += parseFloat(e.monto || 0);
        } else {
          deliveryByDia.set(dia, {
            pedidos: 1,
            totalVentas: parseFloat(e.monto || 0),
            ingresoEnvio: parseFloat(e.monto || 0),
          });
        }
      });

      const deliveryDiasResult: DeliveryDia[] = Array.from(
        deliveryByDia.entries(),
      )
        .map(([fecha, v]) => ({ fecha, ...v }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));

      // KPIs finales
      const gananciaBruta = totalVentas - totalCosto;
      const gananciaNeta = gananciaBruta + deliveryIngresos;

      setKpis({
        totalVentas,
        totalCosto,
        gananciaBruta,
        deliveryIngresos,
        totalGastos: 0,
        gananciaNeta,
        totalFacturas: todasFacturas.length,
        totalPedidosDelivery: todosEnvios.length,
        productosSinCosto: productosSinCosto.size,
      });
      setPorCategoria(categoriasResult);
      setPorSubcategoria(subCategoriasResult);
      setTopProductos(topProd);
      setDeliveryDias(deliveryDiasResult);
      setCalculado(true);
    } catch (err: any) {
      setError(err.message || "Error al calcular ganancias");
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) =>
    `L ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#f8fafc,#e0e7ff)",
        fontFamily: "'Inter',-apple-system,sans-serif",
      }}
    >
      <style>{`
        .gn-header {
          background: rgba(255,255,255,0.96);
          border-bottom: 1px solid #e2e8f0;
          padding: 1.25rem 1.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .gn-title { font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0; }
        .gn-subtitle { font-size: 0.8rem; color: #64748b; margin: 0; }
        .gn-back {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .gn-back:hover { background: #e2e8f0; }
        .gn-body { padding: 1.5rem; max-width: 1300px; margin: 0 auto; }

        .gn-filter-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          display: flex;
          gap: 1rem;
          align-items: flex-end;
          flex-wrap: wrap;
        }
        .gn-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
        .gn-label { font-size: 0.775rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; }
        .gn-input {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 0.9rem;
          color: #0f172a;
          background: #f8fafc;
          outline: none;
        }
        .gn-input:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .gn-btn-calc {
          background: linear-gradient(135deg, #1e3a5f, #2563eb);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 10px 24px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .gn-btn-calc:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.35); }
        .gn-btn-calc:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .gn-shortcut {
          display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
          flex-shrink: 0;
        }
        .gn-shortcut button {
          background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px;
          padding: 6px 12px; font-size: 0.75rem; font-weight: 600; color: #475569;
          cursor: pointer; transition: all 0.15s;
        }
        .gn-shortcut button:hover { background: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; }

        .gn-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .gn-kpi {
          background: white;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          padding: 1.1rem 1.25rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: transform 0.2s;
        }
        .gn-kpi:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .gn-kpi-icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .gn-kpi-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 4px; }
        .gn-kpi-value { font-size: 1.25rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
        .gn-kpi-value.pos { color: #16a34a; }
        .gn-kpi-value.neg { color: #dc2626; }
        .gn-kpi-value.warn { color: #d97706; }
        .gn-kpi-sub { font-size: 0.72rem; color: #94a3b8; margin-top: 4px; }

        .gn-tabs {
          display: flex; gap: 4px; margin-bottom: 1rem; flex-wrap: wrap;
        }
        .gn-tab {
          padding: 8px 18px; border-radius: 8px; border: 1px solid #e2e8f0;
          background: white; cursor: pointer; font-size: 0.85rem; font-weight: 600;
          color: #64748b; transition: all 0.2s;
        }
        .gn-tab.active {
          background: linear-gradient(135deg, #1e3a5f, #2563eb);
          color: white; border-color: transparent;
          box-shadow: 0 4px 12px rgba(37,99,235,0.25);
        }
        .gn-tab:hover:not(.active) { background: #f1f5f9; }

        .gn-table-wrap {
          background: white;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin-bottom: 1rem;
        }
        .gn-table {
          width: 100%; border-collapse: collapse; min-width: 520px;
        }
        .gn-table th {
          background: linear-gradient(135deg, #1e3a5f, #1e40af);
          color: white;
          padding: 0.85rem 1rem;
          text-align: left;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          white-space: nowrap;
        }
        .gn-table td {
          padding: 0.8rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          color: #475569;
          font-size: 0.875rem;
        }
        .gn-table tr:last-child td { border-bottom: none; }
        .gn-table tr:hover td { background: #f8fafc; }
        .gn-table .total-row td {
          background: #fef9c3;
          font-weight: 700;
          color: #0f172a;
          border-top: 2px solid #fbbf24;
        }

        .gn-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 0.75rem; font-weight: 700;
        }
        .gn-bar-wrap { height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-top: 4px; }
        .gn-bar { height: 100%; border-radius: 4px; transition: width 0.6s ease; }

        .gn-warn-box {
          background: #fef3c7; border: 1px solid #fbbf24; border-radius: 10px;
          padding: 0.85rem 1.1rem; margin-bottom: 1.25rem;
          display: flex; align-items: center; gap: 10px;
          font-size: 0.85rem; color: #92400e;
        }

        .gn-empty {
          text-align: center; padding: 3rem 1rem; color: #94a3b8;
        }
        .gn-empty-icon { font-size: 3rem; margin-bottom: 1rem; }

        @media (max-width: 768px) {
          .gn-header { flex-direction: column; gap: 0.75rem; align-items: flex-start; padding: 1rem; }
          .gn-body { padding: 0.75rem; }
          .gn-filter-card { flex-direction: column; align-items: stretch; }
          .gn-kpi-value { font-size: 1.05rem; }
          .gn-table td, .gn-table th { padding: 0.55rem 0.65rem; font-size: 0.77rem; }
          .gn-tabs {
            overflow-x: auto;
            flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
            scrollbar-width: none;
            gap: 6px;
          }
          .gn-tabs::-webkit-scrollbar { display: none; }
          .gn-tab { flex-shrink: 0; padding: 7px 14px; font-size: 0.8rem; }
        }
        @media (max-width: 480px) {
          .gn-kpis { grid-template-columns: repeat(2, 1fr); gap: 0.65rem; }
          .gn-kpi { padding: 0.85rem 0.9rem; }
          .gn-kpi-icon { font-size: 1.2rem; margin-bottom: 0.3rem; }
          .gn-kpi-label { font-size: 0.67rem; }
          .gn-kpi-value { font-size: 0.95rem; }
          .gn-kpi-value[style] { font-size: 1.1rem !important; }
          .gn-kpi-sub { font-size: 0.67rem; }
          .gn-title { font-size: 1.1rem; }
          .gn-subtitle { font-size: 0.75rem; }
          .gn-back { padding: 7px 12px; font-size: 0.8rem; }
          .gn-shortcut button { padding: 5px 10px; }
          .gn-table { min-width: 420px; }
          .gn-table td, .gn-table th { padding: 0.45rem 0.5rem; font-size: 0.73rem; }
          .gn-label { font-size: 0.72rem; }
          .gn-btn-calc { padding: 10px 18px; width: 100%; }
        }
      `}</style>

      {/* Header */}
      <div className="gn-header">
        <div>
          <h1 className="gn-title">📈 Ganancias Netas</h1>
          <p className="gn-subtitle">
            Análisis de rentabilidad por categoría, producto y delivery
          </p>
        </div>
        <button className="gn-back" onClick={onBack}>
          ← Volver
        </button>
      </div>

      <div className="gn-body">
        {/* Filtro de fechas */}
        <div className="gn-filter-card">
          <div className="gn-field">
            <span className="gn-label">Desde</span>
            <input
              type="date"
              className="gn-input"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="gn-field">
            <span className="gn-label">Hasta</span>
            <input
              type="date"
              className="gn-input"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <div className="gn-shortcut">
            <button
              onClick={() => {
                const h = hoy();
                setDesde(h);
                setHasta(h);
              }}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                const d = new Date();
                const lun = new Date(d);
                lun.setDate(d.getDate() - d.getDay() + 1);
                setDesde(lun.toISOString().split("T")[0]);
                setHasta(hoy());
              }}
            >
              Esta semana
            </button>
            <button
              onClick={() => {
                setDesde(inicioMes());
                setHasta(hoy());
              }}
            >
              Este mes
            </button>
            <button
              onClick={() => {
                const d = new Date();
                const mes = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
                const anio =
                  d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
                const ini = `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
                const fin = new Date(anio, mes + 1, 0);
                setDesde(ini);
                setHasta(fin.toISOString().split("T")[0]);
              }}
            >
              Mes anterior
            </button>
          </div>
          <button className="gn-btn-calc" onClick={calcular} disabled={loading}>
            {loading ? "⏳ Calculando..." : "🔍 Ver Ganancias"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: 10,
              padding: "0.85rem 1.1rem",
              marginBottom: "1.25rem",
              color: "#991b1b",
              fontSize: "0.875rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Estado vacío inicial */}
        {!calculado && !loading && (
          <div className="gn-empty">
            <div className="gn-empty-icon">📊</div>
            <p
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "#475569",
                margin: 0,
              }}
            >
              Selecciona el rango de fechas y presiona{" "}
              <strong>Ver Ganancias</strong>
            </p>
          </div>
        )}

        {/* Resultados */}
        {calculado && kpis && (
          <>
            {/* Aviso productos sin costo */}
            {kpis.productosSinCosto > 0 && (
              <div className="gn-warn-box">
                ⚠️ <strong>{kpis.productosSinCosto} producto(s)</strong>{" "}
                vendidos no tienen costo registrado. El cálculo de ganancia para
                esos productos puede estar incompleto. Puedes agregar el costo
                en <em>Control de Inventario</em>.
              </div>
            )}

            {/* KPIs */}
            <div className="gn-kpis">
              <div className="gn-kpi">
                <div className="gn-kpi-icon">💰</div>
                <div className="gn-kpi-label">Total Ventas</div>
                <div className="gn-kpi-value">{fmt(kpis.totalVentas)}</div>
                <div className="gn-kpi-sub">{kpis.totalFacturas} facturas</div>
              </div>
              <div className="gn-kpi">
                <div className="gn-kpi-icon">📦</div>
                <div className="gn-kpi-label">Costo Productos</div>
                <div className="gn-kpi-value warn">{fmt(kpis.totalCosto)}</div>
                <div className="gn-kpi-sub">Costo registrado</div>
              </div>
              <div className="gn-kpi">
                <div className="gn-kpi-icon">📈</div>
                <div className="gn-kpi-label">Ganancia Bruta</div>
                <div
                  className={`gn-kpi-value ${kpis.gananciaBruta >= 0 ? "pos" : "neg"}`}
                >
                  {fmt(kpis.gananciaBruta)}
                </div>
                <div className="gn-kpi-sub">
                  Margen:{" "}
                  {kpis.totalVentas > 0
                    ? ((kpis.gananciaBruta / kpis.totalVentas) * 100).toFixed(
                        1,
                      ) + "%"
                    : "—"}
                </div>
              </div>
              <div className="gn-kpi">
                <div className="gn-kpi-icon">🛵</div>
                <div className="gn-kpi-label">Ingresos Delivery</div>
                <div className="gn-kpi-value pos">
                  {fmt(kpis.deliveryIngresos)}
                </div>
                <div className="gn-kpi-sub">
                  {kpis.totalPedidosDelivery} pedidos entregados
                </div>
              </div>
              <div
                className="gn-kpi"
                style={{
                  background:
                    kpis.gananciaNeta >= 0
                      ? "linear-gradient(135deg,#f0fdf4,#dcfce7)"
                      : "linear-gradient(135deg,#fff1f2,#fee2e2)",
                  border: `1px solid ${kpis.gananciaNeta >= 0 ? "#86efac" : "#fca5a5"}`,
                }}
              >
                <div className="gn-kpi-icon">
                  {kpis.gananciaNeta >= 0 ? "✅" : "❌"}
                </div>
                <div className="gn-kpi-label">Ganancia Neta</div>
                <div
                  className={`gn-kpi-value ${kpis.gananciaNeta >= 0 ? "pos" : "neg"}`}
                  style={{ fontSize: "1.4rem" }}
                >
                  {fmt(kpis.gananciaNeta)}
                </div>
                <div className="gn-kpi-sub">Bruta + Delivery</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="gn-tabs">
              <button
                className={`gn-tab ${activeTab === "categoria" ? "active" : ""}`}
                onClick={() => setActiveTab("categoria")}
              >
                🍽️ Por Categoría
              </button>
              <button
                className={`gn-tab ${activeTab === "subcategoria" ? "active" : ""}`}
                onClick={() => setActiveTab("subcategoria")}
              >
                🗂️ Subcategorías
              </button>
              <button
                className={`gn-tab ${activeTab === "productos" ? "active" : ""}`}
                onClick={() => setActiveTab("productos")}
              >
                🏆 Más Vendidos
              </button>
              <button
                className={`gn-tab ${activeTab === "delivery" ? "active" : ""}`}
                onClick={() => setActiveTab("delivery")}
              >
                🛵 Delivery
              </button>
            </div>

            {/* Tab: Por Categoría */}
            {activeTab === "categoria" && (
              <div className="gn-table-wrap">
                <table className="gn-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th style={{ textAlign: "right" }}>Cantidad Vendida</th>
                      <th style={{ textAlign: "right" }}>Ingreso Total</th>
                      <th style={{ textAlign: "right" }}>Costo Total</th>
                      <th style={{ textAlign: "right" }}>Ganancia</th>
                      <th>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCategoria.map((cat) => (
                      <tr key={cat.categoria}>
                        <td>
                          <span
                            className="gn-badge"
                            style={{
                              background: cat.color + "22",
                              color: cat.color,
                              border: `1px solid ${cat.color}44`,
                            }}
                          >
                            {cat.icono}{" "}
                            {cat.categoria.charAt(0).toUpperCase() +
                              cat.categoria.slice(1)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {cat.cantidadVendida}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: "#16a34a",
                            fontWeight: 600,
                          }}
                        >
                          {fmt(cat.ingresoTotal)}
                        </td>
                        <td style={{ textAlign: "right", color: "#d97706" }}>
                          {fmt(cat.costoTotal)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: cat.ganancia >= 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {fmt(cat.ganancia)}
                        </td>
                        <td style={{ minWidth: 100 }}>
                          <div
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              color:
                                cat.margen >= 30
                                  ? "#16a34a"
                                  : cat.margen >= 10
                                    ? "#d97706"
                                    : "#dc2626",
                            }}
                          >
                            {cat.margen.toFixed(1)}%
                          </div>
                          <div className="gn-bar-wrap">
                            <div
                              className="gn-bar"
                              style={{
                                width: `${Math.min(100, Math.max(0, cat.margen))}%`,
                                background:
                                  cat.margen >= 30
                                    ? "#16a34a"
                                    : cat.margen >= 10
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {porCategoria.length > 0 && (
                      <tr className="total-row">
                        <td>TOTAL</td>
                        <td style={{ textAlign: "right" }}>
                          {porCategoria.reduce(
                            (s, c) => s + c.cantidadVendida,
                            0,
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {fmt(kpis.totalVentas)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {fmt(kpis.totalCosto)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color:
                              kpis.gananciaBruta >= 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {fmt(kpis.gananciaBruta)}
                        </td>
                        <td>
                          {kpis.totalVentas > 0
                            ? (
                                (kpis.gananciaBruta / kpis.totalVentas) *
                                100
                              ).toFixed(1) + "%"
                            : "—"}
                        </td>
                      </tr>
                    )}
                    {porCategoria.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            padding: "2rem",
                            color: "#94a3b8",
                          }}
                        >
                          Sin ventas en este período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Subcategorías */}
            {activeTab === "subcategoria" && (
              <div className="gn-table-wrap">
                <table className="gn-table">
                  <thead>
                    <tr>
                      <th>Subcategoría (Comidas)</th>
                      <th style={{ textAlign: "right" }}>Cantidad Vendida</th>
                      <th style={{ textAlign: "right" }}>Ingreso Total</th>
                      <th style={{ textAlign: "right" }}>Costo Total</th>
                      <th style={{ textAlign: "right" }}>Ganancia</th>
                      <th>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porSubcategoria.map((sc) => {
                      const margen =
                        sc.ingresoTotal > 0
                          ? (sc.ganancia / sc.ingresoTotal) * 100
                          : 0;
                      return (
                        <tr key={sc.subcategoria}>
                          <td>
                            <span
                              className="gn-badge"
                              style={{
                                background: "#f0fdf4",
                                color: "#16a34a",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              🍴 {sc.subcategoria}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {sc.cantidadVendida}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              color: "#16a34a",
                              fontWeight: 600,
                            }}
                          >
                            {fmt(sc.ingresoTotal)}
                          </td>
                          <td style={{ textAlign: "right", color: "#d97706" }}>
                            {fmt(sc.costoTotal)}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: sc.ganancia >= 0 ? "#16a34a" : "#dc2626",
                            }}
                          >
                            {fmt(sc.ganancia)}
                          </td>
                          <td>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                color:
                                  margen >= 30
                                    ? "#16a34a"
                                    : margen >= 10
                                      ? "#d97706"
                                      : "#dc2626",
                              }}
                            >
                              {margen.toFixed(1)}%
                            </div>
                            <div className="gn-bar-wrap">
                              <div
                                className="gn-bar"
                                style={{
                                  width: `${Math.min(100, Math.max(0, margen))}%`,
                                  background:
                                    margen >= 30
                                      ? "#16a34a"
                                      : margen >= 10
                                        ? "#f59e0b"
                                        : "#ef4444",
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {porSubcategoria.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: "center",
                            padding: "2rem",
                            color: "#94a3b8",
                          }}
                        >
                          Sin subcategorías de comida registradas en este
                          período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Más Vendidos */}
            {activeTab === "productos" && (
              <div className="gn-table-wrap">
                <table className="gn-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th style={{ textAlign: "right" }}>Precio</th>
                      <th style={{ textAlign: "right" }}>Costo Unit.</th>
                      <th style={{ textAlign: "right" }}>Vendidos</th>
                      <th style={{ textAlign: "right" }}>Ingreso</th>
                      <th style={{ textAlign: "right" }}>Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProductos.map((p, i) => (
                      <tr key={p.id}>
                        <td>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "0.9rem",
                              color: i < 3 ? "#d97706" : "#94a3b8",
                            }}
                          >
                            {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                          </span>
                        </td>
                        <td
                          style={{
                            fontWeight: 600,
                            color: "#0f172a",
                            maxWidth: 200,
                          }}
                        >
                          {p.nombre}
                        </td>
                        <td>
                          <span
                            className="gn-badge"
                            style={{
                              background: (COLORES[p.tipo] || "#64748b") + "22",
                              color: COLORES[p.tipo] || "#64748b",
                              border: `1px solid ${COLORES[p.tipo] || "#64748b"}44`,
                            }}
                          >
                            {ICONOS[p.tipo] || "📦"} {p.tipo}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", color: "#16a34a" }}>
                          L {p.precio.toFixed(2)}
                        </td>
                        <td style={{ textAlign: "right", color: "#d97706" }}>
                          {p.costo != null ? (
                            `L ${p.costo.toFixed(2)}`
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {p.cantidadVendida}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {fmt(p.ingresoTotal)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: p.ganancia >= 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {p.costo != null ? (
                            fmt(p.ganancia)
                          ) : (
                            <span
                              style={{ color: "#94a3b8", fontSize: "0.8rem" }}
                            >
                              Sin costo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {topProductos.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            textAlign: "center",
                            padding: "2rem",
                            color: "#94a3b8",
                          }}
                        >
                          Sin ventas en este período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab: Delivery */}
            {activeTab === "delivery" && (
              <>
                <div
                  style={{
                    background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
                    border: "1px solid #bfdbfe",
                    borderRadius: 12,
                    padding: "1rem 1.25rem",
                    marginBottom: "1rem",
                    display: "flex",
                    gap: "2rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: "#1d4ed8",
                      }}
                    >
                      Total Pedidos
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {kpis.totalPedidosDelivery}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        color: "#1d4ed8",
                      }}
                    >
                      Ingreso por Envío
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        color: "#16a34a",
                      }}
                    >
                      {fmt(kpis.deliveryIngresos)}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                    💡 Los ingresos reflejan los{" "}
                    <strong>pedidos ya entregados</strong>. El monto es el{" "}
                    <strong>Costo de envío (L)</strong> cobrado al cliente.
                  </div>
                </div>

                <div className="gn-table-wrap">
                  <table className="gn-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th style={{ textAlign: "right" }}>
                          Pedidos Entregados
                        </th>
                        <th style={{ textAlign: "right" }}>
                          Ingreso por Envío
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryDias.map((d) => (
                        <tr key={d.fecha}>
                          <td style={{ fontWeight: 600 }}>{d.fecha}</td>
                          <td style={{ textAlign: "right" }}>{d.pedidos}</td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#2563eb",
                            }}
                          >
                            {fmt(d.ingresoEnvio)}
                          </td>
                        </tr>
                      ))}
                      {deliveryDias.length > 1 && (
                        <tr className="total-row">
                          <td>TOTAL</td>
                          <td style={{ textAlign: "right" }}>
                            {kpis.totalPedidosDelivery}
                          </td>
                          <td style={{ textAlign: "right", color: "#2563eb" }}>
                            {fmt(kpis.deliveryIngresos)}
                          </td>
                        </tr>
                      )}
                      {deliveryDias.length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            style={{
                              textAlign: "center",
                              padding: "2rem",
                              color: "#94a3b8",
                            }}
                          >
                            🛵 Sin pedidos de delivery entregados en este
                            período
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
