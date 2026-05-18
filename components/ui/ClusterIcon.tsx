import { Icon } from "@/components/ui/Icon";

interface ClusterIconProps {
  id: string;
  index?: number;
  size?: "sm" | "md";
}

const variants = [
  Icon.Message,
  Icon.People,
  Icon.Lightbulb,
  Icon.Scale,
  Icon.Shield,
  Icon.Leaf,
  Icon.Sparkle,
];

const tones = [
  { bg: "#f3ede2", fg: "#5b4a34" },
  { bg: "#e8f0ed", fg: "#305b4d" },
  { bg: "#edf0f7", fg: "#384f7a" },
  { bg: "#f4e9e5", fg: "#85472f" },
];

function hash(input: string) {
  let value = 0;
  for (let i = 0; i < input.length; i++) {
    value = (value * 31 + input.charCodeAt(i)) >>> 0;
  }
  return value;
}

export function ClusterIcon({ id, index, size = "md" }: ClusterIconProps) {
  const seed = typeof index === "number" ? index : hash(id);
  const Glyph = variants[seed % variants.length];
  const tone = tones[seed % tones.length];
  const box = size === "sm" ? "h-8 w-8 rounded-[7px]" : "h-10 w-10 rounded-[8px]";
  const glyphSize = size === "sm" ? 15 : 18;

  return (
    <span
      className={`${box} shrink-0 inline-flex items-center justify-center border`}
      style={{ background: tone.bg, color: tone.fg, borderColor: "var(--hairline-soft)" }}
      aria-hidden="true"
    >
      <Glyph size={glyphSize} sw={2} />
    </span>
  );
}
