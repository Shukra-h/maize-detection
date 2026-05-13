import type { User } from "@supabase/supabase-js";
import { useI18n } from "./i18n";

interface AuthControlsProps {
  authConfigured: boolean;
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onSignup: () => void;
  user: User | null;
  variant?: "landing" | "detector";
}

function getDisplayName(user: User, fallback: string): string {
  const metadataName = user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] || fallback;
}

function AuthControls({
  authConfigured,
  authLoading,
  onLogin,
  onLogout,
  onSignup,
  user,
  variant = "landing",
}: AuthControlsProps) {
  const { t } = useI18n();
  const accountClass = variant === "detector" ? "detector-account" : "landing-account";
  const buttonClass = variant === "detector" ? "detector-auth-button" : "landing-nav-button";
  const primaryButtonClass =
    variant === "detector"
      ? "detector-auth-button detector-auth-button--solid"
      : "landing-nav-button landing-nav-button--solid";

  if (!authConfigured) {
    return <span className={accountClass}>{t("auth.addSupabase")}</span>;
  }

  if (authLoading) {
    return <span className={accountClass}>{t("auth.checkingSession")}</span>;
  }

  if (user) {
    const displayName = getDisplayName(user, t("auth.userFallback"));

    return (
      <>
        <span className={accountClass}>{t("auth.signedInAs", { name: displayName })}</span>
        <button className={buttonClass} type="button" onClick={onLogout}>
          {t("auth.logout")}
        </button>
      </>
    );
  }

  return (
    <>
      <button className={buttonClass} type="button" onClick={onLogin}>
        {t("auth.login")}
      </button>
      <button className={primaryButtonClass} type="button" onClick={onSignup}>
        {t("auth.signup")}
      </button>
    </>
  );
}

export default AuthControls;
