import React from "react";
import { cn } from "@/lib/utils";

interface JournoLogoProps {
  variant?: "dark" | "light" | "coral";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

export function JournoLogo({
  variant = "dark",
  size = "md",
  showWordmark = true,
  className,
}: JournoLogoProps) {
  const iconSize = size === "sm" ? 28 : size === "lg" ? 42 : 34;
  const textClass =
    size === "sm"
      ? "text-lg"
      : size === "lg"
        ? "text-2xl"
        : "text-xl";

  const pathStroke =
    variant === "light"
      ? "#F6F4EF"
      : variant === "coral"
        ? "#F6F4EF"
        : "#C67D63";

  const wordmarkColor =
    variant === "light" || variant === "coral" ? "text-[#F6F4EF]" : "text-[#2F453B]";

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M10 42C16 42 22 38 28 29C34 20 39 14 45 16C51 18 50 30 40 36C30 42 26 32 34 23C41 15 49 16 54 21"
          stroke={pathStroke}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47 13L56 21.5L46 26.5"
          stroke={pathStroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark ? (
        <span
          className={cn(
            "font-display font-bold tracking-tight lowercase",
            textClass,
            wordmarkColor
          )}
        >
          journo
        </span>
      ) : null}
    </span>
  );
}
