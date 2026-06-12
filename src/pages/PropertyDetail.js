import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import AuthModal from "../components/AuthModal";
import PropertyImage from "../components/PropertyImage";
import VerifiedBadge from "../components/VerifiedBadge";
import { useProperties } from "../context/PropertiesContext";
import { useAuth } from "../context/AuthContext";
import { useInbox } from "../context/InboxContext";
import { useToast } from "../context/ToastContext";

const extraImages = {
  Apartamento: [
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
    "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800",
    "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800",
  ],
  Casa: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800",
    "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
  ],
  Villa: [
    "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800",
    "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
    "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800",
  ],
};

const amenityIcons = {
  "Piscina": "🏊", "Gym": "💪", "Lobby": "🏛️", "Seguridad 24/7": "🔒",
  "Patio": "🌿", "Terraza": "🌇", "Portón eléctrico": "🚪", "Parqueo doble": "🚗",
  "Vista al mar": "🌊", "BBQ": "🔥", "Seguridad": "🛡️", "Jacuzzi": "🛁",
  "Chimenea": "🔆", "Jardín": "🌳", "Área BBQ": "🥩", "Rooftop": "🏙️",
  "Muelle privado": "⛵", "Área infantil": "🎠", "Balcón": "🌅",
  "Ascensor": "🛗", "Cocina moderna": "🍳", "Parqueo": "🅿️",
};

export default function PropertyDetail() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { id } = useParams();
  const { allProperties, toggleFavorite, isFavorite } = useProperties();
  const { currentUser } = useAuth();
  const { sendMessage } = useInbox();
  const { toast } = useToast();
  const property = allProperties.find((p) => p.id === Number(id));

  const similar = allProperties
    .filter((p) => p.id !== property.id && (p.type === property.type || p.city === property.city))
    .slice(0, 4);

  const [lightbox, setLightbox] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copied, setCopied] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgSent, setMsgSent] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({ message: "Link copiado al portapapeles 🔗", type: "info" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = `🏠 *${property.title}*\n💰 $${Number(property.price).toLocaleString()}\n📍 ${property.city || "República Dominicana"}\n\n🔗 ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleSendMessage = () => {
    if (!msgText.trim() || !currentUser) return;
    sendMessage({
      fromId: currentUser.id,
      fromName: currentUser.name,
      toId: property.publishedById || "admin",
      toName: property.publishedBy || "DomusRD",
      propertyId: property.id,
      propertyTitle: property.title,
      text: msgText,
    });
    setMsgText("");
    setMsgSent(true);
    toast({ message: "Mensaje enviado al vendedor ✉️", type: "success" });
    setTimeout(() => setMsgSent(false), 3000);
  };

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center text-center px-4">
        <p className="text-6xl mb-4">🏚️</p>
        <p className="text-2xl font-black text-gray-900 dark:text-white mb-2">Propiedad no encontrada</p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Esta propiedad no existe o fue eliminada.</p>
        <Link to="/" className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition">
          🏠 Volver al inicio
        </Link>
      </div>
    );
  }

  const gallery = property.images?.length > 0
    ? property.images
    : [property.image, ...(extraImages[property.type] || [])];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Navbar />

      {/* ── GALERÍA HERO ── */}
      <div className="relative h-[55vh] min-h-[400px] max-h-[640px]">

        {/* IMAGEN PRINCIPAL con blur de fondo */}
        <div className="absolute inset-0 overflow-hidden">
          <img src={gallery[0]} alt="bg" className="w-full h-full object-cover scale-110 blur-sm opacity-30 dark:opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50/60 via-transparent to-gray-50 dark:from-gray-900/60 dark:to-gray-900" />
        </div>

        {/* CARRUSEL MOBILE */}
        <div className="relative h-full md:hidden">
          <img
            src={gallery[currentSlide]}
            alt={`slide-${currentSlide}`}
            className="w-full h-full object-cover"
          />
          {/* flechas */}
          <button
            onClick={() => setCurrentSlide((currentSlide - 1 + gallery.length) % gallery.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-xl transition backdrop-blur-sm"
          >‹</button>
          <button
            onClick={() => setCurrentSlide((currentSlide + 1) % gallery.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center text-xl transition backdrop-blur-sm"
          >›</button>
          {/* dots */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            {gallery.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`rounded-full transition-all ${i === currentSlide ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/50"}`}
              />
            ))}
          </div>
          {/* contador */}
          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-medium">
            {currentSlide + 1} / {gallery.length}
          </div>
          {/* abrir lightbox */}
          <button
            onClick={() => setLightbox(currentSlide)}
            className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium border border-white/20"
          >
            🔍 Ver todas
          </button>
        </div>

        {/* GRID DESKTOP */}
        <div className="relative h-full max-w-6xl mx-auto px-4 md:px-6 py-4 hidden md:grid grid-cols-4 grid-rows-2 gap-2">
          {/* Foto principal */}
          <div
            className="col-span-2 row-span-2 rounded-3xl overflow-hidden cursor-pointer relative group shadow-2xl"
            onClick={() => setLightbox(0)}
          >
            <img src={gallery[0]} alt="main" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
          </div>
          {/* 4 miniaturas */}
          {gallery.slice(1, 5).map((img, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden cursor-pointer relative group shadow-lg"
              onClick={() => setLightbox(i + 1)}
            >
              <img src={img} alt={`p${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition" />
              {i === 3 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                  <span className="text-white font-bold text-xs bg-white/20 px-3 py-1.5 rounded-full border border-white/30">
                    📷 Ver todas
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* BOTONES FLOTANTES */}
        <div className="absolute top-6 left-6 z-10 flex gap-2">
          <Link to="/">
            <button className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm text-gray-700 dark:text-gray-200 px-4 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-white dark:hover:bg-gray-800 transition">
              ← Volver
            </button>
          </Link>
        </div>
        <div className="absolute top-6 right-6 z-10 flex gap-2">
          <button
            onClick={handleShare}
            className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm text-gray-700 dark:text-gray-200 px-4 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-white dark:hover:bg-gray-800 transition"
          >
            {copied ? "✅ Copiado" : "🔗 Compartir"}
          </button>
          <button
            onClick={() => {
              toggleFavorite(property.id);
              toast({
                message: isFavorite(property.id) ? "Eliminado de favoritos" : "Guardado en favoritos ❤️",
                type: isFavorite(property.id) ? "info" : "success",
              });
            }}
            className="bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform text-lg"
          >
            {isFavorite(property.id) ? "❤️" : "🤍"}
          </button>
        </div>

      </div>

      {/* ── LIGHTBOX ── */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[999] flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button className="absolute top-5 right-5 text-white/60 hover:text-white text-3xl transition" onClick={() => setLightbox(null)}>✕</button>
            <button
              className="absolute left-4 text-white/60 hover:text-white text-5xl px-4 py-2 transition"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + gallery.length) % gallery.length); }}
            >‹</button>
            <motion.img
              key={lightbox}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              src={gallery[lightbox]}
              alt="lightbox"
              className="max-h-[88vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute right-4 text-white/60 hover:text-white text-5xl px-4 py-2 transition"
              onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % gallery.length); }}
            >›</button>
            <p className="absolute bottom-5 text-white/40 text-sm">{lightbox + 1} / {gallery.length}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENIDO ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="max-w-6xl mx-auto px-4 md:px-6 py-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── COLUMNA IZQUIERDA ── */}
          <div className="lg:col-span-2 space-y-7">

            {/* TÍTULO */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="flex gap-2 mb-3 flex-wrap items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  property.status === "Venta" ? "bg-blue-600 text-white" : "bg-green-500 text-white"
                }`}>{property.status}</span>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1 rounded-full text-xs font-bold">
                  {property.type}
                </span>
                {property.verified && <VerifiedBadge size="lg" />}
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white leading-tight">
                {property.title}
              </h1>
              <p className="text-gray-400 mt-2 flex items-center gap-1.5 text-sm">
                📍 {property.city || "República Dominicana"}
              </p>

              {/* PRECIO + STATS EN LA MISMA CARD */}
              <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
                    {property.status === "Venta" ? "Precio de venta" : "Renta mensual"}
                  </p>
                  <p className="text-4xl font-black text-blue-600 dark:text-blue-400 leading-none">
                    ${Number(property.price).toLocaleString()}
                    {property.status === "Renta" && <span className="text-base font-normal text-gray-400 ml-1">/mes</span>}
                  </p>
                </div>
                <div className="flex gap-3">
                  {[
                    { icon: "🛏️", value: property.rooms, label: "hab" },
                    { icon: "🛁", value: property.baths, label: "baños" },
                    { icon: "🚗", value: property.parking, label: "parq" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 dark:bg-gray-700 rounded-2xl px-4 py-3 text-center min-w-[64px] transition-colors">
                      <p className="text-xl">{s.icon}</p>
                      <p className="text-lg font-black text-gray-900 dark:text-white leading-none mt-1">{s.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* DESCRIPCIÓN */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 rounded-full" />
                Descripción
              </h2>
              <p className="text-gray-600 dark:text-gray-400 leading-8 text-sm">{property.description}</p>
            </div>

            {/* AMENIDADES */}
            {property.amenities?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-600 rounded-full" />
                  Amenidades
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {property.amenities.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-2xl px-4 py-3 transition-colors group"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{amenityIcons[item] || "✅"}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* MAPA */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 rounded-full" />
                Ubicación
              </h2>
              <p className="text-sm text-gray-400 mb-3">📍 {property.city || "República Dominicana"}</p>
              <MapContainer center={[property.lat, property.lng]} zoom={14} className="h-[280px] rounded-2xl">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[property.lat, property.lng]}>
                  <Popup>{property.title}</Popup>
                </Marker>
              </MapContainer>
            </div>

          </div>

          {/* ── SIDEBAR ── */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">

              {/* CARD CONTACTO */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">

                {/* HEADER SIDEBAR */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">
                    {property.status === "Venta" ? "Precio de venta" : "Renta mensual"}
                  </p>
                  <p className="text-3xl font-black">
                    ${Number(property.price).toLocaleString()}
                    {property.status === "Renta" && <span className="text-sm font-normal opacity-70 ml-1">/mes</span>}
                  </p>
                </div>

                <div className="p-5 space-y-4">

                  {/* AGENTE */}
                  {property.publishedBy && (
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-2xl p-3 transition-colors">
                      <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md shrink-0">
                        {property.publishedBy.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Publicado por</p>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{property.publishedBy}</p>
                      </div>
                    </div>
                  )}

                  {/* MENSAJE */}
                  {currentUser ? (
                    msgSent ? (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-2xl px-4 py-3 text-sm font-semibold text-center"
                      >
                        ✅ Mensaje enviado
                      </motion.div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={msgText}
                          onChange={(e) => setMsgText(e.target.value)}
                          placeholder="Hola, estoy interesado en esta propiedad..."
                          className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 placeholder-gray-400 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none h-24 transition-colors"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!msgText.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-bold transition shadow-md"
                        >
                          ✉️ Enviar mensaje
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                      <button onClick={() => setAuthOpen(true)} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Inicia sesión</button> para contactar al vendedor
                    </div>
                  )}

                  {/* BOTONES */}
                  <button
                    onClick={handleWhatsApp}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-2xl font-bold transition shadow-md flex items-center justify-center gap-2"
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-2xl font-semibold transition flex items-center justify-center gap-2"
                  >
                    {copied ? "✅ Copiado" : "🔗 Compartir"}
                  </button>
                </div>
              </div>

              {/* NOTA */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 flex gap-3">
                <span className="text-lg shrink-0">🔒</span>
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-5 font-medium">
                  DomusRD no cobra comisión por contactar. Verifica siempre la identidad del vendedor.
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* ── PROPIEDADES SIMILARES ── */}
        {similar.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-600 rounded-full" />
              Propiedades similares
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similar.map((prop, i) => (
                <motion.div
                  key={prop.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <Link to={`/property/${prop.id}`} onClick={() => window.scrollTo(0, 0)}>
                    <div className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700">
                      <div className="relative overflow-hidden">
                        <PropertyImage
                          src={prop.image}
                          type={prop.type}
                          alt={prop.title}
                          className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-xs font-bold ${
                          prop.status === "Venta" ? "bg-blue-600 text-white" : "bg-green-500 text-white"
                        }`}>
                          {prop.status}
                        </span>
                        <button
                          onClick={(e) => { e.preventDefault(); toggleFavorite(prop.id); }}
                          className="absolute top-2 right-2 bg-white dark:bg-gray-800 w-7 h-7 rounded-full flex items-center justify-center shadow text-xs hover:scale-110 transition-transform"
                        >
                          {isFavorite(prop.id) ? "❤️" : "🤍"}
                        </button>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-gray-900 dark:text-white text-xs leading-snug line-clamp-2">{prop.title}</h3>
                        <p className="text-gray-400 text-xs mt-0.5">📍 {prop.city || "Rep. Dominicana"}</p>
                        <p className="text-blue-600 dark:text-blue-400 font-black text-sm mt-1.5">
                          ${Number(prop.price).toLocaleString()}
                          {prop.status === "Renta" && <span className="text-xs font-normal text-gray-400">/mes</span>}
                        </p>
                        <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700 text-gray-400 text-xs">
                          <span>🛏️ {prop.rooms}</span>
                          <span>🛁 {prop.baths}</span>
                          <span>🚗 {prop.parking}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

      </motion.div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}