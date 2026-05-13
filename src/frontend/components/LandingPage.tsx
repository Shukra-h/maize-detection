import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { FiArrowRight, FiBarChart2, FiBookOpen, FiImage } from "react-icons/fi";
import AuthModal, { type AuthMode } from "./AuthModal";

interface LandingPageProps {
  authConfigured: boolean;
  authLoading: boolean;
  onLogout: () => void;
  onStart: () => void;
  user: User | null;
}

const steps = [
  {
    icon: FiImage,
    title: "Upload a leaf",
    text: "Start with a clear maize leaf photo from the demo device or your computer.",
  },
  {
    icon: FiBarChart2,
    title: "Review confidence",
    text: "The app returns the top class plus confidence scores across the trained labels.",
  },
  {
    icon: FiBookOpen,
    title: "Read guidance",
    text: "Accepted predictions include short treatment and prevention notes for review.",
  },
];

function LandingPage({
  authConfigured,
  authLoading,
  onLogout,
  onStart,
  user,
}: LandingPageProps) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__scene" aria-hidden="true">
          <div className="study-sheet">
            <div className="study-sheet__rule" />
            <div className="leaf-sample">
              <span />
            </div>
            <div className="scan-readout">
              <div className="scan-readout__line scan-readout__line--wide" />
              <div className="scan-readout__line" />
              <div className="scan-readout__score">87%</div>
            </div>
          </div>
        </div>

        <nav className="landing-nav" aria-label="Project">
          <div className="landing-nav__identity">
            <span className="landing-brand">Maize Detection</span>
            <span className="landing-tag">Academic project demo</span>
          </div>

          <div className="landing-nav__actions">
            {!authConfigured ? (
              <span className="landing-account">Add Supabase keys to enable auth</span>
            ) : authLoading ? (
              <span className="landing-account">Checking session...</span>
            ) : user ? (
              <>
                <span className="landing-account">Signed in as {displayName}</span>
                <button className="landing-nav-button" type="button" onClick={onLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <button className="landing-nav-button" type="button" onClick={() => setAuthMode("login")}>
                  Log in
                </button>
                <button
                  className="landing-nav-button landing-nav-button--solid"
                  type="button"
                  onClick={() => setAuthMode("signup")}
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="landing-hero__content">
          <p className="landing-kicker">Maize leaf diagnosis study</p>
          <h1 id="landing-title">A simple demo for maize leaf disease detection.</h1>
          <p className="landing-copy">
            Upload a maize leaf image, run the trained classifier, and review the model's
            confidence across common maize health classes.
          </p>

          <div className="landing-actions">
            <button className="landing-primary" type="button" onClick={onStart}>
              Start detection
              <FiArrowRight aria-hidden="true" />
            </button>
            <span className="landing-footnote">Built for demonstration and study.</span>
          </div>
        </div>
      </section>

      <section className="landing-overview" aria-label="Demo overview">
        <div className="overview-heading">
          <p className="landing-kicker">What the demo shows</p>
          <h2>One focused workflow from image to prediction.</h2>
        </div>

        <div className="overview-grid">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <article className="overview-card" key={step.title}>
                <Icon className="overview-card__icon" aria-hidden="true" />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onModeChange={setAuthMode}
        />
      )}
    </main>
  );
}

export default LandingPage;
