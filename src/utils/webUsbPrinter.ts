/**
 * webUsbPrinter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Comunicación directa con impresoras térmicas USB usando WebUSB API.
 * Compatible con impresoras ESC/POS (Epson, Star, Bixolon, Citizen, etc.)
 *
 * REQUISITOS:
 *  - Navegador Chromium (Chrome ≥ 61 / Edge ≥ 79)
 *  - Conexión HTTPS o localhost
 *  - La página fue activada por un gesto del usuario para requestDevice()
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Declaraciones de tipos WebUSB (no requiere @types/w3c-web-usb) ───────────
declare interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}
declare interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  open(): Promise<void>;
  close(): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  selectAlternateInterface(
    interfaceNumber: number,
    alternateSetting: number,
  ): Promise<void>;
  transferOut(
    endpointNumber: number,
    data: BufferSource,
  ): Promise<{ status: string }>;
  configuration?: { interfaces: USBInterface[] };
}
declare interface USBInterface {
  interfaceNumber: number;
  alternates: USBAlternateInterface[];
}
declare interface USBAlternateInterface {
  interfaceClass: number;
  alternateSetting?: number;
  endpoints: USBEndpoint[];
}
declare interface USBEndpoint {
  direction: string;
  endpointNumber: number;
  type: string;
}
declare interface USB {
  requestDevice(options: { filters: USBDeviceFilter[] }): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PrinterDeviceInfo {
  nombre: string;
  vendorId: number;
  productId: number;
}

export interface ItemPedido {
  nombre: string;
  cantidad: number;
  precio: number;
  tipo?: string;
  complementos?: string[];
  piezas?: string;
}

export interface DatosRecibo {
  nombreNegocio?: string;
  factura: string;
  cajero: string;
  caja: string;
  cliente?: string;
  fecha: string;
  items: ItemPedido[];
  subTotal?: number;
  isv15?: number;
  isv18?: number;
  total: number;
  tipoPago?: string;
  cambio?: number;
  esCredito?: boolean;
  descuento?: number;
  costoEnvio?: number;
  pie?: string;
}

export interface DatosComanda {
  factura: string;
  cliente?: string;
  tipoOrden?: string;
  items: ItemPedido[];
  fecha: string;
  esCredito?: boolean;
  esTelefono?: boolean;
}

// ── Comprobacion de soporte ───────────────────────────────────────────────────

export function webUsbSoportado(): boolean {
  return !!(navigator as any).usb;
}

// ── Solicitar impresora al usuario (requiere gesto) ───────────────────────────

/**
 * Abre el diálogo de selección de dispositivo USB.
 * filters: puedes pasar [{ vendorId: 0x04b8 }] para Epson, etc.
 * Si no se filtra, se muestran todos los dispositivos USB.
 */
export async function solicitarImpresora(
  filters: USBDeviceFilter[] = [],
): Promise<PrinterDeviceInfo | null> {
  if (!webUsbSoportado()) {
    throw new Error(
      "WebUSB no está soportado en este navegador. Usa Chrome o Edge.",
    );
  }
  try {
    const usb = (navigator as any).usb as USB;
    const device: USBDevice = await usb.requestDevice({ filters });
    return {
      nombre: device.productName || `USB ${device.productId.toString(16)}`,
      vendorId: device.vendorId,
      productId: device.productId,
    };
  } catch (err: any) {
    if (err?.name === "NotFoundError") return null; // usuario canceló
    throw err;
  }
}

// ── Obtener dispositivo ya autorizado ────────────────────────────────────────

async function obtenerDispositivo(
  vendorId: number,
  productId: number,
): Promise<USBDevice | null> {
  if (!webUsbSoportado()) return null;
  const usb = (navigator as any).usb as USB;
  const devices: USBDevice[] = await usb.getDevices();
  return (
    devices.find((d) => d.vendorId === vendorId && d.productId === productId) ??
    null
  );
}

// ── Construir buffer ESC/POS ──────────────────────────────────────────────────

// Códigos ESC/POS  comunes
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function init(): number[] {
  return [ESC, 0x40]; // ESC @ → inicializar
}

function corte(): number[] {
  return [GS, 0x56, 0x41, 0x00]; // GS V A 0 → corte parcial
}

function alinearCentro(): number[] {
  return [ESC, 0x61, 0x01];
}

function alinearIzquierda(): number[] {
  return [ESC, 0x61, 0x00];
}

function negrita(on: boolean): number[] {
  return [ESC, 0x45, on ? 0x01 : 0x00];
}

function tamanoDoble(on: boolean): number[] {
  return on ? [ESC, 0x21, 0x11] : [ESC, 0x21, 0x00];
}

function linea(): number[] {
  const dash = "-".charCodeAt(0);
  const arr: number[] = [];
  for (let i = 0; i < 32; i++) arr.push(dash);
  arr.push(LF);
  return arr;
}

function lineaPunteada(): number[] {
  const dash = "-".charCodeAt(0);
  const arr: number[] = [];
  for (let i = 0; i < 32; i++) arr.push(dash);
  arr.push(LF);
  return arr;
}

function texto(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Convertir caracteres especiales básicos del español
    if (code < 128) {
      bytes.push(code);
    } else {
      // Mapa mínimo de caracteres UTF-8 → CP437/CP858 (ISO 8859-1 reducido)
      const latin: Record<string, number> = {
        á: 0xa0,
        é: 0x82,
        í: 0xa1,
        ó: 0xa2,
        ú: 0xa3,
        Á: 0xb5,
        É: 0x90,
        Í: 0xd6,
        Ó: 0xe0,
        Ú: 0xe9,
        ñ: 0xa4,
        Ñ: 0xa5,
        ü: 0x81,
        Ü: 0x9a,
        "¡": 0xad,
        "¿": 0xa8,
        "°": 0xf8,
        L: 0x4c,
      };
      bytes.push(latin[str[i]] ?? 0x3f); // '?' si no hay mapa
    }
  }
  bytes.push(LF);
  return bytes;
}

/** Imprime columna izq + columna der alineadas en 32 chars */
function fila2Cols(izquierda: string, derecha: string, ancho = 32): number[] {
  const espacio = Math.max(0, ancho - izquierda.length - derecha.length);
  return texto(izquierda + " ".repeat(espacio) + derecha);
}

// ── Builders de tickets ───────────────────────────────────────────────────────

export function buildRecibo(datos: DatosRecibo): Uint8Array {
  const buf: number[] = [];

  const push = (...arrs: number[][]) => arrs.forEach((a) => buf.push(...a));

  push(init());

  // Encabezado
  push(alinearCentro(), negrita(true), tamanoDoble(true));
  push(texto(datos.nombreNegocio || "PUNTO DE VENTA"));
  push(tamanoDoble(false));
  if (datos.esCredito) push(texto("*** VENTA A CREDITO ***"));
  push(negrita(false), linea(), alinearIzquierda());

  push(texto("Factura: " + datos.factura));
  push(texto("Cajero:  " + datos.cajero));
  push(texto("Caja:    " + datos.caja));
  if (datos.cliente) push(texto("Cliente: " + datos.cliente));
  push(texto("Fecha:   " + datos.fecha));
  push(linea());

  // Productos
  push(negrita(true));
  push(fila2Cols("DESCRIPCION", "TOTAL"));
  push(negrita(false), lineaPunteada());

  for (const item of datos.items) {
    const lineaItem = `${item.cantidad}x ${item.nombre}`;
    const precio = `L ${(item.precio * item.cantidad).toFixed(2)}`;
    push(fila2Cols(lineaItem.substring(0, 22), precio));
    if (item.complementos?.length) {
      item.complementos.forEach((c) => push(texto("  + " + c)));
    }
  }

  push(linea());

  // Totales
  if (datos.descuento && datos.descuento > 0) {
    push(fila2Cols("Descuento:", "-L " + datos.descuento.toFixed(2)));
  }
  if (datos.costoEnvio && datos.costoEnvio > 0) {
    push(fila2Cols("Envio:", "L " + datos.costoEnvio.toFixed(2)));
  }
  if (datos.subTotal !== undefined) {
    push(fila2Cols("SubTotal:", "L " + datos.subTotal.toFixed(2)));
  }
  if (datos.isv15 !== undefined && datos.isv15 > 0) {
    push(fila2Cols("ISV 15%:", "L " + datos.isv15.toFixed(2)));
  }
  if (datos.isv18 !== undefined && datos.isv18 > 0) {
    push(fila2Cols("ISV 18%:", "L " + datos.isv18.toFixed(2)));
  }
  push(negrita(true), tamanoDoble(true));
  push(fila2Cols("TOTAL:", "L " + datos.total.toFixed(2)));
  push(tamanoDoble(false), negrita(false));

  if (datos.tipoPago) push(fila2Cols("Pago:", datos.tipoPago));
  if (datos.cambio !== undefined && datos.cambio > 0) {
    push(fila2Cols("Cambio:", "L " + datos.cambio.toFixed(2)));
  }

  push(linea());

  // Pie
  push(alinearCentro());
  push(texto(datos.pie || "¡Gracias por su compra!"));
  push(texto(""));
  push(texto(""));
  push(texto(""));

  push(corte());

  return new Uint8Array(buf);
}

export function buildComanda(datos: DatosComanda): Uint8Array {
  const buf: number[] = [];
  const push = (...arrs: number[][]) => arrs.forEach((a) => buf.push(...a));

  push(init());
  push(alinearCentro(), negrita(true), tamanoDoble(true));
  push(texto("COMANDA COCINA"));
  push(tamanoDoble(false));

  if (datos.esTelefono) {
    push(texto("** PEDIDO POR TELEFONO **"));
  }
  if (datos.tipoOrden) {
    push(texto(datos.tipoOrden.toUpperCase()));
  }
  if (datos.esCredito) {
    push(texto("** VENTA A CREDITO **"));
  }
  push(negrita(false));
  push(linea(), alinearIzquierda());

  push(texto("Factura: " + datos.factura));
  if (datos.cliente) push(texto("Cliente: " + datos.cliente));
  push(texto("Hora:    " + datos.fecha));
  push(linea());

  // Comidas
  const comidas = datos.items.filter((i) => i.tipo === "comida");
  const bebidas = datos.items.filter((i) => i.tipo === "bebida");
  const complementos = datos.items.filter((i) => i.tipo === "complemento");
  const otros = datos.items.filter(
    (i) => !["comida", "bebida", "complemento"].includes(i.tipo ?? ""),
  );

  const renderItems = (items: ItemPedido[]) => {
    for (const item of items) {
      push(negrita(true), tamanoDoble(true));
      push(texto(item.cantidad + "x " + item.nombre));
      push(tamanoDoble(false), negrita(false));
      if (item.complementos?.length) {
        item.complementos.forEach((c) => push(texto("  Comp: " + c)));
      }
      if (item.piezas && item.piezas !== "PIEZAS VARIAS") {
        push(texto("  Pzas: " + item.piezas));
      }
      push(lineaPunteada());
    }
  };

  if (comidas.length) {
    push(negrita(true));
    push(texto("---- COMIDAS ----"));
    push(negrita(false));
    renderItems(comidas);
  }
  if (complementos.length) {
    push(negrita(true));
    push(texto("-- COMPLEMENTOS --"));
    push(negrita(false));
    renderItems(complementos);
  }
  if (bebidas.length) {
    push(negrita(true));
    push(texto("---- BEBIDAS ----"));
    push(negrita(false));
    renderItems(bebidas);
  }
  if (otros.length) {
    renderItems(otros);
  }

  push(texto(""));
  push(texto(""));
  push(corte());

  return new Uint8Array(buf);
}

// ── Enviar bytes a impresora por WebUSB ───────────────────────────────────────

const CHUNK_SIZE = 512; // algunos controladores USB solo aceptan chunks pequeños

async function enviarBytes(device: USBDevice, data: Uint8Array): Promise<void> {
  await device.open();

  // Seleccionar configuración 1 (la mayoría de impresoras solo tiene 1)
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Buscar la interfaz + endpoint bulk-out
  let ifaceNumber = 0;
  let altSetting = 0;
  let endpointNumber = 1;
  let found = false;

  for (const iface of device.configuration?.interfaces ?? []) {
    for (const alt of iface.alternates) {
      for (const ep of alt.endpoints) {
        if (ep.type === "bulk" && ep.direction === "out") {
          ifaceNumber = iface.interfaceNumber;
          altSetting = alt.alternateSetting ?? 0;
          endpointNumber = ep.endpointNumber;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) break;
  }

  try {
    await device.claimInterface(ifaceNumber);
  } catch (_) {
    // ya estaba reclamada
  }

  // Seleccionar alternate interface para activar el endpoint bulk-out
  try {
    await device.selectAlternateInterface(ifaceNumber, altSetting);
  } catch (_) {
    // algunos dispositivos no lo necesitan o lo ignoran
  }

  // Enviar en chunks para evitar problemas con buffers pequeños
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    await device.transferOut(endpointNumber, chunk);
  }

  await device.releaseInterface(ifaceNumber);
  await device.close();
}

// ── API pública de impresión ──────────────────────────────────────────────────

/**
 * Imprime un recibo en la impresora USB indicada.
 * Lanza error si el dispositivo no está disponible o hay fallo al enviar.
 */
export async function imprimirReciboUSB(
  vendorId: number,
  productId: number,
  datos: DatosRecibo,
): Promise<void> {
  const device = await obtenerDispositivo(vendorId, productId);
  if (!device) {
    throw new Error(
      "Impresora de recibos no encontrada. Reconecta el USB o vuelve a configurarla en Ajustes → Impresoras.",
    );
  }
  const bytes = buildRecibo(datos);
  await enviarBytes(device, bytes);
}

/**
 * Imprime una comanda en la impresora USB indicada.
 */
export async function imprimirComandaUSB(
  vendorId: number,
  productId: number,
  datos: DatosComanda,
): Promise<void> {
  const device = await obtenerDispositivo(vendorId, productId);
  if (!device) {
    throw new Error(
      "Impresora de comanda no encontrada. Reconecta el USB o vuelve a configurarla en Ajustes → Impresoras.",
    );
  }
  const bytes = buildComanda(datos);
  await enviarBytes(device, bytes);
}

/**
 * Impresión de prueba para verificar conexión.
 */
export async function imprimirPrueba(
  vendorId: number,
  productId: number,
): Promise<void> {
  const device = await obtenerDispositivo(vendorId, productId);
  if (!device) {
    throw new Error(
      "Dispositivo no encontrado. Vuelve a configurar la impresora.",
    );
  }
  const buf: number[] = [
    ...init(),
    ...alinearCentro(),
    ...negrita(true),
    ...texto("*** IMPRESORA OK ***"),
    ...negrita(false),
    ...texto("Prueba de conexion WebUSB"),
    ...texto(new Date().toLocaleString("es-HN")),
    ...texto(""),
    ...texto(""),
    ...corte(),
  ];
  await enviarBytes(device, new Uint8Array(buf));
}
