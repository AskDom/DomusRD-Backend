import React, { createContext, useContext, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [users, setUsers] = useLocalStorage("domusrd-users", []);
  const [currentUser, setCurrentUser] = useLocalStorage("domusrd-session", null);
  const [error, setError] = useState("");

  const register = ({ name, email, password, role }) => {
    setError("");
    if (users.find((u) => u.email === email)) {
      setError("Ya existe una cuenta con ese correo.");
      return false;
    }
    const newUser = { id: Date.now(), name, email, password, role };
    setUsers([...users, newUser]);
    setCurrentUser({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
    return true;
  };

  const login = ({ email, password }) => {
    setError("");
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      setError("Correo o contraseña incorrectos.");
      return false;
    }
    setCurrentUser({ id: user.id, name: user.name, email: user.email, role: user.role });
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}