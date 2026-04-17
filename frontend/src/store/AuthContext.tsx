import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { authApi } from "../api/services";
import type { AuthResponse, User } from "../types/api";
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth
} from "../utils/authStorage";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  initialized: boolean;
  login: (payload: Record<string, unknown>) => Promise<AuthResponse>;
  register: (payload: Record<string, unknown>) => Promise<AuthResponse>;
  logout: () => void;
  setCurrentUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const initialAuth = readStoredAuth();
  const [user, setUser] = useState<User | null>(initialAuth?.user ?? null);
  const [token, setToken] = useState<string | null>(initialAuth?.token ?? null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setInitialized(true);
        return;
      }

      try {
        const profile = await authApi.me();
        setUser(profile);
        writeStoredAuth({ token, user: profile });
      } catch (_error) {
        clearStoredAuth();
        setUser(null);
        setToken(null);
      } finally {
        setInitialized(true);
      }
    };

    void bootstrap();
  }, [token]);

  const handleAuthResponse = async (
    action: () => Promise<AuthResponse>
  ): Promise<AuthResponse> => {
    const response = await action();
    setUser(response.user);
    setToken(response.token);
    writeStoredAuth(response);
    return response;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initialized,
      login: (payload) => handleAuthResponse(() => authApi.login(payload)),
      register: (payload) => handleAuthResponse(() => authApi.register(payload)),
      logout: () => {
        clearStoredAuth();
        setUser(null);
        setToken(null);
      },
      setCurrentUser: (nextUser) => {
        setUser(nextUser);
        if (token) {
          writeStoredAuth({ token, user: nextUser });
        }
      }
    }),
    [initialized, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
};
