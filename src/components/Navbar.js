import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthModal from "./AuthModal";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useProperties } from "../context/PropertiesContext";
import { useInbox } from "../context/InboxContext";

// SVG Icons
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const InboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const HeartIcon = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function Navbar() {
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const { dark, toggleDark } = useTheme();
  const { currentUser, logout } = useAuth();
  const { favorites } = useProperties();
  const { getUnreadCount } = useInbox();
  const unread = currentUser ? getUnreadCount(currentUser.id) : 0;

  const iconBtn = "relative flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all duration-200";

  return (
    <>
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700 shadow-md transition-colors duration-300">
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex items-center gap-4">

          {/* LOGO — anclado a la izquierda */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 mr-auto">
            <div className="bg-blue-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-md text-lg">🏠</div>
            <div className="leading-none">
              <p className="font-black text-lg text-gray-900 dark:text-white tracking-tight">DomusRD</p>
              <p className="text-[10px] text-gray-400 font-medium">Real Estate</p>
            </div>
          </Link>

          {/* ICONOS — agrupados limpiamente */}
          <div className="flex items-center gap-1">

            {/* DARK MODE */}
            <button onClick={toggleDark} className={iconBtn} title={dark ? "Modo claro" : "Modo oscuro"}>
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* INBOX */}
            {currentUser && (
              <Link to="/inbox" className={iconBtn}>
                <InboxIcon />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {unread}
                  </span>
                )}
              </Link>
            )}

            {/* FAVORITOS */}
            <Link to="/favorites" className={`${iconBtn} ${favorites.length > 0 ? "text-red-500 dark:text-red-400" : ""}`}>
              <HeartIcon filled={favorites.length > 0} />
              {favorites.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {favorites.length}
                </span>
              )}
            </Link>

          </div>

          {/* SEPARADOR */}
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

          {/* PUBLICAR */}
          {(!currentUser || ["Agente", "Vendedor"].includes(currentUser.role)) && (
            <Link to="/publish" className="hidden md:block">
              <button className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 ${
                location.pathname === "/publish"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              }`}>
                + Publicar
              </button>
            </Link>
          )}

          {/* USER / SIGN IN */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left leading-none">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{currentUser.name.split(" ")[0]}</p>
                  <p className={`text-[10px] font-semibold ${
                    currentUser.role === "Agente" ? "text-yellow-500" :
                    currentUser.role === "Vendedor" ? "text-green-500" : "text-blue-500"
                  }`}>
                    {currentUser.role === "Agente" ? "⭐ Agente" :
                     currentUser.role === "Vendedor" ? "🏠 Vendedor" : "👤 Cliente"}
                  </p>
                </div>
                <svg className="hidden md:block w-3.5 h-3.5 text-gray-400 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              {/* DROPDOWN */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-black text-gray-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                  </div>
                  {[
                    { to: "/profile", label: "Mi perfil", icon: "👤" },
                    { to: "/profile?tab=propiedades", label: "Mis propiedades", icon: "🏠" },
                    { to: "/favorites", label: "Favoritos", icon: "❤️" },
                    { to: "/inbox", label: "Inbox", icon: "✉️", badge: unread },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <span className="flex items-center gap-2.5">{item.icon} {item.label}</span>
                      {item.badge > 0 && (
                        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>
                      )}
                    </Link>
                  ))}
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2.5"
                    >
                      🚪 Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-xl hover:opacity-80 transition"
            >
              Iniciar sesión
            </button>
          )}

          {/* MOBILE TOGGLE */}
          <button
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 flex flex-col gap-1">
            <Link to="/" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              🏠 Inicio
            </Link>
            <Link to="/favorites" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              ❤️ Favoritos {favorites.length > 0 && `(${favorites.length})`}
            </Link>
            {currentUser && (
              <>
                <Link to="/inbox" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  ✉️ Inbox {unread > 0 && `(${unread})`}
                </Link>
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  👤 Mi perfil
                </Link>
                <button onClick={() => { logout(); setMenuOpen(false); }} className="text-left text-sm font-medium text-red-500 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  🚪 Cerrar sesión
                </button>
              </>
            )}
            <Link to="/publish" onClick={() => setMenuOpen(false)} className="mt-1 bg-blue-600 text-white text-center px-5 py-2.5 rounded-xl font-semibold text-sm">
              + Publicar propiedad
            </Link>
          </div>
        )}
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}