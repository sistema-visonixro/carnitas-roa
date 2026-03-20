import type { FC } from "react";

type ViewType =
  | "home"
  | "puntoDeVenta"
  | "admin"
  | "usuarios"
  | "inventario"
  | "movimientosInventario"
  | "cai"
  | "resultados"
  | "gastos"
  | "facturasEmitidas"
  | "apertura"
  | "resultadosCaja"
  | "cajaOperada"
  | "cierreadmin"
  | "etiquetas"
  | "recibo"
  | "datosNegocio"
  | "gananciasNetas"
  | "creditosPendientes"
  | "proveedores";

const cards: {
  label: string;
  icon: string;
  view: ViewType;
  color: string;
  subtitle: string;
}[] = [
  {
    label: "Gestión de Usuarios",
    icon: "👥",
    view: "usuarios",
    color: "#1e88e5",
    subtitle: "Roles y permisos",
  },
  {
    label: "Control de Inventario",
    icon: "📦",
    view: "inventario",
    color: "#2e7d32",
    subtitle: "Stock y productos",
  },
  {
    label: "Movimientos y Producción",
    icon: "🏭",
    view: "movimientosInventario",
    color: "#1565c0",
    subtitle: "Kardex, recetas y lotes",
  },
  {
    label: "CAI y Facturación",
    icon: "🧾",
    view: "cai",
    color: "#f57c00",
    subtitle: "Documentos fiscales",
  },
  {
    label: "Reporte de Ventas",
    icon: "📊",
    view: "resultados",
    color: "#c62828",
    subtitle: "Análisis de ventas",
  },
  {
    label: "Registro de Gastos",
    icon: "💰",
    view: "gastos",
    color: "#6a1b9a",
    subtitle: "Control presupuestario",
  },
  {
    label: "Cierre de Caja",
    icon: "🔒",
    view: "cierreadmin",
    color: "#f57c00",
    subtitle: "Conciliación diaria",
  },
  {
    label: "Mis Datos",
    icon: "🏪",
    view: "datosNegocio",
    color: "#00897b",
    subtitle: "Información del negocio",
  },
  {
    label: "Ganancias Netas",
    icon: "📈",
    view: "gananciasNetas",
    color: "#0f766e",
    subtitle: "Rentabilidad y margen",
  },
  {
    label: "Créditos Pendientes",
    icon: "💳",
    view: "creditosPendientes",
    color: "#7c3aed",
    subtitle: "Cuentas por cobrar",
  },
  {
    label: "Proveedores y CxP",
    icon: "🏭",
    view: "proveedores",
    color: "#0f766e",
    subtitle: "Cuentas por pagar",
  },
];

interface AdminPanelProps {
  onSelect: (view: ViewType) => void;
  user: any;
}

import { useState, useEffect } from "react";
import { useDatosNegocio } from "./useDatosNegocio";
import UsuariosView from "./UsuariosView";
import InventarioView from "./InventarioView";
import MovimientosInventarioView from "./MovimientosInventarioView";
import CaiFacturasView from "./CaiFacturasView";
import ResultadosView from "./ResultadosView";
import GastosView from "./GastosView";
import FacturasEmitidasView from "./FacturasEmitidasView";
import CierresAdminView from "./CierresAdminView";
import DatosNegocioView from "./DatosNegocioView";
import GananciasNetasView from "./GananciasNetasView";
import CreditosPendientesView from "./CreditosPendientesView";
import ProveedoresCxPView from "./ProveedoresCxPView";

const AdminPanel: FC<AdminPanelProps> = (props) => {
  const { user } = props;
  const { datos: datosNegocio } = useDatosNegocio();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );

  const [currentView, setCurrentView] = useState<string>("menu");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const desk = window.innerWidth >= 1024;
      setIsDesktop(desk);
      if (desk) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleMenuClick = (view: string) => {
    setCurrentView(view);
    if (!isDesktop) setIsSidebarOpen(false);
  };

  return (
    <div
      className="admin-panel-enterprise"
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
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
        background: #f8fafc !important;
      }
      :root {
        --primary: #ffffff;
        --secondary: #f8fafc;
        --accent: #3b82f6;
        --text-primary: #0f172a;
        --text-secondary: #64748b;
        --border: #e2e8f0;
        --shadow: 0 4px 20px rgba(0,0,0,0.06);
        --card-color: #3b82f6;
      }

      * { box-sizing: border-box; }

      .admin-panel-enterprise {
        min-height: 100vh;
        background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow-x: hidden;
      }
      
      .desktop-admin-layout { 
        box-sizing: border-box; 
        width: 100%; 
        height: 100vh;
        overflow: hidden; 
        display: flex;
        position: relative;
      }
      
      .sidebar { 
        width: 260px;
        min-width: 260px;
        height: 100vh;
        overflow-y: auto;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        border-right: 1px solid #e2e8f0;
        box-shadow: 2px 0 8px rgba(0,0,0,0.04);
        display: flex;
        flex-direction: column;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 1000;
        position: relative;
      }
      .sidebar::-webkit-scrollbar { width: 6px; }
      .sidebar::-webkit-scrollbar-track { background: transparent; }
      .sidebar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      
      .sidebar-header {
        padding: 1.5rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        background: white;
      }
      
      .sidebar-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        text-decoration: none;
      }
      .sidebar-logo img, .sidebar-logo > div {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
      }
      .sidebar-title {
        font-size: 0.95rem;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.2;
      }
      
      .sidebar-nav {
        flex: 1;
        padding: 1rem 0.75rem;
        overflow-y: auto;
      }
      .sidebar-nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: all 0.2s ease;
        margin-bottom: 4px;
      }
      .sidebar-nav-item:hover {
        background: #f1f5f9;
        transform: translateX(2px);
      }
      .sidebar-nav-item.active {
        background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%);
        border-left: 3px solid #3b82f6;
        font-weight: 600;
      }
      .sidebar-nav-icon {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        flex-shrink: 0;
      }
      .sidebar-nav-text {
        flex: 1;
        min-width: 0;
      }
      .sidebar-nav-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #0f172a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sidebar-nav-subtitle {
        font-size: 0.7rem;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .sidebar-footer {
        padding: 1rem;
        border-top: 1px solid #e2e8f0;
        background: white;
      }
      .sidebar-logout-btn {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%);
        color: white;
        border: none;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(239,68,68,0.2);
      }
      .sidebar-logout-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(239,68,68,0.3);
      }

      .mobile-close-btn {
        display: none;
        position: absolute;
        top: 25px;
        right: 15px;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #64748b;
        padding: 0;
        z-index: 10;
        width: 40px;
        height: 40px;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
      }
      .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(4px);
        z-index: 999;
      }

      .desktop-content { 
        flex: 1;
        height: 100vh;
        overflow-y: auto;
        overflow-x: hidden;
        background: #fafbfc;
        width: 0; 
        display: flex;
        flex-direction: column;
      }
      .desktop-content::-webkit-scrollbar { width: 8px; }
      .desktop-content::-webkit-scrollbar-track { background: #f1f5f9; }
      .desktop-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      
      .mobile-header {
        display: none;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid var(--border);
        box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      
      .mobile-header-left {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .hamburger-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #0f172a;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mobile-header-title {
        font-weight: 800;
        color: #0f172a;
        font-size: 1.1rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mobile-header-logo {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        object-fit: cover;
      }
      
      .view-wrapper {
        flex: 1;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        padding: 1.5rem;
        overflow-x: hidden;
        box-sizing: border-box;
      }

      .main-content {
        max-width: 1400px;
        margin: 0 auto;
      }
      
      .welcome-section {
        text-align: center;
        margin-bottom: 3rem;
        margin-top: 1rem;
      }
      .welcome-title {
        font-size: clamp(1.8rem, 4vw, 3rem);
        font-weight: 800;
        background: linear-gradient(135deg, #1e293b 0%, #3b82f6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0 0 1rem 0;
      }

      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 2rem;
      }
      .card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        padding: 2rem;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 5px;
        background: var(--card-color);
        border-radius: 20px 20px 0 0;
      }
      .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 30px rgba(0,0,0,0.08);
      }
      .card-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 1.5rem;
      }
      .card-icon {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        background: linear-gradient(135deg, var(--card-color), var(--card-color)cc);
        color: white;
        flex-shrink: 0;
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
      }
      .card-content h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: #0f172a;
      }
      .card-subtitle {
        margin: 0;
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 500;
      }
      .card-footer {
        padding-top: 1rem;
        border-top: 1px solid #f1f5f9;
        display: flex;
        justify-content: flex-end;
      }
      .card-arrow {
        color: #cbd5e1;
        font-size: 1.25rem;
        font-weight: 700;
      }

      /* View-wrapper overrides for internal views */
      .view-wrapper > * { 
        max-width: 100% !important; 
        width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
      }
      .view-wrapper .admin-panel-enterprise,
      .view-wrapper .cierres-enterprise,
      .view-wrapper .usuarios-enterprise,
      .view-wrapper > div[style*="100vw"],
      .view-wrapper > div[style*="100vh"] { 
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: auto !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow-x: hidden !important;
      }
      .view-wrapper .table-container {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: auto !important;
      }

      @media (max-width: 1024px) {
        .sidebar {
           position: fixed;
           top: 0;
           left: 0;
           transform: translateX(-100%);
        }
        .sidebar.open {
           transform: translateX(0);
        }
        .sidebar-overlay {
           display: block;
        }
        .mobile-close-btn {
           display: flex;
        }
        .mobile-header {
           display: flex;
        }
        .view-wrapper {
           padding: 1rem;
        }
        .cards-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .card { padding: 1.5rem; }
        .card-icon { width: 48px; height: 48px; font-size: 1.5rem; }
        .welcome-section { margin-bottom: 2rem; }
      }

      @media (max-width: 480px) {
        .cards-grid { grid-template-columns: 1fr; }
        .mobile-header-title { font-size: 1rem; }
      }
      `}</style>

      <div className="desktop-admin-layout">
        <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
          <button
            className="mobile-close-btn"
            onClick={() => setIsSidebarOpen(false)}
          >
            ✕
          </button>

          <div className="sidebar-header">
            <div className="sidebar-logo">
              {datosNegocio.logo_url ? (
                <img src={datosNegocio.logo_url} alt="Logo" />
              ) : (
                <div
                  style={{
                    background: "linear-gradient(135deg, #667eea, #764ba2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem",
                    color: "white",
                  }}
                >
                  🏪
                </div>
              )}
              <div className="sidebar-title">
                {datosNegocio.nombre_negocio || "Admin Panel"}
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#64748b",
                    fontWeight: "normal",
                    marginTop: "4px",
                  }}
                >
                  Usuario: {user?.nombre || "Admin"}
                </div>
              </div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button
              onClick={() => handleMenuClick("menu")}
              className={`sidebar-nav-item ${currentView === "menu" ? "active" : ""}`}
            >
              <div
                className="sidebar-nav-icon"
                style={{ background: "#475569", color: "white" }}
              >
                🏠
              </div>
              <div className="sidebar-nav-text">
                <div className="sidebar-nav-label">Dashboard</div>
                <div className="sidebar-nav-subtitle">Vista General</div>
              </div>
            </button>

            {cards.map((card) => (
              <button
                key={card.view}
                onClick={() => handleMenuClick(card.view)}
                className={`sidebar-nav-item ${
                  currentView === card.view ? "active" : ""
                }`}
              >
                <div
                  className="sidebar-nav-icon"
                  style={{ background: card.color, color: "white" }}
                >
                  {card.icon}
                </div>
                <div className="sidebar-nav-text">
                  <div className="sidebar-nav-label">{card.label}</div>
                  <div className="sidebar-nav-subtitle">{card.subtitle}</div>
                </div>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="sidebar-logout-btn"
            >
              🔒 Salir
            </button>
          </div>
        </aside>

        {isSidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        <section className="desktop-content">
          <div className="mobile-header">
            <div className="mobile-header-left">
              <button
                className="hamburger-btn"
                onClick={() => setIsSidebarOpen(true)}
              >
                ☰
              </button>
              <div className="mobile-header-title">
                {datosNegocio.logo_url ? (
                  <img
                    src={datosNegocio.logo_url}
                    alt="Logo"
                    className="mobile-header-logo"
                  />
                ) : (
                  <span>🏪</span>
                )}
                <span>{datosNegocio.nombre_negocio || "Admin"}</span>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                    marginLeft: "8px",
                    fontWeight: "normal",
                  }}
                >
                  ({user?.nombre || ""})
                </span>
              </div>
            </div>
          </div>

          <div className="view-wrapper">
            {currentView === "menu" && (
              <main className="main-content">
                <div className="welcome-section">
                  <h1 className="welcome-title">Panel de Control</h1>
                  <p style={{ color: "#64748b", margin: 0 }}>
                    Bienvenido, selecciona una opción para comenzar.
                  </p>
                </div>
                <div className="cards-grid">
                  {cards.map((card) => (
                    <div
                      key={card.view}
                      className="card"
                      onClick={() => handleMenuClick(card.view)}
                      style={
                        { "--card-color": card.color } as React.CSSProperties
                      }
                    >
                      <div className="card-header">
                        <div
                          className="card-icon"
                          style={
                            {
                              "--card-color": card.color,
                            } as React.CSSProperties
                          }
                        >
                          {card.icon}
                        </div>
                        <div className="card-content">
                          <h3>{card.label}</h3>
                          <p className="card-subtitle">{card.subtitle}</p>
                        </div>
                      </div>
                      <div className="card-footer">
                        <span className="card-arrow">→</span>
                      </div>
                    </div>
                  ))}
                </div>
              </main>
            )}

            {currentView === "usuarios" && (
              <UsuariosView onBack={() => setCurrentView("menu")} />
            )}
            {currentView === "inventario" && (
              <InventarioView onBack={() => setCurrentView("menu")} />
            )}
            {currentView === "movimientosInventario" && (
              <MovimientosInventarioView
                onBack={() => setCurrentView("menu")}
              />
            )}
            {currentView === "cai" && (
              <CaiFacturasView onBack={() => setCurrentView("menu")} />
            )}
            {currentView === "resultados" && (
              <ResultadosView
                onBack={() => setCurrentView("menu")}
                onVerFacturasEmitidas={() => setCurrentView("facturasEmitidas")}
              />
            )}
            {currentView === "gastos" && (
              <GastosView onBack={() => setCurrentView("menu")} />
            )}
            {currentView === "facturasEmitidas" && (
              <FacturasEmitidasView
                onBack={() => setCurrentView("resultados")}
              />
            )}
            {currentView === "cierreadmin" && (
              <CierresAdminView onVolver={() => setCurrentView("menu")} />
            )}
            {currentView === "datosNegocio" && (
              <DatosNegocioView onBack={() => setCurrentView("menu")} />
            )}
            {currentView === "gananciasNetas" && (
              <GananciasNetasView onBack={() => setCurrentView("menu")} />
            )}
            {currentView === "creditosPendientes" && (
              <CreditosPendientesView onBack={() => setCurrentView("menu")} />
            )}
            {currentView === "proveedores" && (
              <ProveedoresCxPView onBack={() => setCurrentView("menu")} />
            )}
          </div>
        </section>
      </div>

      {showLogoutModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "2.5rem 3rem",
              minWidth: "320px",
              maxWidth: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              textAlign: "center",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
            <h2
              style={{
                color: "#0f172a",
                fontWeight: 800,
                marginBottom: "1rem",
                fontSize: "1.5rem",
              }}
            >
              Cerrar sesión
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "1.05rem",
                marginBottom: "2rem",
                lineHeight: 1.6,
              }}
            >
              ¿Estás seguro que deseas cerrar tu sesión actual?
            </p>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                style={{
                  background:
                    "linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)",
                  color: "white",
                  fontWeight: 700,
                  border: "none",
                  borderRadius: "12px",
                  padding: "0.85rem 2rem",
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(239,68,68,0.25)",
                  transition: "all 0.3s ease",
                  flex: "1 1 auto",
                }}
                onClick={() => {
                  localStorage.removeItem("usuario");
                  window.location.href = "/";
                }}
              >
                Cerrar sesión
              </button>
              <button
                style={{
                  background: "#f1f5f9",
                  color: "#0f172a",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "12px",
                  padding: "0.85rem 2rem",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  flex: "1 1 auto",
                }}
                onClick={() => setShowLogoutModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
