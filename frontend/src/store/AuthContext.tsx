import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { authApi } from "../api/services";
import type { AuthActionResponse, AuthResponse, User } from "../types/api";

type AuthContextValue = {
  user: User | null;
  initialized: boolean;
  login: (payload: Record<string, unknown>) => Promise<AuthResponse>;
  register: (payload: Record<string, unknown>) => Promise<AuthActionResponse>;
  logout: () => void;
  setCurrentUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const profile = await authApi.me();
        setUser(profile);
      } catch (_error) {
        setUser(null);
      } finally {
        setInitialized(true);
      }
    };

    void bootstrap();
  }, []);

  const handleAuthResponse = async (
    action: () => Promise<AuthResponse>
  ): Promise<AuthResponse> => {
    const response = await action();
    setUser(response.user);
    return response;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initialized,
      login: (payload) => handleAuthResponse(() => authApi.login(payload)),
      register: (payload) => authApi.register(payload),
      logout: () => {
        void authApi.logout().catch(() => undefined);
        setUser(null);
      },
      setCurrentUser: (nextUser) => setUser(nextUser)
    }),
    [initialized, user]
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
