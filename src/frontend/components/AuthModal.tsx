import { useState, type FormEvent } from "react";
import { FiX } from "react-icons/fi";
import { useI18n } from "./i18n";
import { supabase } from "./supabaseClient";

export type AuthMode = "login" | "signup";

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}

//Handles login/setup model w form state, validation, and UI feedback
function AuthModal({ mode, onClose, onModeChange }: AuthModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isSignup = mode === "signup";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError(t("authModal.supabaseMissing"));
      setSubmitting(false);
      return;
    }

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: window.location.origin,
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          onClose();
          return;
        }

        setMessage(t("authModal.accountCreated"));
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          throw loginError;
        }

        onClose();
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t("authModal.authFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-overlay" role="presentation">
      <section
        aria-labelledby="auth-modal-title"
        aria-modal="true"
        className="auth-dialog"
        role="dialog"
      >
        <button className="auth-close" type="button" onClick={onClose} aria-label={t("authModal.close")}>
          <FiX aria-hidden="true" />
        </button>

        <div className="auth-dialog__intro">

          <h2 id="auth-modal-title">{isSignup ? t("authModal.createTitle") : t("authModal.loginTitle")}</h2>
         
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="auth-field">
              <span>{t("authModal.name")}</span>
              <input
                autoComplete="name"
                maxLength={80}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                type="text"
                value={name}
              />
            </label>
          )}

          <label className="auth-field">
            <span>{t("authModal.email")}</span>
            <input
              autoComplete="email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="auth-field">
            <span>{t("authModal.password")}</span>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              maxLength={128}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}

          <button className="landing-primary auth-submit" disabled={submitting} type="submit">
            {submitting ? t("authModal.wait") : isSignup ? t("authModal.createAccount") : t("auth.login")}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? t("authModal.haveAccount") : t("authModal.needAccount")}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              onModeChange(isSignup ? "login" : "signup");
            }}
          >
            {isSignup ? t("auth.login") : t("auth.signup")}
          </button>
        </p>
      </section>
    </div>
  );
}

export default AuthModal;
