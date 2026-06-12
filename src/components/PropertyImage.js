import React, { useState } from "react";

const FALLBACKS = {
  Apartamento: "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800",
  Casa: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
  Villa: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
};

const DEFAULT_FALLBACK = "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800";

export default function PropertyImage({ src, type, alt, className }) {
  const [error, setError] = useState(false);

  const fallback = FALLBACKS[type] || DEFAULT_FALLBACK;
  const imgSrc = !src || error ? fallback : src;

  return (
    <img
      src={imgSrc}
      alt={alt || "Propiedad"}
      className={className}
      onError={() => setError(true)}
    />
  );
}