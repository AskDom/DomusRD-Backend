import React, { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useProperties } from "../context/PropertiesContext";
import { useToast } from "../context/ToastContext";

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "propiedades";
  const { currentUser, logout } = useAuth();
  const { getFavoriteProperties, getUserProperties, deleteProperty, updateProperty, verifyProperty } = useProperties();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-200 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-6xl mb-4">🔒</p>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Acceso restringido</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Debes iniciar sesión para ver tu perfil</p>
          <Link to="/" className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  const myProperties = getUserProperties(currentUser.id);
  const favoriteProperties = getFavoriteProperties();

  const startEdit = (prop) => {
    setEditingId(prop.id);
    setEditForm({ title: prop.title, price: prop.price, status: prop.status, type: prop.type, description: prop.description });
  };

  const saveEdit = () => {
    updateProperty(editingId, editForm);
    setEditingId(null);
    toast({ message: "Propiedad actualizada correctamente", type: "success" });
  };

  const handleDelete = (id) => {
    deleteProperty(id);
    setConfirmDelete(null);
    toast({ message: "Propiedad eliminada", type: "info" });
  };

  const handleVerify = (id) => {
    verifyProperty(id);
    toast({ message: "¡Propiedad verificada! ✓", type: "success" });
  };

  const handleStatusChange = (id, newStatus) => {
    updateProperty(id, { status: newStatus });
    const messages = {
      "Vendido": "Propiedad marcada como Vendida 🎉",
      "Rentado": "Propiedad marcada como Rentada 🎉",
      "Venta": "Propiedad volvió a estado En Venta",
      "Renta": "Propiedad volvió a estado En Renta",
    };
    toast({ message: messages[newStatus] || "Estado actualizado", type: "success" });
  };

  const inputClass = "w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors";

  const tabs = [
    { key: "propiedades", label: "Mis propiedades", icon: "🏠", count: myProperties.length },
    { key: "favoritos", label: "Favoritos", icon: "❤️", count: favoriteProperties.length },
    { key: "cuenta", label: "Mi cuenta", icon: "👤" },
  ];

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-300">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* HEADER PERFIL */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md p-6 mb-6 flex items-center gap-5 transition-colors">
          <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{currentUser.name}</h1>
            <p className="text-gray-400 text-sm">{currentUser.email}</p>
            <span className={`text-xs font-bold px-3 py-1 rounded-full mt-1 inline-block ${
              currentUser.role === "Agente"
                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                : currentUser.role === "Vendedor"
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
            }`}>
              {currentUser.role === "Agente" ? "⭐ Agente" :
               currentUser.role === "Vendedor" ? "🏠 Vendedor" :
               "👤 Cliente"}
            </span>
          </div>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            🚪 Cerrar sesión
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6 bg-white dark:bg-gray-800 rounded-2xl p-1.5 shadow transition-colors">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSearchParams({ tab: tab.key })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── MIS PROPIEDADES ── */}
        {activeTab === "propiedades" && (
          <div>
            {myProperties.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl shadow-md transition-colors">
                <p className="text-5xl mb-3">🏚️</p>
                <p className="text-gray-500 dark:text-gray-400 font-semibold">No has publicado ninguna propiedad aún</p>
                <Link to="/publish" className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition">
                  + Publicar ahora
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myProperties.map((prop) => (
                  <div key={prop.id} className="bg-white dark:bg-gray-800 rounded-3xl shadow-md overflow-hidden transition-colors">

                    {/* MODAL CONFIRMACIÓN BORRAR */}
                    {confirmDelete === prop.id && (
                      <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-4 flex items-center justify-between">
                        <p className="text-red-600 dark:text-red-400 font-semibold text-sm">⚠️ ¿Eliminar esta propiedad? Esta acción no se puede deshacer.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition">Cancelar</button>
                          <button onClick={() => handleDelete(prop.id)} className="px-4 py-2 rounded-xl text-sm bg-red-500 text-white hover:bg-red-600 transition">Eliminar</button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-4 p-4">
                      <img src={prop.image} alt={prop.title} className="w-28 h-24 object-cover rounded-2xl shrink-0" />

                      {editingId === prop.id ? (
                        /* FORMULARIO EDICIÓN */
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Título" className={inputClass} />
                          <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="Precio" className={inputClass} />
                          <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputClass}>
                            <option>Venta</option>
                            <option>Renta</option>
                          </select>
                          <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className={inputClass}>
                            <option>Apartamento</option>
                            <option>Casa</option>
                            <option>Villa</option>
                          </select>
                          <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descripción" className={`${inputClass} sm:col-span-2 resize-none h-16`} />
                          <div className="sm:col-span-2 flex gap-2 justify-end">
                            <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 transition">Cancelar</button>
                            <button onClick={saveEdit} className="px-4 py-2 rounded-xl text-sm bg-blue-600 text-white hover:bg-blue-700 transition font-semibold">Guardar</button>
                          </div>
                        </div>
                      ) : (
                        /* VISTA NORMAL */
                        <div className="flex-1 flex justify-between gap-3">
                          <div>
                            <div className="flex gap-2 mb-1 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                prop.status === "Venta" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" :
                                prop.status === "Renta" ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400" :
                                prop.status === "Vendido" ? "bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-300 line-through" :
                                "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 line-through"
                              }`}>{prop.status}</span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{prop.type}</span>
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{prop.title}</h3>
                            <p className="text-blue-600 dark:text-blue-400 font-black mt-1">${Number(prop.price).toLocaleString()}</p>
                            <p className="text-gray-400 text-xs mt-1">🛏️ {prop.rooms} · 🛁 {prop.baths} · 🚗 {prop.parking}</p>

                            {/* CAMBIO RÁPIDO DE STATUS */}
                            {(prop.status === "Venta" || prop.status === "Vendido") && (
                              <button
                                onClick={() => handleStatusChange(prop.id, prop.status === "Venta" ? "Vendido" : "Venta")}
                                className={`mt-2 text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                                  prop.status === "Venta"
                                    ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                                    : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                                }`}
                              >
                                {prop.status === "Venta" ? "🏁 Marcar como Vendido" : "↩ Volver a En Venta"}
                              </button>
                            )}
                            {(prop.status === "Renta" || prop.status === "Rentado") && (
                              <button
                                onClick={() => handleStatusChange(prop.id, prop.status === "Renta" ? "Rentado" : "Renta")}
                                className={`mt-2 text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                                  prop.status === "Renta"
                                    ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                                    : "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100"
                                }`}
                              >
                                {prop.status === "Renta" ? "🏁 Marcar como Rentado" : "↩ Volver a En Renta"}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <Link to={`/property/${prop.id}`} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-center">
                              👁️ Ver
                            </Link>
                            <button onClick={() => startEdit(prop)} className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition">
                              ✏️ Editar
                            </button>
                            {!prop.verified && (
                              <button onClick={() => handleVerify(prop.id)} className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-xl hover:bg-green-100 transition">
                                ✅ Verificar
                              </button>
                            )}
                            {prop.verified && (
                              <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-xl text-center">
                                ✅ Verificado
                              </span>
                            )}
                            <button onClick={() => setConfirmDelete(prop.id)} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-500 px-3 py-1.5 rounded-xl hover:bg-red-100 transition">
                              🗑️ Borrar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FAVORITOS ── */}
        {activeTab === "favoritos" && (
          <div>
            {favoriteProperties.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl shadow-md transition-colors">
                <p className="text-5xl mb-3">💔</p>
                <p className="text-gray-500 dark:text-gray-400 font-semibold">No tienes propiedades guardadas aún</p>
                <Link to="/" className="mt-4 inline-block bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition">
                  Explorar propiedades
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteProperties.map((prop) => (
                  <Link key={prop.id} to={`/property/${prop.id}`}>
                    <div className="group bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow hover:shadow-xl transition-all duration-300 dark:border dark:border-gray-700">
                      <div className="relative overflow-hidden">
                        <img src={prop.image} alt={prop.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500" />
                        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold ${prop.status === "Venta" ? "bg-blue-600 text-white" : "bg-green-500 text-white"}`}>{prop.status}</span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{prop.title}</h3>
                        <p className="text-blue-600 dark:text-blue-400 font-black mt-1">${prop.price.toLocaleString()}</p>
                        <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-gray-400 text-xs">
                          <span>🛏️ {prop.rooms}</span>
                          <span>🛁 {prop.baths}</span>
                          <span>🚗 {prop.parking}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MI CUENTA ── */}
        {activeTab === "cuenta" && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-md p-6 space-y-4 transition-colors">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">Información de cuenta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Nombre completo", value: currentUser.name, icon: "👤" },
                { label: "Correo electrónico", value: currentUser.email, icon: "📧" },
                { label: "Rol", value: currentUser.role, icon: "🏷️" },
                { label: "ID de usuario", value: `#${currentUser.id}`, icon: "🔑" },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4 transition-colors">
                  <p className="text-xs text-gray-400 mb-1">{item.icon} {item.label}</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                ⚠️ Esta es una demo con localStorage. En producción los datos estarían protegidos en un servidor.
              </p>
            </div>
          </div>
        )}

      </div>
      <Footer />
    </div>
  );
}