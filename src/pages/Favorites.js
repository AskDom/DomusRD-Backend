import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useProperties } from "../context/PropertiesContext";

export default function Favorites() {
  const { currentUser } = useAuth();
  const { getFavoriteProperties, toggleFavorite } = useProperties();
  const favorites = getFavoriteProperties();

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-200 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-6xl mb-4">🔒</p>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Inicia sesión para ver tus favoritos</h2>
          <Link to="/" className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-300">
      <Navbar />

      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-8">

        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Mis favoritos</h1>
          <p className="text-gray-400 text-sm mt-1">
            {favorites.length === 0
              ? "No tienes propiedades guardadas"
              : `${favorites.length} propiedad${favorites.length !== 1 ? "es" : ""} guardada${favorites.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {favorites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <p className="text-7xl mb-5">💔</p>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Aún no tienes favoritos</h2>
            <p className="text-gray-400 mb-6 max-w-sm">Explora propiedades y guarda las que más te gusten con el botón ❤️</p>
            <Link to="/">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-semibold transition shadow-lg">
                Explorar propiedades
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {favorites.map((prop, i) => (
              <motion.div
                key={prop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="group bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow hover:shadow-2xl transition-all duration-300 border border-transparent dark:border-gray-700">
                  <div className="relative overflow-hidden">
                    <Link to={`/property/${prop.id}`}>
                      <img
                        src={prop.image}
                        alt={prop.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </Link>
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow ${prop.status === "Venta" ? "bg-blue-600 text-white" : "bg-green-500 text-white"}`}>
                        {prop.status}
                      </span>
                      <span className="bg-white/90 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-full text-xs font-semibold shadow">
                        {prop.type}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleFavorite(prop.id)}
                      className="absolute top-3 right-3 bg-white dark:bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center shadow hover:scale-110 transition-transform text-sm"
                      title="Quitar de favoritos"
                    >
                      ❤️
                    </button>
                  </div>

                  <div className="p-4">
                    <Link to={`/property/${prop.id}`}>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition">
                        {prop.title}
                      </h3>
                    </Link>
                    <p className="text-gray-400 text-xs mt-0.5">📍 {prop.city || "República Dominicana"}</p>
                    <p className="text-blue-600 dark:text-blue-400 font-black text-lg mt-2">
                      ${prop.price.toLocaleString()}
                      {prop.status === "Renta" && <span className="text-xs font-normal text-gray-400">/mes</span>}
                    </p>
                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-gray-400 text-xs">
                      <span>🛏️ {prop.rooms}</span>
                      <span>🛁 {prop.baths}</span>
                      <span>🚗 {prop.parking}</span>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Link to={`/property/${prop.id}`} className="flex-1">
                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-semibold transition">
                          Ver detalles
                        </button>
                      </Link>
                      <button
                        onClick={() => toggleFavorite(prop.id)}
                        className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-500 px-3 py-2 rounded-xl text-xs font-semibold transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}