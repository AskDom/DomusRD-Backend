import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

const ROLE_CONFIG = {
  publish: {
    allowed: ["Agente", "Vendedor"],
    icon: "🏠",
    title: "Solo agentes y vendedores pueden publicar",
    description: "Regístrate como Agente o Vendedor para publicar propiedades en DomusRD.",
  },
};

export default function ProtectedRoute({ children, requiredRole = "publish" }) {
  const { currentUser } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const config = ROLE_CONFIG[requiredRole];

  // No logueado
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center text-center px-4">
        <p className="text-6xl mb-4">🔒</p>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Inicia sesión para continuar</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{config.description}</p>
        <button
          onClick={() => setAuthOpen(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition"
        >
          Iniciar sesión / Registrarse
        </button>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  // Logueado pero sin el rol correcto
  if (config && !config.allowed.includes(currentUser.role)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center text-center px-4">
        <p className="text-6xl mb-4">{config.icon}</p>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{config.title}</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm">{config.description}</p>

        {/* ROLES DISPONIBLES */}
        <div className="flex gap-4 mb-6 flex-wrap justify-center">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-center shadow-sm">
            <p className="text-2xl mb-1">🏠</p>
            <p className="font-bold text-gray-900 dark:text-white text-sm">Vendedor</p>
            <p className="text-xs text-gray-400 mt-0.5">Hasta 3 propiedades</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-4 text-center shadow-sm">
            <p className="text-2xl mb-1">⭐</p>
            <p className="font-bold text-gray-900 dark:text-white text-sm">Agente</p>
            <p className="text-xs text-gray-400 mt-0.5">Propiedades ilimitadas</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
          Tu cuenta actual es <span className="font-bold text-gray-700 dark:text-gray-300">👤 {currentUser.role}</span>
        </p>
        <p className="text-xs text-gray-400 max-w-xs">
          Para cambiar tu tipo de cuenta, crea una nueva cuenta con el rol correcto.
        </p>
      </div>
    );
  }

  return children;
}