import { useState, useEffect, type FC } from "react";
import { supabase } from "./supabaseClient";
import { invalidarCacheDatosNegocio } from "./useDatosNegocio";

interface DatosNegocio {
  id?: number;
  nombre_negocio: string;
  rtn: string;
  direccion: string;
  celular: string;
  propietario: string;
  logo_url: string | null;
}

interface DatosNegocioViewProps {
  onBack: () => void;
}

const DatosNegocioView: FC<DatosNegocioViewProps> = ({ onBack }) => {
  const [datos, setDatos] = useState<DatosNegocio>({
    nombre_negocio: "",
    rtn: "",
    direccion: "",
    celular: "",
    propietario: "",
    logo_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "success" | "error";
    texto: string;
  } | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);

      // Intentar obtener el primer registro
      const { data, error } = await supabase
        .from("datos_negocio")
        .select("*")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error al cargar datos:", error);
        return;
      }

      if (data) {
        // Si existe un registro, cargarlo
        setDatos(data);
        if (data.logo_url) {
          setPreviewUrl(data.logo_url);
        }
      } else {
        // Si no existe ningún registro, crear uno por defecto
        const datosIniciales = {
          nombre_negocio: "",
          rtn: "",
          direccion: "",
          celular: "",
          propietario: "",
          logo_url: null,
        };

        const { data: nuevoRegistro, error: insertError } = await supabase
          .from("datos_negocio")
          .insert([datosIniciales])
          .select()
          .single();

        if (insertError) {
          console.error("Error al crear registro inicial:", insertError);
        } else if (nuevoRegistro) {
          setDatos(nuevoRegistro);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const subirLogo = async (): Promise<string | null> => {
    if (!logoFile) return datos.logo_url;

    try {
      // Eliminar logo anterior si existe
      if (datos.logo_url) {
        const oldFileName = datos.logo_url.split("/").pop();
        if (oldFileName) {
          await supabase.storage.from("logos-negocio").remove([oldFileName]);
        }
      }

      // Subir nuevo logo
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("logos-negocio")
        .upload(fileName, logoFile);

      if (uploadError) {
        console.error("Error al subir logo:", uploadError);
        return null;
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from("logos-negocio")
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Error al procesar logo:", error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);

    try {
      // Subir logo si hay uno nuevo
      let logoUrl = datos.logo_url;
      if (logoFile) {
        const newLogoUrl = await subirLogo();
        if (newLogoUrl) {
          logoUrl = newLogoUrl;
        }
      }

      // Preparar datos sin el ID (ya que haremos upsert)
      const { id, ...datosActualizados } = { ...datos, logo_url: logoUrl };

      if (id) {
        // Si existe ID, actualizar el registro existente
        const { error } = await supabase
          .from("datos_negocio")
          .update(datosActualizados)
          .eq("id", id);

        if (error) throw error;
      } else {
        // Si no existe ID (caso raro), obtener el primer registro y actualizarlo
        const { data: primerRegistro } = await supabase
          .from("datos_negocio")
          .select("id")
          .order("id", { ascending: true })
          .limit(1)
          .single();

        if (primerRegistro) {
          const { error } = await supabase
            .from("datos_negocio")
            .update(datosActualizados)
            .eq("id", primerRegistro.id);

          if (error) throw error;
        }
      }

      setMensaje({
        tipo: "success",
        texto: "✓ Datos actualizados correctamente",
      });

      // Invalidar cache para que se recarguen los datos en toda la app
      invalidarCacheDatosNegocio();

      await cargarDatos();
      setLogoFile(null);

      // Recargar la página para actualizar título y favicon
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Error al guardar:", error);
      setMensaje({
        tipo: "error",
        texto: error.message || "Error al actualizar los datos",
      });
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100vw",
          height: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            background: "rgba(255, 255, 255, 0.95)",
            padding: "3rem 4rem",
            borderRadius: "20px",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div
            style={{
              fontSize: "3.5rem",
              marginBottom: "1.5rem",
              animation: "pulse 2s infinite",
            }}
          >
            🏪
          </div>
          <p
            style={{
              color: "#1e293b",
              fontSize: "1.125rem",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Cargando información del negocio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="datos-negocio-view"
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      {/* Contenedor Principal */}
      <div
        className="datos-container"
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Header Card */}
        <div
          className="datos-header"
          style={{
            background: "rgba(255, 255, 255, 0.98)",
            borderRadius: "20px 20px 0 0",
            padding: "2rem 2.5rem",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div
            className="datos-header-content"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: "70px",
                height: "70px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
              }}
            >
              🏪
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "2rem",
                  fontWeight: 800,
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Datos del Negocio
              </h1>
              <p
                style={{
                  margin: "0.5rem 0 0 0",
                  color: "#64748b",
                  fontSize: "1rem",
                  fontWeight: 500,
                }}
              >
                Administra la información corporativa de tu empresa
              </p>
            </div>
          </div>
          <button
            onClick={onBack}
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              border: "none",
              borderRadius: "12px",
              padding: "0.875rem 1.75rem",
              color: "white",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 8px 25px rgba(102, 126, 234, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 15px rgba(102, 126, 234, 0.4)";
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>←</span>
            Regresar
          </button>
        </div>

        {/* Formulario Card */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.98)",
              borderRadius: "0 0 20px 20px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
              overflow: "hidden",
            }}
          >
            <div
              className="datos-form-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "400px 1fr",
                minHeight: "600px",
              }}
            >
              {/* Panel Izquierdo - Logo */}
              <div
                style={{
                  background:
                    "linear-gradient(180deg, #f8fafc 0%, #e0e7ff 100%)",
                  borderRight: "1px solid #e2e8f0",
                  padding: "3rem 2rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "280px",
                    textAlign: "center",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 2rem 0",
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#1e293b",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Logotipo
                  </h3>

                  <div
                    style={{
                      width: "240px",
                      height: "240px",
                      border: "3px dashed #cbd5e1",
                      borderRadius: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      background: previewUrl ? "white" : "#f1f5f9",
                      marginBottom: "2rem",
                      transition: "all 0.3s ease",
                      boxShadow: previewUrl
                        ? "0 8px 24px rgba(0, 0, 0, 0.1)"
                        : "none",
                    }}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Logo"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          padding: "1rem",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
                        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>
                          📷
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Sin imagen
                        </p>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "1rem 2rem",
                      background: "linear-gradient(135deg, #667eea, #764ba2)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: 700,
                      fontSize: "1rem",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 25px rgba(102, 126, 234, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 15px rgba(102, 126, 234, 0.3)";
                    }}
                  >
                    <span style={{ fontSize: "1.25rem" }}>📁</span>
                    Cargar Imagen
                  </label>
                  <p
                    style={{
                      marginTop: "1.25rem",
                      fontSize: "0.8125rem",
                      color: "#64748b",
                      lineHeight: 1.6,
                      fontWeight: 500,
                    }}
                  >
                    Formatos: PNG, JPG, WebP
                    <br />
                    Tamaño máximo: 2MB
                    <br />
                    Recomendado: 500x500px
                  </p>
                </div>
              </div>

              {/* Panel Derecho - Formulario */}
              <div
                className="datos-form-right"
                style={{ padding: "2rem 2rem" }}
              >
                <h3
                  style={{
                    margin: "0 0 2.5rem 0",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "#1e293b",
                  }}
                >
                  Información Empresarial
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "2rem",
                  }}
                >
                  {/* Nombre del Negocio */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "flex",
                        marginBottom: "0.75rem",
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "#1e293b",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>🏢</span>
                      Nombre del Negocio
                      <span style={{ color: "#ef4444", fontSize: "1.125rem" }}>
                        *
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={datos.nombre_negocio}
                      onChange={(e) =>
                        setDatos({ ...datos, nombre_negocio: e.target.value })
                      }
                      placeholder="Ej: Pollería Doña Concha"
                      style={{
                        width: "100%",
                        padding: "1rem 1.25rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        transition: "all 0.3s ease",
                        outline: "none",
                        boxSizing: "border-box",
                        background: "#f8fafc",
                        color: "#1e293b",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#667eea";
                        e.target.style.boxShadow =
                          "0 0 0 4px rgba(102, 126, 234, 0.1)";
                        e.target.style.background = "white";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#e2e8f0";
                        e.target.style.boxShadow = "none";
                        e.target.style.background = "#f8fafc";
                      }}
                    />
                  </div>

                  {/* RTN */}
                  <div>
                    <label
                      style={{
                        display: "flex",
                        marginBottom: "0.75rem",
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "#1e293b",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>🆔</span>
                      RTN
                      <span style={{ color: "#ef4444", fontSize: "1.125rem" }}>
                        *
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={datos.rtn}
                      onChange={(e) =>
                        setDatos({ ...datos, rtn: e.target.value })
                      }
                      placeholder="0000-0000-000000"
                      style={{
                        width: "100%",
                        padding: "1rem 1.25rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        transition: "all 0.3s ease",
                        outline: "none",
                        boxSizing: "border-box",
                        background: "#f8fafc",
                        color: "#1e293b",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#667eea";
                        e.target.style.boxShadow =
                          "0 0 0 4px rgba(102, 126, 234, 0.1)";
                        e.target.style.background = "white";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#e2e8f0";
                        e.target.style.boxShadow = "none";
                        e.target.style.background = "#f8fafc";
                      }}
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label
                      style={{
                        display: "flex",
                        marginBottom: "0.75rem",
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "#1e293b",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>📞</span>
                      Teléfono
                      <span style={{ color: "#ef4444", fontSize: "1.125rem" }}>
                        *
                      </span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={datos.celular}
                      onChange={(e) =>
                        setDatos({ ...datos, celular: e.target.value })
                      }
                      placeholder="+504 0000-0000"
                      style={{
                        width: "100%",
                        padding: "1rem 1.25rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        transition: "all 0.3s ease",
                        outline: "none",
                        boxSizing: "border-box",
                        background: "#f8fafc",
                        color: "#1e293b",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#667eea";
                        e.target.style.boxShadow =
                          "0 0 0 4px rgba(102, 126, 234, 0.1)";
                        e.target.style.background = "white";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#e2e8f0";
                        e.target.style.boxShadow = "none";
                        e.target.style.background = "#f8fafc";
                      }}
                    />
                  </div>

                  {/* Propietario */}
                  <div>
                    <label
                      style={{
                        display: "flex",
                        marginBottom: "0.75rem",
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "#1e293b",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>👤</span>
                      Propietario
                      <span style={{ color: "#ef4444", fontSize: "1.125rem" }}>
                        *
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={datos.propietario}
                      onChange={(e) =>
                        setDatos({ ...datos, propietario: e.target.value })
                      }
                      placeholder="Nombre del propietario"
                      style={{
                        width: "100%",
                        padding: "1rem 1.25rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        fontFamily: "inherit",
                        fontWeight: 600,
                        transition: "all 0.3s ease",
                        outline: "none",
                        boxSizing: "border-box",
                        background: "#f8fafc",
                        color: "#1e293b",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#667eea";
                        e.target.style.boxShadow =
                          "0 0 0 4px rgba(102, 126, 234, 0.1)";
                        e.target.style.background = "white";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#e2e8f0";
                        e.target.style.boxShadow = "none";
                        e.target.style.background = "#f8fafc";
                      }}
                    />
                  </div>

                  {/* Dirección - Ocupa toda la fila */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "flex",
                        marginBottom: "0.75rem",
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "#1e293b",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "1.25rem" }}>📍</span>
                      Dirección Completa
                      <span style={{ color: "#ef4444", fontSize: "1.125rem" }}>
                        *
                      </span>
                    </label>
                    <textarea
                      required
                      value={datos.direccion}
                      onChange={(e) =>
                        setDatos({ ...datos, direccion: e.target.value })
                      }
                      placeholder="Ingrese la dirección completa del establecimiento..."
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "1rem 1.25rem",
                        border: "2px solid #e2e8f0",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        fontFamily: "inherit",
                        fontWeight: 500,
                        transition: "all 0.3s ease",
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                        background: "#f8fafc",
                        lineHeight: 1.6,
                        color: "#1e293b",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#667eea";
                        e.target.style.boxShadow =
                          "0 0 0 4px rgba(102, 126, 234, 0.1)";
                        e.target.style.background = "white";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#e2e8f0";
                        e.target.style.boxShadow = "none";
                        e.target.style.background = "#f8fafc";
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con Botones y Mensajes */}
            <div
              style={{
                padding: "2rem 2.5rem",
                background: "linear-gradient(to right, #f8fafc, #f1f5f9)",
                borderTop: "2px solid #e2e8f0",
              }}
            >
              {/* Mensaje de Estado */}
              {mensaje && (
                <div
                  style={{
                    padding: "1.125rem 1.5rem",
                    borderRadius: "12px",
                    marginBottom: "1.5rem",
                    background:
                      mensaje.tipo === "success"
                        ? "linear-gradient(135deg, #d1fae5, #a7f3d0)"
                        : "linear-gradient(135deg, #fee2e2, #fecaca)",
                    border: `2px solid ${
                      mensaje.tipo === "success" ? "#10b981" : "#ef4444"
                    }`,
                    color: mensaje.tipo === "success" ? "#065f46" : "#991b1b",
                    fontWeight: 700,
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}>
                    {mensaje.tipo === "success" ? "✅" : "⚠️"}
                  </span>
                  {mensaje.texto}
                </div>
              )}

              {/* Botones de Acción */}
              <div
                style={{
                  display: "flex",
                  gap: "1.25rem",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    padding: "1rem 2rem",
                    background: "white",
                    border: "2px solid #cbd5e1",
                    borderRadius: "12px",
                    color: "#475569",
                    fontWeight: 700,
                    fontSize: "1rem",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.borderColor = "#94a3b8";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    padding: "1rem 2.5rem",
                    background: guardando
                      ? "#cbd5e1"
                      : "linear-gradient(135deg, #667eea, #764ba2)",
                    border: "none",
                    borderRadius: "12px",
                    color: "white",
                    fontWeight: 700,
                    fontSize: "1rem",
                    cursor: guardando ? "not-allowed" : "pointer",
                    boxShadow: guardando
                      ? "none"
                      : "0 6px 20px rgba(102, 126, 234, 0.4)",
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                  onMouseEnter={(e) => {
                    if (!guardando) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow =
                        "0 10px 30px rgba(102, 126, 234, 0.5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!guardando) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 6px 20px rgba(102, 126, 234, 0.4)";
                    }
                  }}
                >
                  {guardando ? (
                    <>
                      <span
                        style={{
                          animation: "spin 1s linear infinite",
                          display: "inline-block",
                          fontSize: "1.25rem",
                        }}
                      >
                        ⟳
                      </span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: "1.25rem" }}>💾</span>
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Estilos CSS Adicionales */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        /* Responsive design */
        @media (max-width: 1200px) {
          .datos-form-grid {
            grid-template-columns: 1fr !important;
          }
          .datos-negocio-view {
            padding: 1.5rem 0.75rem !important;
          }
        }
        
        @media (max-width: 768px) {
          .datos-header {
            padding: 1.5rem 1rem !important;
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .datos-header-content {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
          .datos-header-content > div:first-child {
            width: 50px !important;
            height: 50px !important;
            font-size: 1.5rem !important;
          }
          .datos-header-content h1 {
            font-size: 1.5rem !important;
          }
          .datos-header-content p {
            font-size: 0.875rem !important;
          }
          .datos-header button {
            width: 100% !important;
            justify-content: center !important;
          }
          .datos-form-grid > div {
            padding: 1.5rem 1rem !important;
          }
          div[style*="gridTemplateColumns"][style*="repeat(2, 1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
        
        @media (max-width: 640px) {
          .datos-negocio-view {
            padding: 1rem 0.5rem !important;
          }
          .datos-header {
            border-radius: 16px 16px 0 0 !important;
            padding: 1rem !important;
          }
          .datos-container {
            padding: 0 !important;
          }
          input, textarea, button {
            font-size: 16px !important;
          }
          .datos-header-content > div:first-child {
            width: 40px !important;
            height: 40px !important;
            font-size: 1.25rem !important;
          }
          .datos-header-content h1 {
            font-size: 1.25rem !important;
          }
          label {
            font-size: 0.875rem !important;
          }
        }
        /* Inputs and form adjustments */
        .datos-form-right input,
        .datos-form-right textarea,
        .datos-form-right select {
          min-width: 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .datos-form-right {
          padding: 2rem 2rem !important;
        }
        @media (max-width: 768px) {
          .datos-form-right { padding: 1rem !important; }
          .datos-form-grid { gap: 1rem !important; }
          .datos-form-right input,
          .datos-form-right textarea { padding: 0.75rem 1rem !important; font-size: 0.975rem !important; }
        }
        @media (max-width: 420px) {
          .datos-form-right { padding: 0.75rem !important; }
          .datos-form-right input,
          .datos-form-right textarea { padding: 0.6rem 0.75rem !important; font-size: 0.95rem !important; }
        }
      `}</style>
    </div>
  );
};

export default DatosNegocioView;
