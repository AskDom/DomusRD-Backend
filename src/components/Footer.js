import React from "react";
import { Link } from "react-router-dom";

const LINKS = {
  Explorar: [
    { label: "Inicio", to: "/" },
    { label: "Comprar", to: "/search?q=República Dominicana" },
    { label: "Rentar", to: "/search?q=República Dominicana" },
    { label: "Publicar propiedad", to: "/publish" },
  ],
  "Mi cuenta": [
    { label: "Mi perfil", to: "/profile" },
    { label: "Mis favoritos", to: "/favorites" },
    { label: "Inbox", to: "/inbox" },
    { label: "Mis propiedades", to: "/profile?tab=propiedades" },
  ],
  Ciudades: [
    { label: "Santo Domingo", to: "/search?q=Santo Domingo" },
    { label: "Santiago", to: "/search?q=Santiago" },
    { label: "Punta Cana", to: "/search?q=Punta Cana" },
    { label: "Samaná", to: "/search?q=Samaná" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-colors duration-300 mt-16">
      {/* MAIN FOOTER */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* BRAND */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="bg-blue-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-md">
                🏠
              </div>

              <div>
                <h2 className="font-black text-xl leading-none text-gray-900 dark:text-white">
                  DomusRD
                </h2>
                <p className="text-xs text-gray-400">Real Estate</p>
              </div>
            </Link>

            <p className="text-gray-500 dark:text-gray-400 text-sm leading-6 max-w-xs">
              La plataforma líder de bienes raíces en República Dominicana.
              Encuentra tu hogar ideal entre miles de propiedades.
            </p>

            {/* REDES SOCIALES */}
            <div className="flex gap-3 mt-5">
              {[
                { icon: "𝕏", href: "https://x.com", label: "X" },
                { icon: "in", href: "https://linkedin.com", label: "LinkedIn" },
                { icon: "f", href: "https://facebook.com", label: "Facebook" },
                { icon: "📸", href: "https://instagram.com", label: "Instagram" },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="bg-gray-100 dark:bg-gray-800 hover:bg-blue-600 hover:text-white text-gray-600 dark:text-gray-400 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* COLUMNAS */}
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="font-black text-gray-900 dark:text-white text-sm mb-4 uppercase tracking-wider">
                {section}
              </h3>

              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="border-t border-gray-100 dark:border-gray-800 transition-colors">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <p>
            © {new Date().getFullYear()} DomusRD. Todos los derechos reservados.
          </p>

          <div className="flex gap-5">
            <Link to="/" className="hover:text-blue-500 transition">
              Términos de uso
            </Link>

            <Link to="/" className="hover:text-blue-500 transition">
              Privacidad
            </Link>

            <Link to="/" className="hover:text-blue-500 transition">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}