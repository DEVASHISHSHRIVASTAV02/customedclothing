"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthModalMode = "signup" | "login";
type AuthModalView = "auth" | "forgot-request" | "forgot-confirm";

type OpenAuthModalOptions = {
  mode?: AuthModalMode;
  reason?: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

type AuthModalContextValue = {
  openAuthModal: (options?: OpenAuthModalOptions) => void;
  closeAuthModal: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

async function readResponseJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return {} as { error?: unknown };
  }

  try {
    return JSON.parse(text) as { error?: unknown };
  } catch {
    return {} as { error?: unknown };
  }
}

function responseErrorMessage(data: { error?: unknown }, fallback: string) {
  if (typeof data.error !== "string") {
    return fallback;
  }

  const value = data.error.trim();
  return value.length > 0 ? value : fallback;
}

function CustomerAuthModal({
  open,
  initialMode,
  reason,
  onClose,
  onAuthSuccess,
}: {
  open: boolean;
  initialMode: AuthModalMode;
  reason: string | null;
  onClose: () => void;
  onAuthSuccess: () => void;
}) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [view, setView] = useState<AuthModalView>("auth");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode(initialMode);
    setView("auth");
    setLogin("");
    setPassword("");
    setConfirmPassword("");
    setResetEmail("");
    setResetOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setLoading(false);
    setError(null);
    setNotice(null);
  }, [open, initialMode]);

  useEffect(() => {
    if (mode === "login") {
      setConfirmPassword("");
    }
  }, [mode]);

  if (!open) {
    return null;
  }

  const submitLabel =
    view === "forgot-request"
      ? "Send OTP"
      : view === "forgot-confirm"
        ? "Reset Password"
        : mode === "signup"
          ? "Create Account"
          : "Log In";
  const heading =
    view === "forgot-request"
      ? "Reset your password"
      : view === "forgot-confirm"
        ? "Enter OTP and new password"
        : mode === "signup"
          ? "Create your account"
          : "Log in to your account";

  const openForgotPassword = () => {
    setMode("login");
    setView("forgot-request");
    setResetEmail(login.includes("@") ? login.trim().toLowerCase() : "");
    setResetOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPassword("");
    setError(null);
    setNotice(null);
  };

  const backToLogin = () => {
    setMode("login");
    setView("auth");
    setLogin(resetEmail || login);
    setPassword("");
    setResetOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError(null);
    setNotice(null);
  };

  const onAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const signupResponse = await fetch("/api/customer/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password }),
        });

        const signupData = await readResponseJson(signupResponse);
        if (!signupResponse.ok) {
          throw new Error(responseErrorMessage(signupData, "Unable to create account."));
        }
      }

      const result = await signIn("customer-credentials", {
        login,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid login credentials.");
      }

      onAuthSuccess();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const onRequestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const response = await fetch("/api/customer/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const responseData = await readResponseJson(response);
      if (!response.ok) {
        throw new Error(responseErrorMessage(responseData, "Unable to send OTP right now."));
      }

      setView("forgot-confirm");
      setNotice("If your account exists with this email, OTP has been sent. Check inbox/spam.");
      setResetOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send OTP right now.");
    } finally {
      setLoading(false);
    }
  };

  const onConfirmReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/customer/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          otp: resetOtp,
          newPassword,
        }),
      });
      const responseData = await readResponseJson(response);
      if (!response.ok) {
        throw new Error(responseErrorMessage(responseData, "Unable to reset password right now."));
      }

      const signInResult = await signIn("customer-credentials", {
        login: resetEmail,
        password: newPassword,
        redirect: false,
      });

      if (!signInResult?.error) {
        onAuthSuccess();
        return;
      }

      setMode("login");
      setView("auth");
      setLogin(resetEmail);
      setPassword("");
      setResetOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
      setNotice("Password reset successful. Log in with your new password.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset password right now.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    if (view === "forgot-request") {
      return onRequestOtp(event);
    }

    if (view === "forgot-confirm") {
      return onConfirmReset(event);
    }

    return onAuthSubmit(event);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#000000]/45 px-4 py-8 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <Card className="relative z-[81] w-full max-w-md">
        <CardHeader className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]">CUSTOMED Account</p>
          <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
          {reason && <p className="text-sm text-[#000000]">{reason}</p>}
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-3">
            {view === "auth" ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-[#000000]">Email ID or Phone Number</label>
                  <Input
                    required
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder="you@example.com or +911234567890"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#000000]">Password</label>
                  <Input
                    required
                    type="password"
                    value={password}
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                {mode === "login" ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs font-medium text-[#000000] underline underline-offset-2"
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : null}

                {mode === "signup" ? (
                  <div className="space-y-1">
                    <label className="text-xs text-[#000000]">Re-enter Password</label>
                    <Input
                      required
                      type="password"
                      value={confirmPassword}
                      minLength={8}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your password"
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {view === "forgot-request" ? (
              <div className="space-y-1">
                <label className="text-xs text-[#000000]">Registered Email ID</label>
                <Input
                  required
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            ) : null}

            {view === "forgot-confirm" ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-[#000000]">Registered Email ID</label>
                  <Input
                    required
                    type="email"
                    value={resetEmail}
                    onChange={(event) => setResetEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#000000]">OTP</label>
                  <Input
                    required
                    value={resetOtp}
                    onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit OTP"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#000000]">New Password</label>
                  <Input
                    required
                    type="password"
                    value={newPassword}
                    minLength={8}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#000000]">Confirm New Password</label>
                  <Input
                    required
                    type="password"
                    value={confirmNewPassword}
                    minLength={8}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
              </>
            ) : null}

            {error && <p className="text-sm text-danger">{error}</p>}
            {notice && <p className="text-sm text-[#0f5f2e]">{notice}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : submitLabel}
            </Button>

            {view === "auth" ? (
              mode === "signup" ? (
                <p className="text-sm text-[#000000]">
                  Already a member?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="ml-1 inline-flex rounded-full border border-[#000000] bg-[#000000] px-2.5 py-1 text-xs font-medium text-[#ffffff] transition-colors hover:border-[#000000] hover:bg-[#000000] active:border-[#000000] active:bg-[#000000]"
                  >
                    Log In
                  </button>
                </p>
              ) : (
                <p className="text-sm text-[#000000]">
                  Need an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="ml-1 inline-flex rounded-full border border-[#000000] bg-[#000000] px-2.5 py-1 text-xs font-medium text-[#ffffff] transition-colors hover:border-[#000000] hover:bg-[#000000] active:border-[#000000] active:bg-[#000000]"
                  >
                    Sign Up
                  </button>
                </p>
              )
            ) : (
              <div className="flex items-center justify-between text-sm text-[#000000]">
                {view === "forgot-confirm" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot-request");
                      setResetOtp("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                      setError(null);
                      setNotice(null);
                    }}
                    className="font-medium text-[#000000] underline underline-offset-2"
                  >
                    Resend OTP
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={backToLogin} className="font-medium text-[#000000] underline underline-offset-2">
                  Back to Log In
                </button>
              </div>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("signup");
  const [reason, setReason] = useState<string | null>(null);
  const successCallbackRef = useRef<(() => void) | null>(null);
  const closeCallbackRef = useRef<(() => void) | null>(null);

  const closeAuthModal = useCallback(() => {
    const closeCallback = closeCallbackRef.current;
    setOpen(false);
    setReason(null);
    successCallbackRef.current = null;
    closeCallbackRef.current = null;
    closeCallback?.();
  }, []);

  const openAuthModal = useCallback((options?: OpenAuthModalOptions) => {
    setMode(options?.mode ?? "signup");
    setReason(options?.reason ?? null);
    successCallbackRef.current = options?.onSuccess ?? null;
    closeCallbackRef.current = options?.onClose ?? null;
    setOpen(true);
  }, []);

  const onAuthSuccess = useCallback(() => {
    const callback = successCallbackRef.current;
    setOpen(false);
    setReason(null);
    successCallbackRef.current = null;
    closeCallbackRef.current = null;
    callback?.();
  }, []);

  const value = useMemo<AuthModalContextValue>(
    () => ({
      openAuthModal,
      closeAuthModal,
    }),
    [openAuthModal, closeAuthModal],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <CustomerAuthModal
        open={open}
        initialMode={mode}
        reason={reason}
        onClose={closeAuthModal}
        onAuthSuccess={onAuthSuccess}
      />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within AuthModalProvider.");
  }
  return context;
}



