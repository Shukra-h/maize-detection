import { LANGUAGES, useI18n, type LanguageCode } from "./i18n";

interface LanguageToggleProps {
  variant?: "landing" | "detector";
}

function LanguageToggle({ variant = "landing" }: LanguageToggleProps) {
  const { language, setLanguage, t } = useI18n();
  const className =
    variant === "detector"
      ? "language-toggle language-toggle--detector"
      : "language-toggle";

  return (
    <div className={className} aria-label={t("language.label")} role="group">
      {LANGUAGES.map((item) => (
        <button
          aria-pressed={language === item.code}
          key={item.code}
          onClick={() => setLanguage(item.code as LanguageCode)}
          title={t(`language.${item.code}`)}
          type="button"
        >
          {item.shortLabel}
        </button>
      ))}
    </div>
  );
}

export default LanguageToggle;
