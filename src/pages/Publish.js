import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Navbar from "../components/Navbar";
import { useProperties } from "../context/PropertiesContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

function LocationSelector({ setPosition }) {
  useMapEvents({
    click(e) { setPosition(e.latlng); },
  });
  return null;
}

const inputClass =
  "w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 transition-colors";

const selectClass =
  "w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 outline-none text-gray-800 dark:text-gray-100 transition-colors";

export default function Publish() {
  const { addProperty, published } = useProperties();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const isVendedor = currentUser?.role === "Vendedor";
  const myPublished = published.filter((p) => p.publishedById === currentUser?.id);
  const vendedorLimit = 3;
  const hasReachedLimit = isVendedor && myPublished.length >= vendedorLimit;
  const [position, setPosition] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    title: "", price: "", description: "",
    type: "Apartamento", status: "Venta",
    rooms: 1, baths: 1, parking: 1,
    city: "", images: [], lat: "", lng: "",
  });

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const remaining = 8 - form.images.length;
    const toProcess = files.slice(0, remaining);
    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev) => ({ ...prev, images: [...prev.images, reader.result] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const moveImage = (from, to) => {
    const imgs = [...form.images];
    const [moved] = imgs.splice(from, 1);
    imgs.splice(to, 0, moved);
    setForm((prev) => ({ ...prev, images: imgs }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = "El título es requerido";
    if (!form.city.trim()) errs.city = "La ciudad es requerida";
    if (!form.price) errs.price = "El precio es requerido";
    if (!form.description.trim()) errs.description = "La descripción es requerida";
    if (!position) errs.position = "Selecciona una ubicación en el mapa";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    if (hasReachedLimit) return;
    addProperty({
      ...form,
      lat: position.lat,
      lng: position.lng,
      liked: false,
      city: form.city,
      image: form.images[0] || "",
      images: form.images,
      publishedById: currentUser?.id || null,
      publishedBy: currentUser?.name || "Anónimo",
    });
    setForm({ title: "", price: "", description: "", type: "Apartamento", status: "Venta", rooms: 1, baths: 1, parking: 1, images: [], city: "", lat: "", lng: "" });
    setPosition(null);
    setSubmitted(true);
    toast({ message: "¡Propiedad publicada con éxito! 🏠", type: "success" });
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* HEADER */}
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white">Publicar propiedad</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Selecciona la ubicación en el mapa y completa el formulario</p>
        </div>

        {/* MAPA — ARRIBA, ANCHO COMPLETO */}
        <div className="relative">
          <div className="absolute bottom-3 right-3 z-10 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-full shadow border border-gray-200 dark:border-gray-600">
            📍 {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : "Haz clic en el mapa para ubicar"}
          </div>
          <MapContainer
            center={[18.7357, -70.1627]}
            zoom={7}
            scrollWheelZoom={false}
            className="w-full h-[420px] rounded-3xl shadow-xl"
            style={{ zIndex: 0 }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationSelector setPosition={setPosition} />
            {position && (
              <Marker position={position}>
                <Popup>📍 Nueva propiedad aquí</Popup>
              </Marker>
            )}
          </MapContainer>
          {errors.position && (
            <p className="text-red-500 text-sm mt-2 font-medium">⚠️ {errors.position}</p>
          )}
        </div>

        {/* FORMULARIO — ABAJO EN GRID */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-3xl p-6 md:p-8 transition-colors duration-300"
        >
          {/* LÍMITE VENDEDOR */}
          {isVendedor && (
            <div className={`mb-4 rounded-2xl px-5 py-3 flex items-center justify-between ${
              hasReachedLimit
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700"
                : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
            }`}>
              <div>
                <p className={`text-sm font-bold ${hasReachedLimit ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
                  {hasReachedLimit ? "⚠️ Límite alcanzado" : "🏠 Cupo de publicaciones"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {hasReachedLimit
                    ? "Has alcanzado el límite de 3 propiedades para Vendedor. Elimina una para publicar otra."
                    : `Has publicado ${myPublished.length} de ${vendedorLimit} propiedades permitidas.`}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className={`text-2xl font-black ${hasReachedLimit ? "text-red-500" : "text-blue-600 dark:text-blue-400"}`}>
                  {myPublished.length}/{vendedorLimit}
                </p>
              </div>
            </div>
          )}

          {/* SUCCESS BANNER */}
          {submitted && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-2xl px-5 py-4 font-semibold flex items-center gap-2">
              ✅ ¡Propiedad publicada con éxito!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* TITULO */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Título de la propiedad</label>
              <input
                placeholder="Ej. Apartamento moderno en Piantini"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`${inputClass} ${errors.title ? "ring-2 ring-red-400" : ""}`}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            {/* CIUDAD */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Ciudad / Sector</label>
              <input
                placeholder="Ej. Santo Domingo"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={`${inputClass} ${errors.city ? "ring-2 ring-red-400" : ""}`}
              />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
            </div>

            {/* PRECIO */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Precio (USD)</label>
              <input
                type="number"
                placeholder="Ej. 150000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={`${inputClass} ${errors.price ? "ring-2 ring-red-400" : ""}`}
              />
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
            </div>

            {/* STATUS */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Operación</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={selectClass}>
                <option>Venta</option>
                <option>Renta</option>
              </select>
            </div>

            {/* TIPO */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Tipo de propiedad</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={selectClass}>
                <option>Apartamento</option>
                <option>Casa</option>
                <option>Villa</option>
              </select>
            </div>

            {/* SPECS */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Características</label>
              <div className="grid grid-cols-3 gap-2">
                <select value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })} className={selectClass}>
                  {[1,2,3,4,5].map((n) => <option key={n}>{n} hab</option>)}
                </select>
                <select value={form.baths} onChange={(e) => setForm({ ...form, baths: e.target.value })} className={selectClass}>
                  {[1,2,3,4].map((n) => <option key={n}>{n} baños</option>)}
                </select>
                <select value={form.parking} onChange={(e) => setForm({ ...form, parking: e.target.value })} className={selectClass}>
                  {[0,1,2,3].map((n) => <option key={n}>{n} parq.</option>)}
                </select>
              </div>
            </div>

            {/* DESCRIPCION */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Descripción</label>
              <textarea
                placeholder="Describe la propiedad: acabados, ubicación, ventajas..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`${inputClass} h-28 resize-none`}
              />
            </div>

            {/* FOTOS */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                Fotos de la propiedad
                <span className="text-gray-400 font-normal ml-2">({form.images.length}/8 — la primera será la portada)</span>
              </label>

              {/* PREVIEWS */}
              {form.images.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100 dark:bg-gray-700">
                      <img src={img} alt={`foto-${i}`} className="w-full h-full object-cover" />

                      {/* PORTADA badge */}
                      {i === 0 && (
                        <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                          Portada
                        </span>
                      )}

                      {/* OVERLAY ACCIONES */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => moveImage(i, i - 1)}
                            className="bg-white/90 text-gray-800 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-white transition"
                            title="Mover izquierda"
                          >←</button>
                        )}
                        {i === 0 && form.images.length > 1 && (
                          <button
                            type="button"
                            onClick={() => moveImage(i, i + 1)}
                            className="bg-white/90 text-gray-800 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-white transition"
                            title="Mover derecha"
                          >→</button>
                        )}
                        {i > 0 && i < form.images.length - 1 && (
                          <button
                            type="button"
                            onClick={() => moveImage(i, i + 1)}
                            className="bg-white/90 text-gray-800 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-white transition"
                          >→</button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="bg-red-500 text-white w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold hover:bg-red-600 transition"
                          title="Eliminar"
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* UPLOAD AREA */}
              {form.images.length < 8 && (
                <label className="block w-full cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-6 text-center bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-blue-400 transition-colors">
                    <p className="text-3xl mb-2">📸</p>
                    <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Haz clic para subir fotos
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Puedes subir hasta {8 - form.images.length} foto{8 - form.images.length !== 1 ? "s" : ""} más · JPG, PNG, WEBP
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

          </div>

          {/* BOTON SUBMIT */}
          <div className="mt-6 flex items-center gap-4">
            <button
              type="submit"
              disabled={hasReachedLimit}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-bold shadow-lg transition text-base"
            >
              🚀 Publicar propiedad
            </button>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {position ? "✅ Ubicación seleccionada" : "⚠️ Falta seleccionar ubicación en el mapa"}
            </p>
          </div>
        </form>

      </div>
    </div>
  );
}