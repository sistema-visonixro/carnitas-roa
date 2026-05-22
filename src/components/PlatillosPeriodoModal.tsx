export interface PlatilloPeriodoRow {
  nombre_producto: string;
  vendidos_dia: number;
  credito_dia: number;
  devolucion_dia: number;
  donados_dia: number;
  total_dia: number;
}

interface PlatillosPeriodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  rows: PlatilloPeriodoRow[];
  onRefresh: () => void;
}

export default function PlatillosPeriodoModal({
  isOpen,
  onClose,
  loading,
  rows,
  onRefresh,
}: PlatillosPeriodoModalProps) {
  if (!isOpen) return null;

  const rowsFiltradas = [...rows]
    .filter(
      (r) =>
        Number(r.vendidos_dia || 0) > 0 ||
        Number(r.credito_dia || 0) > 0 ||
        Number(r.devolucion_dia || 0) > 0 ||
        Number(r.donados_dia || 0) > 0 ||
        Number(r.total_dia || 0) !== 0,
    )
    .sort(
      (a, b) =>
        Number(b.total_dia || 0) - Number(a.total_dia || 0) ||
        a.nombre_producto.localeCompare(b.nombre_producto),
    );

  const totVendidos = rowsFiltradas.reduce(
    (acc, row) => acc + (Number(row.vendidos_dia) || 0),
    0,
  );
  const totDonados = rowsFiltradas.reduce(
    (acc, row) => acc + (Number(row.donados_dia) || 0),
    0,
  );
  const totDevolucion = rowsFiltradas.reduce(
    (acc, row) => acc + (Number(row.devolucion_dia) || 0),
    0,
  );
  const totCredito = rowsFiltradas.reduce(
    (acc, row) => acc + (Number(row.credito_dia) || 0),
    0,
  );
  const totFinal = rowsFiltradas.reduce(
    (acc, row) => acc + (Number(row.total_dia) || 0),
    0,
  );

  // Generador del Ticket de 80mm
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      alert("Por favor permite las ventanas emergentes para imprimir.");
      return;
    }

    const fechaStr = new Date().toLocaleString("es-HN", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const htmlTicket = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket 80mm</title>
          <style>
            @page { margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm; /* Ajuste para el rollo de 80mm */
              margin: 0 auto;
              padding: 4mm 0;
              color: #000000;
              font-size: 12px;
            }
            h2, h3, p { margin: 0; padding: 0; text-align: center; }
            h2 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
            h3 { font-size: 14px; margin-bottom: 5px; }
            .divider { border-bottom: 1px dashed #000000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
            th { text-align: right; border-bottom: 1px solid #000000; padding-bottom: 2px; }
            td { text-align: right; padding: 3px 0; }
            th.left, td.left { text-align: left; max-width: 25mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .bold { font-weight: bold; }
            .totals { margin-top: 8px; font-size: 12px; }
            .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-weight: bold; }
            .total-final { font-size: 15px; margin-top: 4px; border-top: 1px solid #000000; padding-top: 4px; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h2>CORTE DE PLATILLOS</h2>
          <p>Fecha: ${fechaStr}</p>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th class="left">Prod</th>
                <th>Ven</th>
                <th>Cre</th>
                <th>Dev</th>
                <th>Don</th>
                <th>Tot</th>
              </tr>
            </thead>
            <tbody>
              ${rowsFiltradas
                .map(
                  (r) => `
                <tr>
                  <td class="left">${r.nombre_producto}</td>
                  <td>${Number(r.vendidos_dia).toFixed(0)}</td>
                  <td>${Number(r.credito_dia).toFixed(0)}</td>
                  <td>${Number(r.devolucion_dia).toFixed(0)}</td>
                  <td>${Number(r.donados_dia).toFixed(0)}</td>
                  <td class="bold">${Number(r.total_dia).toFixed(2)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="totals">
            <div class="total-row"><span>Ventas:</span><span>${totVendidos.toFixed(2)}</span></div>
            <div class="total-row"><span>Créditos:</span><span>${totCredito.toFixed(2)}</span></div>
            <div class="total-row"><span>Devoluciones:</span><span>${totDevolucion.toFixed(2)}</span></div>
            <div class="total-row"><span>Donaciones:</span><span>${totDonados.toFixed(2)}</span></div>
            <div class="total-row total-final"><span>NETO FINAL:</span><span>${totFinal.toFixed(2)}</span></div>
          </div>
          <div class="divider"></div>
          <p class="center" style="margin-top: 10px; font-size: 10px;">-- Sistema de Reportes --</p>
        </body>
      </html>
    `;

    printWindow.document.write(htmlTicket);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 145500,
        padding: "24px",
      }}
      onClick={onClose}
    >
      <style>
        {`
          @keyframes popIn {
            0% { opacity: 0; transform: translateY(20px) scale(0.97); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes slideFadeRight {
            0% { opacity: 0; transform: translateX(-20px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          .modal-modern {
            animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .row-modern {
            opacity: 0;
            animation: slideFadeRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            transition: all 0.2s ease;
          }
          .row-modern:hover {
            background-color: #f8fafc;
            transform: scale(1.01);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
            border-radius: 12px;
            z-index: 10;
            position: relative;
          }
          /* Asegura que al hacer hover, no se vea raro el borde inferior */
          .row-modern:hover td {
            border-bottom-color: transparent !important;
          }
          .btn-modern {
            transition: all 0.2s ease;
            cursor: pointer;
            border: none;
            font-weight: 800;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border-radius: 14px;
            padding: 12px 20px;
            font-size: 14px;
          }
          .btn-modern:hover { filter: brightness(0.95); transform: translateY(-1px); }
          .btn-modern:active { transform: scale(0.97); }
        `}
      </style>

      <div
        className="modal-modern"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          borderRadius: 32,
          width: "100%",
          maxWidth: 1100,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 30px 60px rgba(15, 23, 42, 0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "32px 40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 900,
                color: "#020617",
                letterSpacing: "-1px",
              }}
            >
              Reporte de Platillos
            </h3>
            <p
              style={{
                margin: "6px 0 0",
                color: "#1e3a8a",
                fontSize: 15,
                fontWeight: 600,
              }}
            ></p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handlePrint}
              className="btn-modern"
              style={{ background: "#ccfbf1", color: "#115e59" }}
            >
              🖨️ Imprimir Ticket
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="btn-modern"
              style={{
                background: "#dbeafe",
                color: "#1e3a8a",
                opacity: loading ? 0.6 : 1,
              }}
            >
              🔄 Recargar
            </button>
            <button
              onClick={onClose}
              className="btn-modern"
              style={{
                background: "#ffe4e6",
                color: "#881337",
                padding: "12px 16px",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 40px" }}>
          {loading ? (
            <div
              style={{
                padding: 60,
                color: "#1e3a8a",
                textAlign: "center",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              Sincronizando movimientos...
            </div>
          ) : rowsFiltradas.length === 0 ? (
            <div
              style={{
                padding: 60,
                color: "#1e3a8a",
                textAlign: "center",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              Aún no hay movimientos registrados hoy.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "0 4px",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      borderBottom: "2px solid #cbd5e1",
                      padding: "16px 20px",
                      textAlign: "left",
                      color: "#0f172a",
                      fontWeight: 900,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Platillo
                  </th>
                  <th
                    style={{
                      borderBottom: "2px solid #cbd5e1",
                      padding: "16px 20px",
                      textAlign: "right",
                      color: "#0f172a",
                      fontWeight: 900,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Vendidos
                  </th>
                  <th
                    style={{
                      borderBottom: "2px solid #cbd5e1",
                      padding: "16px 20px",
                      textAlign: "right",
                      color: "#0f172a",
                      fontWeight: 900,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Crédito
                  </th>
                  <th
                    style={{
                      borderBottom: "2px solid #cbd5e1",
                      padding: "16px 20px",
                      textAlign: "right",
                      color: "#0f172a",
                      fontWeight: 900,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Devolución
                  </th>
                  <th
                    style={{
                      borderBottom: "2px solid #cbd5e1",
                      padding: "16px 20px",
                      textAlign: "right",
                      color: "#0f172a",
                      fontWeight: 900,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Donados
                  </th>
                  <th
                    style={{
                      borderBottom: "2px solid #cbd5e1",
                      padding: "16px 20px",
                      textAlign: "right",
                      color: "#0f172a",
                      fontWeight: 900,
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Total{" "}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rowsFiltradas.map((row, idx) => (
                  <tr
                    key={row.nombre_producto}
                    className="row-modern"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    <td
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "18px 20px",
                        fontWeight: 800,
                        color: "#020617",
                        fontSize: 15,
                        borderRadius: "12px 0 0 12px",
                        transition: "border-color 0.2s",
                      }}
                    >
                      {row.nombre_producto}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "18px 20px",
                        textAlign: "right",
                        color: "#064e3b",
                        fontWeight: 900,
                        fontSize: 16,
                        transition: "border-color 0.2s",
                      }}
                    >
                      {Number(row.vendidos_dia || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "18px 20px",
                        textAlign: "right",
                        color: "#4c1d95",
                        fontWeight: 900,
                        fontSize: 16,
                        transition: "border-color 0.2s",
                      }}
                    >
                      {Number(row.credito_dia || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "18px 20px",
                        textAlign: "right",
                        color: "#7f1d1d",
                        fontWeight: 900,
                        fontSize: 16,
                        transition: "border-color 0.2s",
                      }}
                    >
                      {Number(row.devolucion_dia || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "18px 20px",
                        textAlign: "right",
                        color: "#9f1239",
                        fontWeight: 900,
                        fontSize: 16,
                        transition: "border-color 0.2s",
                      }}
                    >
                      {Number(row.donados_dia || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "18px 20px",
                        textAlign: "right",
                        color: "#020617",
                        fontWeight: 900,
                        fontSize: 18,
                        borderRadius: "0 12px 12px 0",
                        transition: "border-color 0.2s",
                      }}
                    >
                      {Number(row.total_dia || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 20,
            padding: "32px 40px",
            marginTop: "16px",
          }}
        >
          <div
            style={{
              background: "#f0fdf4",
              padding: "20px 24px",
              borderRadius: 24,
            }}
          >
            <div
              style={{
                color: "#064e3b",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Ventas Reales
            </div>
            <div
              style={{
                fontWeight: 900,
                color: "#022c22",
                fontSize: 28,
                marginTop: 4,
              }}
            >
              {totVendidos.toFixed(2)}
            </div>
          </div>
          <div
            style={{
              background: "#f5f3ff",
              padding: "20px 24px",
              borderRadius: 24,
            }}
          >
            <div
              style={{
                color: "#4c1d95",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              En Créditos
            </div>
            <div
              style={{
                fontWeight: 900,
                color: "#2e1065",
                fontSize: 28,
                marginTop: 4,
              }}
            >
              {totCredito.toFixed(2)}
            </div>
          </div>
          <div
            style={{
              background: "#fff1f2",
              padding: "20px 24px",
              borderRadius: 24,
            }}
          >
            <div
              style={{
                color: "#9f1239",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Devueltos
            </div>
            <div
              style={{
                fontWeight: 900,
                color: "#4c0519",
                fontSize: 28,
                marginTop: 4,
              }}
            >
              {totDevolucion.toFixed(2)}
            </div>
          </div>
          <div
            style={{
              background: "#ede9fe",
              padding: "20px 24px",
              borderRadius: 24,
            }}
          >
            <div
              style={{
                color: "#5b21b6",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Donados
            </div>
            <div
              style={{
                fontWeight: 900,
                color: "#311b92",
                fontSize: 28,
                marginTop: 4,
              }}
            >
              {totDonados.toFixed(2)}
            </div>
          </div>
          <div
            style={{
              background: "#fef08a",
              padding: "20px 24px",
              borderRadius: 24,
              boxShadow: "0 10px 25px rgba(253, 224, 71, 0.4)",
            }}
          >
            <div
              style={{
                color: "#713f12",
                fontSize: 14,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Total platillos
            </div>
            <div
              style={{
                fontWeight: 900,
                color: "#422006",
                fontSize: 32,
                marginTop: 4,
              }}
            >
              {totFinal.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
