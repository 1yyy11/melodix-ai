// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

const API_URL = "http://localhost:3001/api";

// ===================== TYPES =====================

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<User>;
  googleLogin: (token: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

// ===================== CONTEXT =====================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===================== TOKEN HELPERS =====================

const getToken = () => localStorage.getItem("token");
const setToken = (token: string) => localStorage.setItem("token", token);
const removeToken = () => localStorage.removeItem("token");

// ===================== PROVIDER =====================

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ================= INIT AUTH =================
  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      // 🔥 ПЫТАЕМСЯ ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЯ ЧЕРЕЗ COOKIE
      const res = await fetch(`${API_URL}/user`, {
        credentials: "include", // ✅ отправляем httpOnly cookie
      });

      if (res.ok) {
        const data = await res.json();
        console.log("✅ User loaded from cookie:", data);
        setUser(data);
        setIsLoading(false);
        return;
      }

      // 🔥 ЕСЛИ COOKIE НЕ СРАБОТАЛ, ПРОБУЕМ JWT ИЗ LOCALSTORAGE
      const token = getToken();
      if (token) {
        const res2 = await fetch(`${API_URL}/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res2.ok) {
          const data = await res2.json();
          console.log("✅ User loaded from token:", data);
          setUser(data);
          setIsLoading(false);
          return;
        } else {
          removeToken();
        }
      }

      setUser(null);
    } catch (error) {
      console.error("Init auth error:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ================= LOGIN =================

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Login failed");

    if (data.token) {
      setToken(data.token);
    }

    setUser(data.user);
    return data.user;
  };

  // ================= GOOGLE LOGIN =================

  const googleLogin = async (googleToken: string) => {
    console.log("🔐 googleLogin called");
    
    const res = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: googleToken }),
    });

    const data = await res.json();
    console.log("📦 Google response:", data);

    if (!res.ok) {
      throw new Error(data.message || "Google login failed");
    }

    if (data.accessToken) {
      setToken(data.accessToken);
    }

    setUser(data.user);
    return data.user;
  };

  // ================= REGISTER =================

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Register failed");

    if (data.token) {
      setToken(data.token);
    }

    setUser(data.user);
    return data.user;
  };

  // ================= LOGOUT =================

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      removeToken();
      setUser(null);
    }
  };

  // ================= REFRESH =================

  const refreshUser = async () => {
    try {
      const res = await fetch(`${API_URL}/user`, {
        credentials: "include",
      });

      if (!res.ok) {
        removeToken();
        setUser(null);
        return null;
      }

      const data = await res.json();
      setUser(data);
      return data;
    } catch {
      removeToken();
      setUser(null);
      return null;
    }
  };

  // ================= VALUE =================

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    googleLogin,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ================= HOOK =================

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};