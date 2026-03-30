/**
 * printerConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión de configuración de impresoras.
 * Usa una base IndexedDB independiente y se sincroniza con Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "../supabaseClient";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoImpresora = "recibo" | "comanda";
export type ModoImpresion = "navegador" | "silenciosa";

export interface PrinterConfig {
  tipo: TipoImpresora;
  nombre: string;
  vendorId: number;
  productId: number;
  modoImpresion: ModoImpresion;
}

// ── IndexedDB ────────────────────────────────────────────────────────────────

const IDB_NAME = "ImpresorasConfigDB";
const IDB_VERSION = 1;
const STORE = "impresoras";

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        // key = tipo ('recibo' | 'comanda')
        db.createObjectStore(STORE, { keyPath: "tipo" });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
}

export async function guardarConfigLocal(cfg: PrinterConfig): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.put(cfg);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function obtenerConfigLocal(
  tipo: TipoImpresora,
): Promise<PrinterConfig | null> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(tipo);
    req.onsuccess = (e) => resolve((e.target as IDBRequest).result ?? null);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function obtenerTodasLasConfigsLocales(): Promise<
  PrinterConfig[]
> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = (e) => resolve((e.target as IDBRequest).result ?? []);
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function eliminarConfigLocal(tipo: TipoImpresora): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(tipo);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

// ── Supabase ─────────────────────────────────────────────────────────────────

/** Guarda o actualiza la config en Supabase (upsert por cajero_id + tipo). */
export async function guardarConfigRemota(
  cfg: PrinterConfig,
  cajeroId: string,
): Promise<void> {
  const { error } = await supabase.from("impresoras_config").upsert(
    [
      {
        cajero_id: cajeroId,
        tipo: cfg.tipo,
        nombre: cfg.nombre,
        vendor_id: cfg.vendorId,
        product_id: cfg.productId,
        modo_impresion: cfg.modoImpresion,
      },
    ],
    { onConflict: "cajero_id,tipo" },
  );
  if (error) throw error;
}

/** Carga la config remota para un cajero y la sincroniza a IndexedDB. */
export async function sincronizarConfigDesdeSupabase(
  cajeroId: string,
): Promise<PrinterConfig[]> {
  const { data, error } = await supabase
    .from("impresoras_config")
    .select("tipo, nombre, vendor_id, product_id, modo_impresion")
    .eq("cajero_id", cajeroId);

  if (error) throw error;

  const configs: PrinterConfig[] = (data ?? []).map((row: any) => ({
    tipo: row.tipo as TipoImpresora,
    nombre: row.nombre ?? "",
    vendorId: row.vendor_id ?? 0,
    productId: row.product_id ?? 0,
    modoImpresion: (row.modo_impresion as ModoImpresion) ?? "navegador",
  }));

  // Persistir localmente
  for (const cfg of configs) {
    await guardarConfigLocal(cfg);
  }

  return configs;
}

// ── Helper combinado: guardar local + remoto ─────────────────────────────────

export async function guardarPrinterConfig(
  cfg: PrinterConfig,
  cajeroId: string,
): Promise<void> {
  await guardarConfigLocal(cfg);

  // Intentar guardar en Supabase (no bloqueante si falla)
  try {
    await guardarConfigRemota(cfg, cajeroId);
  } catch (err) {
    console.warn("No se pudo guardar la config de impresora en Supabase:", err);
  }
}

/** Carga la config de una impresora: primero local, luego remoto si no existe. */
export async function cargarPrinterConfig(
  tipo: TipoImpresora,
  cajeroId?: string,
): Promise<PrinterConfig | null> {
  let local = await obtenerConfigLocal(tipo);
  if (!local && cajeroId) {
    try {
      const remotas = await sincronizarConfigDesdeSupabase(cajeroId);
      local = remotas.find((c) => c.tipo === tipo) ?? null;
    } catch (_) {}
  }
  return local;
}
