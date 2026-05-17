import { useEffect, useState } from "react";

const MIN_SPLASH_DURATION_MS = 1200;
const MAX_SPLASH_DURATION_MS = 6500;

export const useStartupSplash = (isReady: boolean) => {
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [safetyElapsed, setSafetyElapsed] = useState(false);

  useEffect(() => {
    const minimumTimer = window.setTimeout(() => {
      setMinimumElapsed(true);
    }, MIN_SPLASH_DURATION_MS);
    const safetyTimer = window.setTimeout(() => {
      setSafetyElapsed(true);
    }, MAX_SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(minimumTimer);
      window.clearTimeout(safetyTimer);
    };
  }, []);

  const showSplash = !safetyElapsed && (!minimumElapsed || !isReady);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.dataset.comportStartup = showSplash ? "loading" : "ready";

    if (!showSplash) {
      const startupShell = document.getElementById("app-startup-shell");
      const cleanupTimer = window.setTimeout(() => {
        startupShell?.remove();
      }, 220);

      return () => {
        window.clearTimeout(cleanupTimer);
      };
    }

    return;
  }, [showSplash]);

  return {
    showSplash
  };
};
