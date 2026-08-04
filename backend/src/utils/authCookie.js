// El mismo JWT que se manda en el body (para la app móvil, que lo guarda
// en SecureStore) también se manda como cookie httpOnly — el frontend web
// deja de guardar el token en localStorage y usa esta cookie en su lugar,
// para que un XSS no pueda leerlo con document.cookie/localStorage.
const COOKIE_NAME = "domify-token";

const isProd = process.env.NODE_ENV === "production";

// sameSite:"none" es necesario porque el frontend y el backend viven en
// dominios distintos (ej. Vercel + Render) — pero "none" exige Secure,
// que a su vez exige HTTPS, así que en dev (http://localhost) usamos
// "lax" en su lugar (localhost:3000 y localhost:5000 son same-site).
const cookieOptions = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? "none" : "lax",
  path:     "/",
};

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // debe coincidir con JWT_EXPIRES_IN
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

module.exports = { COOKIE_NAME, setAuthCookie, clearAuthCookie };
