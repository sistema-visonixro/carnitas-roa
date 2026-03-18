// ============================================================
// Tipos e interfaces para el Módulo de Ventas a Crédito,
// Cuentas por Cobrar, Proveedores y Cuentas por Pagar.
// ============================================================

// ─────────────────────────────────────────────────
// 1. CLIENTES DE CRÉDITO
// ─────────────────────────────────────────────────

export interface ClienteCredito {
  id: string;
  nombre: string;
  /** Formato esperado: 1809-1966-00326 */
  dni: string;
  telefono?: string;
  direccion?: string;
  email?: string;
  limite_credito?: number;
  activo: boolean;
  observaciones?: string;
  creado_por?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export type ClienteCreditoInput = Omit<
  ClienteCredito,
  "id" | "creado_en" | "actualizado_en"
>;

// ─────────────────────────────────────────────────
// 2. CUENTAS POR COBRAR
// ─────────────────────────────────────────────────

export type EstadoCuentaCobrar = "activo" | "cancelado";

export interface CuentaPorCobrar {
  id: string;
  cliente_id: string;
  saldo_actual: number;
  total_facturado: number;
  total_pagado: number;
  estado: EstadoCuentaCobrar;
  ultima_compra?: string;
  creado_en?: string;
  actualizado_en?: string;
}

// Vista consolidada (join con cliente)
export interface CreditoResumen {
  cliente_id: string;
  cliente_nombre: string;
  dni: string;
  telefono?: string;
  cliente_activo: boolean;
  cuenta_id: string;
  saldo_actual: number;
  total_facturado: number;
  total_pagado: number;
  ultima_compra?: string;
  cuenta_estado: EstadoCuentaCobrar;
  facturas_pendientes: number;
  facturas_vencidas: number;
}

// ─────────────────────────────────────────────────
// 3. FACTURAS DE CRÉDITO
// ─────────────────────────────────────────────────

export type EstadoFacturaCredito =
  | "pendiente"
  | "parcial"
  | "pagado"
  | "vencido";

export interface FacturaCredito {
  id: string;
  factura_numero: string;
  cliente_id: string;
  cuenta_cobrar_id: string;
  cajero_id?: string;
  cajero?: string;
  caja?: string;
  cai?: string;
  productos: ProductoFactura[];
  sub_total: number;
  isv_15: number;
  isv_18: number;
  total: number;
  saldo_anterior: number;
  nuevo_saldo: number;
  estado: EstadoFacturaCredito;
  fecha_vencimiento?: string;
  fecha_hora: string;
  observaciones?: string;
  tipo_orden?: string;
  creado_en?: string;
  actualizado_en?: string;
  // Joins opcionales
  cliente?: ClienteCredito;
}

export interface ProductoFactura {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  tipo: string;
}

/** Payload para crear venta a crédito (llama a la función SQL) */
export interface VentaCreditoPayload {
  factura_numero: string;
  cliente_id: string;
  cajero_id: string;
  cajero: string;
  caja: string;
  cai: string;
  productos: ProductoFactura[];
  sub_total: number;
  isv_15: number;
  isv_18: number;
  total: number;
  fecha_hora: string;
  tipo_orden?: string;
  dias_vencimiento?: number;
  observaciones?: string;
}

// ─────────────────────────────────────────────────
// 4. PAGOS DE CRÉDITO
// ─────────────────────────────────────────────────

export type TipoPagoCredito =
  | "efectivo"
  | "tarjeta"
  | "transferencia"
  | "dolares";

export interface PagoCredito {
  id: string;
  cliente_id: string;
  cuenta_cobrar_id: string;
  factura_credito_id?: string;
  monto: number;
  tipo_pago: TipoPagoCredito;
  referencia?: string;
  banco?: string;
  usd_monto?: number;
  cajero_id?: string;
  cajero?: string;
  caja?: string;
  observacion?: string;
  saldo_antes: number;
  saldo_despues: number;
  fecha_hora: string;
  creado_en?: string;
  // Join opcional
  cliente?: ClienteCredito;
}

export interface PagoCreditoPayload {
  cliente_id: string;
  monto: number;
  tipo_pago: TipoPagoCredito;
  cajero_id: string;
  cajero: string;
  caja?: string;
  factura_credito_id?: string;
  referencia?: string;
  banco?: string;
  usd_monto?: number;
  observacion?: string;
}

// ─────────────────────────────────────────────────
// 5. PROVEEDORES
// ─────────────────────────────────────────────────

export interface Proveedor {
  id: string;
  nombre_comercial: string;
  rtn_dni?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  contacto?: string;
  observaciones?: string;
  activo: boolean;
  creado_por?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export type ProveedorInput = Omit<
  Proveedor,
  "id" | "creado_en" | "actualizado_en"
>;

// Vista resumen CxP por proveedor
export interface CxpResumen {
  proveedor_id: string;
  proveedor: string;
  rtn_dni?: string;
  telefono?: string;
  proveedor_activo: boolean;
  total_facturas: number;
  saldo_pendiente_total: number;
  total_pagado: number;
  proxima_fecha_vencimiento?: string;
}

// ─────────────────────────────────────────────────
// 6. CUENTAS POR PAGAR
// ─────────────────────────────────────────────────

export type EstadoCuentaPagar = "pendiente" | "parcial" | "pagado" | "vencido";

export interface CuentaPorPagar {
  id: string;
  proveedor_id: string;
  numero_documento?: string;
  concepto: string;
  monto_total: number;
  saldo_pendiente: number;
  total_pagado: number;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  estado: EstadoCuentaPagar;
  cajero_id?: string;
  cajero?: string;
  observaciones?: string;
  creado_en?: string;
  actualizado_en?: string;
  // Join opcional
  proveedor?: Proveedor;
}

export type CuentaPorPagarInput = Omit<
  CuentaPorPagar,
  "id" | "total_pagado" | "creado_en" | "actualizado_en" | "proveedor"
>;

// ─────────────────────────────────────────────────
// 7. PAGOS A PROVEEDORES
// ─────────────────────────────────────────────────

export type TipoPagoProveedor =
  | "efectivo"
  | "tarjeta"
  | "transferencia"
  | "cheque";

export interface PagoProveedor {
  id: string;
  proveedor_id: string;
  cuenta_pagar_id: string;
  monto: number;
  tipo_pago: TipoPagoProveedor;
  referencia?: string;
  banco?: string;
  cajero_id?: string;
  cajero?: string;
  observacion?: string;
  saldo_antes: number;
  saldo_despues: number;
  fecha_hora: string;
  creado_en?: string;
  // Joins opcionales
  proveedor?: Proveedor;
}

export interface PagoProveedorPayload {
  proveedor_id: string;
  cuenta_pagar_id: string;
  monto: number;
  tipo_pago: TipoPagoProveedor;
  cajero_id: string;
  cajero: string;
  referencia?: string;
  banco?: string;
  observacion?: string;
}

// ─────────────────────────────────────────────────
// 8. RESPUESTA DE FUNCIONES SQL
// ─────────────────────────────────────────────────

export interface ResultadoVentaCredito {
  ok: boolean;
  factura_id?: string;
  cuenta_id?: string;
  saldo_anterior?: number;
  nuevo_saldo?: number;
  error?: string;
}

export interface ResultadoPagoCredito {
  ok: boolean;
  pago_id?: string;
  saldo_antes?: number;
  saldo_despues?: number;
  error?: string;
}

export interface ResultadoPagoProveedor {
  ok: boolean;
  pago_id?: string;
  saldo_antes?: number;
  saldo_despues?: number;
  error?: string;
}

// ─────────────────────────────────────────────────
// 9. FILTROS Y REPORTES
// ─────────────────────────────────────────────────

export interface FiltroFechas {
  desde: string;
  hasta: string;
}

export interface ReporteCreditosData {
  total_facturado_credito: number;
  total_cobrado_credito: number;
  saldo_pendiente_total: number;
  clientes_con_deuda: number;
  facturas_vencidas: number;
  promedio_recuperacion: number; // porcentaje
  contado_vs_credito: {
    contado: number;
    credito: number;
  };
  top_deudores: {
    cliente: string;
    saldo: number;
  }[];
}
