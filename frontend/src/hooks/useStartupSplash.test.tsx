import { act, renderHook } from "@testing-library/react";

import { useStartupSplash } from "./useStartupSplash";

describe("useStartupSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.dataset.comportStartup = "loading";
    document.body.innerHTML = '<div id="app-startup-shell"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("keeps the splash visible for at least the minimum duration", () => {
    const { result, rerender } = renderHook(({ isReady }) => useStartupSplash(isReady), {
      initialProps: { isReady: false }
    });

    expect(result.current.showSplash).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    rerender({ isReady: true });
    expect(result.current.showSplash).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.showSplash).toBe(false);
    expect(document.body.dataset.comportStartup).toBe("ready");
  });

  it("hides the splash after the safety timeout even if readiness never arrives", () => {
    const { result } = renderHook(() => useStartupSplash(false));

    act(() => {
      vi.advanceTimersByTime(6500);
    });

    expect(result.current.showSplash).toBe(false);
    expect(document.body.dataset.comportStartup).toBe("ready");
  });
});
