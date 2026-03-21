/**
 * Sistema de sincronización offline usando IndexedDB
 * Almacena facturas y pagos localmente y los sincroniza con Supabase automáticamente
 */

import { supabase } from "../supabaseClient";

// Nombre de la base de datos
const DB_NAME = "PuntoVentaOfflineDB";
const DB_VERSION = 4; // Incrementado para nuevas stores

// Nombres de las tablas (stores)
const FACTURAS_STORE = "facturas_pendientes";
const PAGOS_STORE = "pagos_pendientes";
const GASTOS_STORE = "gastos_pendientes";
const ENVIOS_STORE = "envios_pendientes";
const PRODUCTOS_STORE = "productos_cache"; // Cache de productos
const APERTURA_STORE = "apertura_cache"; // Cache de apertura de caja
const CAI_STORE = "cai_cache"; // Cache de información CAI
const DATOS_NEGOCIO_STORE = "datos_negocio_cache"; // Cache de datos del negocio

// Tipos
export interface FacturaPendiente {
  id?: number;
  /** UUID único por operación — previene duplicados al sincronizar */
  operation_id?: string;
  fecha_hora: string;
  cajero: string;
  cajero_id: string | null;
  caja: string;
  cai: string;
  factura: string;
  cliente: string;
  tipo_orden?: string; // "PARA LLEVAR" | "COMER AQUÍ" | "DELIVERY"
  productos: string; // JSON con complementos y piezas incluidos
  sub_total: string;
  isv_15: string;
  isv_18: string;
  descuento?: number | null;
  total: string;
  /** Estado de sincronización: pending | syncing | synced | error */
  sync_status?: "pending" | "syncing" | "synced" | "error";
  timestamp: number;
  intentos: number;
}

export interface PagoPendiente {
  id?: number;
  /** UUID único por registro de pago — previene pagos duplicados al sincronizar */
  operation_id?: string;
  tipo: string;
  monto: number;
  banco: string | null;
  tarjeta: string | null;
  factura: string | null;
  autorizador: string | null;
  referencia: string | null;
  usd_monto: number | null;
  fecha_hora: string;
  cajero: string;
  cajero_id: string | null;
  cliente: string;
  factura_venta: string;
  recibido: number;
  cambio: number;
  timestamp: number;
  intentos: number;
}

export interface GastoPendiente {
  id?: number;
  tipo: string;
  monto: number;
  descripcion: string;
  cajero: string;
  cajero_id: string | null;
  caja: string;
  fecha_hora: string;
  timestamp: number;
  intentos: number;
}

export interface EnvioPendiente {
  id?: number;
  cliente: string;
  telefono: string;
  direccion: string;
  productos: any[];
  total: number;
  costo_envio: number;
  tipo_pago: string;
  cajero: string;
  cajero_id: string | null;
  caja: string;
  factura_venta: string | null;
  fecha_hora: string;
  timestamp: number;
  intentos: number;
}

export interface ProductoCache {
  id: string;
  nombre: string;
  precio: number;
  tipo: string;
  complementos?: string;
  piezas?: string;
  subcategoria?: string;
  imagen_url?: string;
  activo: boolean;
  timestamp: number;
}

export interface AperturaCache {
  id: string;
  cajero_id: string;
  caja: string;
  fecha: string;
  estado: string;
  timestamp: number;
}

export interface CaiCache {
  id: string;
  cajero_id: string;
  caja_asignada: string;
  cai: string;
  factura_desde: string;
  factura_hasta: string;
  factura_actual: string;
  nombre_cajero: string;
  timestamp: number;
}

export interface DatosNegocioCache {
  id: string;
  nombre_negocio: string;
  rtn: string;
  direccion: string;
  celular: string;
  propietario: string;
  logo_url: string | null;
  timestamp: number;
}

// Variable global para la conexión DB
let db: IDBDatabase | null = null;

/**
 * Inicializa la base de datos IndexedDB
 */
export async function initIndexedDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Error al abrir IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log("IndexedDB inicializada correctamente");
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Crear store para facturas pendientes
      if (!database.objectStoreNames.contains(FACTURAS_STORE)) {
        const facturasStore = database.createObjectStore(FACTURAS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        facturasStore.createIndex("timestamp", "timestamp", { unique: false });
        facturasStore.createIndex("factura", "factura", { unique: false });
        console.log("Store de facturas creado");
      }

      // Crear store para pagos pendientes
      if (!database.objectStoreNames.contains(PAGOS_STORE)) {
        const pagosStore = database.createObjectStore(PAGOS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        pagosStore.createIndex("timestamp", "timestamp", { unique: false });
        pagosStore.createIndex("factura_venta", "factura_venta", {
          unique: false,
        });
        console.log("Store de pagos creado");
      }

      // Crear store para gastos pendientes
      if (!database.objectStoreNames.contains(GASTOS_STORE)) {
        const gastosStore = database.createObjectStore(GASTOS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        gastosStore.createIndex("timestamp", "timestamp", { unique: false });
        console.log("Store de gastos creado");
      }

      // Crear store para envíos pendientes
      if (!database.objectStoreNames.contains(ENVIOS_STORE)) {
        const enviosStore = database.createObjectStore(ENVIOS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        enviosStore.createIndex("timestamp", "timestamp", { unique: false });
        console.log("Store de envíos creado");
      }

      // Crear store para cache de productos
      if (!database.objectStoreNames.contains(PRODUCTOS_STORE)) {
        const productosStore = database.createObjectStore(PRODUCTOS_STORE, {
          keyPath: "id",
        });
        productosStore.createIndex("tipo", "tipo", { unique: false });
        productosStore.createIndex("activo", "activo", { unique: false });
        console.log("Store de productos cache creado");
      }

      // Crear store para cache de apertura de caja
      if (!database.objectStoreNames.contains(APERTURA_STORE)) {
        const aperturaStore = database.createObjectStore(APERTURA_STORE, {
          keyPath: "id",
        });
        aperturaStore.createIndex("cajero_id", "cajero_id", { unique: false });
        aperturaStore.createIndex("fecha", "fecha", { unique: false });
        console.log("Store de apertura cache creado");
      }

      // Crear store para cache de CAI
      if (!database.objectStoreNames.contains(CAI_STORE)) {
        const caiStore = database.createObjectStore(CAI_STORE, {
          keyPath: "id",
        });
        caiStore.createIndex("cajero_id", "cajero_id", { unique: false });
        console.log("Store de CAI cache creado");
      }

      // Crear store para cache de datos del negocio
      if (!database.objectStoreNames.contains(DATOS_NEGOCIO_STORE)) {
        database.createObjectStore(DATOS_NEGOCIO_STORE, {
          keyPath: "id",
        });
        console.log("Store de datos del negocio cache creado");
      }
    };
  });
}

/**
 * Guarda una factura en IndexedDB
 */
export async function guardarFacturaLocal(
  factura: Omit<FacturaPendiente, "id" | "timestamp" | "intentos">,
): Promise<number> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readwrite");
    const store = transaction.objectStore(FACTURAS_STORE);

    const facturaConMetadata: Omit<FacturaPendiente, "id"> = {
      ...factura,
      timestamp: Date.now(),
      intentos: 0,
    };

    const request = store.add(facturaConMetadata);

    request.onsuccess = () => {
      console.log("Factura guardada en IndexedDB:", request.result);
      resolve(request.result as number);
    };

    request.onerror = () => {
      console.error("Error guardando factura en IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Actualiza factura_venta en todos los pagos de IndexedDB que coincidan
 * con el número antiguo y el cajero. Se llama cada vez que se auto-corrige
 * un número de factura para mantener consistencia.
 * @returns cantidad de registros actualizados
 */
export async function actualizarFacturaVentaEnPagosLocales(
  oldFactura: string,
  newFactura: string,
  cajeroId: string,
): Promise<number> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readwrite");
    const store = transaction.objectStore(PAGOS_STORE);
    const request = store.getAll();
    let actualizados = 0;

    request.onsuccess = () => {
      const pagos = request.result as PagoPendiente[];
      const pendientes = pagos.filter(
        (p) =>
          p.factura_venta === oldFactura &&
          (p.cajero_id === cajeroId || !cajeroId),
      );

      if (pendientes.length === 0) {
        resolve(0);
        return;
      }

      let procesados = 0;
      for (const pago of pendientes) {
        const pagoActualizado = { ...pago, factura_venta: newFactura };
        const putReq = store.put(pagoActualizado);
        putReq.onsuccess = () => {
          actualizados++;
          procesados++;
          if (procesados === pendientes.length) {
            console.log(
              `[sync] ${actualizados} pagos en IndexedDB actualizados: factura_venta ${oldFactura} → ${newFactura}`,
            );
            resolve(actualizados);
          }
        };
        putReq.onerror = () => {
          procesados++;
          if (procesados === pendientes.length) resolve(actualizados);
        };
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda pagos en IndexedDB
 */
export async function guardarPagosLocal(
  pagos: Omit<PagoPendiente, "id" | "timestamp" | "intentos">[],
): Promise<number[]> {
  const database = await initIndexedDB();
  const ids: number[] = [];

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readwrite");
    const store = transaction.objectStore(PAGOS_STORE);

    let completados = 0;
    const total = pagos.length;

    pagos.forEach((pago) => {
      const pagoConMetadata: Omit<PagoPendiente, "id"> = {
        ...pago,
        timestamp: Date.now(),
        intentos: 0,
      };

      const request = store.add(pagoConMetadata);

      request.onsuccess = () => {
        ids.push(request.result as number);
        completados++;
        if (completados === total) {
          console.log(`${total} pagos guardados en IndexedDB`);
          resolve(ids);
        }
      };

      request.onerror = () => {
        console.error("Error guardando pago en IndexedDB:", request.error);
        reject(request.error);
      };
    });
  });
}

/**
 * Obtiene todas las facturas pendientes de sincronización
 */
export async function obtenerFacturasPendientes(): Promise<FacturaPendiente[]> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readonly");
    const store = transaction.objectStore(FACTURAS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as FacturaPendiente[]);
    };

    request.onerror = () => {
      console.error("Error obteniendo facturas pendientes:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Obtiene todos los pagos pendientes de sincronización
 */
export async function obtenerPagosPendientes(): Promise<PagoPendiente[]> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readonly");
    const store = transaction.objectStore(PAGOS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as PagoPendiente[]);
    };

    request.onerror = () => {
      console.error("Error obteniendo pagos pendientes:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Elimina una factura de IndexedDB después de sincronizarla
 */
export async function eliminarFacturaLocal(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readwrite");
    const store = transaction.objectStore(FACTURAS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Factura ${id} eliminada de IndexedDB`);
      resolve();
    };

    request.onerror = () => {
      console.error("Error eliminando factura de IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Elimina un pago de IndexedDB después de sincronizarlo
 */
export async function eliminarPagoLocal(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readwrite");
    const store = transaction.objectStore(PAGOS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Pago ${id} eliminado de IndexedDB`);
      resolve();
    };

    request.onerror = () => {
      console.error("Error eliminando pago de IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Incrementa el contador de intentos de una factura
 */
async function incrementarIntentosFactura(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readwrite");
    const store = transaction.objectStore(FACTURAS_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const factura = getRequest.result as FacturaPendiente;
      if (factura) {
        factura.intentos = (factura.intentos || 0) + 1;
        const updateRequest = store.put(factura);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Incrementa el contador de intentos de un pago
 */
async function incrementarIntentosPago(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readwrite");
    const store = transaction.objectStore(PAGOS_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const pago = getRequest.result as PagoPendiente;
      if (pago) {
        pago.intentos = (pago.intentos || 0) + 1;
        const updateRequest = store.put(pago);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Sincroniza las facturas pendientes con Supabase
 */
export async function sincronizarFacturas(): Promise<{
  exitosas: number;
  fallidas: number;
}> {
  const facturasPendientes = await obtenerFacturasPendientes();

  if (facturasPendientes.length === 0) {
    return { exitosas: 0, fallidas: 0 };
  }

  console.log(
    `Sincronizando ${facturasPendientes.length} facturas pendientes...`,
  );

  let exitosas = 0;
  let fallidas = 0;

  for (const factura of facturasPendientes) {
    try {
      // Preparar datos para insertar (sin campos de IndexedDB)
      const { id, timestamp, intentos, sync_status, ...facturaData } = factura;

      const { error } = await supabase.from("facturas").upsert([facturaData], {
        onConflict: "operation_id",
        ignoreDuplicates: true,
      });

      if (error) {
        if (error.code === "23505") {
          // Verificar si nuestro propio operation_id ya está en Supabase
          const { data: existe } = await supabase
            .from("facturas")
            .select("id")
            .eq("operation_id", factura.operation_id ?? "")
            .maybeSingle();

          if (existe) {
            // Misma operación → ya guardada, borrar de IndexedDB
            console.warn(
              `⚠ [sync] Factura ${factura.factura} ya existe (mismo operation_id). Eliminando de IndexedDB.`,
            );
            await eliminarFacturaLocal(factura.id!);
            exitosas++;
          } else {
            // Número tomado por otra operación → auto-corregir usando el
            // último número real en la tabla facturas.
            try {
              const { data: maxRow } = await supabase
                .from("facturas")
                .select("factura")
                .eq("cajero_id", factura.cajero_id)
                .order("id", { ascending: false })
                .limit(1)
                .maybeSingle();
              const maxNum = maxRow
                ? parseInt(maxRow.factura)
                : parseInt(factura.factura);
              const nuevoNumero = (maxNum + 1).toString();
              const siguienteNum = (maxNum + 2).toString();
              console.warn(
                `⚠ [sync] Número ${factura.factura} tomado. Auto-corrigiendo → ${nuevoNumero}`,
              );
              const facturaCorregida = { ...facturaData, factura: nuevoNumero };
              const { error: retryError } = await supabase
                .from("facturas")
                .upsert([facturaCorregida], {
                  onConflict: "operation_id",
                  ignoreDuplicates: false,
                });
              if (!retryError) {
                // 1. Actualizar contador en Supabase
                await supabase
                  .from("cai_facturas")
                  .update({ factura_actual: siguienteNum })
                  .eq("cajero_id", factura.cajero_id);

                // 2. Corregir factura_venta en pagos ya en Supabase
                //    (pueden haberse sincronizado antes que la factura)
                const { data: pagosActualizados } = await supabase
                  .from("pagos")
                  .update({ factura_venta: nuevoNumero })
                  .eq("factura_venta", factura.factura)
                  .eq("cajero_id", factura.cajero_id)
                  .select("id");
                if ((pagosActualizados?.length ?? 0) > 0) {
                  console.log(
                    `[sync] ${pagosActualizados!.length} pagos en Supabase: factura_venta ${factura.factura} → ${nuevoNumero}`,
                  );
                }

                // 3. Corregir factura_venta en pagos aún en IndexedDB
                await actualizarFacturaVentaEnPagosLocales(
                  factura.factura,
                  nuevoNumero,
                  factura.cajero_id || "",
                );

                await eliminarFacturaLocal(factura.id!);
                console.log(
                  `✓ [sync] Factura corregida: ${factura.factura} → ${nuevoNumero}. Próxima: ${siguienteNum}`,
                );
                exitosas++;
              } else {
                console.error(
                  `[sync] Reintento con número corregido también falló:`,
                  retryError,
                );
                await incrementarIntentosFactura(factura.id!);
                fallidas++;
              }
            } catch (corrErr) {
              console.error(
                "[sync] Error al auto-corregir número de factura:",
                corrErr,
              );
              await incrementarIntentosFactura(factura.id!);
              fallidas++;
            }
          }
        } else {
          console.error(
            `Error sincronizando factura ${factura.factura}:`,
            error,
          );
          await incrementarIntentosFactura(factura.id!);
          fallidas++;
          if (intentos >= 5) {
            console.error(
              `Factura ${factura.factura} ha fallado ${intentos} veces`,
            );
          }
        }
      } else {
        console.log(`Factura ${factura.factura} sincronizada exitosamente`);
        await eliminarFacturaLocal(factura.id!);
        exitosas++;
      }
    } catch (error) {
      console.error(`Error sincronizando factura ${factura.factura}:`, error);
      await incrementarIntentosFactura(factura.id!);
      fallidas++;
    }
  }

  return { exitosas, fallidas };
}

/**
 * Sincroniza los pagos pendientes con Supabase
 */
export async function sincronizarPagos(): Promise<{
  exitosos: number;
  fallidos: number;
}> {
  const pagosPendientes = await obtenerPagosPendientes();

  if (pagosPendientes.length === 0) {
    return { exitosos: 0, fallidos: 0 };
  }

  console.log(`Sincronizando ${pagosPendientes.length} pagos pendientes...`);

  let exitosos = 0;
  let fallidos = 0;

  for (const pago of pagosPendientes) {
    try {
      // Preparar datos para insertar (sin campos de IndexedDB)
      const { id, timestamp, intentos, ...pagoData } = pago;

      const { error } = await supabase.from("pagos").upsert([pagoData], {
        onConflict: "operation_id",
        ignoreDuplicates: true,
      });

      if (error) {
        // Código 23505 = violación de UNIQUE: registro duplicado
        if (error.code === "23505") {
          console.warn(
            `⚠ Pago ${id} ya existe en Supabase (duplicate). Eliminando de IndexedDB.`,
          );
          await eliminarPagoLocal(pago.id!);
          exitosos++;
        } else {
          console.error(`Error sincronizando pago ${id}:`, error);
          await incrementarIntentosPago(pago.id!);
          fallidos++;
          if (intentos >= 5) {
            console.error(`Pago ${id} ha fallado ${intentos} veces`);
          }
        }
      } else {
        console.log(`Pago ${id} sincronizado exitosamente`);
        await eliminarPagoLocal(pago.id!);
        exitosos++;
      }
    } catch (error) {
      console.error(`Error sincronizando pago ${pago.id}:`, error);
      await incrementarIntentosPago(pago.id!);
      fallidos++;
    }
  }

  return { exitosos, fallidos };
}

/**
 * Guarda un gasto en IndexedDB
 */
export async function guardarGastoLocal(
  gasto: Omit<GastoPendiente, "id" | "timestamp" | "intentos">,
): Promise<number> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([GASTOS_STORE], "readwrite");
    const store = transaction.objectStore(GASTOS_STORE);

    const gastoConMetadata: Omit<GastoPendiente, "id"> = {
      ...gasto,
      timestamp: Date.now(),
      intentos: 0,
    };

    const request = store.add(gastoConMetadata);

    request.onsuccess = () => {
      console.log("Gasto guardado en IndexedDB:", request.result);
      resolve(request.result as number);
    };

    request.onerror = () => {
      console.error("Error guardando gasto en IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Obtiene todos los gastos pendientes
 */
export async function obtenerGastosPendientes(): Promise<GastoPendiente[]> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([GASTOS_STORE], "readonly");
    const store = transaction.objectStore(GASTOS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as GastoPendiente[]);
    };

    request.onerror = () => {
      console.error("Error obteniendo gastos pendientes:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Elimina un gasto de IndexedDB
 */
export async function eliminarGastoLocal(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([GASTOS_STORE], "readwrite");
    const store = transaction.objectStore(GASTOS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Gasto ${id} eliminado de IndexedDB`);
      resolve();
    };

    request.onerror = () => {
      console.error("Error eliminando gasto de IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Incrementa el contador de intentos de un gasto
 */
async function incrementarIntentosGasto(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([GASTOS_STORE], "readwrite");
    const store = transaction.objectStore(GASTOS_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const gasto = getRequest.result as GastoPendiente;
      if (gasto) {
        gasto.intentos = (gasto.intentos || 0) + 1;
        const updateRequest = store.put(gasto);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Sincroniza los gastos pendientes con Supabase
 */
export async function sincronizarGastos(): Promise<{
  exitosos: number;
  fallidos: number;
}> {
  const gastosPendientes = await obtenerGastosPendientes();

  if (gastosPendientes.length === 0) {
    return { exitosos: 0, fallidos: 0 };
  }

  console.log(`Sincronizando ${gastosPendientes.length} gastos pendientes...`);

  let exitosos = 0;
  let fallidos = 0;

  for (const gasto of gastosPendientes) {
    try {
      const { id, intentos } = gasto;

      // Extraer fecha de fecha_hora para el campo fecha
      const fechaHora = gasto.fecha_hora;
      const fecha = fechaHora
        ? fechaHora.split("T")[0]
        : new Date().toISOString().split("T")[0];

      // Transformar campos de IndexedDB a formato Supabase
      const gastoParaSupabase = {
        fecha: fecha,
        fecha_hora: fechaHora,
        monto: gasto.monto,
        motivo: gasto.tipo || gasto.descripcion || "", // Usar tipo o descripcion como motivo
        cajero_id: gasto.cajero_id,
        caja: gasto.caja,
      };

      console.log(`🔄 Sincronizando gasto ${id}:`, gastoParaSupabase);

      // Verificar si ya existe en Supabase para evitar duplicados
      const { data: existente } = await supabase
        .from("gastos")
        .select("id")
        .eq("fecha_hora", gastoParaSupabase.fecha_hora)
        .eq("monto", gastoParaSupabase.monto)
        .eq("cajero_id", gastoParaSupabase.cajero_id)
        .maybeSingle();

      if (existente) {
        console.log(
          `⚠ Gasto ${id} ya existe en Supabase, eliminando de IndexedDB`,
        );
        await eliminarGastoLocal(gasto.id!);
        exitosos++;
        continue;
      }

      const { error } = await supabase
        .from("gastos")
        .insert([gastoParaSupabase]);

      if (error) {
        console.error(`Error sincronizando gasto ${id}:`, error);
        await incrementarIntentosGasto(gasto.id!);
        fallidos++;

        if (intentos >= 5) {
          console.error(`Gasto ${id} ha fallado ${intentos} veces`);
        }
      } else {
        console.log(`✓ Gasto ${id} sincronizado exitosamente`);
        await eliminarGastoLocal(gasto.id!);
        exitosos++;
      }
    } catch (error) {
      console.error(`Error sincronizando gasto ${gasto.id}:`, error);
      await incrementarIntentosGasto(gasto.id!);
      fallidos++;
    }
  }

  return { exitosos, fallidos };
}

/**
 * Guarda un envío en IndexedDB
 */
export async function guardarEnvioLocal(
  envio: Omit<EnvioPendiente, "id" | "timestamp" | "intentos">,
): Promise<number> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([ENVIOS_STORE], "readwrite");
    const store = transaction.objectStore(ENVIOS_STORE);

    const envioConMetadata: Omit<EnvioPendiente, "id"> = {
      ...envio,
      timestamp: Date.now(),
      intentos: 0,
    };

    const request = store.add(envioConMetadata);

    request.onsuccess = () => {
      console.log("Envío guardado en IndexedDB:", request.result);
      resolve(request.result as number);
    };

    request.onerror = () => {
      console.error("Error guardando envío en IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Obtiene todos los envíos pendientes
 */
export async function obtenerEnviosPendientes(): Promise<EnvioPendiente[]> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([ENVIOS_STORE], "readonly");
    const store = transaction.objectStore(ENVIOS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as EnvioPendiente[]);
    };

    request.onerror = () => {
      console.error("Error obteniendo envíos pendientes:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Elimina un envío de IndexedDB
 */
export async function eliminarEnvioLocal(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([ENVIOS_STORE], "readwrite");
    const store = transaction.objectStore(ENVIOS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Envío ${id} eliminado de IndexedDB`);
      resolve();
    };

    request.onerror = () => {
      console.error("Error eliminando envío de IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Incrementa el contador de intentos de un envío
 */
async function incrementarIntentosEnvio(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([ENVIOS_STORE], "readwrite");
    const store = transaction.objectStore(ENVIOS_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const envio = getRequest.result as EnvioPendiente;
      if (envio) {
        envio.intentos = (envio.intentos || 0) + 1;
        const updateRequest = store.put(envio);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Sincroniza los envíos pendientes con Supabase
 */
export async function sincronizarEnvios(): Promise<{
  exitosos: number;
  fallidos: number;
}> {
  const enviosPendientes = await obtenerEnviosPendientes();

  if (enviosPendientes.length === 0) {
    return { exitosos: 0, fallidos: 0 };
  }

  console.log(`Sincronizando ${enviosPendientes.length} envíos pendientes...`);

  let exitosos = 0;
  let fallidos = 0;

  for (const envio of enviosPendientes) {
    try {
      const { id, intentos } = envio;

      const envioData = {
        productos: envio.productos,
        cajero_id: envio.cajero_id,
        caja: envio.caja,
        fecha: envio.fecha_hora,
        cliente: envio.cliente,
        celular: envio.telefono,
        total: envio.total,
        costo_envio: envio.costo_envio,
        tipo_pago: envio.tipo_pago,
      };

      // Verificar si ya existe en Supabase para evitar duplicados
      const { data: existente } = await supabase
        .from("pedidos_envio")
        .select("id")
        .eq("fecha", envioData.fecha)
        .eq("total", envioData.total)
        .eq("cajero_id", envioData.cajero_id)
        .eq("cliente", envioData.cliente)
        .maybeSingle();

      if (existente) {
        console.log(
          `⚠ Envío ${id} ya existe en Supabase, eliminando de IndexedDB`,
        );
        await eliminarEnvioLocal(envio.id!);
        exitosos++;
        continue;
      }

      const { error } = await supabase
        .from("pedidos_envio")
        .insert([envioData]);

      if (error) {
        console.error(`Error sincronizando envío ${id}:`, error);
        await incrementarIntentosEnvio(envio.id!);
        fallidos++;

        if (intentos >= 5) {
          console.error(`Envío ${id} ha fallado ${intentos} veces`);
        }
      } else {
        console.log(`Envío ${id} sincronizado exitosamente`);
        await eliminarEnvioLocal(envio.id!);
        exitosos++;
      }
    } catch (error) {
      console.error(`Error sincronizando envío ${envio.id}:`, error);
      await incrementarIntentosEnvio(envio.id!);
      fallidos++;
    }
  }

  return { exitosos, fallidos };
}

/**
 * Mutex para evitar sincronizaciones concurrentes que dupliquen registros.
 * Si sincronizarTodo ya está corriendo (ej: evento "online" + setInterval
 * al mismo tiempo), la segunda llamada sale inmediatamente.
 */
let _isSyncing = false;

/**
 * Sincroniza todos los datos pendientes (facturas, pagos, gastos y envíos)
 */
export async function sincronizarTodo(): Promise<{
  facturas: { exitosas: number; fallidas: number };
  pagos: { exitosos: number; fallidos: number };
  gastos: { exitosos: number; fallidos: number };
  envios: { exitosos: number; fallidos: number };
}> {
  // Guard: si ya hay una sincronización en curso, salir sin hacer nada
  if (_isSyncing) {
    console.log(
      "[sync] Sincronización ya en curso, saltando llamada concurrente.",
    );
    return {
      facturas: { exitosas: 0, fallidas: 0 },
      pagos: { exitosos: 0, fallidos: 0 },
      gastos: { exitosos: 0, fallidos: 0 },
      envios: { exitosos: 0, fallidos: 0 },
    };
  }

  _isSyncing = true;
  console.log("[sync] Iniciando sincronización completa...");

  try {
    const facturas = await sincronizarFacturas();
    const pagos = await sincronizarPagos();
    const gastos = await sincronizarGastos();
    const envios = await sincronizarEnvios();

    console.log(
      `[sync] Completa: ${facturas.exitosas} facturas, ${pagos.exitosos} pagos, ` +
        `${gastos.exitosos} gastos y ${envios.exitosos} envíos sincronizados.`,
    );

    return { facturas, pagos, gastos, envios };
  } finally {
    _isSyncing = false;
  }
}

/**
 * Obtiene el conteo de registros pendientes
 */
export async function obtenerContadorPendientes(): Promise<{
  facturas: number;
  pagos: number;
  gastos: number;
  envios: number;
}> {
  const facturas = await obtenerFacturasPendientes();
  const pagos = await obtenerPagosPendientes();
  const gastos = await obtenerGastosPendientes();
  const envios = await obtenerEnviosPendientes();

  return {
    facturas: facturas.length,
    pagos: pagos.length,
    gastos: gastos.length,
    envios: envios.length,
  };
}

/**
 * Configura la sincronización automática cuando se detecta conexión
 */
export function configurarSincronizacionAutomatica(): void {
  // Sincronizar cada 30 segundos si hay conexión
  setInterval(async () => {
    if (navigator.onLine) {
      const pendientes = await obtenerContadorPendientes();
      const total =
        pendientes.facturas +
        pendientes.pagos +
        pendientes.gastos +
        pendientes.envios;
      if (total > 0) {
        console.log("Sincronización automática iniciada...");
        await sincronizarTodo();
      }
    }
  }, 30000); // 30 segundos

  // Sincronizar cuando se recupere la conexión
  window.addEventListener("online", async () => {
    console.log("Conexión restaurada. Sincronizando datos pendientes...");
    const resultado = await sincronizarTodo();

    const totalSincronizados =
      resultado.facturas.exitosas +
      resultado.pagos.exitosos +
      resultado.gastos.exitosos +
      resultado.envios.exitosos;

    if (totalSincronizados > 0) {
      console.log(
        `✓ ${resultado.facturas.exitosas} facturas, ${resultado.pagos.exitosos} pagos, ${resultado.gastos.exitosos} gastos y ${resultado.envios.exitosos} envíos sincronizados exitosamente`,
      );
    }
  });

  // Notificar cuando se pierde la conexión
  window.addEventListener("offline", () => {
    console.warn(
      "⚠ Conexión perdida. Los datos se guardarán localmente y se sincronizarán cuando se restaure la conexión.",
    );
  });
}

/**
 * Guarda productos en cache para uso offline
 */
export async function guardarProductosCache(productos: any[]): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTOS_STORE], "readwrite");
    const store = transaction.objectStore(PRODUCTOS_STORE);

    // Limpiar cache anterior
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      let completados = 0;
      const total = productos.length;

      if (total === 0) {
        resolve();
        return;
      }

      productos.forEach((producto) => {
        const productoCache: ProductoCache = {
          ...producto,
          timestamp: Date.now(),
        };

        const addRequest = store.add(productoCache);

        addRequest.onsuccess = () => {
          completados++;
          if (completados === total) {
            console.log(`${total} productos guardados en cache`);
            resolve();
          }
        };

        addRequest.onerror = () => {
          console.error("Error guardando producto en cache:", addRequest.error);
          reject(addRequest.error);
        };
      });
    };

    clearRequest.onerror = () => {
      console.error("Error limpiando cache de productos:", clearRequest.error);
      reject(clearRequest.error);
    };
  });
}

/**
 * Obtiene productos desde el cache
 */
export async function obtenerProductosCache(): Promise<ProductoCache[]> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCTOS_STORE], "readonly");
    const store = transaction.objectStore(PRODUCTOS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as ProductoCache[]);
    };

    request.onerror = () => {
      console.error("Error obteniendo productos desde cache:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Verifica si hay productos en cache
 */
export async function hayProductosEnCache(): Promise<boolean> {
  try {
    const productos = await obtenerProductosCache();
    return productos.length > 0;
  } catch (error) {
    console.error("Error verificando cache de productos:", error);
    return false;
  }
}

/**
 * Verifica si la aplicación está conectada a internet
 */
/**
 * Verifica si hay conexión a internet (sincrónico, solo navigator.onLine)
 * Para verificación real, usar estaConectadoReal() del hook useConexion
 */
export function estaConectado(): boolean {
  return navigator.onLine;
}

/**
 * Verifica conexión real a internet (asincrónico, con timeout)
 */
export async function estaConectadoReal(): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Usar Google como endpoint confiable con mode: no-cors
    await fetch("https://www.google.com/favicon.ico", {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Actualiza el cache de productos desde Supabase
 */
export async function actualizarCacheProductos(): Promise<{
  exitoso: boolean;
  mensaje: string;
  cantidad: number;
}> {
  if (!estaConectado()) {
    return {
      exitoso: false,
      mensaje: "No hay conexión a internet",
      cantidad: 0,
    };
  }

  try {
    const { data: productos, error } = await supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) {
      console.error("Error cargando productos desde Supabase:", error);
      return {
        exitoso: false,
        mensaje: "Error al cargar productos",
        cantidad: 0,
      };
    }

    await guardarProductosCache(productos || []);

    // Pre-cargar imágenes de productos para que el Service Worker las cachee
    await precargarImagenesProductos(productos || []);

    return {
      exitoso: true,
      mensaje: `${productos?.length || 0} productos actualizados`,
      cantidad: productos?.length || 0,
    };
  } catch (error) {
    console.error("Error actualizando cache de productos:", error);
    return {
      exitoso: false,
      mensaje: "Error al actualizar cache",
      cantidad: 0,
    };
  }
}

/**
 * Pre-carga las imágenes de los productos para que el Service Worker las cachee
 */
export async function precargarImagenesProductos(
  productos: any[],
): Promise<void> {
  console.log("🖼️ Iniciando pre-carga de imágenes de productos...");
  let cargadas = 0;
  let fallidas = 0;

  for (const producto of productos) {
    if (producto.imagen && producto.imagen.trim() !== "") {
      try {
        // Hacer fetch de la imagen para que el Service Worker la cachee
        const response = await fetch(producto.imagen);
        if (response.ok) {
          // Leer el blob para asegurar que se descargue completamente
          await response.blob();
          cargadas++;
        } else {
          fallidas++;
        }
      } catch (error) {
        console.warn(`⚠️ Error pre-cargando imagen ${producto.nombre}:`, error);
        fallidas++;
      }
    }
  }

  console.log(
    `✓ Pre-carga de imágenes completada: ${cargadas} exitosas, ${fallidas} fallidas`,
  );
}

/**
 * Guarda información de apertura de caja en cache
 */
export async function guardarAperturaCache(
  apertura: Omit<AperturaCache, "timestamp">,
): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([APERTURA_STORE], "readwrite");
    const store = transaction.objectStore(APERTURA_STORE);

    // Limpiar cache anterior del mismo cajero y fecha
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      const aperturaConTimestamp: AperturaCache = {
        ...apertura,
        timestamp: Date.now(),
      };

      const addRequest = store.add(aperturaConTimestamp);

      addRequest.onsuccess = () => {
        console.log("Apertura guardada en cache");
        resolve();
      };

      addRequest.onerror = () => {
        console.error("Error guardando apertura en cache:", addRequest.error);
        reject(addRequest.error);
      };
    };

    clearRequest.onerror = () => {
      console.error("Error limpiando cache de apertura:", clearRequest.error);
      reject(clearRequest.error);
    };
  });
}

/**
 * Obtiene información de apertura desde el cache
 */
export async function obtenerAperturaCache(): Promise<AperturaCache | null> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([APERTURA_STORE], "readonly");
    const store = transaction.objectStore(APERTURA_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const aperturas = request.result as AperturaCache[];
      if (aperturas.length > 0) {
        resolve(aperturas[0]); // Devolver la primera (debería ser única)
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      console.error("Error obteniendo apertura desde cache:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Limpia el cache de apertura
 */
export async function limpiarAperturaCache(): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([APERTURA_STORE], "readwrite");
    const store = transaction.objectStore(APERTURA_STORE);
    const request = store.clear();

    request.onsuccess = () => {
      console.log("Cache de apertura limpiado");
      resolve();
    };

    request.onerror = () => {
      console.error("Error limpiando cache de apertura:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Guarda información CAI en cache
 */
export async function guardarCaiCache(
  cai: Omit<CaiCache, "timestamp">,
): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CAI_STORE], "readwrite");
    const store = transaction.objectStore(CAI_STORE);

    // Limpiar cache anterior
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      const caiConTimestamp: CaiCache = {
        ...cai,
        timestamp: Date.now(),
      };

      const addRequest = store.add(caiConTimestamp);

      addRequest.onsuccess = () => {
        console.log("CAI guardado en cache");
        resolve();
      };

      addRequest.onerror = () => {
        console.error("Error guardando CAI en cache:", addRequest.error);
        reject(addRequest.error);
      };
    };

    clearRequest.onerror = () => {
      console.error("Error limpiando cache de CAI:", clearRequest.error);
      reject(clearRequest.error);
    };
  });
}

/**
 * Obtiene información CAI desde el cache
 */
export async function obtenerCaiCache(): Promise<CaiCache | null> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CAI_STORE], "readonly");
    const store = transaction.objectStore(CAI_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const cais = request.result as CaiCache[];
      if (cais.length > 0) {
        resolve(cais[0]);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      console.error("Error obteniendo CAI desde cache:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Guarda datos del negocio en cache
 */
export async function guardarDatosNegocioCache(
  datos: Omit<DatosNegocioCache, "timestamp">,
): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [DATOS_NEGOCIO_STORE],
      "readwrite",
    );
    const store = transaction.objectStore(DATOS_NEGOCIO_STORE);

    // Limpiar cache anterior
    const clearRequest = store.clear();

    clearRequest.onsuccess = () => {
      const datosConTimestamp: DatosNegocioCache = {
        ...datos,
        timestamp: Date.now(),
      };

      const addRequest = store.add(datosConTimestamp);

      addRequest.onsuccess = () => {
        console.log("Datos del negocio guardados en cache");
        resolve();
      };

      addRequest.onerror = () => {
        console.error(
          "Error guardando datos del negocio en cache:",
          addRequest.error,
        );
        reject(addRequest.error);
      };
    };

    clearRequest.onerror = () => {
      console.error(
        "Error limpiando cache de datos del negocio:",
        clearRequest.error,
      );
      reject(clearRequest.error);
    };
  });
}

/**
 * Obtiene datos del negocio desde el cache
 */
export async function obtenerDatosNegocioCache(): Promise<DatosNegocioCache | null> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DATOS_NEGOCIO_STORE], "readonly");
    const store = transaction.objectStore(DATOS_NEGOCIO_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const datos = request.result as DatosNegocioCache[];
      if (datos.length > 0) {
        resolve(datos[0]);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      console.error(
        "Error obteniendo datos del negocio desde cache:",
        request.error,
      );
      reject(request.error);
    };
  });
}

/**
 * Inicializa el sistema completo de sincronización offline
 */
export async function inicializarSistemaOffline(): Promise<void> {
  try {
    await initIndexedDB();
    configurarSincronizacionAutomatica();

    // Intentar sincronizar datos pendientes al iniciar
    if (navigator.onLine) {
      const pendientes = await obtenerContadorPendientes();
      const total =
        pendientes.facturas +
        pendientes.pagos +
        pendientes.gastos +
        pendientes.envios;

      if (total > 0) {
        console.log(
          `Hay ${pendientes.facturas} facturas, ${pendientes.pagos} pagos, ${pendientes.gastos} gastos y ${pendientes.envios} envíos pendientes de sincronización`,
        );
        await sincronizarTodo();
      }

      // Cargar productos en cache si no hay ninguno o actualizar
      const hayCache = await hayProductosEnCache();
      if (!hayCache) {
        console.log("Cargando productos en cache por primera vez...");
        const resultado = await actualizarCacheProductos();
        if (resultado.exitoso) {
          console.log(`✓ ${resultado.cantidad} productos cargados en cache`);
        }
      }
    } else {
      console.warn("⚠ Sin conexión. Verificando cache de productos...");
      const hayCache = await hayProductosEnCache();
      if (!hayCache) {
        console.error(
          "❌ No hay productos en cache y no hay conexión a internet",
        );
      } else {
        const productos = await obtenerProductosCache();
        console.log(`✓ ${productos.length} productos disponibles en cache`);
      }
    }

    console.log("✓ Sistema de sincronización offline inicializado");
  } catch (error) {
    console.error("Error inicializando sistema offline:", error);
  }
}
