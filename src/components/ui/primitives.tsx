"use client";

import React, { useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "dark" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary:
      "bg-[#C67D63] hover:bg-[#B26B52] text-white border border-transparent",
    secondary:
      "bg-[#ECE9E1] hover:bg-[#E3DFD5] text-[#2F453B] border border-[#DFDBD0]",
    dark:
      "bg-[#2F453B] hover:bg-[#3D564B] text-[#F6F4EF] border border-transparent",
    outline:
      "bg-white hover:bg-[#F6F4EF] text-[#2F453B] border border-[#DFDBD0]",
    ghost:
      "bg-transparent hover:bg-[#ECE9E1] text-[#2F453B] border border-transparent",
    danger:
      "bg-[#B05454] hover:bg-[#9E4949] text-white border border-transparent",
  };

  const sizeClasses = {
    sm: "min-h-[38px] px-3 text-xs rounded-lg",
    md: "min-h-[44px] px-4 text-sm rounded-xl",
    lg: "min-h-[48px] px-6 text-base rounded-xl",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.96] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  dark = false,
}: {
  className?: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 transition-colors duration-150",
        dark
          ? "bg-[#2F453B] text-[#F6F4EF] border border-[#3D564B]"
          : "bg-white text-[#2F453B] border border-[#DFDBD0]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "neutral" | "coral" | "forest" | "safe" | "warn" | "danger";
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-[#ECE9E1] text-[#2F453B] border border-[#DFDBD0]",
    coral: "bg-[#F4E8E3] text-[#B26B52] border border-[#E2C2B5]",
    forest: "bg-[#2F453B] text-[#F6F4EF] border border-[#2F453B]",
    safe: "bg-[#E6F1EC] text-[#3F7A63] border border-[#C6DDD2]",
    warn: "bg-[#F6EFE2] text-[#9C6B3B] border border-[#E6D6B8]",
    danger: "bg-[#F5E6E6] text-[#B05454] border border-[#E4C7C7]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  id,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-150 disabled:opacity-50",
        checked ? "bg-[#C67D63]" : "bg-[#D6CEB8]"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-150",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = "max-w-lg",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
      containerRef.current.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2F453B]/55 p-0 sm:p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journo-modal-title"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className={cn(
          "w-full max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#F6F4EF] border border-[#DFDBD0] p-5 text-[#2F453B]",
          maxWidth
        )}
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#DFDBD0]">
          <div>
            <h2 id="journo-modal-title" className="font-display text-lg font-bold tracking-tight">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-[#5E766B]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECE9E1] hover:bg-[#DFDBD0] text-[#2F453B] transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full min-h-[44px] rounded-xl border border-[#DFDBD0] bg-white px-3.5 py-2 text-sm text-[#2F453B] placeholder:text-[#5E766B]/60 focus:border-[#C67D63] focus:outline-none";
