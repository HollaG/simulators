import { useRef, useState, type ReactNode } from "react";
import "./style.css";

export type SitePage = "home" | "mackie" | "cinetreak";
export const SOURCE_URL = "https://github.com/HollaG/simulators";

/** Every page uses this shell. Pass the site's root, not the simulator's asset base,
 * so navigation works from both nested Pages URLs and the local development hub.
 */
export function SiteLayout({
  page,
  base = "/",
  theme = "light",
  manual,
  children,
}: {
  page: SitePage;
  base?: string;
  theme?: "light" | "dark";
  manual?: { title: string; url: string };
  children: ReactNode;
}) {
  const root = `${base.replace(/\/+$/, "")}/`;
  const [split, setSplit] = useState(false);
  const splitButton = useRef<HTMLButtonElement>(null);
  const closeManual = () => {
    setSplit(false);
    splitButton.current?.focus();
  };
  return (
    <div className="pd-site" data-theme={theme}>
      <a className="pd-skip" href="#practice-content">
        Skip to content
      </a>
      <header className="pd-header">
        <a className="pd-brand" href={root} aria-label="Practice desk home">
          <span className="pd-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4" />
            </svg>
          </span>
          <span>
            practice<span className="pd-brand-light">desk</span>
            <small>THE HANDS-ON PRACTICE LAB</small>
          </span>
        </a>
        <nav className="pd-nav" aria-label="Main navigation">
          <a href={root} aria-current={page === "home" ? "page" : undefined}>
            All simulators
          </a>
          <a
            href={`${root}mackie-profx22v3/`}
            aria-current={page === "mackie" ? "page" : undefined}
          >
            Mackie
          </a>
          <a
            href={`${root}cinetreak-mixer-plus/`}
            aria-current={page === "cinetreak" ? "page" : undefined}
          >
            CineTreak
          </a>
          <a
            className="pd-source"
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Source <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <div className="pd-content" id="practice-content">
        {manual && (
          <div className="pd-manual-tools">
            <span className="pd-manual-label">
              OWNER’S MANUAL <strong>{manual.title}</strong>
            </span>
            <div>
              <button
                ref={splitButton}
                type="button"
                className="pd-manual-button"
                aria-pressed={split}
                aria-controls="pd-manual"
                onClick={() => setSplit((value) => !value)}
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                >
                  <rect x="2" y="3" width="16" height="14" rx="2" />
                  <path d="M11 3v14" />
                </svg>
                Split view
              </button>
              <a
                className="pd-manual-button"
                href={manual.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open PDF in new tab <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        )}
        <div className="pd-workspace" data-split={split}>
          {/* Keep this subtree mounted while changing layout: audio, video and desk state continue. */}
          <div className="pd-simulator-pane">{children}</div>
          {manual && (
            <aside
              className="pd-manual"
              id="pd-manual"
              aria-label={`${manual.title} manual`}
              hidden={!split}
            >
              <div className="pd-manual-heading">
                <span>
                  {manual.title} <small>OWNER’S MANUAL</small>
                </span>
                <button
                  type="button"
                  aria-label="Close manual"
                  onClick={closeManual}
                >
                  ×
                </button>
              </div>
              {split && (
                <iframe
                  title={`${manual.title} PDF manual`}
                  src={`${manual.url}#view=FitH&navpanes=0`}
                />
              )}
              <p className="pd-manual-tip">
                Use the PDF toolbar to search or change pages. You can also open
                the PDF in a new tab.
              </p>
            </aside>
          )}
        </div>
      </div>
      <footer className="pd-footer">
        <span>
          <i aria-hidden="true" /> Built for rehearsal. Ready for the real desk.
        </span>
        <div>
          <a
            href={`${SOURCE_URL}/tree/main/skill`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Build your own simulator ↗
          </a>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
          <span>Independent practice tools</span>
        </div>
      </footer>
    </div>
  );
}
