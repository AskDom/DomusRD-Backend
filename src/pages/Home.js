import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PropertyImage from "../components/PropertyImage";
import PropertyCardSkeleton from "../components/PropertyCardSkeleton";
import VerifiedBadge from "../components/VerifiedBadge";
import { useProperties } from "../context/PropertiesContext";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useToast } from "../context/ToastContext";

const PROVINCIAS = [
  "Santo Domingo", "Santiago", "Punta Cana", "Samaná",
  "Jarabacoa", "La Romana", "Baní", "San Cristóbal",
];

const TAB_FILTERS = {
  "Todos": () => true,
  "Apartamentos": (p) => p.type === "Apartamento",
  "Casas": (p) => p.type === "Casa",
  "Villas": (p) => p.type === "Villa",
  "En Venta": (p) => p.status === "Venta",
  "En Renta": (p) => p.status === "Renta",
};

const SORT_OPTIONS = [
  { value: "recent", label: "Más recientes" },
  { value: "price_asc", label: "Menor precio" },
  { value: "price_desc", label: "Mayor precio" },
];

function sortProperties(props, sort) {
  const arr = [...props];
  if (sort === "price_asc") return arr.sort((a, b) => a.price - b.price);
  if (sort === "price_desc") return arr.sort((a, b) => b.price - a.price);
  return arr.sort((a, b) => (b.id > a.id ? 1 : -1));
}

const MAX_HISTORY = 6;

export default function Home() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useLocalStorage("domusrd-search-history", []);
  const { allProperties, toggleFavorite, isFavorite } = useProperties();
  const { toast } = useToast();

  const activeTab = searchParams.get("tab") || "Todos";
  const filtered = sortProperties(
    allProperties.filter(TAB_FILTERS[activeTab] || (() => true)),
    sort
  );

  useEffect(() => { setTimeout(() => setLoading(false), 1800); }, []);

  const saveToHistory = (term) => {
    if (!term.trim()) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h.toLowerCase() !== term.toLowerCase());
      return [term, ...filtered].slice(0, MAX_HISTORY);
    });
  };

  const handleSearch = (term) => {
    const q = term || query;
    if (!q.trim()) return;
    saveToHistory(q.trim());
    setShowHistory(false);
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const removeFromHistory = (e, term) => {
    e.stopPropagation();
    setSearchHistory((prev) => prev.filter((h) => h !== term));
  };

  const handleTabChange = (tab) => {
    navigate(tab === "Todos" ? "/" : `/?tab=${encodeURIComponent(tab)}`);
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-300">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── HERO ── */}
      <div className="relative h-[420px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=1800&q=85"
          alt="hero"
          className="w-full h-full object-cover object-[center_60%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/75" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-5 uppercase tracking-widest">
            República Dominicana
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-3 drop-shadow-lg">
            Encuentra tu hogar <span className="text-blue-400">ideal</span>
          </h1>
          <p className="text-gray-300 text-base md:text-lg mb-8 max-w-lg">
            Miles de propiedades en venta y renta en todo el país
          </p>
          <div className="w-full max-w-2xl relative">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-2 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="🔍  Busca por ciudad, sector o provincia..."
                className="flex-1 px-4 py-3 outline-none bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 text-sm"
              />
              <button onClick={() => handleSearch()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition shrink-0">
                Buscar
              </button>
            </div>

            {/* HISTORIAL DROPDOWN */}
            {showHistory && searchHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
              >
                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Búsquedas recientes</p>
                  <button
                    onMouseDown={() => setSearchHistory([])}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition"
                  >
                    Limpiar
                  </button>
                </div>
                {searchHistory.map((term) => (
                  <div
                    key={term}
                    onMouseDown={() => handleSearch(term)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-300 dark:text-gray-600">🕐</span>
                      <span className="text-sm text-gray-700 dark:text-gray-200">{term}</span>
                    </div>
                    <button
                      onMouseDown={(e) => removeFromHistory(e, term)}
                      className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition text-lg"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {PROVINCIAS.map((p) => (
              <button key={p} onClick={() => handleSearch(p)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full border border-white/30 transition">
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="absolute bottom-5 right-6 hidden md:flex gap-6 text-white">
          {[["2,400+", "Propiedades"], ["180+", "Agentes"], ["12", "Ciudades"]].map(([n, l]) => (
            <div key={l} className="text-center">
              <p className="font-black text-xl">{n}</p>
              <p className="text-gray-300 text-xs">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEED ── */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-10">

        {/* HEADER + ORDENAR */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
              {activeTab === "Todos" ? "Propiedades destacadas" : activeTab}
            </h2>
            <p className="text-gray-400 text-sm mt-0.5">{filtered.length} propiedades disponibles</p>
          </div>
          <div className="flex items-center gap-3">
            {/* ORDENAR */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={() => handleSearch("República Dominicana")}
              className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline whitespace-nowrap"
            >
              Ver todas →
            </button>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {loading ? (
            [...Array(8)].map((_, i) => <PropertyCardSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-full text-center py-20"
            >
              <p className="text-5xl mb-4">🏚️</p>
              <p className="text-gray-500 dark:text-gray-400 font-semibold text-lg">No hay propiedades en esta categoría</p>
              <button onClick={() => handleTabChange("Todos")} className="mt-4 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:underline">
                Ver todas las propiedades
              </button>
            </motion.div>
          ) : (
            filtered.map((prop, i) => (
              <motion.div
                key={prop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <Link to={`/property/${prop.id}`}>
                  <div className="group bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-700 h-full">
                    <div className="relative overflow-hidden">
                      <PropertyImage
                        src={prop.image}
                        type={prop.type}
                        alt={prop.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3 flex gap-2 items-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow ${prop.status === "Venta" ? "bg-blue-600 text-white" : "bg-green-500 text-white"}`}>
                          {prop.status}
                        </span>
                        <span className="bg-white/90 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-full text-xs font-semibold shadow">
                          {prop.type}
                        </span>
                        {prop.verified && <VerifiedBadge />}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavorite(prop.id);
                          toast({
                            message: isFavorite(prop.id) ? "Eliminado de favoritos" : "Guardado en favoritos ❤️",
                            type: isFavorite(prop.id) ? "info" : "success",
                          });
                        }}
                        className="absolute top-3 right-3 bg-white dark:bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform text-sm"
                      >
                        {isFavorite(prop.id) ? "❤️" : "🤍"}
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{prop.title}</h3>
                      <p className="text-gray-400 text-xs mt-0.5">📍 {prop.city || "República Dominicana"}</p>
                      <p className="text-blue-600 dark:text-blue-400 font-black text-lg mt-2">
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
            ))
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}