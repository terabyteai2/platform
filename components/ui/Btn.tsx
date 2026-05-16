"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "accent" | "primary" | "secondary" | "ghost" | "warn";
type Size = "sm" | "md" | "lg";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  accent:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] active:bg-[var(--accent-deep)]",
  primary:
    "bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] active:bg-black",
  secondary:
    "bg-[var(--surface)] text-[var(--ink)] border border-[var(--hairline)] hover:border-[var(--ink-soft)] active:bg-[var(--surface-soft)]",
  ghost:
    "bg-transparent text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] active:bg-[var(--hairline-soft)]",
  warn: "bg-[var(--warn)] text-white hover:opacity-90 active:opacity-80",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[13px] px-3 py-1.5 rounded-[8px]",
  md: "text-sm px-4 py-2.5 rounded-[10px]",
  lg: "text-[15px] px-6 py-3.5 rounded-[12px]",
};

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 font-semibold tracking-tight",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Btn.displayName = "Btn";
