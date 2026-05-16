"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser, initialsFor } from "@/lib/user-context";
import { Btn } from "@/components/ui/Btn";
import clsx from "clsx";

interface RobotMicAvatarProps {
  size: number;
  active: boolean;       // true when user has a displayName
  initials: string;      // displayed when active
  listening?: boolean;   // pulses the antenna red while true
}

/**
 * A tiny robot-mic character. Rounded "mic capsule" head with two LED eyes and
 * an antenna (mic feature) on top, sitting on a small stand. When `active`,
 * the eyes are replaced by the user's initials.
 */
function RobotMicAvatar({ size, active, initials, listening }: RobotMicAvatarProps) {
  // Viewbox: 40x40. Head 26x22 centered. Antenna pin on top. Stand at bottom.
  const head = {
    bg: active ? "var(--ink)" : "var(--surface)",
    stroke: active ? "var(--ink)" : "var(--hairline)",
    eye: active ? "var(--paper)" : "var(--ink-soft)",
    accent: active ? "var(--accent-soft)" : "var(--paper)",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Antenna stem */}
      <line x1="20" y1="4" x2="20" y2="8" stroke={head.stroke} strokeWidth="1.5" strokeLinecap="round" />
      {/* Antenna ball — turns red while listening */}
      <circle
        cx="20"
        cy="3"
        r="2"
        fill={listening ? "var(--live)" : active ? "var(--accent)" : "var(--ink-soft)"}
      >
        {listening && (
          <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Head / mic capsule */}
      <rect
        x="7"
        y="9"
        width="26"
        height="22"
        rx="7"
        fill={head.bg}
        stroke={head.stroke}
        strokeWidth="1.5"
        strokeDasharray={active ? undefined : "2.5 2"}
      />

      {/* Face plate */}
      {active && initials ? (
        <text
          x="20"
          y="23.5"
          textAnchor="middle"
          fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
          fontWeight="700"
          fontSize="11"
          fill={head.eye}
          letterSpacing="0.4"
        >
          {initials}
        </text>
      ) : (
        <>
          {/* Two LED eyes */}
          <circle cx="14.5" cy="18" r="1.8" fill={head.eye} />
          <circle cx="25.5" cy="18" r="1.8" fill={head.eye} />
          {/* Small mouth dash */}
          <line
            x1="16.5"
            y1="24.5"
            x2="23.5"
            y2="24.5"
            stroke={head.eye}
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.5"
          />
        </>
      )}

      {/* Mic grille — three horizontal bars at the bottom of the head */}
      <g opacity={active ? "0.35" : "0.55"} stroke={head.stroke} strokeWidth="1" strokeLinecap="round">
        <line x1="13" y1="28" x2="27" y2="28" />
      </g>

      {/* Stand neck */}
      <rect x="18.5" y="31" width="3" height="3" rx="0.5" fill={head.stroke} />
      {/* Base */}
      <rect x="14" y="34" width="12" height="2.5" rx="1.25" fill={head.stroke} />
    </svg>
  );
}

interface AvatarProps {
  size?: "sm" | "md" | "lg";
  /** If true, no popover — purely decorative (e.g. inside cards). */
  readOnly?: boolean;
  placement?: "top" | "bottom";
}

export function Avatar({ size = "md", readOnly = false, placement = "bottom" }: AvatarProps) {
  const {
    user,
    updateName,
    prompt,
    resolvePrompt,
    openEditor,
    editorOpen,
    setEditorOpen,
  } = useCurrentUser();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const open = !readOnly && editorOpen;
  const hasPrompt = !!prompt;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setDraft(user?.displayName ?? "");
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, user?.displayName]);

  // Click-outside / Escape to close
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      if (hasPrompt) resolvePrompt(false);
      else setEditorOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (hasPrompt) resolvePrompt(false);
        else setEditorOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [hasPrompt, open, resolvePrompt, setEditorOpen]);

  async function save() {
    const trimmed = draft.trim();
    if (hasPrompt && trimmed === "") {
      setError("Please add your name to continue.");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await updateName(trimmed === "" ? null : trimmed);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (hasPrompt) resolvePrompt(true);
    else setEditorOpen(false);
  }

  async function clearName() {
    setSaving(true);
    setError(null);
    const res = await updateName(null);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditorOpen(false);
  }

  const initials = initialsFor(user?.displayName);
  const hasName = !!user?.displayName;
  const px = size === "sm" ? 32 : size === "lg" ? 48 : 40;
  const wrapperSize = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-14 h-14" : "w-10 h-10";

  const button = (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        if (readOnly) return;
        if (hasPrompt) return;
        if (editorOpen && !hasPrompt) setEditorOpen(false);
        else openEditor();
      }}
      disabled={readOnly}
      suppressHydrationWarning
      aria-label={hasName ? `Signed in as ${user!.displayName}` : "Set your name"}
      className={clsx(
        "shrink-0 flex items-center justify-center transition-transform",
        wrapperSize,
        !readOnly && "rounded-full border border-[var(--hairline)] bg-[var(--surface)] shadow-[0_12px_36px_-18px_rgba(20,17,13,0.5)] hover:scale-[1.06] active:scale-95 cursor-pointer",
        readOnly && "cursor-default"
      )}
      style={readOnly ? { background: "transparent", border: "none", padding: 0 } : { padding: 0 }}
    >
      <RobotMicAvatar
        size={px}
        active={hasName}
        initials={initials}
        listening={false}
      />
    </button>
  );

  if (readOnly) return button;

  return (
    <div className="relative">
      {button}
      {open && (
        <div
          ref={popoverRef}
          className={clsx(
            "absolute right-0 w-72 voices-card p-4 z-50",
            placement === "top" ? "bottom-full mb-3" : "mt-2"
          )}
          style={{
            boxShadow:
              "0 1px 0 var(--hairline), 0 12px 32px -16px rgba(20,17,13,0.25)",
          }}
        >
          <span className="voices-eyebrow">
            {hasPrompt ? "NAME REQUIRED" : hasName ? "YOUR NAME" : "ADD YOUR NAME"}
          </span>
          <p
            className="mt-2 text-[13px] text-[var(--muted)] leading-snug bn-text"
            style={{ fontFamily: "Hind Siliguri, sans-serif" }}
          >
            {prompt?.message ?? "Choose how you want to appear. Leave blank to stay anonymous."}
          </p>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder="e.g. Aisha R."
            maxLength={40}
            autoFocus
            className="mt-3 w-full px-3 py-2.5 rounded-[8px] border text-[14px] bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
            style={{ fontFamily: "Hind Siliguri, Plus Jakarta Sans, sans-serif" }}
          />
          {error && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--warn)" }}>
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            {hasPrompt ? (
              <span className="voices-eyebrow">SAVED TO YOUR PROFILE</span>
            ) : (
              <button
                type="button"
                onClick={clearName}
                disabled={saving || !hasName}
                className="voices-eyebrow hover:text-[var(--ink)] disabled:opacity-30 transition-colors"
              >
                {hasName ? "GO ANONYMOUS" : "ANONYMOUS"}
              </button>
            )}
            <div className="flex items-center gap-2">
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (hasPrompt) resolvePrompt(false);
                  else setEditorOpen(false);
                }}
              >
                Cancel
              </Btn>
              <Btn variant="accent" size="sm" onClick={save} loading={saving}>
                Save
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FloatingAvatar() {
  return (
    <div className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-[70]">
      <Avatar size="lg" placement="top" />
    </div>
  );
}
