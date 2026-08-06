// Solo existe para que Jest pueda cargar en tests el árbol de dependencias
// de otplib (2FA), que incluye @scure/base — un paquete ESM-only ("export
// const ...") sin build CJS. El resto del proyecto sigue en CommonJS plano;
// no hay build de la app con Babel.
module.exports = {
  plugins: ["@babel/plugin-transform-modules-commonjs"],
};
