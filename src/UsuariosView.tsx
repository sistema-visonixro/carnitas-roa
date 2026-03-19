import AdminEditModal from "./AdminEditModal";
// ...existing code...
import { useEffect, useState } from "react";

interface Usuario {
  id: string;
  nombre: string;
  codigo: string;
  clave: string;
  rol: string;
  email?: string;
  caja?: string;
  ip?: string;
}

interface UsuariosViewProps {
  onBack: () => void;
}

export default function UsuariosView({ onBack }: UsuariosViewProps) {
  // Estados para el modal de edición de Admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEditId, setAdminEditId] = useState<string | null>(null);
  const [adminNombre, setAdminNombre] = useState("");
  const [adminClave, setAdminClave] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const handleAdminUpdate = (adminUser: Usuario) => {
    setAdminNombre(adminUser.nombre || "");
    setAdminClave("");
    setAdminEmail(adminUser.email || "");
    setAdminEditId(adminUser.id);
    setShowAdminModal(true);
  };

  const handleAdminModalClose = () => {
    setShowAdminModal(false);
    setAdminEditId(null);
    setAdminNombre("");
    setAdminClave("");
    setAdminError("");
  };

  const handleAdminModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Debe tener mínimo 6 caracteres, al menos una letra y un signo
    if (
      !/^.*(?=.{6,})(?=.*[A-Za-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).*$/.test(
        adminClave,
      )
    ) {
      setAdminError(
        "La contraseña debe tener mínimo 6 caracteres, incluir una letra y un signo.",
      );
      return;
    }
    setAdminLoading(true);
    setAdminError("");
    try {
      await fetch(`${API_URL}?id=eq.${adminEditId}`, {
        method: "PATCH",
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          nombre: adminNombre,
          clave: adminClave,
          email: adminEmail,
        }),
      });
      // Recargar datos
      const res = await fetch(API_URL + "?select=*", {
        headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
      });
      const nuevosUsuarios = await res.json();
      setUsuarios(nuevosUsuarios);
      handleAdminModalClose();
    } catch {
      setAdminError("Error al guardar cambios");
    }
    setAdminLoading(false);
  };
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Partial<Usuario>>({});
  const [showModal, setShowModal] = useState(false);
  // Lista de cajas sugeridas (puedes modificar o cargar dinámicamente)
  const cajasDisponibles = ["caja1", "caja2", "caja3", "caja4", "caja5"];
  const [editId, setEditId] = useState<string | null>(null);

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/usuarios`;
  const API_KEY = import.meta.env.VITE_SUPABASE_KEY || "";

  // Cargar usuarios
  useEffect(() => {
    fetch(API_URL + "?select=*", {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUsuarios(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Error al cargar usuarios");
        setLoading(false);
      });
  }, []);

  // ✅ CORREGIDO: Cálculos de límites (DESPUÉS de hooks)
  const totalUsuarios = usuarios.length;
  const adminCount = usuarios.filter((u) => u.rol === "Admin").length;
  const cajeroCount = usuarios.filter((u) => u.rol === "cajero").length;

  const limiteTotal = totalUsuarios >= 6;
  const limiteAdmin = form.rol === "admin" && adminCount >= 1;
  const limiteCajero = form.rol === "cajero" && cajeroCount >= 5;
  const limitePorRol = limiteAdmin || limiteCajero;

  const errorLimite = limiteTotal
    ? "No se pueden agregar más de 6 usuarios."
    : limiteAdmin
      ? "Solo puede haber 1 usuario admin."
      : limiteCajero
        ? "Solo puede haber 5 cajeros."
        : "";

  // Crear o editar usuario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limiteTotal || limitePorRol) {
      setError(errorLimite);
      return;
    }
    // Validación de contraseña: mínimo 6 caracteres, al menos una letra y un signo
    const clave = form.clave || "";
    if (
      !/^.*(?=.{6,})(?=.*[A-Za-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).*$/.test(
        clave,
      )
    ) {
      setError(
        "La contraseña debe tener mínimo 6 caracteres, incluir una letra y un signo.",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Forzar el valor del rol a 'cajero' o 'admin' según el select
      const rolVal =
        form.rol === "cajero" || form.rol === "admin" ? form.rol : "cajero";
      const formToSend = { ...form, rol: rolVal };
      if (editId) {
        await fetch(`${API_URL}?id=eq.${editId}`, {
          method: "PATCH",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(formToSend),
        });
      } else {
        await fetch(API_URL, {
          method: "POST",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(formToSend),
        });
      }
      setForm({});
      setEditId(null);
      // Recargar datos
      const res = await fetch(API_URL + "?select=*", {
        headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
      });
      setUsuarios(await res.json());
    } catch {
      setError("Error al guardar usuario");
    }
    setLoading(false);
  };

  // Eliminada la función de eliminación para prohibir borrar usuarios desde la UI;
  // solo se permite actualizar/editar usuarios.

  const handleEdit = (usuario: Usuario) => {
    setEditId(usuario.id);
    setForm({
      nombre: usuario.nombre || "",
      codigo: usuario.codigo || "",
      clave: "", // Nunca mostrar la clave anterior
      rol: usuario.rol || "cajero",
      email: usuario.email || "",
      caja: usuario.caja || "",
      ip: usuario.ip || "",
    });
    setShowModal(true);
  };

  // const handleNew = () => {}; // Eliminado para evitar error TS6133

  return (
    <div
      className="usuarios-enterprise"
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
        }

        .usuarios-enterprise {
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

        .container {
          max-width: 1400px;
          margin: 0 auto;
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
          background: #f1f5f9;
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

        .btn-back:hover {
          background: #e2e8f0;
          border-color: var(--accent);
        }

        .page-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59,130,246,0.4);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .main-content {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: var(--shadow);
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--accent);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .table-container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
          margin-bottom: 2rem;
          border: 1px solid var(--border);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th {
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border);
        }

        .table td {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }

        .table tr:hover {
          background: #f8fafc;
        }

        .btn-table {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight:#dbeafe; 
          color: #3b82f6; 
        }

        .btn-edit:hover { 
          background: #bfdbfe; 
          transform: scale(1.05);
        }

        .btn-delete { 
          background: #fee2e2; 
          color: #ef4444; 
        }

        .btn-delete:hover { 
          background: #fecaca; 
          transform: scale(1.05);
        }

        .form-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-input {
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          color: var(--text-primary);
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
          background: #fff;
        }

        .error {
          background: #fee2e2;
          color: #ef4444;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid var(--danger);
          margin-bottom: 1rem;
        }

        .form-input::placeholder {
          color: var(--text-secondary);
        }

        /* Cards para móvil */
        .cards-grid { display: none; }
        .user-card { 
          background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 16px; 
          display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); 
          transition: all 0.2s ease;
        }
        .user-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .user-card-header { display: flex; align-items: center; gap: 12px; }
        .user-avatar-sm { width: 50px; height: 50px; border-radius: 12px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size: 20px; color:#fff; background:linear-gradient(135deg,#3b82f6,#8b5cf6); flex-shrink:0; }
        .user-body { flex:1; min-width:0; }
        .user-name { font-size: 16px; font-weight:800; color:var(--text-primary); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-meta { color:var(--text-secondary); font-size:13px; font-family: monospace; }
        .user-card-details { background: #f8fafc; border-radius: 8px; padding: 12px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .user-card-actions { display: flex; gap: 8px; margin-top: 4px; }
        
        .role-badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .role-admin { background: #dbeafe; color: #1e40af; }
        .role-cajero { background: #dcfce7; color: #16a34a; }

        .loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .header { padding: 1rem; flex-direction: column; gap: 1rem; }
          .main-content { padding: 1rem; }
          .form-grid { grid-template-columns: 1fr; }
          .table { display: none; }
          .table-container { box-shadow: none; border: none; background: transparent; }
          .cards-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
          .stats-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>
            ← Volver
          </button>
          <h1 className="page-title">Gestión de Usuarios</h1>
        </div>
      </header>

      <main className="main-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{totalUsuarios}</div>
            <div className="stat-label">Total Usuarios</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{adminCount}</div>
            <div className="stat-label">Administradores</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{cajeroCount}</div>
            <div className="stat-label">Cajeros</div>
          </div>
        </div>

        {/* Error */}
        {(error || errorLimite) && (
          <div className="error">⚠️ {error || errorLimite}</div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="loading">⏳ Cargando usuarios...</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Caja</th>
                  <th>IP</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios
                  .map((u) => (
                    <tr key={u.id}>
                      <td style={{ color: "#43a047", fontWeight: 700 }}>
                        {u.id}
                      </td>
                      <td>
                        <strong>{u.nombre}</strong>
                      </td>
                      <td>{u.codigo}</td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {u.email || "-"}
                      </td>
                      <td
                        style={{
                          color:
                            u.rol === "admin"
                              ? "#1e88e5"
                              : u.rol === "sub-Admin"
                                ? "#f57c00"
                                : "#4caf50",
                        }}
                      >
                        {u.rol}
                      </td>
                      <td style={{ color: "#43a047", fontWeight: 700 }}>
                        {u.caja || "-"}
                      </td>
                      <td>{u.ip || "-"}</td>
                      <td>
                        {u.rol !== "Admin" && (
                          <button
                            className="btn-table btn-edit"
                            onClick={() => handleEdit(u)}
                          >
                            Editar
                          </button>
                        )}
                        {u.rol === "Admin" && (
                          <button
                            className="btn-table btn-update"
                            onClick={() => handleAdminUpdate(u)}
                            style={{
                              background: "#1976d2",
                              color: "#fff",
                              marginLeft: 8,
                            }}
                          >
                            Actualizar
                          </button>
                        )}
                        {/* Eliminado botón de eliminar: sólo se permite editar/actualizar */}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="cards-grid" style={{ marginTop: 8 }}>
              {usuarios.map((u) => (
                  <div className="user-card" key={u.id}>
                    <div className="user-card-header">
                      <div className="user-avatar-sm" style={{ background: u.rol === 'Admin' ? 'linear-gradient(135deg,#1e40af,#3b82f6)' : 'linear-gradient(135deg,#16a34a,#4ade80)' }}>
                        {u.nombre?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="user-body">
                        <div className="user-name">{u.nombre}</div>
                        <div className="user-meta">Code: {u.codigo}</div>
                      </div>
                      <div>
                        <span className={`role-badge ${u.rol === 'Admin' ? 'role-admin' : 'role-cajero'}`}>{u.rol}</span>
                      </div>
                    </div>
                    
                    <div className="user-card-details">
                       <div><strong>Caja:</strong><br/>{u.caja || 'Ninguna'}</div>
                       <div><strong>IP:</strong><br/>{u.ip || '—'}</div>
                    </div>
                    
                    <div className="user-card-actions">
                      {u.rol !== "Admin" && (
                        <button className="btn-table btn-edit" onClick={() => handleEdit(u)} style={{ flex: 1, padding: '10px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a' }}>
                          Editar Usuario
                        </button>
                      )}
                      {u.rol === "Admin" && (
                        <button className="btn-table btn-update" onClick={() => handleAdminUpdate(u)} style={{ flex: 1, padding: '10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: '6px' }}>
                          Actualizar Admin
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Botón para abrir modal de nuevo usuario */}
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <button
            style={{
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 32px",
              fontWeight: 700,
              fontSize: 18,
              cursor: "pointer",
              boxShadow: "0 2px 8px #1976d222",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => {
              setEditId(null);
              setForm({
                nombre: "",
                codigo: "",
                clave: "",
                rol: "cajero",
                caja: "",
                ip: "",
              });
              setTimeout(() => setShowModal(true), 0);
            }}
          >
            <span role="img" aria-label="nuevo usuario">
              👤
            </span>{" "}
            Nuevo Usuario
          </button>
        </div>

        {/* Modal para crear/editar usuario */}
        <AdminEditModal
          open={showAdminModal}
          nombre={adminNombre}
          clave={adminClave}
          email={adminEmail}
          loading={adminLoading}
          error={adminError}
          onClose={handleAdminModalClose}
          onChangeNombre={setAdminNombre}
          onChangeClave={setAdminClave}
          onChangeEmail={setAdminEmail}
          onSubmit={handleAdminModalSubmit}
        />
        {showModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(30,41,59,0.45)",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 20,
                padding: "32px 32px 28px",
                minWidth: 340,
                maxWidth: 440,
                width: "92%",
                boxShadow: "0 24px 64px rgba(30,41,59,0.18), 0 0 0 1px rgba(100,116,139,0.1)",
                position: "relative",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: "#6366f1", textTransform: "uppercase", marginBottom: 3 }}>
                    {editId ? "Editando" : "Nuevo registro"}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                    {editId ? "✏️ Editar Usuario" : "👤 Nuevo Usuario"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    color: "#64748b",
                    borderRadius: 10,
                    width: 36,
                    height: 36,
                    cursor: "pointer",
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#1e293b"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
                >
                  ✕
                </button>
              </div>

              {/* Separador */}
              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)", marginBottom: 22 }} />

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Nombre */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Nombre completo *</label>
                  <input
                    type="text"
                    placeholder="Ej: Juan Pérez"
                    value={form.nombre || ""}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", outline: "none", transition: "border 150ms", boxSizing: "border-box", background: "#f8fafc" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
                  />
                </div>

                {/* Código */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Código único *</label>
                  <input
                    type="text"
                    placeholder="Ej: USR001"
                    value={form.codigo || ""}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", outline: "none", transition: "border 150ms", boxSizing: "border-box", background: "#f8fafc" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
                  />
                </div>

                {/* Contraseña */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Contraseña *</label>
                  <input
                    type="password"
                    placeholder="Mínimo 4 caracteres"
                    value={form.clave || ""}
                    onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", outline: "none", transition: "border 150ms", boxSizing: "border-box", background: "#f8fafc" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
                  />
                </div>

                {/* Rol (fijo cajero) */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Rol</label>
                  <div style={{ padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#64748b", background: "#f1f5f9" }}>Cajero</div>
                </div>

                {/* Caja */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Caja asignada *</label>
                  <select
                    value={form.caja || ""}
                    onChange={(e) => setForm((f) => ({ ...f, caja: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", outline: "none", transition: "border 150ms", boxSizing: "border-box", background: "#f8fafc", cursor: "pointer" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
                  >
                    <option value="">Seleccionar caja...</option>
                    {cajasDisponibles
                      .filter((caja) => {
                        const ocupada = usuarios.some(
                          (u) => u.caja === caja && (!editId || u.id !== editId),
                        );
                        return !ocupada || (editId && form.caja === caja);
                      })
                      .map((caja) => (
                        <option key={caja} value={caja}>{caja}</option>
                      ))}
                  </select>
                </div>

                {/* Separador */}
                <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />

                {/* Botones */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "11px 0", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 150ms" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || limiteTotal || limitePorRol}
                    style={{ flex: 2, padding: "11px 0", border: "none", borderRadius: 10, background: loading || limiteTotal || limitePorRol ? "#c7d2fe" : "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: loading || limiteTotal || limitePorRol ? "not-allowed" : "pointer", transition: "all 150ms", boxShadow: loading || limiteTotal || limitePorRol ? "none" : "0 4px 14px rgba(99,102,241,0.35)" }}
                    onMouseEnter={(e) => { if (!loading && !limiteTotal && !limitePorRol) e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {loading ? "⏳ Guardando..." : editId ? "💾 Guardar Cambios" : "✅ Crear Usuario"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
