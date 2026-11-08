import type { ReactNode } from "react";
import "./style.css";

export type SitePage = "home" | "mackie" | "cinetreak";
export const SOURCE_URL = "https://github.com/HollaG/simulators";

/** Every page uses this shell. Pass the site's root, not the simulator's asset base,
 * so navigation works from both nested Pages URLs and the local development hub.
 */
export function SiteLayout({
  page,
  base = "/",
  children,
}: {
  page: SitePage;
  base?: string;
  children: ReactNode;
}) {
  const root = `${base.replace(/\/+$/, "")}/`;
  return (
    <div className="pd-site">
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
        {children}
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
