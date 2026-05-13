import type { User } from "@supabase/supabase-js";
import { FiArrowRight, FiBarChart2, FiBookOpen, FiImage } from "react-icons/fi";
import AuthControls from "./AuthControls";
import LanguageToggle from "./LanguageToggle";
import { useI18n } from "./i18n";

interface LandingPageProps {
  authConfigured: boolean;
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onSignup: () => void;
  onStart: () => void;
  user: User | null;
}

const steps = [
  {
    icon: FiImage,
    titleKey: "landing.stepUploadTitle",
    textKey: "landing.stepUploadText",
  },
  {
    icon: FiBarChart2,
    titleKey: "landing.stepConfidenceTitle",
    textKey: "landing.stepConfidenceText",
  },
  {
    icon: FiBookOpen,
    titleKey: "landing.stepGuidanceTitle",
    textKey: "landing.stepGuidanceText",
  },
];

function LandingPage({
  authConfigured,
  authLoading,
  onLogin,
  onLogout,
  onSignup,
  onStart,
  user,
}: LandingPageProps) {
  const { t } = useI18n();

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

        <nav className="landing-nav" aria-label={t("app.academicDemo")}>
          <div className="landing-nav__identity">
            <span className="landing-brand">{t("app.brand")}</span>
            <span className="landing-tag">{t("app.academicDemo")}</span>
          </div>

          <div className="landing-nav__actions">
            <LanguageToggle />
            <AuthControls
              authConfigured={authConfigured}
              authLoading={authLoading}
              onLogin={onLogin}
              onLogout={onLogout}
              onSignup={onSignup}
              user={user}
            />
          </div>
        </nav>

        <div className="landing-hero__content">
          <p className="landing-kicker">{t("landing.kicker")}</p>
          <h1 id="landing-title">{t("landing.title")}</h1>
          <p className="landing-copy">{t("landing.copy")}</p>

          <div className="landing-actions">
            <button className="landing-primary" type="button" onClick={onStart}>
              {t("landing.start")}
              <FiArrowRight aria-hidden="true" />
            </button>
            <span className="landing-footnote">{t("landing.footnote")}</span>
          </div>
        </div>
      </section>

      <section className="landing-overview" aria-label={t("landing.overviewKicker")}>
        <div className="overview-heading">
          <p className="landing-kicker">{t("landing.overviewKicker")}</p>
          <h2>{t("landing.overviewTitle")}</h2>
        </div>

        <div className="overview-grid">
          {steps.map((step) => {
            const Icon = step.icon;
            const title = t(step.titleKey);

            return (
              <article className="overview-card" key={step.titleKey}>
                <Icon className="overview-card__icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{t(step.textKey)}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
