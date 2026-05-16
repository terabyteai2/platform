"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "warn";
type Size = "sm" | "md" | "lg";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#1a1a1a] text-white hover:opacity-85 active:opacity-75 shadow-sm",
  secondary:
    "bg-white text-[#14110d] border border-[#e2ddd1] hover:bg-[#f5f2ec] active:bg-[#ece9e2]",
  ghost:
    "bg-transparent text-[#3a342c] hover:bg-[#ececec] active:bg-[#e2ddd1]",
  warn: "bg-[#b85c1e] text-white hover:opacity-85 active:opacity-75",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-[6px]",
  md: "text-sm px-4 py-2.5 rounded-[6px]",
  lg: "text-base px-6 py-3 rounded-[12px]",
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
          "inline-flex items-center justify-center gap-2 font-medium",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2",
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
