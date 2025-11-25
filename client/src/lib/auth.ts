import { type User } from "@shared/schema";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "consultant" | "client";
  avatar?: string | null;
  geminiApiKey?: string | null;
  geminiApiKeys?: string[] | null;
  isActive?: boolean;
}

export const getToken = (): string | null => {
  return localStorage.getItem("token");
};

export const setToken = (token: string): void => {
  localStorage.setItem("token", token);
};

export const removeToken = (): void => {
  localStorage.removeItem("token");
};

export const getAuthUser = (): AuthUser | null => {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setAuthUser = (user: AuthUser): void => {
  localStorage.setItem("user", JSON.stringify(user));
};

export const removeAuthUser = (): void => {
  localStorage.removeItem("user");
};

export const logout = (): void => {
  // Mark that user is actively logging out
  localStorage.setItem('isLoggingOut', 'true');
  
  removeToken();
  removeAuthUser();
  localStorage.removeItem('sessionId');
  window.location.href = "/login";
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  const user = getAuthUser();
  return !!(token && user);
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};
