"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  login: async () => false,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const STORAGE_KEY = "te_admin_session";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      verifyKey(stored).then((valid) => {
        setIsAuthenticated(valid);
        if (!valid) sessionStorage.removeItem(STORAGE_KEY);
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!checking && !isAuthenticated && pathname?.startsWith("/admin") && pathname !== "/admin/login") {
      router.replace("/admin/login");
    }
  }, [checking, isAuthenticated, pathname, router]);

  async function verifyKey(key: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/admin/tenants/`, {
        headers: { "X-Admin-Key": key },
        cache: "no-store",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function login(password: string): Promise<boolean> {
    const valid = await verifyKey(password);
    if (valid) {
      sessionStorage.setItem(STORAGE_KEY, password);
      setIsAuthenticated(true);
    }
    return valid;
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
    router.replace("/admin/login");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
