import clsx from "clsx";

interface PillProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Pill({ label, selected, onClick, className }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center px-3 py-1 text-sm font-medium rounded-[999px] border",
        "transition-all duration-150",
        selected
          ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
          : "bg-white text-[#3a342c] border-[#e2ddd1] hover:border-[#1a1a1a] hover:text-[#14110d]",
        className
      )}
    >
      {label}
    </button>
  );
}
