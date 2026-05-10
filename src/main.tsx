import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function UpdateNotification({
  show,
  version,
}: {
  show: boolean;
  version: string | null;
}) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "#fff",
        padding: "16px 24px",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        animation: "slideInRight 0.4s ease-out",
        maxWidth: 350,
      }}
    >
      <div style={{ fontSize: 28 }}>✨</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          ¡Sistema Actualizado!
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          Versión {version || "nueva"} cargada con éxito
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
            transform: translateX(400px);
          }
        }
      `}</style>
    </div>
  );
}

function Root() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [updatedVersion, setUpdatedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!(import.meta.env.DEV && "serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {
        // ignore
      });
  }, []);

  // Verificar si acabamos de actualizar (viene del query param _cb)
  useEffect(() => {
    const url = new URL(window.location.href);
    const cacheBuster = url.searchParams.get("_cb");

    if (cacheBuster) {
      // Acabamos de actualizar, mostrar notificación
      const loadVersion = async () => {
        try {
          const res = await fetch("/version.json", { cache: "no-store" });
          const j = await res.json();
          const ver = String(j.version || "");
          setUpdatedVersion(ver);
          setShowUpdateNotification(true);

          // Ocultar después de 4 segundos
          setTimeout(() => {
            setShowUpdateNotification(false);
          }, 4000);

          // Limpiar el query param sin recargar
          url.searchParams.delete("_cb");
          window.history.replaceState({}, "", url.toString());
        } catch (e) {
          // ignore
        }
      };
      loadVersion();
    }
  }, []);

  // Función para aplicar la actualización automáticamente
  const applyUpdate = async () => {
    console.log("🔄 Aplicando actualización automática...");
    // try to unregister service workers to ensure fresh files are loaded
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          try {
            await r.unregister();
          } catch (e) {
            /* ignore */
          }
        }
      }
    } catch (e) {
      // ignore
    }
    // Force a full navigation bypassing browser cache by adding a cache-buster query param.
    // This avoids cases where a simple F5 or reload returns a cached index.html.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_cb", String(Date.now()));
      window.location.href = url.toString();
    } catch (e) {
      // fallback
      window.location.reload();
    }
  };

  // comprobar ahora: expuesto a window via evento
  const checkNow = async (): Promise<string | null> => {
    try {
      const res = await fetch("/version.json", { cache: "no-store" });
      if (!res.ok) return null;
      const j = await res.json();
      const ver = String(j.version || j?.ver || j?.v || "");
      if (!ver) return null;
      if (!currentVersion) {
        // first load wasn't set; set current and do not prompt
        setCurrentVersion(ver);
        return null;
      }
      if (ver && ver !== currentVersion) {
        return ver;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        const ver = String(j.version || j?.ver || j?.v || "");
        setCurrentVersion((prev) => prev || ver);
      } catch (e) {
        // ignore
      }
    };
    load();

    const interval = setInterval(async () => {
      try {
        const ver = await checkNow();
        if (ver) {
          console.log(
            `✨ Nueva versión detectada: ${ver}. Actualizando automáticamente...`,
          );
          // Aplicar la actualización automáticamente sin pedir confirmación
          await applyUpdate();
        }
      } catch (e) {
        // ignore
      }
    }, 60 * 1000); // check every 60s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentVersion]);

  // Listen for manual check events from the page
  useEffect(() => {
    const onCheck = async () => {
      const ver = await checkNow();
      if (ver) {
        console.log(
          `✨ Nueva versión detectada manualmente: ${ver}. Actualizando automáticamente...`,
        );
        await applyUpdate();
        window.dispatchEvent(
          new CustomEvent("app:check-update-result", {
            detail: { updated: true, availableVersion: ver },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("app:check-update-result", {
            detail: { updated: false },
          }),
        );
      }
    };
    window.addEventListener("app:check-update", onCheck as EventListener);
    return () =>
      window.removeEventListener("app:check-update", onCheck as EventListener);
  }, [currentVersion]);

  return (
    <StrictMode>
      <UpdateNotification
        show={showUpdateNotification}
        version={updatedVersion}
      />
      <App />
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);

// Auto-update on service worker messages
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    try {
      const data = event.data;
      if (data && data.type === "NEW_VERSION_AVAILABLE") {
        console.log(
          "🔄 Service Worker detectó nueva versión. Recargando automáticamente...",
        );
        // Recargar automáticamente sin pedir confirmación
        window.location.reload();
      }
    } catch (e) {
      // ignore
    }
  });
}
