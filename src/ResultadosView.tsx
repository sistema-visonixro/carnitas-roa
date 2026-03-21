import { useEffect, useState } from "react";
import { getLocalDayRange } from "./utils/fechas";
import { supabase } from "./supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useDatosNegocio } from "./useDatosNegocio";

// use centralized supabase client from src/supabaseClient.ts

interface ResultadosViewProps {
  onBack?: () => void;
  onVerFacturasEmitidas?: () => void;
}

export default function ResultadosView({
  onBack,
  onVerFacturasEmitidas,
}: ResultadosViewProps) {
  // Obtener datos del negocio desde la base de datos
  const { datos: datosNegocio } = useDatosNegocio();

  // Inicializar los filtros de fecha/hora al día actual (formato datetime-local)
  const today = getLocalDayRange().day;
  const [desde, setDesde] = useState(() => today + "T00:00");
  const [hasta, setHasta] = useState(() => today + "T23:59");
  const [facturas, setFacturas] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [ventasPorDia, setVentasPorDia] = useState<any[]>([]);
  const [pagosTotales, setPagosTotales] = useState<{
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    dolares_lps: number;
    dolares_usd: number;
  }>({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    dolares_lps: 0,
    dolares_usd: 0,
  });
  const [pagos, setPagos] = useState<any[]>([]);
  const [filtroTipoPago, setFiltroTipoPago] = useState<string | null>(null);
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [cajeroFiltro, setCajeroFiltro] = useState("");
  // Estados para modal de resumen admin
  const [showResumenAdmin, setShowResumenAdmin] = useState(false);
  const [resumenAdminStep, setResumenAdminStep] = useState<"select" | "data">(
    "select",
  );
  const [cajeroResumenId, setCajeroResumenId] = useState("");
  const [resumenAdminLoading, setResumenAdminLoading] = useState(false);
  const [resumenAdminData, setResumenAdminData] = useState<{
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    dolares: number;
    dolares_usd: number;
    dolares_convertidos: number;
    tasa_dolar: number;
    gastos: number;
  } | null>(null);
  // Obtener usuario actual de localStorage
  const usuarioActual = (() => {
    try {
      const stored = localStorage.getItem("usuario");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    fetchDatos();
    fetchCajeros();
  }, [desde, hasta, cajeroFiltro]);

  async function fetchCajeros() {
    try {
      const { data } = await supabase
        .from("usuarios")
        .select("id, nombre")
        .order("nombre");
      setCajeros(data || []);
    } catch (error) {
      console.error("Error fetching cajeros:", error);
    }
  }

  async function fetchResumenAdmin(cajeroId: string) {
    setResumenAdminLoading(true);
    setResumenAdminStep("data");
    try {
      // Buscar la última apertura del cajero seleccionado
      const { data: cierreData } = await supabase
        .from("cierres")
        .select("fecha, caja")
        .eq("cajero_id", cajeroId)
        .eq("estado", "APERTURA")
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cierreData) {
        setResumenAdminLoading(false);
        setResumenAdminData({
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
          dolares: 0,
          dolares_usd: 0,
          dolares_convertidos: 0,
          tasa_dolar: 0,
          gastos: 0,
        });
        return;
      }

      const start = cierreData.fecha;
      const cajaAsignada = cierreData.caja;
      const { end: dayEnd } = getLocalDayRange();

      const [
        { data: pagosEfectivo },
        { data: pagosTarjeta },
        { data: pagosTrans },
        { data: pagosDolares },
        { data: gastosDia },
      ] = await Promise.all([
        supabase
          .from("pagos")
          .select("monto")
          .eq("tipo", "efectivo")
          .eq("cajero_id", cajeroId)
          .gte("fecha_hora", start)
          .lte("fecha_hora", dayEnd),
        supabase
          .from("pagos")
          .select("monto")
          .eq("tipo", "tarjeta")
          .eq("cajero_id", cajeroId)
          .gte("fecha_hora", start)
          .lte("fecha_hora", dayEnd),
        supabase
          .from("pagos")
          .select("monto")
          .eq("tipo", "transferencia")
          .eq("cajero_id", cajeroId)
          .gte("fecha_hora", start)
          .lte("fecha_hora", dayEnd),
        supabase
          .from("pagos")
          .select("monto,usd_monto")
          .eq("tipo", "dolares")
          .eq("cajero_id", cajeroId)
          .gte("fecha_hora", start)
          .lte("fecha_hora", dayEnd),
        supabase
          .from("gastos")
          .select("monto")
          .eq("cajero_id", cajeroId)
          .eq("caja", cajaAsignada)
          .gte("fecha_hora", start)
          .lte("fecha_hora", dayEnd),
      ]);

      const efectivoSum = (pagosEfectivo || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );
      const tarjetaSum = (pagosTarjeta || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );
      const transSum = (pagosTrans || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );
      const dolaresSum = (pagosDolares || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );
      const dolaresSumUsd = (pagosDolares || []).reduce(
        (s: number, p: any) => s + parseFloat(p.usd_monto || 0),
        0,
      );

      let tasa = 0;
      try {
        const { data: tasaData } = await supabase
          .from("precio_dolar")
          .select("valor")
          .eq("id", "singleton")
          .limit(1)
          .single();
        if (tasaData) tasa = Number(tasaData.valor) || 0;
      } catch (_) {}

      const dolaresConvertidos = Number((dolaresSumUsd * tasa).toFixed(2));
      const gastosSum = (gastosDia || []).reduce(
        (s: number, g: any) => s + parseFloat(g.monto || 0),
        0,
      );

      setResumenAdminData({
        efectivo: efectivoSum,
        tarjeta: tarjetaSum,
        transferencia: transSum,
        dolares: dolaresSum,
        dolares_usd: dolaresSumUsd,
        dolares_convertidos: dolaresConvertidos,
        tasa_dolar: tasa,
        gastos: gastosSum,
      });
    } catch (err) {
      console.error("Error al obtener resumen admin:", err);
      setResumenAdminData({
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        dolares: 0,
        dolares_usd: 0,
        dolares_convertidos: 0,
        tasa_dolar: 0,
        gastos: 0,
      });
    } finally {
      setResumenAdminLoading(false);
    }
  }

  // Si el usuario no es admin, mostrar mensaje y bloquear acceso
  if (
    !usuarioActual ||
    (usuarioActual.rol !== "admin" && usuarioActual.rol !== "Admin")
  ) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
          color: "#fff",
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        Acceso restringido: solo administradores pueden ver el dashboard
        financiero.
      </div>
    );
  }

  async function fetchDatos() {
    try {
      // Normalizar filtros: datetime-local YYYY-MM-DDTHH:MM → YYYY-MM-DD HH:MM:SS
      const desdeInicio = desde ? desde.replace("T", " ") + ":00" : null;
      const hastaFin = hasta ? hasta.replace("T", " ") + ":59" : null;

      // Función para obtener todos los registros con paginación
      async function obtenerTodasLasFacturas() {
        let todasLasFacturas: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("facturas").select("*", { count: "exact" });

          if (desdeInicio && hastaFin) {
            query = query
              .gte("fecha_hora", desdeInicio)
              .lte("fecha_hora", hastaFin);
          }

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha_hora", { ascending: false })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) throw error;
          if (data) {
            todasLasFacturas = [...todasLasFacturas, ...data];
            desde_pag += limite;
            hayMasRegistros = data.length === limite;
          } else {
            hayMasRegistros = false;
          }
        }
        return todasLasFacturas;
      }

      async function obtenerTodosLosGastos() {
        let todosLosGastos: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("gastos").select("*");

          if (desde && hasta) {
            query = query
              .gte("fecha", desde.split("T")[0])
              .lte("fecha", hasta.split("T")[0]);
          }

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha", { ascending: false })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) throw error;
          if (data) {
            todosLosGastos = [...todosLosGastos, ...data];
            desde_pag += limite;
            hayMasRegistros = data.length === limite;
          } else {
            hayMasRegistros = false;
          }
        }
        return todosLosGastos;
      }

      async function obtenerTodosLosPagos() {
        let todosLosPagos: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("pagos").select("*");

          if (desdeInicio && hastaFin) {
            query = query
              .gte("fecha_hora", desdeInicio)
              .lte("fecha_hora", hastaFin);
          }

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha_hora", { ascending: false })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) throw error;
          if (data) {
            todosLosPagos = [...todosLosPagos, ...data];
            desde_pag += limite;
            hayMasRegistros = data.length === limite;
          } else {
            hayMasRegistros = false;
          }
        }
        return todosLosPagos;
      }

      const [factData, gastData, pagosData] = await Promise.all([
        obtenerTodasLasFacturas(),
        obtenerTodosLosGastos(),
        obtenerTodosLosPagos(),
      ]);

      setFacturas(factData || []);
      setGastos(gastData || []);

      // Calcular totales de pagos por tipo (campo: tipo; valores: efectivo/tarjeta/transferencia/dolares)
      const pt = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        dolares_lps: 0,
        dolares_usd: 0,
      };
      (pagosData || []).forEach((p: any) => {
        const tipo = (p.tipo || "").toLowerCase().trim();
        const monto = parseFloat(String(p.monto || 0).replace(/,/g, ""));
        if (isNaN(monto)) return;
        if (tipo === "efectivo") pt.efectivo += monto;
        else if (tipo === "tarjeta") pt.tarjeta += monto;
        else if (tipo === "transferencia" || tipo === "transferencias")
          pt.transferencia += monto;
        else if (tipo === "dolares" || tipo === "dólares") {
          // monto ya es en Lempiras; usd_monto es el valor en USD
          pt.dolares_lps += monto;
          pt.dolares_usd += parseFloat(
            String(p.usd_monto || 0).replace(/,/g, ""),
          );
        }
      });
      setPagosTotales(pt);
      setPagos(pagosData || []);

      calcularMensual(factData || [], gastData || [], pagosData || []);
      calcularPorDia(factData || []);
      function calcularPorDia(facturas: any[]) {
        // Agrupar ventas por día
        const ventasAgrupadas: { [fecha: string]: number } = {};
        facturas.forEach((fact) => {
          const fecha = fact.fecha_hora.split("T")[0];
          ventasAgrupadas[fecha] =
            (ventasAgrupadas[fecha] || 0) + (fact.total || 0);
        });
        // Convertir a array para la gráfica
        const ventasArray = Object.entries(ventasAgrupadas).map(
          ([fecha, total]) => ({ fecha, total }),
        );
        setVentasPorDia(ventasArray);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  async function generarReportePDF() {
    if (!desde || !hasta) {
      alert(
        "Por favor selecciona las fechas Desde y Hasta antes de generar el reporte.",
      );
      return;
    }

    // Abrir ventana inmediatamente (acción directa del click) para evitar bloqueo de popups
    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup bloqueado. Por favor permite popups o usa la opción alternativa.",
      );
      return;
    }
    // Mostrar placeholder de carga
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Generando reporte...</title></head><body><h3>Cargando reporte...</h3></body></html>`,
    );
    win.document.close();

    try {
      // Normalizar rango al mismo formato que usa la vista: 'YYYY-MM-DD HH:MM:SS'
      const desdeInicio = desde.replace("T", " ") + ":00";
      const hastaFin = hasta.replace("T", " ") + ":59";

      // Funciones para obtener todos los registros con paginación
      async function obtenerTodasLasFacturasReporte() {
        let todasLasFacturas: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("facturas").select("*");

          query = query
            .gte("fecha_hora", desdeInicio)
            .lte("fecha_hora", hastaFin);

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha_hora", { ascending: true })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) throw error;
          if (data) {
            todasLasFacturas = [...todasLasFacturas, ...data];
            desde_pag += limite;
            hayMasRegistros = data.length === limite;
          } else {
            hayMasRegistros = false;
          }
        }
        return todasLasFacturas;
      }

      async function obtenerTodosLosGastosReporte() {
        let todosLosGastos: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("gastos").select("*");

          query = query
            .gte("fecha", desde.split("T")[0])
            .lte("fecha", hasta.split("T")[0]);

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha", { ascending: true })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) throw error;
          if (data) {
            todosLosGastos = [...todosLosGastos, ...data];
            desde_pag += limite;
            hayMasRegistros = data.length === limite;
          } else {
            hayMasRegistros = false;
          }
        }
        return todosLosGastos;
      }

      async function obtenerTodosLosPagosReporte() {
        let todosLosPagos: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("pagos").select("*");

          query = query
            .gte("fecha_hora", desdeInicio)
            .lte("fecha_hora", hastaFin);

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha_hora", { ascending: true })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) throw error;
          if (data) {
            todosLosPagos = [...todosLosPagos, ...data];
            desde_pag += limite;
            hayMasRegistros = data.length === limite;
          } else {
            hayMasRegistros = false;
          }
        }
        return todosLosPagos;
      }

      async function obtenerTodosLosCierresReporte() {
        let todosLosCierres: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase
            .from("cierres")
            .select("*")
            .eq("tipo_registro", "cierre");

          query = query.gte("fecha", desdeInicio).lte("fecha", hastaFin);

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha", { ascending: true })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) throw error;
          if (data) {
            todosLosCierres = [...todosLosCierres, ...data];
            desde_pag += limite;
            hayMasRegistros = data.length === limite;
          } else {
            hayMasRegistros = false;
          }
        }
        return todosLosCierres;
      }

      // Consultas paralelas (incluyendo precio_dolar)
      const [factData, gastData, pagosData, cierresData, precioDolarRes] =
        await Promise.all([
          obtenerTodasLasFacturasReporte(),
          obtenerTodosLosGastosReporte(),
          obtenerTodosLosPagosReporte(),
          obtenerTodosLosCierresReporte(),
          supabase
            .from("precio_dolar")
            .select("valor")
            .eq("id", "singleton")
            .limit(1)
            .single(),
        ]);

      const precioDolar = precioDolarRes.data?.valor
        ? Number(precioDolarRes.data.valor)
        : 0;

      // Consultar movimientos de inventario (bebidas e insumos vendidos) en paralelo
      const [bebidasMovRes, insumosMovRes] = await Promise.all([
        supabase
          .from("movimientos_inventario")
          .select(
            "producto_id, cantidad, costo_unitario, productos(nombre, precio, tipo)",
          )
          .eq("tipo", "venta")
          .eq("item_tipo", "producto")
          .gte("created_at", desdeInicio)
          .lte("created_at", hastaFin),
        supabase
          .from("movimientos_inventario")
          .select(
            "insumo_id, cantidad, costo_unitario, insumos(nombre, unidad)",
          )
          .eq("tipo", "venta")
          .eq("item_tipo", "insumo")
          .gte("created_at", desdeInicio)
          .lte("created_at", hastaFin),
      ]);
      const bebidasMovData = bebidasMovRes.data || [];
      const insumosMovData = insumosMovRes.data || [];

      // Los datos ya vienen directamente de las funciones de paginación

      const totalFacturas = factData.length;

      // IMPORTANTE: Primero calcular los pagos únicos por factura
      // porque este será el total de ventas real

      // Total de todos los pagos (raw)
      const totalPagosRaw = pagosData.reduce((s: number, p: any) => {
        const val =
          p.monto !== undefined && p.monto !== null
            ? Number(String(p.monto).replace(/,/g, ""))
            : 0;
        return s + (isNaN(val) ? 0 : val);
      }, 0);

      // Agrupar pagos por número de factura para no contar facturas repetidas
      const pagosPorFacturaMap = new Map<
        string,
        {
          factura: string;
          monto: number;
          tipos: Set<string>;
          cajero?: string;
          fecha?: string;
        }
      >();
      pagosData.forEach((p: any) => {
        // Buscar el número de factura en ambos campos posibles
        const facturaKey = p.factura_venta
          ? String(p.factura_venta)
          : p.factura
            ? String(p.factura)
            : `__no_fact_${p.id || Math.random()}`;
        const monto =
          p.monto !== undefined && p.monto !== null
            ? Number(String(p.monto).replace(/,/g, ""))
            : 0;
        const tipo = p.tipo || "";
        const fecha = p.fecha_hora || p.fecha || "";
        const cajero = p.cajero || "";
        if (pagosPorFacturaMap.has(facturaKey)) {
          const entry = pagosPorFacturaMap.get(facturaKey)!;
          entry.monto += isNaN(monto) ? 0 : monto;
          if (tipo) entry.tipos.add(tipo);
          // mantener la fecha más temprana
          if (fecha && (!entry.fecha || fecha < entry.fecha))
            entry.fecha = fecha;
        } else {
          const tiposSet = new Set<string>();
          if (tipo) tiposSet.add(tipo);
          pagosPorFacturaMap.set(facturaKey, {
            factura: facturaKey,
            monto: isNaN(monto) ? 0 : monto,
            tipos: tiposSet,
            cajero,
            fecha,
          });
        }
      });

      const pagosUnicosArray = Array.from(pagosPorFacturaMap.values());
      const totalPagosUnique = pagosUnicosArray.reduce(
        (s, p) => s + (p.monto || 0),
        0,
      );

      // Usar el total de pagos únicos como el total de ventas real
      // porque refleja correctamente las devoluciones y el dinero realmente recibido
      const totalVentas = totalPagosUnique;

      // Calcular total de ventas por facturas (para referencia)
      const totalVentasPorFacturas = factData.reduce((s: number, f: any) => {
        const val =
          f.total !== undefined && f.total !== null
            ? parseFloat(String(f.total).replace(/,/g, ""))
            : 0;
        return s + (isNaN(val) ? 0 : val);
      }, 0);

      const totalGastos = gastData.reduce(
        (s: number, g: any) => s + parseFloat(g.monto || 0),
        0,
      );
      const balanceReporte = totalVentas - totalGastos;
      const rentabilidadPercent =
        totalGastos > 0 ? (balanceReporte / totalGastos) * 100 : null;

      // Ganancia + Diferencia acumulada de cierres
      const totalDiferenciaCierres = cierresData.reduce(
        (acc: number, c: any) => acc + parseFloat(c.diferencia || 0),
        0,
      );
      const gananciaMasDiferencia = balanceReporte + totalDiferenciaCierres;

      // Desglose de pagos (separar dolares USD de Lps)
      const pagosPorTipo: { [k: string]: number } = {};
      let dolaresUSD = 0;
      pagosData.forEach((p: any) => {
        const tipo = p.tipo || "Desconocido";
        if (tipo === "dolares") {
          // Para dólares, acumular el valor en USD desde usd_monto
          dolaresUSD += parseFloat(p.usd_monto || 0);
        }
        pagosPorTipo[tipo] =
          (pagosPorTipo[tipo] || 0) + parseFloat(p.monto || 0);
      });
      const dolaresLps = pagosPorTipo["dolares"] || 0;

      // Debug: comparar facturas y pagos por factura (opcional)
      try {
        console.debug(
          "ReportePDF: facturas count",
          factData.length,
          "pagos count",
          pagosData.length,
        );
        console.debug(
          "ReportePDF: totalVentasPorFacturas",
          totalVentasPorFacturas,
          "totalPagosRaw (pagos)",
          totalPagosRaw,
          "totalPagosUnique/totalVentas",
          totalPagosUnique,
        );
      } catch (e) {}

      // Construir HTML para imprimir
      // Obtener nombre del cajero si hay filtro aplicado
      let nombreCajeroFiltro = "";
      if (cajeroFiltro) {
        const cajeroEncontrado = cajeros.find(
          (c: any) => c.id === cajeroFiltro,
        );
        nombreCajeroFiltro = cajeroEncontrado
          ? ` - Cajero: ${cajeroEncontrado.nombre}`
          : "";
      }
      const titulo = `Reporte Ventas ${desde} → ${hasta}${nombreCajeroFiltro}`;
      let html = `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>`;
      html += `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />`;
      html += `<style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #1a202c;
          padding: 20px;
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        }
        .header-content { position: relative; z-index: 1; }
        .logo { width: 100px; height: 100px; margin: 0 auto 20px; }
        .report-title { font-size: 42px; font-weight: 800; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); }
        .report-subtitle { font-size: 18px; opacity: 0.9; }
        .content { padding: 40px; }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }
        .kpi-card {
          background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%);
          border-radius: 15px;
          padding: 25px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          border-left: 5px solid;
          transition: transform 0.2s;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .kpi-card:hover { transform: translateY(-5px); }
        .kpi-card.ventas { border-left-color: #10b981; }
        .kpi-card.gastos { border-left-color: #ef4444; }
        .kpi-card.balance { border-left-color: #3b82f6; }
        .kpi-card.facturas { border-left-color: #f59e0b; }
        .kpi-card.rentabilidad { border-left-color: #8b5cf6; }
        .kpi-label {
          font-size: 14px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .kpi-value {
          font-size: 32px;
          font-weight: 800;
          color: #1a202c;
        }
        .kpi-icon {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .section {
          margin-bottom: 40px;
          background: #f8fafc;
          border-radius: 15px;
          padding: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .section-title {
          font-size: 24px;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 3px solid #667eea;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .chart-container {
          position: relative;
          height: 300px;
          margin: 20px 0;
          background: white;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-top: 20px;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        thead th {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        tbody td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
        }
        tbody tr:hover {
          background: #f8fafc;
        }
        tbody tr:last-child td {
          border-bottom: none;
        }
        .total-row {
          background: #fef3c7 !important;
          font-weight: 700;
          color: #1a202c !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .total-row td {
          border-top: 3px solid #f59e0b;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        .table-scroll {
          overflow-x: auto;
          margin: 0 -20px;
          padding: 0 20px;
        }
        .table-cierres {
          font-size: 9px !important;
          min-width: 100%;
        }
        .table-cierres th,
        .table-cierres td {
          padding: 8px 6px !important;
          white-space: nowrap;
          font-size: 9px !important;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body { background: white; padding: 0; }
          .container { box-shadow: none; border-radius: 0; }
          .header {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .kpi-card {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .section { 
            break-inside: avoid; 
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .chart-container { 
            height: 250px; 
            page-break-inside: avoid;
            break-inside: avoid;
          }
          thead th {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
          }
          .total-row {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fef3c7 !important;
          }
          .badge {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .table-scroll { overflow-x: visible; margin: 0; padding: 0; }
          .table-cierres { font-size: 7px !important; }
          .table-cierres th,
          .table-cierres td { padding: 4px 3px !important; font-size: 7px !important; }
          @page { size: landscape; margin: 10mm; }
        }
      </style>`;
      html += `</head><body><div class="container">`;

      // Header moderno
      const nombreNegocioReporte =
        datosNegocio.nombre_negocio?.toUpperCase() || "PUNTO DE VENTA";
      html += `<div class="header">
        <div class="header-content">
          <div class="report-title">📊 ${nombreNegocioReporte}</div>
          <div class="report-subtitle">${titulo}</div>
          <div style="margin-top:10px;font-size:14px;opacity:0.8;">Generado: ${new Date().toLocaleDateString(
            "es-HN",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          )}</div>
        </div>
      </div>`;

      html += `<div class="content">`;

      // KPIs Modernos
      html += `<div class="kpi-grid">`;
      html += `<div class="kpi-card ventas">
        <div class="kpi-icon">💰</div>
        <div class="kpi-label">Total Ventas</div>
        <div class="kpi-value">L ${totalVentas.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>`;
      html += `<div class="kpi-card gastos">
        <div class="kpi-icon">💸</div>
        <div class="kpi-label">Total Gastos</div>
        <div class="kpi-value">L ${totalGastos.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>`;
      html += `<div class="kpi-card balance">
        <div class="kpi-icon">${balanceReporte >= 0 ? "✅" : "❌"}</div>
        <div class="kpi-label">${balanceReporte >= 0 ? "Ganancia" : "Pérdida"}</div>
        <div class="kpi-value">L ${balanceReporte.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>`;
      html += `<div class="kpi-card facturas">
        <div class="kpi-icon">📋</div>
        <div class="kpi-label">Facturas</div>
        <div class="kpi-value">${totalFacturas}</div>
      </div>`;
      html += `<div class="kpi-card rentabilidad">
        <div class="kpi-icon">📈</div>
        <div class="kpi-label">Rentabilidad</div>
        <div class="kpi-value">${rentabilidadPercent !== null ? rentabilidadPercent.toFixed(1) + "%" : "N/A"}</div>
      </div>`;
      html += `<div class="kpi-card" style="border-left-color:#ec4899;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <div class="kpi-icon">🏦</div>
        <div class="kpi-label">Ganancia + Diferencia</div>
        <div class="kpi-value" style="color:${gananciaMasDiferencia >= 0 ? "#10b981" : "#ef4444"};">
          L ${gananciaMasDiferencia.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>`;
      html += `</div>`;

      // Sección de Pagos con gráfica
      html += `<div class="section">
        <div class="section-title">💳 Distribución de Pagos</div>`;

      if (precioDolar > 0) {
        html += `<div style="background:#fef3c7;padding:15px;border-radius:10px;margin-bottom:20px;border-left:4px solid #f59e0b;">
          <strong>💱 Tipo de Cambio:</strong> L ${precioDolar.toFixed(2)} por $1.00 USD
        </div>`;
      }

      // Preparar datos para la gráfica
      const pagoLabels: string[] = [];
      const pagoMontos: number[] = [];

      const tipos = ["efectivo", "transferencia", "tarjeta"];
      tipos.forEach((t) => {
        const m = Number(pagosPorTipo[t] || 0);
        if (m > 0) {
          const tLabel = t.charAt(0).toUpperCase() + t.slice(1);
          pagoLabels.push(tLabel);
          pagoMontos.push(m);
        }
      });

      if (dolaresLps > 0) {
        pagoLabels.push("Dólares");
        pagoMontos.push(dolaresLps);
      }

      // Crear gráfica SVG tipo pastel para pagos
      const totalPagosGrafica = pagoMontos.reduce((a, b) => a + b, 0);
      const coloresPagos = [
        "#10b981",
        "#3b82f6",
        "#f59e0b",
        "#8b5cf6",
        "#ec4899",
        "#14b8a6",
      ];
      let currentAngle = 0;
      let svgPathsPagos = "";
      let legendPagos = "";

      pagoMontos.forEach((monto, index) => {
        const percentage = (monto / totalPagosGrafica) * 100;
        const angle = (percentage / 100) * 360;
        const endAngle = currentAngle + angle;

        const startX =
          150 + 120 * Math.cos(((currentAngle - 90) * Math.PI) / 180);
        const startY =
          150 + 120 * Math.sin(((currentAngle - 90) * Math.PI) / 180);
        const endX = 150 + 120 * Math.cos(((endAngle - 90) * Math.PI) / 180);
        const endY = 150 + 120 * Math.sin(((endAngle - 90) * Math.PI) / 180);

        const largeArc = angle > 180 ? 1 : 0;

        svgPathsPagos += `<path d="M 150 150 L ${startX} ${startY} A 120 120 0 ${largeArc} 1 ${endX} ${endY} Z" fill="${coloresPagos[index]}" stroke="#fff" stroke-width="2"/>`;

        legendPagos += `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;"><div style="width:16px;height:16px;background:${coloresPagos[index]};border-radius:3px;"></div><span style="font-size:13px;">${pagoLabels[index]}: ${percentage.toFixed(1)}%</span></div>`;

        currentAngle = endAngle;
      });

      html += `<div style="display:flex;gap:30px;align-items:center;margin:20px 0;padding:20px;background:white;border-radius:10px;">
        <svg width="300" height="300" viewBox="0 0 300 300" style="flex-shrink:0;">
          <text x="150" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#1a202c">Distribución de Pagos</text>
          ${svgPathsPagos}
        </svg>
        <div style="flex:1;">${legendPagos}</div>
      </div>`;

      html += `<table><thead><tr><th>Tipo de Pago</th><th style="text-align:right;">Monto</th><th style="text-align:right;">% del Total</th></tr></thead><tbody>`;

      tipos.forEach((t) => {
        const m = Number(pagosPorTipo[t] || 0);
        if (m > 0) {
          const mFmt = m.toLocaleString("es-HN", { minimumFractionDigits: 2 });
          const tLabel = t.charAt(0).toUpperCase() + t.slice(1);
          const porcentaje = ((m / totalPagosUnique) * 100).toFixed(1);
          html += `<tr><td><span class="badge badge-info">${tLabel}</span></td><td style="text-align:right;">L ${mFmt}</td><td style="text-align:right;">${porcentaje}%</td></tr>`;
        }
      });

      if (dolaresUSD > 0) {
        const dolaresUSDFmt = dolaresUSD.toLocaleString("es-HN", {
          minimumFractionDigits: 2,
        });
        const dolaresLpsFmt = dolaresLps.toLocaleString("es-HN", {
          minimumFractionDigits: 2,
        });
        const porcentaje = ((dolaresLps / totalPagosUnique) * 100).toFixed(1);
        html += `<tr><td><span class="badge badge-success">Dólares</span></td><td style="text-align:right;"><b>$ ${dolaresUSDFmt}</b> <span style="color:#64748b;font-size:11px;">(L ${dolaresLpsFmt})</span></td><td style="text-align:right;">${porcentaje}%</td></tr>`;
      }

      Object.keys(pagosPorTipo).forEach((t) => {
        if (![...tipos, "dolares"].includes(t)) {
          const m = Number(pagosPorTipo[t] || 0);
          if (m > 0) {
            const mFmt = m.toLocaleString("es-HN", {
              minimumFractionDigits: 2,
            });
            const tLabel = t.charAt(0).toUpperCase() + t.slice(1);
            const porcentaje = ((m / totalPagosUnique) * 100).toFixed(1);
            html += `<tr><td><span class="badge badge-info">${tLabel}</span></td><td style="text-align:right;">L ${mFmt}</td><td style="text-align:right;">${porcentaje}%</td></tr>`;
          }
        }
      });

      const totalPagosFmt = Number(totalPagosUnique || 0).toLocaleString(
        "es-HN",
        { minimumFractionDigits: 2 },
      );
      html += `<tr class="total-row"><td><strong>TOTAL PAGOS</strong></td><td style="text-align:right;"><strong>L ${totalPagosFmt}</strong></td><td style="text-align:right;"><strong>100%</strong></td></tr>`;
      html += `</tbody></table></div>`;

      // Sección VALOR DE VENTA POR CATEGORÍA con gráficas
      html += `<div class="section">
        <div class="section-title">🍗 Ventas por Categoría</div>`;

      // Calcular ventas por categoría y subcategoría consultando tabla productos
      const ventasPorCategoria: { [key: string]: number } = {
        comida: 0,
        bebida: 0,
        complemento: 0,
      };
      const ventasPorSubcategoria: { [key: string]: number } = {};

      // Obtener todos los IDs de productos únicos
      const productosIds = new Set<string>();
      factData.forEach((f: any) => {
        if (f.productos) {
          try {
            // Parsear el string JSON de productos
            const productosArray =
              typeof f.productos === "string"
                ? JSON.parse(f.productos)
                : f.productos;

            if (Array.isArray(productosArray)) {
              productosArray.forEach((prod: any) => {
                if (prod.id) productosIds.add(prod.id);
              });
            }
          } catch (e) {
            console.error("Error parseando productos:", e);
          }
        }
      });

      // Consultar información de productos desde la base de datos
      const { data: productosInfo } = await supabase
        .from("productos")
        .select("id, tipo, subcategoria")
        .in("id", Array.from(productosIds));

      // Crear mapa de productos para búsqueda rápida
      const productosMap = new Map();
      if (productosInfo) {
        productosInfo.forEach((p: any) => {
          productosMap.set(p.id, {
            tipo: p.tipo,
            subcategoria: p.subcategoria,
          });
        });
      }

      // Crear mapa de pagos por factura para usar el monto real pagado
      const montoRealPorFactura = new Map<string, number>();
      pagosPorFacturaMap.forEach((value, key) => {
        montoRealPorFactura.set(key, value.monto);
      });

      // Crear mapa de facturas por número para búsqueda rápida
      const facturasMap = new Map<string, any>();
      factData.forEach((f: any) => {
        if (f.factura) {
          facturasMap.set(String(f.factura), f);
        }
      });

      // Calcular ventas SOLO de facturas que tienen pagos registrados
      montoRealPorFactura.forEach((montoPagado, facturaKey) => {
        const factura = facturasMap.get(facturaKey);

        if (factura && factura.productos) {
          try {
            // Parsear el string JSON de productos
            const productosArray =
              typeof factura.productos === "string"
                ? JSON.parse(factura.productos)
                : factura.productos;

            if (Array.isArray(productosArray) && productosArray.length > 0) {
              // Calcular el total teórico sumando productos para distribuir proporcionalmente
              let totalTeorico = 0;
              const productosPorCategoria: { [key: string]: number } = {
                comida: 0,
                bebida: 0,
                complemento: 0,
              };
              const productosPorSubcategoria: { [key: string]: number } = {};

              productosArray.forEach((prod: any) => {
                const productoInfo = productosMap.get(prod.id);
                if (productoInfo) {
                  const tipo = productoInfo.tipo || "comida";
                  const cantidad = prod.cantidad || 1;
                  const precio = prod.precio || 0;
                  const totalProd = precio * cantidad;
                  totalTeorico += totalProd;

                  // Acumular por categoría
                  if (productosPorCategoria[tipo] !== undefined) {
                    productosPorCategoria[tipo] += totalProd;
                  }

                  // Acumular por subcategoría
                  if (tipo === "comida" && productoInfo.subcategoria) {
                    const subcat = productoInfo.subcategoria;
                    productosPorSubcategoria[subcat] =
                      (productosPorSubcategoria[subcat] || 0) + totalProd;
                  }
                }
              });

              // Distribuir el total REAL PAGADO proporcionalmente
              if (totalTeorico > 0) {
                const factor = montoPagado / totalTeorico;

                // Aplicar factor a categorías
                Object.keys(productosPorCategoria).forEach((tipo) => {
                  if (ventasPorCategoria[tipo] !== undefined) {
                    ventasPorCategoria[tipo] +=
                      productosPorCategoria[tipo] * factor;
                  }
                });

                // Aplicar factor a subcategorías
                Object.keys(productosPorSubcategoria).forEach((subcat) => {
                  ventasPorSubcategoria[subcat] =
                    (ventasPorSubcategoria[subcat] || 0) +
                    productosPorSubcategoria[subcat] * factor;
                });
              }
            }
          } catch (e) {
            console.error("Error parseando productos para cálculo:", e);
          }
        }
      });

      // Preparar datos para gráficas
      const categoriaLabels: string[] = [];
      const categoriaMontos: number[] = [];

      const categorias = [
        { key: "comida", label: "Comidas", icon: "🍗" },
        { key: "complemento", label: "Complementos", icon: "🍟" },
        { key: "bebida", label: "Bebidas", icon: "🥤" },
      ];

      categorias.forEach(({ key }) => {
        const total = ventasPorCategoria[key] || 0;
        if (total > 0) {
          categoriaLabels.push(key.charAt(0).toUpperCase() + key.slice(1));
          categoriaMontos.push(total);
        }
      });

      // Crear gráfica SVG tipo pastel para categorías
      const totalCategoriasGrafica = categoriaMontos.reduce((a, b) => a + b, 0);
      const coloresCategorias = [
        "#f59e0b",
        "#10b981",
        "#3b82f6",
        "#ec4899",
        "#8b5cf6",
      ];
      let currentAngleCat = 0;
      let svgPathsCat = "";
      let legendCat = "";

      categoriaMontos.forEach((monto, index) => {
        const percentage = (monto / totalCategoriasGrafica) * 100;
        const angle = (percentage / 100) * 360;
        const endAngle = currentAngleCat + angle;

        const startX =
          150 + 120 * Math.cos(((currentAngleCat - 90) * Math.PI) / 180);
        const startY =
          150 + 120 * Math.sin(((currentAngleCat - 90) * Math.PI) / 180);
        const endX = 150 + 120 * Math.cos(((endAngle - 90) * Math.PI) / 180);
        const endY = 150 + 120 * Math.sin(((endAngle - 90) * Math.PI) / 180);

        const largeArc = angle > 180 ? 1 : 0;

        svgPathsCat += `<path d="M 150 150 L ${startX} ${startY} A 120 120 0 ${largeArc} 1 ${endX} ${endY} Z" fill="${coloresCategorias[index]}" stroke="#fff" stroke-width="2"/>`;

        legendCat += `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;"><div style="width:16px;height:16px;background:${coloresCategorias[index]};border-radius:3px;"></div><span style="font-size:13px;">${categoriaLabels[index]}: ${percentage.toFixed(1)}%</span></div>`;

        currentAngleCat = endAngle;
      });

      html += `<div style="display:flex;gap:30px;align-items:center;margin:20px 0;padding:20px;background:white;border-radius:10px;">
        <svg width="300" height="300" viewBox="0 0 300 300" style="flex-shrink:0;">
          <text x="150" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#1a202c">Ventas por Categoría</text>
          ${svgPathsCat}
        </svg>
        <div style="flex:1;">${legendCat}</div>
      </div>`;

      // Tabla de subcategorías de COMIDA
      const subcategorias = Object.keys(ventasPorSubcategoria).sort();
      if (subcategorias.length > 0) {
        html += `<h3 style="margin:30px 0 15px;color:#1a202c;font-size:18px;font-weight:700;">🍗 Comidas por Subcategoría</h3>`;

        // Crear gráfica SVG tipo pastel para subcategorías
        const subcatMontos = subcategorias.map((s) => ventasPorSubcategoria[s]);
        const totalSubcatGrafica = subcatMontos.reduce((a, b) => a + b, 0);
        const coloresSubcat = [
          "#667eea",
          "#f59e0b",
          "#10b981",
          "#3b82f6",
          "#ec4899",
          "#8b5cf6",
          "#14b8a6",
          "#f97316",
          "#06b6d4",
          "#84cc16",
          "#a855f7",
          "#0ea5e9",
          "#22c55e",
          "#eab308",
          "#ef4444",
        ];
        let currentAngleSub = 0;
        let svgPathsSub = "";
        let legendSub = "";

        subcatMontos.forEach((monto, index) => {
          const percentage = (monto / totalSubcatGrafica) * 100;
          const angle = (percentage / 100) * 360;
          const endAngle = currentAngleSub + angle;

          const startX =
            150 + 120 * Math.cos(((currentAngleSub - 90) * Math.PI) / 180);
          const startY =
            150 + 120 * Math.sin(((currentAngleSub - 90) * Math.PI) / 180);
          const endX = 150 + 120 * Math.cos(((endAngle - 90) * Math.PI) / 180);
          const endY = 150 + 120 * Math.sin(((endAngle - 90) * Math.PI) / 180);

          const largeArc = angle > 180 ? 1 : 0;

          svgPathsSub += `<path d="M 150 150 L ${startX} ${startY} A 120 120 0 ${largeArc} 1 ${endX} ${endY} Z" fill="${coloresSubcat[index % coloresSubcat.length]}" stroke="#fff" stroke-width="2"/>`;

          legendSub += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;"><div style="width:14px;height:14px;background:${coloresSubcat[index % coloresSubcat.length]};border-radius:3px;"></div><span style="font-size:11px;">${subcategorias[index]}: ${percentage.toFixed(1)}%</span></div>`;

          currentAngleSub = endAngle;
        });

        html += `<div style="display:flex;gap:20px;align-items:center;margin:20px 0;padding:20px;background:white;border-radius:10px;">
          <svg width="280" height="280" viewBox="0 0 300 300" style="flex-shrink:0;">
            <text x="150" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#1a202c">Subcategorías</text>
            ${svgPathsSub}
          </svg>
          <div style="flex:1;max-height:260px;overflow-y:auto;">${legendSub}</div>
        </div>`;

        html += `<table><thead><tr><th>Subcategoría</th><th style="text-align:right;">Total Ventas</th><th style="text-align:right;">% del Total Comidas</th></tr></thead><tbody>`;
        const totalComida = ventasPorCategoria["comida"] || 0;
        subcategorias.forEach((subcat) => {
          const total = ventasPorSubcategoria[subcat];
          const totalFmt = total.toLocaleString("es-HN", {
            minimumFractionDigits: 2,
          });
          const porcentaje =
            totalComida > 0 ? ((total / totalComida) * 100).toFixed(1) : "0";
          html += `<tr><td>${subcat}</td><td style="text-align:right;">L ${totalFmt}</td><td style="text-align:right;">${porcentaje}%</td></tr>`;
        });
        html += `</tbody></table>`;
      }

      // Tabla de categorías principales
      html += `<h3 style="margin:30px 0 15px;color:#1a202c;font-size:18px;font-weight:700;">📊 Resumen por Categoría</h3>`;
      html += `<table><thead><tr><th>Categoría</th><th style="text-align:right;">Total Ventas</th><th style="text-align:right;">% del Total</th></tr></thead><tbody>`;

      const totalCategorias = Object.values(ventasPorCategoria).reduce(
        (sum, val) => sum + val,
        0,
      );

      categorias.forEach(({ key, label, icon }) => {
        const total = ventasPorCategoria[key] || 0;
        if (total > 0) {
          const totalFmt = total.toLocaleString("es-HN", {
            minimumFractionDigits: 2,
          });
          const porcentaje = ((total / totalCategorias) * 100).toFixed(1);
          html += `<tr><td>${icon} ${label}</td><td style="text-align:right;">L ${totalFmt}</td><td style="text-align:right;">${porcentaje}%</td></tr>`;
        }
      });

      const totalCategoriasFmt = totalCategorias.toLocaleString("es-HN", {
        minimumFractionDigits: 2,
      });
      html += `<tr class="total-row"><td><strong>TOTAL GENERAL</strong></td><td style="text-align:right;"><strong>L ${totalCategoriasFmt}</strong></td><td style="text-align:right;"><strong>100%</strong></td></tr>`;
      html += `</tbody></table></div>`;

      // ── Unidades vendidas por producto de comida ─────────────────────────────
      // Iteramos TODAS las facturas del período directamente (sin filtrar por pago
      // ni aplicar ningún factor de proporcionalidad: las unidades son conteo puro).
      const unidadesPorProducto = new Map<
        string,
        { nombre: string; unidades: number; total: number }
      >();

      factData.forEach((factura: any) => {
        if (!factura.productos) return;
        try {
          const productosArray =
            typeof factura.productos === "string"
              ? JSON.parse(factura.productos)
              : factura.productos;
          if (!Array.isArray(productosArray)) return;

          productosArray.forEach((prod: any) => {
            const info = productosMap.get(prod.id);
            if (!info || info.tipo !== "comida") return;

            const nombre: string = prod.nombre || prod.id || "Desconocido";
            const cantidad: number = Number(prod.cantidad) || 1;
            const precioUnit: number = Number(prod.precio) || 0;
            const totalProd: number = precioUnit * cantidad;

            const entry = unidadesPorProducto.get(nombre);
            if (entry) {
              entry.unidades += cantidad;
              entry.total += totalProd;
            } else {
              unidadesPorProducto.set(nombre, {
                nombre,
                unidades: cantidad,
                total: totalProd,
              });
            }
          });
        } catch (e) {
          /* ignorar JSON malformado */
        }
      });

      const productosComidaOrdenados = Array.from(
        unidadesPorProducto.values(),
      ).sort((a, b) => b.unidades - a.unidades);

      if (productosComidaOrdenados.length > 0) {
        const totalUnidadesComida = productosComidaOrdenados.reduce(
          (s, p) => s + p.unidades,
          0,
        );
        const totalIngresosComida = productosComidaOrdenados.reduce(
          (s, p) => s + p.total,
          0,
        );
        const maxUnidades = productosComidaOrdenados[0].unidades;

        html += `<div class="section">
          <div class="section-title">🍗 Unidades Vendidas — Comida</div>`;
        html += `<table><thead><tr>
          <th>#</th>
          <th>Producto</th>
          <th style="text-align:center;">Unidades</th>
          <th style="text-align:right;">% del Total</th>
          <th style="text-align:right;">Total Ingresos</th>
        </tr></thead><tbody>`;

        productosComidaOrdenados.forEach((p, i) => {
          const pct =
            totalUnidadesComida > 0
              ? ((p.unidades / totalUnidadesComida) * 100).toFixed(1)
              : "0";
          const barWidth =
            maxUnidades > 0 ? Math.round((p.unidades / maxUnidades) * 100) : 0;
          const rowBg = i % 2 === 0 ? "" : "background:#f8fafc;";
          html += `<tr style="${rowBg}">
            <td style="color:#64748b;font-size:13px;">${i + 1}</td>
            <td style="font-weight:600;">${p.nombre}
              <div style="height:6px;background:#e2e8f0;border-radius:3px;margin-top:4px;">
                <div style="height:6px;background:#f59e0b;border-radius:3px;width:${barWidth}%;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
              </div>
            </td>
            <td style="text-align:center;font-weight:800;font-size:20px;color:#f59e0b;">${p.unidades}</td>
            <td style="text-align:right;">${pct}%</td>
            <td style="text-align:right;">L ${p.total.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</td>
          </tr>`;
        });

        html += `<tr class="total-row">
          <td></td>
          <td><strong>TOTAL</strong></td>
          <td style="text-align:center;font-weight:800;font-size:22px;">🍗 ${totalUnidadesComida}</td>
          <td style="text-align:right;"><strong>100%</strong></td>
          <td style="text-align:right;"><strong>L ${totalIngresosComida.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong></td>
        </tr>`;
        html += `</tbody></table></div>`;
      }
      // ─────────────────────────────────────────────────────────────────────────

      html += `<div class="section">
        <div class="section-title">🔐 Historial de Cierres de Caja</div>`;
      if (cierresData.length === 0) {
        html += `<p style="padding:20px;text-align:center;color:#64748b;">No hay cierres en el rango seleccionado.</p>`;
      } else {
        html += `<div class="table-scroll">`;
        html += `<table class="table-cierres"><thead><tr>`;
        html += `<th>Fecha</th>`;
        html += `<th>Cajero</th>`;
        html += `<th>Caja</th>`;
        html += `<th style="text-align:right;">Efectivo Reg.</th>`;
        html += `<th style="text-align:right;">Efectivo Día</th>`;
        html += `<th style="text-align:right;">Tarjeta Reg.</th>`;
        html += `<th style="text-align:right;">Tarjeta Día</th>`;
        html += `<th style="text-align:right;">Transf. Reg.</th>`;
        html += `<th style="text-align:right;">Transf. Día</th>`;
        html += `<th style="text-align:right;">Dólares Reg.</th>`;
        html += `<th style="text-align:right;">Dólares Día</th>`;
        html += `<th style="text-align:right;">Total Reg.</th>`;
        html += `<th style="text-align:right;">Total Día</th>`;
        html += `<th style="text-align:right;">Diferencia</th>`;
        html += `<th>Observación</th>`;
        html += `</tr></thead><tbody>`;
        cierresData.forEach((c: any) => {
          const fecha = c.fecha ? c.fecha.slice(0, 16).replace("T", " ") : "";
          const diferencia = parseFloat(c.diferencia || 0);
          const difColor =
            diferencia > 0 ? "#388e3c" : diferencia < 0 ? "#d32f2f" : "#111";

          // Calcular totales incluyendo dólares convertidos a Lempiras
          const dolaresRegLps =
            parseFloat(c.dolares_registrado || 0) * precioDolar;
          const dolaresDiaLps = parseFloat(c.dolares_dia || 0) * precioDolar;

          const totalRegistrado =
            parseFloat(c.efectivo_registrado || 0) +
            parseFloat(c.monto_tarjeta_registrado || 0) +
            parseFloat(c.transferencias_registradas || 0) +
            dolaresRegLps;

          const totalVentaDia =
            parseFloat(c.efectivo_dia || 0) +
            parseFloat(c.monto_tarjeta_dia || 0) +
            parseFloat(c.transferencias_dia || 0) +
            dolaresDiaLps;

          html += `<tr>`;
          html += `<td style="font-size:10px;">${fecha}</td>`;
          html += `<td>${c.cajero || ""}</td>`;
          html += `<td>${c.caja || ""}</td>`;
          html += `<td style="text-align:right;">L ${parseFloat(c.efectivo_registrado || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;">L ${parseFloat(c.efectivo_dia || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;">L ${parseFloat(c.monto_tarjeta_registrado || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;">L ${parseFloat(c.monto_tarjeta_dia || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;">L ${parseFloat(c.transferencias_registradas || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;">L ${parseFloat(c.transferencias_dia || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;">$ ${parseFloat(c.dolares_registrado || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;">$ ${parseFloat(c.dolares_dia || 0).toFixed(2)}</td>`;
          html += `<td style="text-align:right;font-weight:700;">L ${totalRegistrado.toFixed(2)}</td>`;
          html += `<td style="text-align:right;font-weight:700;">L ${totalVentaDia.toFixed(2)}</td>`;
          html += `<td style="text-align:right;color:${difColor};font-weight:700;">L ${diferencia.toFixed(2)}</td>`;
          html += `<td style="font-size:10px;">${c.observacion || "—"}</td>`;
          html += `</tr>`;
        });

        // Calcular totales generales de cierres
        const totalesCierres = cierresData.reduce(
          (acc: any, c: any) => {
            const dolaresRegLps =
              parseFloat(c.dolares_registrado || 0) * precioDolar;
            const dolaresDiaLps = parseFloat(c.dolares_dia || 0) * precioDolar;

            return {
              efectivoReg:
                acc.efectivoReg + parseFloat(c.efectivo_registrado || 0),
              efectivoDia: acc.efectivoDia + parseFloat(c.efectivo_dia || 0),
              tarjetaReg:
                acc.tarjetaReg + parseFloat(c.monto_tarjeta_registrado || 0),
              tarjetaDia: acc.tarjetaDia + parseFloat(c.monto_tarjeta_dia || 0),
              transfReg:
                acc.transfReg + parseFloat(c.transferencias_registradas || 0),
              transfDia: acc.transfDia + parseFloat(c.transferencias_dia || 0),
              dolaresReg:
                acc.dolaresReg + parseFloat(c.dolares_registrado || 0),
              dolaresDia: acc.dolaresDia + parseFloat(c.dolares_dia || 0),
              totalReg:
                acc.totalReg +
                parseFloat(c.efectivo_registrado || 0) +
                parseFloat(c.monto_tarjeta_registrado || 0) +
                parseFloat(c.transferencias_registradas || 0) +
                dolaresRegLps,
              totalDia:
                acc.totalDia +
                parseFloat(c.efectivo_dia || 0) +
                parseFloat(c.monto_tarjeta_dia || 0) +
                parseFloat(c.transferencias_dia || 0) +
                dolaresDiaLps,
              diferencia: acc.diferencia + parseFloat(c.diferencia || 0),
            };
          },
          {
            efectivoReg: 0,
            efectivoDia: 0,
            tarjetaReg: 0,
            tarjetaDia: 0,
            transfReg: 0,
            transfDia: 0,
            dolaresReg: 0,
            dolaresDia: 0,
            totalReg: 0,
            totalDia: 0,
            diferencia: 0,
          },
        );

        // Fila de totales
        const difTotalColorCierres =
          totalesCierres.diferencia > 0
            ? "#10b981"
            : totalesCierres.diferencia < 0
              ? "#ef4444"
              : "#1a202c";
        html += `<tr class="total-row">`;
        html += `<th colspan="3" style="text-align:right;">TOTALES:</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.efectivoReg.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.efectivoDia.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.tarjetaReg.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.tarjetaDia.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.transfReg.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.transfDia.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">$ ${totalesCierres.dolaresReg.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">$ ${totalesCierres.dolaresDia.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.totalReg.toFixed(2)}</th>`;
        html += `<th style="text-align:right;">L ${totalesCierres.totalDia.toFixed(2)}</th>`;
        html += `<th style="text-align:right;color:${difTotalColorCierres};">L ${totalesCierres.diferencia.toFixed(2)}</th>`;
        html += `<th></th>`;
        html += `</tr>`;

        html += `</tbody></table></div>`;
      }
      html += `</div>`;

      // ── Sección Bebidas Vendidas (movimientos_inventario tipo=venta, item_tipo=producto) ──
      const bebidasMap = new Map<
        string,
        { nombre: string; cantidad: number; precio: number }
      >();
      (bebidasMovData as any[]).forEach((m: any) => {
        const prod = Array.isArray(m.productos) ? m.productos[0] : m.productos;
        // Solo incluir productos cuyo tipo sea 'bebida'
        if (!prod || prod.tipo !== "bebida") return;
        const nombre = prod.nombre || m.producto_id || "Desconocido";
        const precio = parseFloat(prod?.precio ?? m.costo_unitario ?? 0);
        const cantidad = parseFloat(m.cantidad || 0);
        if (bebidasMap.has(nombre)) {
          bebidasMap.get(nombre)!.cantidad += cantidad;
        } else {
          bebidasMap.set(nombre, { nombre, cantidad, precio });
        }
      });

      html += `<div class="section"><div class="section-title">🥤 Bebidas Vendidas</div>`;
      if (bebidasMap.size === 0) {
        html += `<p style="padding:20px;text-align:center;color:#64748b;">No hay movimientos de bebidas en el rango seleccionado.</p>`;
      } else {
        html += `<table><thead><tr><th>Bebida</th><th style="text-align:right;">Cantidad</th><th style="text-align:right;">Precio Venta</th><th style="text-align:right;">Total</th></tr></thead><tbody>`;
        let totalBebidasVentas = 0;
        bebidasMap.forEach(({ nombre, cantidad, precio }) => {
          const total = cantidad * precio;
          totalBebidasVentas += total;
          html += `<tr><td>${nombre}</td><td style="text-align:right;">${cantidad.toFixed(2)}</td><td style="text-align:right;">L ${precio.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</td><td style="text-align:right;">L ${total.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</td></tr>`;
        });
        html += `<tr class="total-row"><td colspan="3"><strong>TOTAL BEBIDAS</strong></td><td style="text-align:right;"><strong>L ${totalBebidasVentas.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong></td></tr>`;
        html += `</tbody></table>`;
      }
      html += `</div>`;

      // ── Sección Insumos Consumidos (movimientos_inventario tipo=venta, item_tipo=insumo) ──
      const insumosConsumoMap = new Map<
        string,
        {
          nombre: string;
          unidad: string;
          cantidad: number;
          costoUnitario: number;
          costoTotal: number;
        }
      >();
      (insumosMovData as any[]).forEach((m: any) => {
        const ins = Array.isArray(m.insumos) ? m.insumos[0] : m.insumos;
        const nombre = ins?.nombre || m.insumo_id || "Desconocido";
        const unidad = ins?.unidad || "";
        const cantidad = parseFloat(m.cantidad || 0);
        const costoUnitario = parseFloat(m.costo_unitario || 0);
        if (insumosConsumoMap.has(nombre)) {
          const entry = insumosConsumoMap.get(nombre)!;
          entry.cantidad += cantidad;
          entry.costoTotal += cantidad * costoUnitario;
        } else {
          insumosConsumoMap.set(nombre, {
            nombre,
            unidad,
            cantidad,
            costoUnitario,
            costoTotal: cantidad * costoUnitario,
          });
        }
      });

      html += `<div class="section"><div class="section-title">🧂 Insumos Consumidos</div>`;
      if (insumosConsumoMap.size === 0) {
        html += `<p style="padding:20px;text-align:center;color:#64748b;">No hay consumo de insumos en el rango seleccionado.</p>`;
      } else {
        html += `<table><thead><tr><th>Insumo</th><th>Unidad</th><th style="text-align:right;">Cantidad</th><th style="text-align:right;">Costo Unitario</th><th style="text-align:right;">Total Costo</th></tr></thead><tbody>`;
        let totalInsumosCosto = 0;
        insumosConsumoMap.forEach(
          ({ nombre, unidad, cantidad, costoUnitario, costoTotal }) => {
            totalInsumosCosto += costoTotal;
            html += `<tr><td>${nombre}</td><td>${unidad}</td><td style="text-align:right;">${cantidad.toFixed(3)}</td><td style="text-align:right;">L ${costoUnitario.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</td><td style="text-align:right;">L ${costoTotal.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</td></tr>`;
          },
        );
        html += `<tr class="total-row"><td colspan="4"><strong>TOTAL INSUMOS</strong></td><td style="text-align:right;"><strong>L ${totalInsumosCosto.toLocaleString("es-HN", { minimumFractionDigits: 2 })}</strong></td></tr>`;
        html += `</tbody></table>`;
      }
      html += `</div>`;

      // Cerrar contenedor
      html += `</div></div>`;

      html += `</body></html>`;

      // Reemplazar contenido de la ventana ya abierta y lanzar print
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      // Las gráficas SVG se muestran inmediatamente, no necesitan tiempo de carga
      setTimeout(() => {
        win.print();
      }, 500);
    } catch (error) {
      console.error("Error generando reporte:", error);
      try {
        win.document.body.innerHTML =
          "<p>Error al generar el reporte. Revisa la consola para más detalles.</p>";
      } catch (e) {}
      alert(
        "Error al generar el reporte. Revisa la consola para más detalles.",
      );
    }
  }

  async function generarReporteFacturas() {
    if (!desde || !hasta) {
      alert(
        "Por favor selecciona las fechas Desde y Hasta antes de generar el reporte.",
      );
      return;
    }

    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup bloqueado. Por favor permite popups o usa la opción alternativa.",
      );
      return;
    }
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Generando reporte...</title></head><body><h3>Cargando reporte...</h3></body></html>`,
    );
    win.document.close();

    try {
      const desdeInicio = desde.replace("T", " ") + ":00";
      const hastaFin = hasta.replace("T", " ") + ":59";

      // Obtener todas las facturas con paginación
      async function obtenerTodasLasFacturasReporte() {
        let todasLasFacturas: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("facturas").select("*");

          query = query
            .gte("fecha_hora", desdeInicio)
            .lte("fecha_hora", hastaFin);

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha_hora", { ascending: true })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) {
            console.error("Error obteniendo facturas:", error);
            break;
          }

          if (!data || data.length === 0) {
            hayMasRegistros = false;
          } else {
            todasLasFacturas = todasLasFacturas.concat(data);
            desde_pag += limite;
            if (data.length < limite) {
              hayMasRegistros = false;
            }
          }
        }

        return todasLasFacturas;
      }

      const facturas_reporte = await obtenerTodasLasFacturasReporte();
      const nombreCajero = cajeroFiltro
        ? cajeros.find((c) => c.id === cajeroFiltro)?.nombre || "Sin nombre"
        : "";

      let html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de Facturas</title></head><body style="margin:0;padding:20px;font-family:Arial,sans-serif;font-size:12px;background:#fff;">`;
      html += `<div style="max-width:1200px;margin:0 auto;">`;
      html += `<h1 style="text-align:center;color:#333;">📋 Reporte de Facturas</h1>`;
      html += `<p style="text-align:center;color:#666;margin-bottom:20px;">Del ${desde} al ${hasta}${cajeroFiltro ? ` - Cajero: ${nombreCajero}` : ""}</p>`;

      html += `<h2 style="color:#333;border-bottom:2px solid #ddd;padding-bottom:5px;margin-top:30px;">Tabla de Ventas Realizadas</h2>`;
      html += `<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="background:#f0f0f0;"><th style="border:1px solid #ccc;padding:8px;text-align:left;">#</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Factura</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Cliente</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Fecha/Hora</th><th style="border:1px solid #ccc;padding:8px;text-align:right;">Total (L)</th></tr></thead><tbody>`;

      facturas_reporte.forEach((f, i) => {
        const total = parseFloat(String(f.total || 0).replace(/,/g, ""));
        const formattedTotal = total.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
        });
        html += `<tr><td style="border:1px solid #ccc;padding:8px;">${i + 1}</td><td style="border:1px solid #ccc;padding:8px;">${f.numero_factura || f.id}</td><td style="border:1px solid #ccc;padding:8px;">${f.cliente || "—"}</td><td style="border:1px solid #ccc;padding:8px;">${f.fecha_hora?.slice(0, 16).replace("T", " ") || "—"}</td><td style="border:1px solid #ccc;padding:8px;text-align:right;">${formattedTotal}</td></tr>`;
      });

      const totalFacturas = facturas_reporte.reduce((sum, f) => {
        const total = parseFloat(String(f.total || 0).replace(/,/g, ""));
        return sum + (isNaN(total) ? 0 : total);
      }, 0);
      html += `<tr style="background:#ffffcc;font-weight:bold;"><td colspan="4" style="border:1px solid #ccc;padding:8px;text-align:right;">TOTAL:</td><td style="border:1px solid #ccc;padding:8px;text-align:right;">L ${totalFacturas.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td></tr>`;
      html += `</tbody></table>`;

      html += `</div></body></html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    } catch (error) {
      console.error("Error generando reporte de facturas:", error);
      try {
        win.document.body.innerHTML =
          "<p>Error al generar el reporte. Revisa la consola para más detalles.</p>";
      } catch (e) {}
      alert(
        "Error al generar el reporte. Revisa la consola para más detalles.",
      );
    }
  }

  async function generarReporteGastos() {
    if (!desde || !hasta) {
      alert(
        "Por favor selecciona las fechas Desde y Hasta antes de generar el reporte.",
      );
      return;
    }

    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup bloqueado. Por favor permite popups o usa la opción alternativa.",
      );
      return;
    }
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Generando reporte...</title></head><body><h3>Cargando reporte...</h3></body></html>`,
    );
    win.document.close();

    try {
      const desdeInicio = desde.replace("T", " ") + ":00";
      const hastaFin = hasta.replace("T", " ") + ":59";

      // Obtener todos los gastos con paginación
      async function obtenerTodosLosGastosReporte() {
        let todosLosGastos: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("gastos").select("*");

          query = query
            .gte("fecha_hora", desdeInicio)
            .lte("fecha_hora", hastaFin);

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha_hora", { ascending: true })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) {
            console.error("Error obteniendo gastos:", error);
            break;
          }

          if (!data || data.length === 0) {
            hayMasRegistros = false;
          } else {
            todosLosGastos = todosLosGastos.concat(data);
            desde_pag += limite;
            if (data.length < limite) {
              hayMasRegistros = false;
            }
          }
        }

        return todosLosGastos;
      }

      const gastos_reporte = await obtenerTodosLosGastosReporte();
      const nombreCajero = cajeroFiltro
        ? cajeros.find((c) => c.id === cajeroFiltro)?.nombre || "Sin nombre"
        : "";

      let html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de Gastos</title></head><body style="margin:0;padding:20px;font-family:Arial,sans-serif;font-size:12px;background:#fff;">`;
      html += `<div style="max-width:1200px;margin:0 auto;">`;
      html += `<h1 style="text-align:center;color:#333;">💸 Reporte de Gastos</h1>`;
      html += `<p style="text-align:center;color:#666;margin-bottom:20px;">Del ${desde} al ${hasta}${cajeroFiltro ? ` - Cajero: ${nombreCajero}` : ""}</p>`;

      html += `<h2 style="color:#333;border-bottom:2px solid #ddd;padding-bottom:5px;margin-top:30px;">Tabla de Gastos</h2>`;
      html += `<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="background:#f0f0f0;"><th style="border:1px solid #ccc;padding:8px;text-align:left;">#</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Descripción</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Fecha/Hora</th><th style="border:1px solid #ccc;padding:8px;text-align:right;">Monto (L)</th></tr></thead><tbody>`;

      gastos_reporte.forEach((g, i) => {
        const monto = parseFloat(String(g.monto || 0).replace(/,/g, ""));
        const formattedMonto = monto.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
        });
        html += `<tr><td style="border:1px solid #ccc;padding:8px;">${i + 1}</td><td style="border:1px solid #ccc;padding:8px;">${g.descripcion || "—"}</td><td style="border:1px solid #ccc;padding:8px;">${g.fecha_hora?.slice(0, 16).replace("T", " ") || "—"}</td><td style="border:1px solid #ccc;padding:8px;text-align:right;">${formattedMonto}</td></tr>`;
      });

      const totalGastos = gastos_reporte.reduce((sum, g) => {
        const monto = parseFloat(String(g.monto || 0).replace(/,/g, ""));
        return sum + (isNaN(monto) ? 0 : monto);
      }, 0);
      html += `<tr style="background:#ffffcc;font-weight:bold;"><td colspan="3" style="border:1px solid #ccc;padding:8px;text-align:right;">TOTAL:</td><td style="border:1px solid #ccc;padding:8px;text-align:right;">L ${totalGastos.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td></tr>`;
      html += `</tbody></table>`;

      html += `</div></body></html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    } catch (error) {
      console.error("Error generando reporte de gastos:", error);
      try {
        win.document.body.innerHTML =
          "<p>Error al generar el reporte. Revisa la consola para más detalles.</p>";
      } catch (e) {}
      alert(
        "Error al generar el reporte. Revisa la consola para más detalles.",
      );
    }
  }

  async function generarReportePagos() {
    if (!desde || !hasta) {
      alert(
        "Por favor selecciona las fechas Desde y Hasta antes de generar el reporte.",
      );
      return;
    }

    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup bloqueado. Por favor permite popups o usa la opción alternativa.",
      );
      return;
    }
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Generando reporte...</title></head><body><h3>Cargando reporte...</h3></body></html>`,
    );
    win.document.close();

    try {
      const desdeInicio = desde.replace("T", " ") + ":00";
      const hastaFin = hasta.replace("T", " ") + ":59";

      // Obtener todos los pagos con paginación
      async function obtenerTodosLosPagosReporte() {
        let todosLosPagos: any[] = [];
        let desde_pag = 0;
        const limite = 1000;
        let hayMasRegistros = true;

        while (hayMasRegistros) {
          let query = supabase.from("pagos").select("*");

          query = query
            .gte("fecha_hora", desdeInicio)
            .lte("fecha_hora", hastaFin);

          if (cajeroFiltro) {
            query = query.eq("cajero_id", cajeroFiltro);
          }

          const { data, error } = await query
            .order("fecha_hora", { ascending: true })
            .range(desde_pag, desde_pag + limite - 1);

          if (error) {
            console.error("Error obteniendo pagos:", error);
            break;
          }

          if (!data || data.length === 0) {
            hayMasRegistros = false;
          } else {
            todosLosPagos = todosLosPagos.concat(data);
            desde_pag += limite;
            if (data.length < limite) {
              hayMasRegistros = false;
            }
          }
        }

        return todosLosPagos;
      }

      const pagos_reporte = await obtenerTodosLosPagosReporte();
      const nombreCajero = cajeroFiltro
        ? cajeros.find((c) => c.id === cajeroFiltro)?.nombre || "Sin nombre"
        : "";

      let html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de Pagos</title></head><body style="margin:0;padding:20px;font-family:Arial,sans-serif;font-size:12px;background:#fff;">`;
      html += `<div style="max-width:1200px;margin:0 auto;">`;
      html += `<h1 style="text-align:center;color:#333;">💳 Reporte de Pagos (Detalle)</h1>`;
      html += `<p style="text-align:center;color:#666;margin-bottom:20px;">Del ${desde} al ${hasta}${cajeroFiltro ? ` - Cajero: ${nombreCajero}` : ""}</p>`;

      html += `<h2 style="color:#333;border-bottom:2px solid #ddd;padding-bottom:5px;margin-top:30px;">Tabla de Pagos (Detalle)</h2>`;
      html += `<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="background:#f0f0f0;"><th style="border:1px solid #ccc;padding:8px;text-align:left;">#</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Factura</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Tipo</th><th style="border:1px solid #ccc;padding:8px;text-align:left;">Fecha/Hora</th><th style="border:1px solid #ccc;padding:8px;text-align:right;">Monto (L)</th></tr></thead><tbody>`;

      pagos_reporte.forEach((p, i) => {
        const monto = parseFloat(String(p.monto || 0).replace(/,/g, ""));
        const formattedMonto = monto.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
        });
        html += `<tr><td style="border:1px solid #ccc;padding:8px;">${i + 1}</td><td style="border:1px solid #ccc;padding:8px;">${p.factura_venta || p.factura || "—"}</td><td style="border:1px solid #ccc;padding:8px;">${p.metodo_pago || "—"}</td><td style="border:1px solid #ccc;padding:8px;">${p.fecha_hora?.slice(0, 16).replace("T", " ") || "—"}</td><td style="border:1px solid #ccc;padding:8px;text-align:right;">${formattedMonto}</td></tr>`;
      });

      const totalPagos = pagos_reporte.reduce((sum, p) => {
        const monto = parseFloat(String(p.monto || 0).replace(/,/g, ""));
        return sum + (isNaN(monto) ? 0 : monto);
      }, 0);
      html += `<tr style="background:#ffffcc;font-weight:bold;"><td colspan="4" style="border:1px solid #ccc;padding:8px;text-align:right;">TOTAL:</td><td style="border:1px solid #ccc;padding:8px;text-align:right;">L ${totalPagos.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</td></tr>`;
      html += `</tbody></table>`;

      html += `</div></body></html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    } catch (error) {
      console.error("Error generando reporte de pagos:", error);
      try {
        win.document.body.innerHTML =
          "<p>Error al generar el reporte. Revisa la consola para más detalles.</p>";
      } catch (e) {}
      alert(
        "Error al generar el reporte. Revisa la consola para más detalles.",
      );
    }
  }

  function calcularMensual(_facturas: any[], gastos: any[], pagos: any[]) {
    // Calcular total de ventas basado en pagos únicos por factura
    const pagosPorFacturaMap = new Map<string, number>();
    pagos.forEach((p: any) => {
      const facturaKey =
        p.factura || p.factura_venta || `__no_fact_${p.id || Math.random()}`;
      const monto = parseFloat(String(p.monto || 0).replace(/,/g, ""));
      if (!isNaN(monto)) {
        pagosPorFacturaMap.set(
          facturaKey,
          (pagosPorFacturaMap.get(facturaKey) || 0) + monto,
        );
      }
    });
    const totalVentasReal = Array.from(pagosPorFacturaMap.values()).reduce(
      (sum, monto) => sum + monto,
      0,
    );

    // Calcular balance total
    const totalGastos = gastos.reduce(
      (sum, g) => sum + parseFloat(g.monto || 0),
      0,
    );
    setBalance(totalVentasReal - totalGastos);
  }

  // Mapa: número de factura → set de tipos de pago
  const pagosPorFacturaMap = new Map<string, Set<string>>();
  pagos.forEach((p: any) => {
    const factNum = p.factura_venta
      ? String(p.factura_venta)
      : p.factura
        ? String(p.factura)
        : null;
    if (!factNum) return;
    if (!pagosPorFacturaMap.has(factNum)) pagosPorFacturaMap.set(factNum, new Set());
    const tipo = (p.tipo || "").toLowerCase().trim();
    if (tipo) pagosPorFacturaMap.get(factNum)!.add(tipo);
  });

  const facturasFiltradas =
    filtroTipoPago === null
      ? facturas
      : filtroTipoPago === "delivery"
        ? facturas.filter((f: any) => (f.tipo_orden || "").toUpperCase() === "DELIVERY")
        : facturas.filter((f: any) => {
            const tipos = pagosPorFacturaMap.get(String(f.factura || ""));
            if (!tipos) return false;
            if (filtroTipoPago === "transferencia")
              return tipos.has("transferencia") || tipos.has("transferencias");
            if (filtroTipoPago === "dolares")
              return tipos.has("dolares") || tipos.has("dólares");
            return tipos.has(filtroTipoPago);
          });

  // Total de facturas delivery
  const deliveryTotal = facturas
    .filter((f: any) => (f.tipo_orden || "").toUpperCase() === "DELIVERY")
    .reduce((s: number, f: any) => s + parseFloat(String(f.total || 0)), 0);

  const gastosFiltrados = gastos;

  // Calcular total de ventas desde el balance (que ya usa pagos)
  const totalGastos = gastosFiltrados.reduce(
    (sum, g) => sum + parseFloat(g.monto || 0),
    0,
  );
  const totalVentas = balance + totalGastos;
  const facturasCount = facturasFiltradas.length;
  const gastosCount = gastosFiltrados.length;

  // Rango de facturas (primera y última según número de factura)
  const facturasSorted = [...facturasFiltradas].sort((a, b) => {
    const fa = parseInt(String(a.factura || "0").replace(/[^0-9]/g, ""), 10);
    const fb = parseInt(String(b.factura || "0").replace(/[^0-9]/g, ""), 10);
    return fa - fb;
  });
  const facturaInicial =
    facturasSorted.length > 0 ? facturasSorted[0]?.factura : null;
  const facturaFinal =
    facturasSorted.length > 0
      ? facturasSorted[facturasSorted.length - 1]?.factura
      : null;

  return (
    <div
      className="resultados-enterprise"
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
        .resultados-enterprise {
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

        .resultados-enterprise {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 0;
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

        .main-content {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .filters {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255,255,255,0.1);
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .filter-group label {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.95rem;
        }

        .filter-input, .filter-select {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .btn-filter {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .kpi-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          transition: all 0.3s ease;
          box-shadow: var(--shadow);
        }

        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }

        .kpi-value {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .kpi-success .kpi-value { color: var(--success); }
        .kpi-danger .kpi-value { color: var(--danger); }
        .kpi-info .kpi-value { color: var(--info); }

        .kpi-label {
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        /* Mobile adjustments: stack columns and make tables scrollable */
        @media (max-width: 900px) {
          .content-grid { grid-template-columns: 1fr; }
          .kpi-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
          .table-card { padding: 1rem; }
          .filters { padding: 1rem; gap: 1rem; }
        }

        .table-responsive { overflow-x: auto; }

        .table-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .table-card {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: var(--shadow);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .table-title {
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .btn-secondary {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          min-width: 600px; /* permite scroll en pantallas estrechas */
        }

        .table th, .table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }

        .table th {
          background: rgba(255,255,255,0.08);
          color: var(--text-primary);
          font-weight: 600;
        }

        .charts-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 2rem;
          box-shadow: var(--shadow);
        }

        .charts-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 2rem;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }

        @media (max-width: 1024px) {
          .content-grid { grid-template-columns: 1fr; }
          .charts-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .filters { flex-direction: column; gap: 1rem; }
          .filter-group { justify-content: center; }
          .main-content { padding: 1rem; }
          .header { padding: 1rem; flex-direction: column; gap: 1rem; }
          /* tablas responsive: mostrar filas como tarjetas */
          .table {
            min-width: 0;
          }
          .table thead { display: none; }
          .table tbody tr {
            display: block;
            margin-bottom: 12px;
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 8px;
          }
          .table tbody td {
            display: flex;
            justify-content: space-between;
            padding: 6px 8px;
            border: none;
          }
          .table tbody td::before {
            content: attr(data-label) ": ";
            font-weight: 700;
            color: var(--text-secondary);
            margin-right: 8px;
            flex: 0 0 50%;
            text-align: left;
          }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          {onBack && (
            <button className="btn-back" onClick={onBack}>
              ← Volver
            </button>
          )}
          <h1 className="page-title">📊 Dashboard Financiero</h1>
        </div>
      </header>

      <main className="main-content">
        {/* Filtros */}
        <div className="filters">
          <div className="filter-group">
            <label>📅 Desde:</label>
            <input
              type="datetime-local"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>hasta:</label>
            <input
              type="datetime-local"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>👤 Cajero:</label>
            <select
              value={cajeroFiltro}
              onChange={(e) => setCajeroFiltro(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              {cajeros.map((cajero) => (
                <option key={cajero.id} value={cajero.id}>
                  {cajero.nombre}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-filter" onClick={fetchDatos}>
            🔍 Filtrar
          </button>
          <button
            className="btn-filter"
            onClick={async () => {
              await generarReportePDF();
            }}
            title="Generar reporte listo para imprimir"
            style={{ marginLeft: 8 }}
          >
            📝 Reporte PDF
          </button>
          <button
            className="btn-filter"
            onClick={async () => {
              await generarReporteFacturas();
            }}
            title="Generar reporte de facturas detalladas"
            style={{ marginLeft: 8 }}
          >
            📋 Reporte Facturas
          </button>
          <button
            className="btn-filter"
            onClick={async () => {
              await generarReporteGastos();
            }}
            title="Generar reporte de gastos detallados"
            style={{ marginLeft: 8 }}
          >
            💸 Reporte Gastos
          </button>
          <button
            className="btn-filter"
            onClick={async () => {
              await generarReportePagos();
            }}
            title="Generar reporte de pagos detallados"
            style={{ marginLeft: 8 }}
          >
            💳 Reporte Pagos
          </button>
          <button
            className="btn-filter"
            onClick={() => {
              setResumenAdminStep("select");
              setCajeroResumenId("");
              setResumenAdminData(null);
              setShowResumenAdmin(true);
            }}
            title="Ver resumen de caja de un cajero"
            style={{ marginLeft: 8, background: "#7c3aed", color: "#fff" }}
          >
            📊 Resumen por cajero
          </button>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-success">
            <div className="kpi-value">
              L{" "}
              {totalVentas.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="kpi-label">Total Ventas</div>
          </div>
          <div className="kpi-card kpi-danger">
            <div className="kpi-value">
              L{" "}
              {totalGastos.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="kpi-label">Total Gastos</div>
          </div>
          <div className="kpi-card kpi-info">
            <div className="kpi-value">
              L {balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
            </div>
            <div className="kpi-label">
              {balance >= 0 ? "✅ Ganancia" : "❌ Pérdida"}
            </div>
          </div>
          <div className="kpi-card kpi-success">
            <div className="kpi-value">{facturasCount}</div>
            <div className="kpi-label">Facturas</div>
            {facturaInicial && facturaFinal && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: "0.75rem",
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                <div>
                  De:{" "}
                  <strong style={{ color: "#10b981" }}>
                    #{facturaInicial}
                  </strong>
                </div>
                <div>
                  A:{" "}
                  <strong style={{ color: "#10b981" }}>#{facturaFinal}</strong>
                </div>
              </div>
            )}
          </div>
          <div className="kpi-card kpi-danger">
            <div className="kpi-value">{gastosCount}</div>
            <div className="kpi-label">Gastos</div>
          </div>
          {/* KPIs de pagos por tipo */}
          <div className="kpi-card" style={{ borderTop: "4px solid #10b981" }}>
            <div className="kpi-value" style={{ color: "#10b981" }}>
              L{" "}
              {pagosTotales.efectivo.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="kpi-label">💵 Efectivo</div>
          </div>
          <div className="kpi-card" style={{ borderTop: "4px solid #3b82f6" }}>
            <div className="kpi-value" style={{ color: "#3b82f6" }}>
              L{" "}
              {pagosTotales.tarjeta.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="kpi-label">💳 Tarjeta</div>
          </div>
          <div className="kpi-card" style={{ borderTop: "4px solid #8b5cf6" }}>
            <div className="kpi-value" style={{ color: "#8b5cf6" }}>
              L{" "}
              {pagosTotales.transferencia.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="kpi-label">🏦 Transferencia</div>
          </div>
          <div className="kpi-card" style={{ borderTop: "4px solid #f59e0b" }}>
            <div
              className="kpi-value"
              style={{ color: "#f59e0b", fontSize: "1.6rem" }}
            >
              ${" "}
              {pagosTotales.dolares_usd.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
              {pagosTotales.dolares_lps > 0 && (
                <div
                  style={{ fontSize: "1rem", color: "#64748b", marginTop: 2 }}
                >
                  ≈ L{" "}
                  {pagosTotales.dolares_lps.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                  })}
                </div>
              )}
            </div>
            <div className="kpi-label">💱 Dólares</div>
          </div>
        </div>

        {/* Tablas */}
        <div className="content-grid">
          <div className="table-container">
            <div className="table-card">
              <div className="table-header">
                <h3 className="table-title">
                  📋 Historial de Ventas
                  {filtroTipoPago && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        color: "#64748b",
                      }}
                    >
                      — {facturasFiltradas.length} resultado{facturasFiltradas.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </h3>
                {onVerFacturasEmitidas && (
                  <button
                    className="btn-secondary"
                    onClick={onVerFacturasEmitidas}
                  >
                    Ver todas
                  </button>
                )}
              </div>
              {/* Filtros por tipo de pago */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  padding: "10px 0 6px",
                  borderBottom: "1px solid var(--border, #e2e8f0)",
                  marginBottom: 8,
                }}
              >
                {([
                  { key: null,             label: "Todas",          icon: "🔄", color: "#64748b", total: null },
                  { key: "efectivo",       label: "Efectivo",       icon: "💵", color: "#10b981", total: pagosTotales.efectivo },
                  { key: "tarjeta",        label: "Tarjeta",        icon: "💳", color: "#3b82f6", total: pagosTotales.tarjeta },
                  { key: "transferencia",  label: "Transferencia",  icon: "🏦", color: "#8b5cf6", total: pagosTotales.transferencia },
                  { key: "dolares",        label: "Dólares",        icon: "💱", color: "#f59e0b", total: pagosTotales.dolares_lps },
                  { key: "delivery",       label: "Delivery",       icon: "🛵", color: "#f43f5e", total: deliveryTotal },
                ] as const).map(({ key, label, icon, color, total }) => {
                  const isActive = filtroTipoPago === key;
                  return (
                    <button
                      key={String(key)}
                      onClick={() => setFiltroTipoPago(key as string | null)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        padding: "5px 12px",
                        border: `2px solid ${isActive ? color : "var(--border, #e2e8f0)"}`,
                        borderRadius: 20,
                        background: isActive ? color : "transparent",
                        color: isActive ? "#fff" : color,
                        cursor: "pointer",
                        fontWeight: isActive ? 700 : 500,
                        fontSize: "0.75rem",
                        lineHeight: 1.3,
                        transition: "all 0.18s",
                        minWidth: 72,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontSize: "1rem" }}>{icon} {label}</span>
                      {total !== null && (
                        <span style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                          L {total.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      {key === null && (
                        <span style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                          {facturas.length} fact.
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora de venta</th>
                        <th>Cajero</th>
                        <th>Factura</th>
                        <th>Cliente</th>
                        <th>Tipo Pago</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasFiltradas.slice(0, filtroTipoPago ? 500 : 10).map((f) => {
                        // Extraer hora en formato 12h
                        let horaVenta = "";
                        if (f.fecha_hora) {
                          try {
                            const fechaCompleta = f.fecha_hora.includes("T")
                              ? f.fecha_hora
                              : f.fecha_hora.replace(" ", "T");
                            const fecha = new Date(fechaCompleta);
                            let horas = fecha.getHours();
                            const minutos = fecha
                              .getMinutes()
                              .toString()
                              .padStart(2, "0");
                            const ampm = horas >= 12 ? "PM" : "AM";
                            horas = horas % 12 || 12;
                            horaVenta = `${horas}:${minutos} ${ampm}`;
                          } catch (e) {
                            horaVenta = f.fecha_hora.slice(11, 16) || "";
                          }
                        }

                        // Tipos de pago de esta factura
                        const tiposFactura = pagosPorFacturaMap.get(String(f.factura || ""));
                        const tipoIcons: Record<string, { icon: string; color: string }> = {
                          efectivo:      { icon: "💵", color: "#10b981" },
                          tarjeta:       { icon: "💳", color: "#3b82f6" },
                          transferencia: { icon: "🏦", color: "#8b5cf6" },
                          transferencias:{ icon: "🏦", color: "#8b5cf6" },
                          dolares:       { icon: "💱", color: "#f59e0b" },
                          "dólares":     { icon: "💱", color: "#f59e0b" },
                        };
                        // Si es delivery, también mostrar etiqueta
                        const esDelivery = (f.tipo_orden || "").toUpperCase() === "DELIVERY";

                        return (
                          <tr key={f.id}>
                            <td data-label="Fecha">
                              {f.fecha_hora?.slice(0, 10)}
                            </td>
                            <td data-label="Hora de venta">{horaVenta}</td>
                            <td data-label="Cajero">{f.cajero}</td>
                            <td data-label="Factura">{f.factura}</td>
                            <td data-label="Cliente">{f.cliente}</td>
                            <td data-label="Tipo Pago" style={{ whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                {esDelivery && (
                                  <span
                                    style={{
                                      background: "#fef2f2",
                                      color: "#f43f5e",
                                      border: "1px solid #fecdd3",
                                      borderRadius: 10,
                                      padding: "1px 7px",
                                      fontSize: "0.68rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    🛵 Delivery
                                  </span>
                                )}
                                {tiposFactura && Array.from(tiposFactura).map((t) => {
                                  const ti = tipoIcons[t];
                                  if (!ti) return null;
                                  const label = t === "transferencia" || t === "transferencias"
                                    ? "Transf."
                                    : t === "dolares" || t === "dólares"
                                      ? "Dólares"
                                      : t.charAt(0).toUpperCase() + t.slice(1);
                                  return (
                                    <span
                                      key={t}
                                      style={{
                                        background: ti.color + "18",
                                        color: ti.color,
                                        border: `1px solid ${ti.color}44`,
                                        borderRadius: 10,
                                        padding: "1px 7px",
                                        fontSize: "0.68rem",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {ti.icon} {label}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td
                              data-label="Total"
                              style={{ color: "var(--success)" }}
                            >
                              L {parseFloat(f.total || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <div className="table-card">
              <div className="table-header">
                <h3 className="table-title">💸 Gastos</h3>
              </div>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastosFiltrados.slice(0, 10).map((g) => (
                        <tr key={g.id}>
                          <td data-label="Fecha">{g.fecha}</td>
                          <td
                            data-label="Monto"
                            style={{ color: "var(--danger)" }}
                          >
                            L {parseFloat(g.monto || 0).toFixed(2)}
                          </td>
                          <td data-label="Motivo">{g.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficas */}
        <div className="charts-container">
          {/* Gráfica de ventas por día */}
          <h3 className="charts-title" style={{ marginTop: 32 }}>
            🗓️ Ventas por Día
          </h3>
          <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={ventasPorDia}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={"var(--border)"} />
                <XAxis dataKey="fecha" stroke={"var(--text-secondary)"} />
                <YAxis stroke={"var(--text-secondary)"} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(26,26,46,0.95)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <Bar dataKey="total" fill="var(--success)" name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* Modal de Resumen de Caja (admin) */}
      {showResumenAdmin && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
          onClick={() => setShowResumenAdmin(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 28,
              minWidth: 320,
              maxWidth: 420,
              boxShadow: "0 8px 32px #0004",
              color: "#222",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: "#7c3aed", marginBottom: 18 }}>
              📊 Resumen de Caja
            </h3>

            {resumenAdminStep === "select" && (
              <>
                <p style={{ margin: "0 0 12px", color: "#555", fontSize: 14 }}>
                  Selecciona el cajero del que deseas ver el resumen del turno
                  actual:
                </p>
                <select
                  value={cajeroResumenId}
                  onChange={(e) => setCajeroResumenId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1.5px solid #bbb",
                    fontSize: 15,
                    marginBottom: 16,
                  }}
                >
                  <option value="">-- Elige un cajero --</option>
                  {cajeros.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setShowResumenAdmin(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      background: "#f5f5f5",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!cajeroResumenId}
                    onClick={() => fetchResumenAdmin(cajeroResumenId)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: cajeroResumenId ? "#7c3aed" : "#ccc",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: cajeroResumenId ? "pointer" : "default",
                    }}
                  >
                    Consultar
                  </button>
                </div>
              </>
            )}

            {resumenAdminStep === "data" && (
              <>
                {resumenAdminLoading ? (
                  <div
                    style={{
                      padding: 16,
                      textAlign: "center",
                      color: "#7c3aed",
                    }}
                  >
                    Cargando...
                  </div>
                ) : resumenAdminData ? (
                  <>
                    <p
                      style={{
                        margin: "0 0 14px",
                        fontSize: 13,
                        color: "#888",
                      }}
                    >
                      Cajero:{" "}
                      <strong>
                        {cajeros.find((c) => c.id === cajeroResumenId)
                          ?.nombre || "—"}
                      </strong>{" "}
                      · Desde apertura hasta ahora
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "#f0fdf4",
                          borderRadius: 8,
                        }}
                      >
                        <strong>EFECTIVO (LPS):</strong>
                        <span>
                          L{" "}
                          {(
                            resumenAdminData.efectivo - resumenAdminData.gastos
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "#eff6ff",
                          borderRadius: 8,
                        }}
                      >
                        <strong>TARJETA:</strong>
                        <span>L {resumenAdminData.tarjeta.toFixed(2)}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "#eff6ff",
                          borderRadius: 8,
                        }}
                      >
                        <strong>TRANSFERENCIA:</strong>
                        <span>
                          L {resumenAdminData.transferencia.toFixed(2)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "#fdf4ff",
                          borderRadius: 8,
                        }}
                      >
                        <strong>DÓLARES:</strong>
                        <span>
                          ({resumenAdminData.dolares_usd.toFixed(2)} $) : Lps{" "}
                          {resumenAdminData.dolares_convertidos.toFixed(2)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "#fef2f2",
                          borderRadius: 8,
                        }}
                      >
                        <strong>GASTOS:</strong>
                        <span>L {resumenAdminData.gastos.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    style={{ color: "#888", textAlign: "center", padding: 12 }}
                  >
                    Sin datos disponibles
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    marginTop: 16,
                  }}
                >
                  <button
                    onClick={() => {
                      setResumenAdminStep("select");
                      setResumenAdminData(null);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      background: "#f5f5f5",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={() => setShowResumenAdmin(false)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "#7c3aed",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
