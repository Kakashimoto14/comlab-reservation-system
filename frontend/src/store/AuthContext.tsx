import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authApi } from "../api/services";
import { subscribeToAuthFailures } from "../api/client";
import type { AuthActionResponse, AuthResponse, User } from "../types/api";

const ASSISTANT_SESSION_STORAGE_KEY = "comportAssistantConversation";

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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  const clearClientState = (targetUserId?: number | null) => {
    queryClient.clear();

    if (typeof targetUserId === "number") {
      sessionStorage.removeItem(`${ASSISTANT_SESSION_STORAGE_KEY}:${targetUserId}`);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const profile = await authApi.me();

        if (isMounted) {
          setUser(profile);
        }
      } catch (_error) {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setInitialized(true);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeToAuthFailures(() => {
      clearClientState(user?.id);
      setUser(null);
      setInitialized(true);
    });
  }, [queryClient, user?.id]);

  const handleAuthResponse = async (
    action: () => Promise<AuthResponse>
  ): Promise<AuthResponse> => {
    const response = await action();
    clearClientState(user?.id);
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
        clearClientState(user?.id);
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
