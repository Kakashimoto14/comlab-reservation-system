import { useEffect, useState } from "react";

const COMPORT_INTRO_KEY = "comportIntroShown";
const INTRO_DURATION_MS = 1500;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const useSessionIntro = () => {
  const [showIntro, setShowIntro] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const reduceMotion = mediaQuery.matches;
    const introAlreadyShown = sessionStorage.getItem(COMPORT_INTRO_KEY) === "true";

    setPrefersReducedMotion(reduceMotion);

    if (reduceMotion || introAlreadyShown) {
      sessionStorage.setItem(COMPORT_INTRO_KEY, "true");
      setShowIntro(false);
      setIsReady(true);
      return;
    }

    setShowIntro(true);

    const timeout = window.setTimeout(() => {
      sessionStorage.setItem(COMPORT_INTRO_KEY, "true");
      setShowIntro(false);
      setIsReady(true);
    }, INTRO_DURATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return {
    showIntro,
    isReady,
    prefersReducedMotion
  };
};
