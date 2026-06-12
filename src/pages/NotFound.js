import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">

        {/* NÚMERO 404 ANIMADO */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="relative mb-6"
        >
          <p className="text-[10rem] md:text-[14rem] font-black text-gray-100 dark:text-gray-800 leading-none select-none">
            404
          </p>
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center text-7xl md:text-8xl"
          >
            🏚️
          </motion.div>
        </motion.div>

        {/* TEXTO */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-3">
            Página no encontrada
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-md mb-8">
            La propiedad que buscas no existe o fue eliminada. Explora nuestro catálogo completo.
          </p>
        </motion.div>

        {/* ACCIONES */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-wrap gap-3 justify-center"
        >
          <button
            onClick={() => navigate(-1)}
            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-3 rounded-2xl font-semibold transition"
          >
            ← Volver atrás
          </button>
          <Link to="/">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-semibold transition shadow-lg">
              🏠 Ir al inicio
            </button>
          </Link>
          <Link to="/search?q=República Dominicana">
            <button className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md text-gray-700 dark:text-gray-200 px-6 py-3 rounded-2xl font-semibold transition">
              🔍 Ver propiedades
            </button>
          </Link>
        </motion.div>

      </div>
    </div>
  );
}