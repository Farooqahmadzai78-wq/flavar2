import { Sparkles, HelpCircle, GraduationCap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { vibrate } from "@/lib/vibration";
import { playClick } from "@/lib/sfx";

interface PageTutorialButtonProps {
  onClick: () => void;
  variant?: "icon" | "pill" | "subtle" | "floating";
  className?: string;
  label?: string;
}

export function PageTutorialButton({
  onClick,
  variant = "icon",
  className = "",
  label,
}: PageTutorialButtonProps) {
  const { t } = useI18n();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    vibrate(10);
    playClick();
    onClick();
  };

  const buttonLabel = label || t.pageTutorial || "Guide";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={buttonLabel}
        aria-label={buttonLabel}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 text-emerald-400 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-xs ${className}`}
      >
        <Sparkles className="size-3.5 text-emerald-400 animate-pulse" />
        <span>{buttonLabel}</span>
      </button>
    );
  }

  if (variant === "subtle") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={buttonLabel}
        aria-label={buttonLabel}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition active:scale-95 cursor-pointer ${className}`}
      >
        <HelpCircle className="size-3.5" />
        <span>{buttonLabel}</span>
      </button>
    );
  }

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={buttonLabel}
        aria-label={buttonLabel}
        className={`fixed bottom-20 right-4 z-40 size-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-400/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md ${className}`}
      >
        <Sparkles className="size-5" />
      </button>
    );
  }

  // Default "icon" button
  return (
    <button
      type="button"
      onClick={handleClick}
      title={buttonLabel}
      aria-label={buttonLabel}
      className={`size-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 dark:bg-card/60 dark:hover:bg-card text-foreground/80 hover:text-foreground border border-border/60 backdrop-blur-md transition-all active:scale-90 cursor-pointer shadow-xs ${className}`}
    >
      <HelpCircle className="size-4.5 text-emerald-500 dark:text-emerald-400" />
    </button>
  );
}
