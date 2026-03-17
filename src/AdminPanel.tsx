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
  | "gananciasNetas";

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

const AdminPanel: FC<AdminPanelProps> = ({ onSelect, user }) => {
  const { datos: datosNegocio } = useDatosNegocio();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );
  const [currentView, setCurrentView] = useState<string>(
    isDesktop ? "resultados" : "menu",
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isDesktop) setCurrentView((v) => (v === "menu" ? "resultados" : v));
  }, [isDesktop]);
  return (
    <div
      className="admin-panel-enterprise"
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
        --shadow-hover: 0 12px 32px rgba(0,0,0,0.12);
      }

      * {
        box-sizing: border-box;
      }

      .admin-panel-enterprise {
        min-height: 100vh;
        background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
        padding: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow-x: hidden;
      }
      
      .container {
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        max-width: none;
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      
      .header {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid var(--border);
        padding: 0.75rem 1.5rem;
        position: sticky;
        top: 0;
        z-index: 100;
        box-shadow: 0 2px 12px rgba(0,0,0,0.04);
      }
      
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin: 0;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--text-primary);
        text-decoration: none;
      }
      
      .user-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-secondary);
  background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #dbeafe 100%);
  border-radius: 10px;
  padding: 0.5rem 0.875rem;
  box-shadow: 0 4px 20px rgba(59,130,246,0.12);
  border: 1px solid #e0e7ff;
      }
      
      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: white;
        font-size: 0.95rem;
        box-shadow: 0 4px 16px rgba(59,130,246,0.3);
        flex-shrink: 0;
      }
      
      .user-details h1 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
      }
      
      .user-role {
        font-size: 0.75rem;
        color: #3b82f6;
        margin: 0;
        font-weight: 600;
        line-height: 1.2;
      }
      
      .main-content {
        padding: 3rem 2.5rem;
        max-width: 1400px;
        margin: 0 auto;
      }
      
      .welcome-section {
        text-align: center;
        margin-bottom: 4rem;
      }
      
      .welcome-title {
        font-size: clamp(2rem, 4vw, 3.5rem);
        font-weight: 800;
        background: linear-gradient(135deg, #1e293b 0%, #3b82f6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0 0 1rem 0;
        letter-spacing: -0.02em;
      }
      
      .welcome-subtitle {
        font-size: 1.125rem;
        color: var(--text-secondary);
        margin: 0;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        line-height: 1.6;
      }
      
      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 2rem;
      }
      
      .card {
        background: white;
        backdrop-filter: blur(16px);
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
        top: 0;
        left: 0;
        right: 0;
        height: 5px;
        background: var(--card-color);
        border-radius: 20px 20px 0 0;
      }
      
      .card:hover {
        transform: translateY(-8px) scale(1.02);
        background: white;
        border-color: var(--card-color);
        box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 0 0 3px rgba(59,130,246,0.1);
      }
      
      .card-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 1.5rem;
      }
      
      .card-icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        background: linear-gradient(135deg, var(--card-color), var(--card-color)cc);
        color: white;
        flex-shrink: 0;
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        transition: transform 0.3s ease;
      }
      
      .card:hover .card-icon {
        transform: scale(1.1) rotate(5deg);
      }

  /* Brand image: tamaño más pequeño por defecto, y más pequeño aún en móvil (avatar redondo) */
  .brand-image { width: 160px; height: 60px; border-radius: 8px; object-fit: cover; }
      
      .card-content h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
      }
      
      .card-subtitle {
        margin: 0;
        font-size: 0.9rem;
        color: #64748b;
        font-weight: 500;
      }
      
      .card-footer {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid #f1f5f9;
        display: flex;
        justify-content: flex-end;
      }
      
      .card-arrow {
        color: #cbd5e1;
        transition: all 0.3s ease;
        font-size: 1.25rem;
        font-weight: 700;
      }
      
      .card:hover .card-arrow {
        color: var(--card-color);
        transform: translateX(6px);
      }
      
      @media (max-width: 1024px) {
        .cards-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .main-content { padding: 2rem 1.5rem; }
        .header { padding: 1.5rem; }
      }
      
      @media (max-width: 768px) {
        .header-content { flex-direction: column; gap: 1rem; text-align: center; }
        .cards-grid { grid-template-columns: 1fr; max-width: 100%; }
        .main-content { padding: 1.5rem 1rem; }
        .header { padding: 1.5rem 1rem; }
        .welcome-section { margin-bottom: 2rem; }
      }
      
      @media (max-width: 480px) {
        .card { padding: 1.5rem; }
        .card-header { gap: 12px; }
        .card-icon { width: 48px; height: 48px; font-size: 1.5rem; }
      }
      /* Mejoras responsive para móviles y tablets */
      @media (max-width: 1024px) {
        .welcome-section { margin-bottom: 2rem; }
        .logo img { width: 280px !important; height: auto !important; }
      }

      @media (max-width: 768px) {
        .header { padding: 1rem; }
        .header-content { flex-direction: column; gap: 12px; align-items: stretch; }
        .logo { justify-content: center; }
        .user-info { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 12px; }
        .user-details { text-align: left; }
        .cards-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .card { padding: 1rem; }
        .card-header { gap: 12px; }
        .card-icon { width: 48px; height: 48px; font-size: 1.4rem; }
        .card-content h3 { font-size: 1.05rem; }
        .card-subtitle { font-size: 0.85rem; }
        .card-footer { justify-content: center; }
        /* hide header buttons and show floating ones */
        .user-info .btn-primary { display: none !important; }
        .floating-controls { display: flex !important; position: fixed; right: 16px; bottom: 18px; flex-direction: column; gap: 10px; z-index: 2000; }
        .floating-btn { width: 52px; height: 52px; border-radius: 999px; border: none; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 8px 20px rgba(7,23,48,0.12); cursor: pointer; }
        .floating-btn.logout { background: linear-gradient(135deg, #ef4444, #f59e0b); color: white; }
        .floating-btn.clave { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; }
  .brand-image { width: 44px !important; height: 44px !important; border-radius: 999px !important; object-fit: cover; }
      }

      @media (max-width: 420px) {
        .header { padding: 0.75rem; }
        .logo img { width: 200px !important; height: auto !important; }
        .user-info { padding: 10px; gap: 6px; }
        .user-avatar { width: 36px; height: 36px; font-size: 1rem; }
        .btn-primary { font-size: 0.95rem; padding: 10px; }
        .card { padding: 0.85rem; }
        .card-icon { width: 44px; height: 44px; }
      }

      /* Mobile minimal header: show only logo + nombre, hide user block and floating logout */
      @media (max-width: 600px) {
        .header { padding: 0.5rem 0.75rem; }
        .header-content { justify-content: flex-start; gap: 12px; }
        .logo { gap: 8px; font-size: 1rem; }
        .brand-image { width: 28px !important; height: 28px !important; border-radius: 6px !important; }
        .logo span { font-size: 0.95rem; font-weight: 700; }
        .user-info { display: none !important; }
      }

      /* Extra small screens: make logo even smaller */
      @media (max-width: 380px) {
        .brand-image { width: 24px !important; height: 24px !important; }
        .logo span { font-size: 0.9rem; }
        .header-content { gap: 8px; }
      }

      /* Evitar overflow en vistas dentro del layout de escritorio */
      .desktop-admin-layout { 
        box-sizing: border-box; 
        width: 100vw; 
        height: 100vh;
        overflow: hidden; 
        display: flex;
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
        box-sizing: border-box;
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
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sidebar-nav-subtitle {
        font-size: 0.7rem;
        color: #64748b;
        line-height: 1.2;
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
      .desktop-content { 
        flex: 1;
        height: 100vh;
        overflow-y: auto;
        overflow-x: hidden;
        background: #fafbfc;
        box-sizing: border-box;
        padding: 1.5rem;
        width: 0; /* Force flex item to respect container */
      }
      .desktop-content::-webkit-scrollbar { width: 8px; }
      .desktop-content::-webkit-scrollbar-track { background: #f1f5f9; }
      .desktop-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      
      /* Wrapper for views with strict containment */
      .view-wrapper {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow: hidden;
        box-sizing: border-box;
      }
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
        padding: 1rem !important;
        margin: 0 !important;
        overflow-x: hidden !important;
      }
      .view-wrapper .container { 
        max-width: 100% !important; 
        width: 100% !important; 
        margin: 0 auto !important; 
        padding: 1rem !important;
      }
      .view-wrapper .header { 
        position: static !important; 
        width: 100% !important;
        max-width: 100% !important;
      }
      .view-wrapper .table-container {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        margin: 0 !important;
      }
      .view-wrapper table { 
        max-width: 100% !important; 
        width: 100% !important; 
        display: table !important;
        table-layout: auto !important;
      }
      .view-wrapper img { max-width: 100% !important; height: auto; }
      .view-wrapper * { box-sizing: border-box; }
    `}</style>

      {isDesktop ? (
        <div className="desktop-admin-layout">
          <aside className="sidebar">
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
                    }}
                  >
                    🏪
                  </div>
                )}
                <div className="sidebar-title">
                  {datosNegocio.nombre_negocio}
                </div>
              </div>
            </div>
            <nav className="sidebar-nav">
              {cards.map((card) => (
                <button
                  key={card.view}
                  onClick={() => setCurrentView(card.view)}
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
          <section className="desktop-content">
            <div className="view-wrapper">
              {currentView === "usuarios" && (
                <UsuariosView onBack={() => setCurrentView("resultados")} />
              )}
              {currentView === "inventario" && (
                <InventarioView onBack={() => setCurrentView("resultados")} />
              )}
              {currentView === "movimientosInventario" && (
                <MovimientosInventarioView
                  onBack={() => setCurrentView("resultados")}
                />
              )}
              {currentView === "cai" && (
                <CaiFacturasView onBack={() => setCurrentView("resultados")} />
              )}
              {currentView === "resultados" && (
                <ResultadosView
                  onBack={() => setCurrentView("resultados")}
                  onVerFacturasEmitidas={() =>
                    setCurrentView("facturasEmitidas")
                  }
                />
              )}
              {currentView === "gastos" && (
                <GastosView onBack={() => setCurrentView("resultados")} />
              )}
              {currentView === "facturasEmitidas" && (
                <FacturasEmitidasView
                  onBack={() => setCurrentView("resultados")}
                />
              )}
              {currentView === "cierreadmin" && (
                <CierresAdminView
                  onVolver={() => setCurrentView("resultados")}
                />
              )}
              {currentView === "datosNegocio" && (
                <DatosNegocioView onBack={() => setCurrentView("resultados")} />
              )}
              {currentView === "gananciasNetas" && (
                <GananciasNetasView
                  onBack={() => setCurrentView("resultados")}
                />
              )}
            </div>
          </section>
        </div>
      ) : (
        <>
          <header className="header">
            <div className="header-content">
              <div className="logo">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  {datosNegocio.logo_url ? (
                    <img
                      src={datosNegocio.logo_url}
                      alt="Logo"
                      className="brand-image"
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: 10,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #667eea, #764ba2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.75rem",
                      }}
                    >
                      🏪
                    </div>
                  )}
                  <span
                    style={{
                      display: "block",
                      textAlign: "left",
                      fontWeight: 800,
                      fontSize: "1.25rem",
                      color: "#0f172a",
                      letterSpacing: "1px",
                    }}
                  >
                    {datosNegocio.nombre_negocio}
                  </span>
                </div>
              </div>
              <div className="user-info">
                <div className="user-avatar">
                  {user.nombre?.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <h1>{user.nombre}</h1>
                  <p className="user-role">Administrador</p>
                </div>
                <button
                  style={{
                    background:
                      "linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)",
                    color: "white",
                    fontWeight: 600,
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    padding: "0.5rem 0.875rem",
                    fontSize: "0.8125rem",
                  }}
                  onClick={() => setShowLogoutModal(true)}
                >
                  🔒 Salir
                </button>
              </div>
            </div>
          </header>

          {/* Botones flotantes (siempre visibles) */}
          <div className="floating-controls">
            <button
              className="floating-btn logout"
              onClick={() => setShowLogoutModal(true)}
            >
              🔒
            </button>
          </div>

          <main className="main-content">
            <div className="welcome-section">
              <h1 className="welcome-title">Panel de Control</h1>
            </div>
            <div className="cards-grid">
              {cards.map((card) => (
                <div
                  key={card.view}
                  className="card"
                  onClick={() => onSelect(card.view)}
                  style={{ "--card-color": card.color } as React.CSSProperties}
                >
                  <div className="card-header">
                    <div
                      className="card-icon"
                      style={
                        { "--card-color": card.color } as React.CSSProperties
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
        </>
      )}
      {/* Modal de cierre de sesión */}
      {showLogoutModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
              minWidth: "360px",
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
              style={{ display: "flex", gap: "1rem", justifyContent: "center" }}
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
                }}
                onClick={() => {
                  localStorage.removeItem("usuario");
                  window.location.href = "/";
                }}
              >
                Sí, cerrar sesión
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
                }}
                onClick={() => setShowLogoutModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Clave modal eliminado */}
    </div>
  );
};

export default AdminPanel;
