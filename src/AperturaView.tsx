import { useState } from "react";
import FondoImagen from "./FondoImagen";
import { supabase } from "./supabaseClient";
import { getLocalDayRange, formatToHondurasLocal } from "./utils/fechas";
import { obtenerAperturaLocalStorage, guardarAperturaLocalStorage } from "./utils/offlineSync";

interface AperturaViewProps {
  usuarioActual: { id: string; nombre: string } | null;
  caja: string | null;
}

export default function AperturaView({
  usuarioActual,
  caja,
}: AperturaViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [fondoFijo, setFondoFijo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const registrarApertura = async () => {
    try {
      setLoading(true);
      setError("");
      if (!caja || caja === "" || caja === null || caja === undefined) {
        setError('No tienes caja asiganda. Contacte al administrador.');
        setLoading(false);
        return;
      }

      // ── Capa rápida: localStorage (sin red, instantáneo) ──────────────────
      const aperturaLS = obtenerAperturaLocalStorage();
      if (aperturaLS && aperturaLS.cajero_id === usuarioActual?.id) {
        console.log("✓ Apertura activa en localStorage → no se duplica");
        window.location.href = "/punto-de-venta";
        setLoading(false);
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      const { start, end } = getLocalDayRange();
      // Verificar si ya hay apertura hoy
      const { data: aperturas, error: queryErr } = await supabase
        .from("cierres")
        .select("*")
        .eq("tipo_registro", "apertura")
        .eq("cajero", usuarioActual?.nombre)
        .eq("caja", caja)
        .gte("fecha", start)
        .lte("fecha", end);
      if (queryErr) {
        console.error("Error consultando aperturas:", queryErr);
        setError(queryErr.message || "Error consultando aperturas");
        setLoading(false);
        return;
      }
      if (aperturas && aperturas.length > 0) {
        window.location.href = "/punto-de-venta";
        setLoading(false);
        return;
      }
      // Registrar apertura (incluimos fecha en hora local de Honduras)
      const { data: insertada, error: insertError } = await supabase.from("cierres").insert([
        {
          tipo_registro: "apertura",
          cajero: usuarioActual?.nombre,
          cajero_id: usuarioActual?.id,
          caja,
          fecha: formatToHondurasLocal(),
          fondo_fijo_registrado: parseFloat(fondoFijo),
          fondo_fijo: 0,
          efectivo_registrado: 0,
          efectivo_dia: 0,
          monto_tarjeta_registrado: 0,
          monto_tarjeta_dia: 0,
          transferencias_registradas: 0,
          transferencias_dia: 0,
          diferencia: 0,
          estado: "APERTURA",
        },
      ]).select();
      setLoading(false);
      if (insertError) {
        console.error("Error insertando apertura:", insertError);
        // Si el error es por constraint único (duplicado en BD), igual redirigir
        if (insertError.code === "23505") {
          console.log("⚠ Constraint único: apertura ya existe en BD → redirigiendo");
          window.location.href = "/punto-de-venta";
          return;
        }
        setError(insertError.message || "Error al registrar apertura");
      } else {
        // Guardar en localStorage para prevenir futuros duplicados
        if (insertada && insertada.length > 0) {
          const ap = insertada[0];
          guardarAperturaLocalStorage({
            id: ap.id?.toString() ?? "",
            cajero_id: ap.cajero_id ?? usuarioActual?.id ?? "",
            caja: ap.caja ?? caja,
            fecha: ap.fecha ?? "",
            estado: ap.estado ?? "APERTURA",
          });
        }
        window.location.href = "/punto-de-venta";
      }
    } catch (e: any) {
      console.error("Excepción en registrarApertura:", e);
      setError(e?.message || String(e));
      setLoading(false);
    }
  };

  return (
    <FondoImagen>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          width: "100vw",
        }}
      >
        <button
          style={{
            fontSize: 28,
            padding: "24px 48px",
            borderRadius: 16,
            background: "#1976d2",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            boxShadow: "0 2px 12px #1976d222",
            cursor: "pointer",
            marginBottom: 32,
          }}
          onClick={() => setShowModal(true)}
        >
          Registrar Apertura
        </button>
        <button
          style={{
            fontSize: 18,
            padding: "12px 32px",
            borderRadius: 12,
            background: "#c62828",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            boxShadow: "0 2px 8px #c6282822",
            cursor: "pointer",
            marginBottom: 16,
          }}
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
        >
          Cerrar sesión
        </button>
        {showModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.25)",
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
                boxShadow: "0 8px 32px #1976d222",
                padding: 32,
                minWidth: 350,
              }}
            >
              <h2 style={{ color: "#1976d2", marginBottom: 18 }}>
                Fondo Fijo de Caja
              </h2>
              <input
                type="number"
                value={fondoFijo}
                onChange={(e) => setFondoFijo(e.target.value)}
                placeholder="Ingrese fondo fijo"
                style={{
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 18,
                  marginBottom: 18,
                  width: "100%",
                }}
              />
              <div
                style={{ display: "flex", gap: 16, justifyContent: "center" }}
              >
                <button
                  onClick={registrarApertura}
                  disabled={loading || !fondoFijo}
                  style={{
                    background: "#1976d2",
                    color: "#fff",
                    borderRadius: 8,
                    border: "none",
                    padding: "10px 32px",
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  Registrar
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "#d32f2f",
                    color: "#fff",
                    borderRadius: 8,
                    border: "none",
                    padding: "10px 32px",
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
              {error && (
                <div style={{ color: "red", marginTop: 12 }}>{error}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </FondoImagen>
  );
}
