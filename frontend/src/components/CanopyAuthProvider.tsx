"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { getApiBase } from "@/lib/api-base";

export function CanopyAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider apiBase={getApiBase()} tokenKey="canopy_auth_token">
      {children}
    </AuthProvider>
  );
}
