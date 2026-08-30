import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Lightbulb,
  HelpCircle,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { playClick, playConfirm } from "@/lib/sfx";
import { vibrate } from "@/lib/vibration";
import {
  getPageTutorial,
  isPageTutorialSeen,
  markPageTutorialAsSeen,
  type PageTutorialId,
  type PageTutorialData,
} from "@/lib/page-tutorials";

interface PageTutorialModalProps {
  pageId: PageTutorialId;
  isOpen: boolean;
  onClose: () => void;
  /** Optional custom title override */
  customTitle?: string;
}

export function PageTutorialModal({
  pageId,
  isOpen,
  onClose,
  customTitle,
}: PageTutorialModalProps) {
  const { locale, t } = useI18n();
  const tutorial: PageTutorialData = getPageTutorial(pageId, locale);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  // Reset to first step whenever reopened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  const totalSteps = tutorial.steps.length;
  const currentStep = tutorial.steps[currentStepIndex] || tutorial.steps[0];

  const handleNext = () => {
    vibrate(10);
    playClick();
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    vibrate(8);
    playClick();
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    playConfirm();
    vibrate(20);
    if (dontShowAgain) {
      markPageTutorialAsSeen(pageId);
    }
    onClose();
  };

  const handleSkip = () => {
    vibrate(8);
    if (dontShowAgain) {
      markPageTutorialAsSeen(pageId);
    }
    onClose();
  };

  if (!isOpen || typeof document === "undefined") return null;

  const MainIcon = tutorial.icon;
  const StepIcon = currentStep.icon;

  return createPortal(
    <div
      id={`page-tutorial-modal-overlay-${pageId}`}
      className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSkip();
      }}
    >
      <motion.div
        id={`page-tutorial-card-${pageId}`}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-lg rounded-3xl bg-slate-900/95 border border-emerald-500/30 text-white shadow-2xl shadow-emerald-950/60 backdrop-blur-2xl overflow-hidden flex flex-col my-auto"
      >
        {/* Glow ambient accent behind header */}
        <div className="absolute -top-24 -right-24 size-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 px-5 pt-5 pb-3 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
              <MainIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-400">
                  {t.tutorialBadge || "Guide & Tutoriel"}
                </span>
                <span className="size-1 rounded-full bg-emerald-400/60" />
                <span className="text-[11px] font-medium text-white/60">
                  {currentStepIndex + 1} / {totalSteps}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {customTitle || tutorial.pageName}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            aria-label={t.close || "Fermer"}
            className="size-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Progress Bar & Step Dots */}
        <div className="relative z-10 px-5 pt-3 pb-1 flex items-center gap-1.5">
          {tutorial.steps.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                vibrate(6);
                setCurrentStepIndex(idx);
              }}
              aria-label={`${t.step || "Étape"} ${idx + 1}`}
              className="flex-1 h-1.5 rounded-full transition-all cursor-pointer overflow-hidden relative bg-white/15 hover:bg-white/30"
            >
              {idx <= currentStepIndex && (
                <motion.div
                  layoutId={`progress-fill-${pageId}`}
                  className="absolute inset-0 bg-emerald-400 shadow-[0_0_8px_#34d399]"
                />
              )}
            </button>
          ))}
        </div>

        {/* Main Step Content with animated transitions */}
        <div className="relative z-10 p-5 sm:p-6 flex-1 flex flex-col justify-between min-h-[260px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="space-y-4"
            >
              {/* Step Badge & Icon Header */}
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
                  <StepIcon className="size-6 text-emerald-300" />
                </div>
                <div>
                  {currentStep.badge && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                      {currentStep.badge}
                    </span>
                  )}
                  <h4 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {currentStep.title}
                  </h4>
                </div>
              </div>

              {/* Step Description */}
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                {currentStep.description}
              </p>

              {/* Practical Tip Callout */}
              {currentStep.tip && (
                <div className="rounded-2xl bg-emerald-950/50 border border-emerald-500/25 p-3 sm:p-3.5 flex items-start gap-2.5 shadow-sm">
                  <div className="size-6 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide">
                      {t.practicalTip || "Astuce pratique"}
                    </p>
                    <p className="text-xs text-emerald-100/90 leading-relaxed mt-0.5">
                      {currentStep.tip}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="relative z-10 px-5 py-4 border-t border-white/10 bg-slate-950/60 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 active:scale-95 transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="size-4" />
              <span>{t.previous || "Précédent"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="px-3 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                {t.skip || "Passer"}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  {currentStepIndex === totalSteps - 1
                    ? t.finishTutorial || "Terminer"
                    : t.next || "Suivant"}
                </span>
                {currentStepIndex === totalSteps - 1 ? (
                  <Check className="size-4 stroke-[2.5]" />
                ) : (
                  <ChevronRight className="size-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>

          {/* Don't show again toggle */}
          <label className="flex items-center justify-center gap-2 text-[11px] text-white/60 cursor-pointer pt-1 hover:text-white/80 transition">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-white/30 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-white/10 size-3.5 accent-emerald-500 cursor-pointer"
            />
            <span>{t.markTutorialAsSeen || "Ne plus ouvrir automatiquement sur cette page"}</span>
          </label>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/**
 * Hook to automatically check if tutorial was seen, with auto-opening for first visit and manual trigger helper.
 */
export function usePageTutorial(pageId: PageTutorialId, autoOpen = true) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (autoOpen && !isPageTutorialSeen(pageId)) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [pageId, autoOpen]);

  const openTutorial = useCallback(() => {
    vibrate(10);
    playClick();
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openTutorial,
    closeTutorial,
  };
}
