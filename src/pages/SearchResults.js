import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PropertyImage from "../components/PropertyImage";
import PropertyCardSkeleton from "../components/PropertyCardSkeleton";
import VerifiedBadge from "../components/VerifiedBadge";
import { useProperties } from "../context/PropertiesContext";

// Fix default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Crea un marcador con el precio como etiqueta
function createPriceIcon(price, isActive, status) {
  const formatted = price >= 1000000
    ? `$${(price / 1000000).toFixed(1)}M`
    : price >= 1000
    ? `$${Math.round(price / 1000)}K`
    : `$${price}`;

  const bg = isActive ? "#2563eb" : status === "Renta" ? "#22c55e" : "#1e293b";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        background: ${bg};
        color: white;
        padding: 5px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white;
        transform: ${isActive ? "scale(1.15)" : "scale(1)"};
        transition: all 0.2s;
        cursor: pointer;
      ">${formatted}</div>
      <div style="
        width: 8px; height: 8px;
        background: ${bg};
        margin: 0 auto;
        clip-path: polygon(0 0, 100% 0, 50% 100%);
        margin-top: -1px;
      "></div>
    `,
    iconSize: [70, 36],
    iconAnchor: [35, 36],
    popupAnchor: [0, -36],
  });
}

// Solo centra el mapa cuando cambia la búsqueda, no en cada hover
function MapFocus({ properties, version }) {
  const map = useMap();
  useEffect(() => {
    if (properties.length === 1) {
      map.setView([properties[0].lat, properties[0].lng], 13, { animate: true });
    } else if (properties.length > 1) {
      const bounds = L.latLngBounds(properties.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], animate: true });
    }
  // version cambia solo cuando cambia query o filtros, no en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return null;
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapVersion, setMapVersion] = useState(0);
  const [filters, setFilters] = useState({ status: "", type: "", rooms: "", minPrice: "", maxPrice: "" });
  const { allProperties, toggleFavorite, isFavorite } = useProperties();
  const query = searchParams.get("q") || "";

  useEffect(() => {
    setLoading(true);
    setMapVersion((v) => v + 1);
    const t = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(t);
  }, [query, filters]);

  const results = allProperties.filter((p) => {
    const q = query.toLowerCase();
    const matchQuery = q === "" || q === "república dominicana"
      ? true
      : p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q);
    const matchStatus = !filters.status || p.status === filters.status;
    const matchType = !filters.type || p.type === filters.type;
    const matchRooms = !filters.rooms || p.rooms === Number(filters.rooms);
    const matchMin = !filters.minPrice || Number(p.price) >= Number(filters.minPrice);
    const matchMax = !filters.maxPrice || Number(p.price) <= Number(filters.maxPrice);
    return matchQuery && matchStatus && matchType && matchRooms && matchMin && matchMax;
  });

  const selectClass = "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl px-4 py-2 text-sm outline-none border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 transition-colors";

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      <Navbar />

      {/* ── BARRA BÚSQUEDA + FILTROS ── */}
      <div className="bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center gap-3 z-40 shadow-sm">
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 gap-2 flex-1 min-w-[200px] max-w-sm">
          <span className="text-gray-400">🔍</span>
          <input
            type="text"
            defaultValue={query}
            onKeyDown={(e) => { if (e.key === "Enter") setSearchParams({ q: e.target.value }); }}
            placeholder="Buscar..."
            className="bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 w-full"
          />
        </div>

        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={selectClass}>
          <option value="">Venta o Renta</option>
          <option value="Venta">Venta</option>
          <option value="Renta">Renta</option>
        </select>

        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className={selectClass}>
          <option value="">Tipo</option>
          <option>Apartamento</option>
          <option>Casa</option>
          <option>Villa</option>
        </select>

        <select value={filters.rooms} onChange={(e) => setFilters({ ...filters, rooms: e.target.value })} className={selectClass}>
          <option value="">Habitaciones</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} hab</option>)}
        </select>

        {/* PRECIO MIN/MAX */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            placeholder="Precio mín"
            value={filters.minPrice}
            onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
            className={`${selectClass} w-28`}
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            placeholder="Precio máx"
            value={filters.maxPrice}
            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            className={`${selectClass} w-28`}
          />
        </div>

        {/* LIMPIAR FILTROS */}
        {(filters.status || filters.type || filters.rooms || filters.minPrice || filters.maxPrice) && (
          <button
            onClick={() => setFilters({ status: "", type: "", rooms: "", minPrice: "", maxPrice: "" })}
            className="text-xs text-red-500 hover:text-red-700 font-semibold whitespace-nowrap transition"
          >
            ✕ Limpiar
          </button>
        )}

        <span className="text-gray-400 dark:text-gray-500 text-sm ml-auto hidden md:block">
          {loading ? "Buscando..." : `${results.length} resultado${results.length !== 1 ? "s" : ""} para`} {!loading && <strong className="text-gray-700 dark:text-gray-200">"{query}"</strong>}
        </span>
      </div>

      {/* ── LAYOUT DOS COLUMNAS ── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 118px)" }}>

        {/* CARDS */}
        <div className="w-full lg:w-[48%] overflow-y-auto px-4 py-5">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => <PropertyCardSkeleton key={i} />)}
            </div>
          ) : results.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-64 text-center"
            >
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-gray-500 dark:text-gray-400 font-semibold">No encontramos propiedades para "{query}"</p>
              <p className="text-gray-400 text-sm mt-1">Intenta con otro sector o provincia</p>
              <Link to="/" className="mt-4 text-blue-600 text-sm font-semibold hover:underline">← Volver al inicio</Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((prop, i) => (
                <motion.div
                  key={prop.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link to={`/property/${prop.id}`}>
                    <div
                      onMouseEnter={() => setActiveId(prop.id)}
                      onMouseLeave={() => setActiveId(null)}
                      className={`group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden transition-all duration-200 border-2 cursor-pointer ${
                        activeId === prop.id
                          ? "border-blue-500 shadow-xl scale-[1.01]"
                          : "border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl"
                      }`}
                    >
                      <div className="relative overflow-hidden">
                        <PropertyImage
                          src={prop.image}
                          type={prop.type}
                          alt={prop.title}
                          className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-2 left-2 flex gap-1.5 items-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            prop.status === "Venta" ? "bg-blue-600 text-white" : "bg-green-500 text-white"
                          }`}>{prop.status}</span>
                          <span className="bg-white/90 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                            {prop.type}
                          </span>
                          {prop.verified && <VerifiedBadge />}
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); toggleFavorite(prop.id); }}
                          className="absolute top-2 right-2 bg-white dark:bg-gray-800 w-7 h-7 rounded-full flex items-center justify-center shadow text-xs hover:scale-110 transition-transform"
                        >
                          {isFavorite(prop.id) ? "❤️" : "🤍"}
                        </button>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{prop.title}</h3>
                        <p className="text-gray-400 text-xs mt-0.5">📍 {prop.city || "Rep. Dominicana"}</p>
                        <p className="text-blue-600 dark:text-blue-400 font-black text-base mt-1">
                          ${Number(prop.price).toLocaleString()}
                          {prop.status === "Renta" && <span className="text-xs font-normal text-gray-400">/mes</span>}
                        </p>
                        <div className="flex gap-3 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-400 text-xs">
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
          )}
        </div>

        {/* MAPA con precio en marcadores */}
        <div className="hidden lg:block flex-1 relative">
          <MapContainer
            center={[18.7357, -70.1627]}
            zoom={7}
            scrollWheelZoom={true}
            className="w-full h-full"
            style={{ zIndex: 0 }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFocus properties={results} version={mapVersion} />
            {results.map((prop) => (
              <Marker
                key={prop.id}
                position={[prop.lat, prop.lng]}
                icon={createPriceIcon(prop.price, activeId === prop.id, prop.status)}
                eventHandlers={{
                  mouseover: () => setActiveId(prop.id),
                  mouseout: () => setActiveId(null),
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[160px]">
                    <PropertyImage
                      src={prop.image}
                      type={prop.type}
                      alt={prop.title}
                      className="w-full h-24 object-cover rounded-lg mb-2"
                    />
                    <p className="font-bold text-gray-900 leading-snug">{prop.title}</p>
                    <p className="text-blue-600 font-black mt-1">${Number(prop.price).toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{prop.status} · {prop.type}</p>
                    <Link to={`/property/${prop.id}`} className="block mt-2 bg-blue-600 text-white text-center py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
                      Ver detalles →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

      </div>
      <Footer />
    </div>
  );
}