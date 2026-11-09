import { createRoot } from "react-dom/client";
import { SiteLayout, SOURCE_URL } from "@practicedesk/ui";
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  Check,
  Code2,
  MousePointer2,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import "./style.css";

const base = import.meta.env.BASE_URL;
const simulators = [
  {
    slug: "yamaha-mg10xu",
    number: "04",
    name: "MG10XU",
    brand: "YAMAHA",
    type: "COMPACT AUDIO MIXER",
    image: "mg10xu.webp",
    className: "mg10xu",
    Icon: AudioLines,
    description: "Make every turn count. Set your gain, add an effect, and practise a clean USB monitoring mix.",
    features: ["Gain & compression", "24 FX programs", "USB monitoring", "Real audio meters"],
    detail: "10 inputs · 7 control strips",
  },
  {
    slug: "yamaha-stagepas400i",
    number: "03",
    name: "STAGEPAS 400i",
    brand: "YAMAHA",
    type: "PORTABLE PA",
    image: "stagepas.webp",
    className: "stagepas",
    Icon: AudioLines,
    description:
      "Start small. Balance a band, add a little reverb, and get comfortable with your portable PA.",
    features: [
      "Mic & line inputs",
      "Two-band EQ",
      "SPX-style reverb",
      "Monitor & sub outputs",
    ],
    detail: "8 inputs · 6 control strips",
  },
  {
    slug: "mackie-profx22v3",
    number: "01",
    name: "ProFX22v3",
    brand: "MACKIE",
    type: "AUDIO MIXING",
    image: "mackie.webp",
    className: "audio",
    Icon: AudioLines,
    description:
      "Find your balance. Work the faders, shape your sound, and learn where every signal goes.",
    features: ["Gain & EQ", "Monitor mixes", "PFL & routing", "24 FX presets"],
    detail: "22 channels · 4 buses",
  },
  {
    slug: "cinetreak-mixer-plus",
    number: "02",
    name: "Mixer Plus",
    brand: "CINETREAK",
    type: "VIDEO SWITCHING",
    image: "cinetreak.png",
    className: "video",
    Icon: Video,
    description:
      "Line up the next shot. Rehearse live cuts, smooth transitions, keys, and camera moves.",
    features: [
      "Preview & program",
      "CUT / AUTO",
      "Keys & overlays",
      "Virtual PTZ",
    ],
    detail: "4 inputs · Live multiview",
  },
];

function Landing() {
  return (
    <SiteLayout page="home" base={base}>
      <main className="home-main">
        <section className="home-hero">
          <div>
            <div className="home-eyebrow">
              <span /> A LITTLE PRACTICE. A LOT MORE CONFIDENCE.
            </div>
            <h1>
              Get to know
              <br />
              your <span>gear.</span>
            </h1>
            <p>
              The desk might be unfamiliar. The next show doesn’t have to be.
              <br className="desktop-break" /> Get hands-on with audio and video
              hardware, right in your browser.
            </p>
            <a className="home-button" href="#simulators">
              Find your practice desk <ArrowDown size={15} />
            </a>
          </div>
          <aside className="hero-note">
            <div className="hero-note-top">
              <SlidersHorizontal size={19} />
              <span>DESIGNED FOR REHEARSAL</span>
            </div>
            <p>
              Real layouts.
              <br />
              Working controls.
              <br />
              <em>Room to make mistakes.</em>
            </p>
            <div className="hero-note-bottom">
              <span>
                <Check size={12} /> No hardware needed
              </span>
              <span>
                <Check size={12} /> No sign-up
              </span>
            </div>
          </aside>
        </section>
        <section
          className="library"
          id="simulators"
          aria-labelledby="library-title"
        >
          <div className="library-heading">
            <div>
              <div className="home-eyebrow">THE PRACTICE LIBRARY</div>
              <h2 id="library-title">Pick a desk. Make it familiar.</h2>
            </div>
            <span className="library-count">
              {String(simulators.length).padStart(2, "0")} SIMULATORS <i />
            </span>
          </div>
          <div className="simulator-grid">
            {simulators.map(
              ({
                slug,
                number,
                name,
                brand,
                type,
                image,
                className,
                Icon,
                description,
                features,
                detail,
              }) => (
                <article className={`simulator-card ${className}`} key={slug}>
                  <a
                    className="simulator-image"
                    href={`${base}${slug}/`}
                    aria-label={`Open ${brand} ${name} simulator`}
                  >
                    <span className="image-category">
                      <Icon size={12} /> {type}
                    </span>
                    <img
                      src={`${base}${image}`}
                      alt={`${brand} ${name} physical control panel`}
                    />
                    <span className="image-index">DESK / {number}</span>
                    <span className="image-arrow" aria-hidden="true">
                      <ArrowUpRight size={20} />
                    </span>
                  </a>
                  <div className="simulator-info">
                    <div className="card-eyebrow">
                      <span>{brand}</span>
                      <span>{detail}</span>
                    </div>
                    <h3>{name}</h3>
                    <p>{description}</p>
                    <div className="feature-list">
                      {features.map((feature) => (
                        <span key={feature}>{feature}</span>
                      ))}
                    </div>
                    <a className="open-simulator" href={`${base}${slug}/`}>
                      Open simulator <ArrowUpRight size={16} />
                    </a>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
        <section className="practice-notes" aria-label="How to practise">
          <div>
            <span className="note-icon">
              <MousePointer2 size={18} />
            </span>
            <h3>Learn by doing.</h3>
            <p>
              Click, drag, turn, and try again. Follow the physical layout and
              build familiarity at your own pace.
            </p>
          </div>
          <div>
            <span className="note-icon">
              <AudioLines size={18} />
            </span>
            <h3>Bring your own show.</h3>
            <p>
              Start with built-in practice sources, or load local media to
              rehearse with something familiar.
            </p>
          </div>
          <div>
            <span className="note-icon">
              <SlidersHorizontal size={18} />
            </span>
            <h3>Take it to the real desk.</h3>
            <p>
              Build confidence with the workflow. Check the accuracy notes, then
              compare with your own hardware.
            </p>
          </div>
        </section>
        <section className="build-banner">
          <span className="build-icon">
            <Code2 size={25} />
          </span>
          <div>
            <div className="home-eyebrow">
              OPEN SOURCE. OPEN TO EXPLORATION.
            </div>
            <h2>Your next desk could be here.</h2>
            <p>
              Explore the code and the hardware-simulator skill used to build
              these practice tools.
            </p>
          </div>
          <a
            className="home-button secondary"
            href={`${SOURCE_URL}/tree/main/skill`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore the skill <ArrowUpRight size={15} />
          </a>
        </section>
      </main>
    </SiteLayout>
  );
}
createRoot(document.getElementById("root")!).render(<Landing />);
