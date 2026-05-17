export const StartupSplash = () => (
  <div
    className="comport-startup-shell"
    role="status"
    aria-live="polite"
    aria-label="Initializing ComPort"
  >
    <div className="comport-startup-backdrop" aria-hidden="true">
      <div className="comport-startup-orb comport-startup-orb-left" />
      <div className="comport-startup-orb comport-startup-orb-right" />
    </div>

    <div className="comport-startup-card">
      <div className="comport-startup-brand">
        <img src="/comport-logo.png" alt="" className="comport-startup-logo" />
        <div className="comport-startup-copy">
          <p className="comport-startup-eyebrow">ComPort Laboratory Portal</p>
          <h1 className="comport-startup-title">Initializing ComPort...</h1>
          <p className="comport-startup-subtitle">
            Preparing schedules, reservations, and secure access to your laboratory workspace.
          </p>
        </div>
      </div>

      <div className="comport-startup-progress" aria-hidden="true">
        <span className="comport-startup-progress-bar" />
      </div>

      <div className="comport-startup-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  </div>
);
