import { Cpu, Monitor } from "lucide-react";

export const ComPortIntroOverlay = () => (
  <div className="comport-intro-overlay" aria-hidden="true">
    <div className="comport-intro-panel">
      <div className="comport-intro-emblem">
        <img src="/comport-logo.png" alt="" className="comport-intro-logo" />
        <div className="comport-intro-icon-shell">
          <Monitor className="h-7 w-7" />
          <Cpu className="comport-intro-cpu h-3.5 w-3.5" />
        </div>
      </div>

      <div className="comport-intro-copy">
        <p className="comport-intro-eyebrow">ComPort Laboratory Portal</p>
        <h1 className="comport-intro-title">Initializing ComPort...</h1>
        <p className="comport-intro-subtitle">
          Preparing your computer laboratory reservation portal
        </p>
      </div>

      <div className="comport-intro-progress" />

      <div className="comport-intro-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  </div>
);
