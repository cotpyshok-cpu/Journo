"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Button, Modal, inputClass } from "@/components/ui/primitives";

export function AuthModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    setErrorMsg(null);
    setEmailSubmitted(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to Journo"
      subtitle="Sign in with Google to sync your calendar, or jump straight into your planner"
    >
      <div className="space-y-4">
        <div className="grid gap-2.5">
          <a
            href="/api/auth/google?intent=login&next=/app"
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#2F453B] px-4 py-2.5 text-sm font-semibold text-[#F6F4EF] hover:bg-[#3D564B] transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            Continue with Google
          </a>

          <Link
            href="/app?view=S03"
            onClick={onClose}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#DFDBD0] bg-white px-4 py-2.5 text-sm font-semibold text-[#2F453B] hover:bg-[#ECE9E1] transition-colors"
          >
            Continue with Apple
          </Link>
        </div>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-[#DFDBD0]" />
          <span className="mx-3 text-xs font-medium text-[#5E766B]">or sign in with email</span>
          <div className="flex-grow border-t border-[#DFDBD0]" />
        </div>

        {emailSubmitted ? (
          <div className="rounded-xl border border-[#C6DDD2] bg-[#E6F1EC] p-4 text-sm text-[#2F453B] space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-[#3F7A63] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Check your inbox at {email}</p>
                <p className="text-xs text-[#5E766B] mt-0.5">
                  No need to wait — you can jump straight into your daily setup.
                </p>
              </div>
            </div>
            <Link
              href="/app?view=S03"
              onClick={onClose}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#C67D63] px-4 text-sm font-semibold text-white hover:bg-[#B26B52]"
            >
              Continue to Setup
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleEmailSignIn} className="space-y-3" noValidate>
            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-[#2F453B] mb-1">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="amina@astanahub.kz"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="auth-pass" className="block text-xs font-semibold text-[#2F453B] mb-1">
                Password
              </label>
              <input
                id="auth-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className={inputClass}
              />
            </div>

            {errorMsg ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#E4C7C7] bg-[#F5E6E6] px-3 py-2.5 text-xs text-[#B05454]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <Button type="submit" variant="primary" className="w-full">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Continue with Email
            </Button>
          </form>
        )}

        <div className="pt-2 border-t border-[#DFDBD0] text-center">
          <Link
            href="/app"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C67D63] hover:underline"
          >
            Skip sign-in and try Journo now
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Modal>
  );
}
