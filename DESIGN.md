# practicedesk collection

Three static pages are built from independent npm workspaces: the practice library
at `/simulators/`, Mackie at `/simulators/mackie-profx22v3/`, and CineTreak at
`/simulators/cinetreak-mixer-plus/`. Native links and directory indexes support
direct visits, refresh and browser history on GitHub Pages without an SPA router.

Both apps retain their original engines, controls, calibration, media handling,
tests and documented accuracy limits. Their existing localStorage keys and the
CineTreak IndexedDB database stay separate. Uploaded media stays in the browser.
The new origin paths do not migrate media or settings from the old sites.

`packages/ui` contains the single header and footer implementation used by all
three pages. Their branding, spacing, navigation and content are consistent;
the current page gets an active navigation state. Page-specific help, sources
and reset controls stay in each simulator's practice area. The shared shell accepts a colour theme without changing its layout or content.
The Mackie and library pages use the light green theme; the video desk uses a
dark mint theme throughout, including its header and footer.

Each simulator supplies its own manual metadata and a public `manual.pdf`. The
shared shell offers an optional split layout and a new-tab PDF link. The manual
uses the browser's PDF reader; no PDF library or worker is required. Desktop
places the PDF beside the desk, with a sticky reader; small screens stack it
above the desk. Only the iframe is mounted/unmounted when toggling, so the desk's
audio/video resources and configuration continue. Closing returns focus to the
split button. This view preference is transient. Simulator keyboard shortcuts
exclude the manual tools and reader.

The landing page links every simulator and the published `skill/` source. It uses
the real panel images already supplied for the simulators. The full local skill
is copied as a distributable snapshot, including its references, UI metadata and
PDF helper. No additional website page is needed to read it on GitHub.

The root build invokes each workspace's own compiler/Vite version, combines their
static outputs into `dist/`, and copies the skill. `VITE_BASE_PATH` controls each
app's asset directory; `VITE_SITE_BASE` points shared navigation at the collection
root. GitHub Actions derives the root from Pages metadata. The development hub
proxies the simulator servers, so the same navigation works locally.

Validation keeps each engine's logic and browser tests, plus production tests for
cross-page navigation, live Mackie audio meters, CineTreak CUT/LCD output,
restoration, shared shell content, direct reloads and responsive page widths.
Static preview returns 404 for missing files so incorrect deployment paths cannot
silently return the landing HTML. None of these checks establishes physical
hardware accuracy.
