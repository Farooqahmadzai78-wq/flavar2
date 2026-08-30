import { useState, useEffect, useRef, useMemo } from "react";
import {
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  MapPin,
  Palette,
  Play,
  Pause,
  QrCode,
  Search,
  Sparkles,
  Volume2,
  AlertCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/app-settings";
import { useI18n, type LocaleCode } from "@/lib/i18n";
import { playClick, playConfirm } from "@/lib/sfx";
import { vibrate } from "@/lib/vibration";
import {
  isOnboardingCompleted,
  setOnboardingCompleted,
  subscribeToOnboardingOpen,
} from "@/lib/onboarding-state";

interface LanguageItem {
  code: LocaleCode;
  nativeName: string;
  subName: string;
  flag: string;
  isRtl?: boolean;
}

const ONBOARDING_LANGUAGES: LanguageItem[] = [
  { code: "ps", nativeName: "پښتو", subName: "Pashto", flag: "🇦🇫", isRtl: true },
  { code: "fr", nativeName: "Français", subName: "French", flag: "🇫🇷" },
  { code: "ar", nativeName: "العربية", subName: "Arabic (Standard)", flag: "🇸🇦", isRtl: true },
  { code: "en", nativeName: "English", subName: "English", flag: "🇬🇧" },
  { code: "ur", nativeName: "اردو", subName: "Urdu", flag: "🇵🇰", isRtl: true },
  { code: "tr", nativeName: "Türkçe", subName: "Turkish", flag: "🇹🇷" },
  { code: "fa", nativeName: "فارسی", subName: "Persian / Farsi", flag: "🇮🇷", isRtl: true },
  { code: "ar-DZ", nativeName: "الدارجة الجزائرية", subName: "Algerian Arabic", flag: "🇩🇿", isRtl: true },
  { code: "ar-MA", nativeName: "الدارجة المغربية", subName: "Moroccan Arabic", flag: "🇲🇦", isRtl: true },
  { code: "ar-EG", nativeName: "العامية المصرية", subName: "Egyptian Arabic", flag: "🇪🇬", isRtl: true },
  { code: "ar-TN", nativeName: "الدارجة التونسية", subName: "Tunisian Arabic", flag: "🇹🇳", isRtl: true },
  { code: "de", nativeName: "Deutsch", subName: "German", flag: "🇩🇪" },
  { code: "es", nativeName: "Español", subName: "Spanish", flag: "🇪🇸" },
  { code: "pt", nativeName: "Português", subName: "Portuguese", flag: "🇵🇹" },
  { code: "it", nativeName: "Italiano", subName: "Italian", flag: "🇮🇹" },
  { code: "nl", nativeName: "Nederlands", subName: "Dutch", flag: "🇳🇱" },
  { code: "ru", nativeName: "Русский", subName: "Russian", flag: "🇷🇺" },
  { code: "pl", nativeName: "Polski", subName: "Polish", flag: "🇵🇱" },
  { code: "ro", nativeName: "Română", subName: "Romanian", flag: "🇷🇴" },
  { code: "el", nativeName: "Ελληνικά", subName: "Greek", flag: "🇬🇷" },
  { code: "sq", nativeName: "Shqip", subName: "Albanian", flag: "🇦🇱" },
  { code: "bs", nativeName: "Bosanski", subName: "Bosnian", flag: "🇧🇦" },
  { code: "sv", nativeName: "Svenska", subName: "Swedish", flag: "🇸🇪" },
  { code: "no", nativeName: "Norsk", subName: "Norwegian", flag: "🇳🇴" },
  { code: "da", nativeName: "Dansk", subName: "Danish", flag: "🇩🇰" },
  { code: "fi", nativeName: "Suomi", subName: "Finnish", flag: "🇫🇮" },
  { code: "hi", nativeName: "हिन्दी", subName: "Hindi", flag: "🇮🇳" },
  { code: "bn", nativeName: "বাংলা", subName: "Bengali", flag: "🇧🇩" },
  { code: "pa", nativeName: "ਪੰਜਾਬੀ", subName: "Punjabi", flag: "🇮🇳" },
  { code: "gu", nativeName: "ગુજરાતી", subName: "Gujarati", flag: "🇮🇳" },
  { code: "mr", nativeName: "मराठी", subName: "Marathi", flag: "🇮🇳" },
  { code: "ta", nativeName: "தமிழ்", subName: "Tamil", flag: "🇮🇳" },
  { code: "te", nativeName: "తెలుగు", subName: "Telugu", flag: "🇮🇳" },
  { code: "ml", nativeName: "മലയാളം", subName: "Malayalam", flag: "🇮🇳" },
  { code: "kn", nativeName: "ಕನ್ನಡ", subName: "Kannada", flag: "🇮🇳" },
  { code: "id", nativeName: "Bahasa Indonesia", subName: "Indonesian", flag: "🇮🇩" },
  { code: "ms", nativeName: "Bahasa Melayu", subName: "Malay", flag: "🇲🇾" },
  { code: "ha", nativeName: "Hausa", subName: "Hausa", flag: "🇳🇬" },
  { code: "sw", nativeName: "Kiswahili", subName: "Swahili", flag: "🇹🇿" },
  { code: "zh", nativeName: "中文", subName: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "ja", nativeName: "日本語", subName: "Japanese", flag: "🇯🇵" },
  { code: "ko", nativeName: "한국어", subName: "Korean", flag: "🇰🇷" },
  { code: "vi", nativeName: "Tiếng Việt", subName: "Vietnamese", flag: "🇻🇳" },
  { code: "th", nativeName: "ไทย", subName: "Thai", flag: "🇹🇭" },
  { code: "uz", nativeName: "Oʻzbekcha", subName: "Uzbek", flag: "🇺🇿" },
  { code: "kk", nativeName: "Қазақша", subName: "Kazakh", flag: "🇰🇿" },
  { code: "ky", nativeName: "Кыргызча", subName: "Kyrgyz", flag: "🇰🇬" },
  { code: "tg", nativeName: "Тоҷикӣ", subName: "Tajik", flag: "🇹🇯" },
  { code: "tk", nativeName: "Türkmençe", subName: "Turkmen", flag: "🇹🇲" },
  { code: "az", nativeName: "Azərbaycan dili", subName: "Azerbaijani", flag: "🇦🇿" },
];

function MiniKaaba3D({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="24" cy="40" rx="15" ry="4" fill="black" opacity="0.25" />
      <path d="M24 6 L40 14 L40 36 L24 44 L8 36 L8 14 Z" fill="#18181b" />
      <path d="M8 14 L24 22 L24 44 L8 36 Z" fill="#09090b" opacity="0.9" />
      <path d="M24 22 L40 14 L40 36 L24 44 Z" fill="#27272a" />
      <path d="M24 6 L40 14 L24 22 L8 14 Z" fill="#3f3f46" />
      <path d="M8 19 L24 27 L40 19 L40 22 L24 30 L8 22 Z" fill="#facc15" />
      <path d="M28 27 L34 24 L34 35 L28 38 Z" fill="#eab308" stroke="#fef08a" strokeWidth="0.5" />
    </svg>
  );
}

export function AppOnboardingModal({ onComplete }: { onComplete: () => void }) {
  const { settings, update } = useSettings();
  const { t } = useI18n();

  const [step, setStep] = useState<number>(0);
  const [visible, setVisible] = useState(false);
  const [langSearch, setLangSearch] = useState("");

  // Slide 1 (Prayer) state
  const [isPlayingAdhanDemo, setIsPlayingAdhanDemo] = useState(false);
  const [selectedReminderOffset, setSelectedReminderOffset] = useState<number>(15);
  const [checkedPrayers, setCheckedPrayers] = useState<Record<string, boolean>>({
    fajr: true,
    dhuhr: true,
    asr: false,
    maghrib: false,
    isha: false,
  });

  // Slide 2 (Quran) state
  const [activeQuranTab, setActiveQuranTab] = useState<"arabic" | "translit" | "translation">("arabic");
  const [selectedReciterDemo, setSelectedReciterDemo] = useState("alafasy");

  // Slide 3 (Halal) state
  const [activeHalalSample, setActiveHalalSample] = useState<"halal" | "doubtful" | "haram">("halal");

  // Slide 4 (Tasbih) state
  const [tasbihCount, setTasbihCount] = useState<number>(12);
  const [tasbihPhraseIndex, setTasbihPhraseIndex] = useState<number>(0);

  // Slide 5 (Qibla) state
  const [isQiblaAligned, setIsQiblaAligned] = useState(false);

  // Slide 6 (Themes) state
  const [selectedThemePreview, setSelectedThemePreview] = useState<string>(
    settings.widgetTheme || "w-grad-vert-chartreuse",
  );

  const audioToneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      setVisible(true);
      document.body.style.overflow = "hidden";
    }

    const unsubscribe = subscribeToOnboardingOpen(() => {
      setStep(0);
      setVisible(true);
      document.body.style.overflow = "hidden";
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioToneIntervalRef.current) {
        clearInterval(audioToneIntervalRef.current);
        audioToneIntervalRef.current = null;
      }
    };
  }, [step]);

  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return ONBOARDING_LANGUAGES;
    return ONBOARDING_LANGUAGES.filter(
      (item) =>
        item.nativeName.toLowerCase().includes(q) ||
        item.subName.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q),
    );
  }, [langSearch]);

  if (!visible) return null;

  const totalSlides = 6;

  const handleSelectLanguage = (langCode: LocaleCode) => {
    playClick();
    vibrate("button");
    update({ language: langCode });
  };

  const handleNext = () => {
    playClick();
    vibrate("button");
    if (step < totalSlides) {
      setStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    playClick();
    vibrate("button");
    if (step > 0) {
      setStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    playClick();
    handleComplete();
  };

  const handleComplete = () => {
    setOnboardingCompleted(true);
    document.body.style.overflow = "";
    setVisible(false);
    onComplete();
  };

  const toggleAdhanDemoSound = () => {
    vibrate("button");
    if (isPlayingAdhanDemo) {
      setIsPlayingAdhanDemo(false);
      if (audioToneIntervalRef.current) {
        clearInterval(audioToneIntervalRef.current);
        audioToneIntervalRef.current = null;
      }
    } else {
      setIsPlayingAdhanDemo(true);
      playConfirm();
      let note = 0;
      const notes = [440, 493.88, 554.37, 659.25, 554.37, 440];
      audioToneIntervalRef.current = setInterval(() => {
        note = (note + 1) % notes.length;
        if (note === 0) {
          setIsPlayingAdhanDemo(false);
          if (audioToneIntervalRef.current) {
            clearInterval(audioToneIntervalRef.current);
            audioToneIntervalRef.current = null;
          }
        }
      }, 700);
    }
  };

  const handlePrayerToggle = (prayerKey: string) => {
    playConfirm();
    vibrate("button");
    setCheckedPrayers((prev) => ({ ...prev, [prayerKey]: !prev[prayerKey] }));
  };

  const handleTasbihTap = () => {
    playClick();
    vibrate("button");
    setTasbihCount((prev) => {
      const next = prev + 1;
      if (next >= 33) {
        playConfirm();
        setTasbihPhraseIndex((p) => (p + 1) % 3);
        return 0;
      }
      return next;
    });
  };

  const tasbihPhrases = [
    {
      ar: "سُبْحَانَ اللَّهِ",
      fr: "SubhanAllah",
      meaning: t.subhanAllahMeaning || "Gloire et Pureté à Allah",
      target: 33,
    },
    {
      ar: "الْحَمْدُ لِلَّهِ",
      fr: "Alhamdulillah",
      meaning: t.alhamdulillahMeaning || "Toutes les louanges sont à Allah",
      target: 33,
    },
    {
      ar: "اللَّهُ أَكْبَرُ",
      fr: "Allahu Akbar",
      meaning: t.allahuAkbarMeaning || "Allah est le Plus Grand",
      target: 34,
    },
  ];

  const currentTasbih = tasbihPhrases[tasbihPhraseIndex];

  const themePresets = [
    {
      id: "w-grad-vert-chartreuse",
      name: t["theme_w-grad-vert-chartreuse_name"] || "Vert Chartreuse",
      grad: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
      color: "#38ef7d",
    },
    {
      id: "w-grad-ambre-dore",
      name: t["theme_w-grad-ambre-dore_name"] || "Ambre Doré",
      grad: "linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)",
      color: "#ffaf7b",
    },
    {
      id: "w-solid-bleu",
      name: t["theme_w-solid-bleu_name"] || "Bleu Impérial",
      grad: "linear-gradient(135deg, #0396ff 0%, #3b82f6 100%)",
      color: "#3b82f6",
    },
    {
      id: "w-grad-sunset-warm",
      name: t["theme_w-anim-sunset_name"] || "Coucher de Soleil",
      grad: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
      color: "#f5af19",
    },
    {
      id: "w-grad-purple-night",
      name: t["theme_w-solid-violet_name"] || "Nuit Violette",
      grad: "linear-gradient(135deg, #4e54c8 0%, #8f94fb 100%)",
      color: "#8f94fb",
    },
    {
      id: "w-grad-emerald-dark",
      name: t["theme_w-anim-emerald_name"] || "Émeraude Royale",
      grad: "linear-gradient(135deg, #0575e6 0%, #00f260 100%)",
      color: "#00f260",
    },
  ];

  const slideBadges = [
    t.multilingualSupportBadge || "MULTILINGUAL SUPPORT • 50+ LANGUAGES",
    t.onboardingStep1Badge || "HORAIRES DE PRIÈRE • PRÉCISION ASTRONOMIQUE",
    t.onboardingStep2Badge || "LE SAINT CORAN • TAJWID & AUDIO",
    t.onboardingStep3Badge || "SCANNER HALAL • ADDITIFS & E-NUMBERS",
    t.onboardingStep4Badge || "DHIKR & TASBIH • COMPTEUR HAPTIQUE",
    t.onboardingStep5Badge || "BOUSSOLE QIBLA 3D • MOSQUÉES SYNCHRONISÉES",
    t.onboardingStep6Badge || "PERSONNALISATION • THÈMES & WIDGETS",
  ];

  const slideTitles = [
    {
      title: t.selectLanguageTitle || "Choisissez votre langue",
      sub: t.selectLanguageSub || "Sélectionnez votre langue parmi plus de 50 langues. Le site s'adapte instantanément.",
    },
    {
      title: t.onboardingStep1Title || "Horaires de Prière & Rappels",
      sub: t.onboardingStep1Desc || "Calculs astronomiques exacts pour votre ville avec Azan audio.",
    },
    {
      title: t.onboardingStep2Title || "Le Saint Coran & Tajwid",
      sub: t.onboardingStep2Desc || "Texte coranique authentique, règle du Tajwid en couleur et récitations.",
    },
    {
      title: t.onboardingStep3Title || "Scanner & Analyseur Halal",
      sub: t.onboardingStep3Desc || "Analyse immédiate du code-barres et des ingrédients (Additifs, Gélatine).",
    },
    {
      title: t.onboardingStep4DhikrTitle || "Tasbih & Invocations (Dhikr)",
      sub: t.onboardingStep4DhikrDesc || "Compteur haptique interactif et invocations quotidiennes vérifiées.",
    },
    {
      title: t.onboardingStep5Title || "Boussole Qibla & Mosquées",
      sub: t.onboardingStep5Desc || "Localisation précise de la Kaaba et des mosquées aux alentours.",
    },
    {
      title: t.onboardingStep4Title || "Personnalisez votre thème",
      sub: t.onboardingStep6Desc || "Ajustez l'apparence visuelle des widgets selon vos préférences.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-2xl animate-in fade-in duration-300 select-none">
      <div className="w-full max-w-lg sm:max-w-xl bg-slate-50 dark:bg-[#0c141a] text-foreground border border-emerald-500/30 rounded-[32px] shadow-[0_25px_70px_-15px_rgba(16,185,129,0.3)] relative overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] h-auto backdrop-saturate-150 transform-gpu">
        
        {/* ============================================================ */}
        {/* TOP HERO HEADER (Exact Emerald Luxury Style from Screenshot) */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-gradient-to-b from-[#063328] via-[#052b22] to-[#041f19] text-white p-4 sm:p-6 pb-4 sm:pb-5 rounded-t-[30px] relative overflow-hidden shadow-md">
          {/* Subtle Islamic Rosette Background Watermark */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none flex items-center justify-end overflow-hidden">
            <svg
              viewBox="0 0 400 400"
              className="size-[320px] text-emerald-300 fill-current animate-[spin_240s_linear_infinite]"
            >
              <path d="M200 20 L230 130 L340 100 L270 190 L380 230 L270 270 L340 360 L230 330 L200 440 L170 330 L60 360 L130 270 L20 230 L130 190 L60 100 L170 130 Z" />
            </svg>
          </div>

          {/* Ambient Glows */}
          <div className="absolute -top-16 -right-16 size-48 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 size-48 bg-teal-500/20 rounded-full blur-2xl pointer-events-none" />

          {/* Top Row: Multilingual Badge & Close Button */}
          <div className="flex items-center justify-between gap-2 relative z-10 mb-3 sm:mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/35 text-emerald-300 text-[10px] sm:text-xs font-black tracking-wider uppercase backdrop-blur-md shadow-xs truncate max-w-[80%]">
              <Sparkles className="size-3 text-emerald-300 shrink-0" />
              <span className="truncate">{slideBadges[step]}</span>
            </div>

            <button
              type="button"
              onClick={handleSkip}
              className="size-9 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white flex items-center justify-center transition backdrop-blur-md cursor-pointer shrink-0 border border-white/10"
              title={t.close || "Fermer"}
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Middle Row: Glowing Icon + Title + Subtitle */}
          <div className="flex items-start gap-3.5 relative z-10">
            <div className="size-12 sm:size-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] shrink-0 mt-0.5">
              {step === 0 && <Globe className="size-6 sm:size-7" />}
              {step === 1 && <Bell className="size-6 sm:size-7" />}
              {step === 2 && <BookOpen className="size-6 sm:size-7" />}
              {step === 3 && <QrCode className="size-6 sm:size-7" />}
              {step === 4 && <Sparkles className="size-6 sm:size-7" />}
              {step === 5 && <MapPin className="size-6 sm:size-7" />}
              {step === 6 && <Palette className="size-6 sm:size-7" />}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug truncate">
                {slideTitles[step]?.title}
              </h2>
              <p className="text-xs sm:text-[13px] text-emerald-100/80 mt-1 leading-relaxed line-clamp-2">
                {slideTitles[step]?.sub}
              </p>
            </div>
          </div>

          {/* Search Box on Slide 0 */}
          {step === 0 && (
            <div className="relative mt-3.5 sm:mt-4 z-10">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-emerald-300/70" />
              <input
                type="text"
                placeholder={t.search50Languages || "Rechercher une langue (Pashto, Arabic, Français...)"}
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/35 border border-emerald-500/35 text-white placeholder:text-emerald-200/50 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-400/50 transition-all backdrop-blur-md shadow-inner"
              />
            </div>
          )}

          {/* Stepper Interactive Pills */}
          <div className="grid grid-cols-7 gap-1.5 mt-3 sm:mt-3.5 relative z-10">
            {Array.from({ length: 7 }).map((_, idx) => {
              const isActive = idx <= step;
              const isCurrent = idx === step;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    playClick();
                    setStep(idx);
                  }}
                  className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer relative overflow-hidden ${
                    isCurrent
                      ? "bg-emerald-400 shadow-sm shadow-emerald-400/50 ring-2 ring-emerald-300/40"
                      : isActive
                        ? "bg-emerald-500/70"
                        : "bg-emerald-950/80 hover:bg-emerald-900/60"
                  }`}
                  title={`Étape ${idx + 1}`}
                />
              );
            })}
          </div>
        </div>

        {/* ============================================================ */}
        {/* MIDDLE SCROLLABLE CONTENT                                    */}
        {/* ============================================================ */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-3 space-y-3 relative z-10">
          {/* ============================================================ */}
          {/* STEP 0: LANGUAGE SELECTION (Exact Match with Image)           */}
          {/* ============================================================ */}
          {step === 0 && (
            <div className="space-y-2.5 animate-in slide-in-from-right duration-300">
              <div className="space-y-2">
                {filteredLanguages.map((item) => {
                  const isSelected = settings.language === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => handleSelectLanguage(item.code)}
                      className={`w-full p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer text-left ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 ring-2 ring-emerald-500/25 shadow-[0_4px_20px_rgba(16,185,129,0.12)]"
                          : "border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 hover:border-emerald-400/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2">
                        <span className="text-2xl sm:text-3xl shrink-0 leading-none drop-shadow-xs">
                          {item.flag}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-foreground font-sans tracking-tight">
                              {item.nativeName}
                            </span>
                            {item.isRtl && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black tracking-wider border border-amber-500/25 shrink-0">
                                RTL
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-medium block truncate mt-0.5">
                            {item.subName}
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0">
                          <Check className="size-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="size-5 rounded-full border border-border/80 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: PRAYER TIMES, ADHAN & SMART REMINDERS                */}
          {/* ============================================================ */}
          {step === 1 && (
            <div className="space-y-3 animate-in slide-in-from-right duration-300">
              <div className="p-4 rounded-3xl border border-border/80 bg-white/90 dark:bg-slate-900/90 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      {t.nextPrayer || "Prochaine prière"}
                    </span>
                    <div className="text-lg font-extrabold font-serif text-foreground">
                      {t.maghrib || "Maghrib"} — 19:42{" "}
                      <span className="text-xs font-normal text-muted-foreground font-sans">
                        (-01h 18m)
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAdhanDemoSound}
                    className={`px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs ${
                      isPlayingAdhanDemo
                        ? "bg-emerald-500 text-slate-950 ring-2 ring-emerald-400"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
                    }`}
                  >
                    {isPlayingAdhanDemo ? (
                      <Pause className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    <span>
                      {isPlayingAdhanDemo
                        ? t.guideAdhanPlaying || "Lecture Azan..."
                        : t.guidePrayerAdhanDemo || "Écouter l'Azan"}
                    </span>
                  </button>
                </div>

                {/* 5 Prayer Cards Grid */}
                <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                  {[
                    { key: "fajr", name: t.fajr || "Fajr", time: "05:28" },
                    { key: "dhuhr", name: t.dhuhr || "Dhuhr", time: "13:15" },
                    { key: "asr", name: t.asr || "Asr", time: "16:45" },
                    { key: "maghrib", name: t.maghrib || "Maghrib", time: "19:42", highlight: true },
                    { key: "isha", name: t.isha || "Isha", time: "21:10" },
                  ].map((p) => {
                    const isDone = checkedPrayers[p.key];
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => handlePrayerToggle(p.key)}
                        className={`p-2 sm:p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          p.highlight
                            ? "border-emerald-500 bg-emerald-500/20 text-foreground font-bold ring-1 ring-emerald-500/40 shadow-xs"
                            : isDone
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="text-[10px] font-bold truncate">{p.name}</div>
                        <div className="text-xs font-mono font-black mt-0.5">{p.time}</div>
                        <div className="mt-1.5">
                          {isDone ? (
                            <Check className="size-3.5 mx-auto text-emerald-500" />
                          ) : (
                            <span className="size-2 rounded-full bg-muted-foreground/30 mx-auto block" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Reminder Selector */}
                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold text-xs flex items-center gap-1.5">
                    <Volume2 className="size-4 text-emerald-500" />
                    {t.reminderBeforeAzan || "Rappel avant Azan :"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[5, 15, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          playClick();
                          setSelectedReminderOffset(mins);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          selectedReminderOffset === mins
                            ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {mins} {t.unitMin || "min"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: HOLY QURAN, TAJWEED & AUDIO RECITATIONS               */}
          {/* ============================================================ */}
          {step === 2 && (
            <div className="space-y-3 animate-in slide-in-from-right duration-300">
              <div className="p-4 rounded-3xl border border-border/80 bg-white/90 dark:bg-slate-900/90 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    {t.ayatKursiTitle || "Ayat Al-Kursi (2:255)"}
                  </span>

                  <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveQuranTab("arabic")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeQuranTab === "arabic"
                          ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.arabicTab || "Arabe"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQuranTab("translit")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeQuranTab === "translit"
                          ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.translitTab || "Phonétique"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQuranTab("translation")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeQuranTab === "translation"
                          ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.translationTab || "Traduction"}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-emerald-500/25 text-center space-y-2.5">
                  {activeQuranTab === "arabic" && (
                    <p
                      className="font-arabic text-xl sm:text-2xl leading-loose text-foreground font-bold"
                      dir="rtl"
                    >
                      اللَّهُ <span className="text-purple-500">لَا إِلَٰهَ</span> إِلَّا هُوَ{" "}
                      <span className="text-emerald-500 font-extrabold">الْحَيُّ</span> الْقَيُّومُ
                    </p>
                  )}
                  {activeQuranTab === "translit" && (
                    <p className="text-xs font-bold italic text-foreground leading-relaxed">
                      {t.ayatKursiTranslit || "Allahu la ilaha illa Huwal-Hayyul-Qayyum..."}
                    </p>
                  )}
                  {activeQuranTab === "translation" && (
                    <p className="text-xs font-semibold text-foreground leading-relaxed">
                      {t.ayatKursiTranslation || "« Allah ! Point de divinité à part Lui, le Vivant, Celui qui subsiste par Lui-même. »"}
                    </p>
                  )}

                  <div className="pt-2.5 border-t border-border/40 flex items-center justify-center gap-3 text-[10px] font-bold text-muted-foreground">
                    <span className="text-purple-500 flex items-center gap-1">
                      {t.tajwidMaddRule || "● Madd (Allongement)"}
                    </span>
                    <span className="text-emerald-500 flex items-center gap-1">
                      {t.tajwidGhunnahRule || "● Ghunnah (Nasalisation)"}
                    </span>
                    <span className="text-sky-500 flex items-center gap-1">
                      {t.tajwidQalqalahRule || "● Qalqalah"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-xs text-muted-foreground font-semibold">
                    {t.reciterColon || "Récitateur :"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: "alafasy", name: "Mishary Alafasy" },
                    ].map((reciter) => (
                      <button
                        key={reciter.id}
                        type="button"
                        onClick={() => {
                          playClick();
                          setSelectedReciterDemo(reciter.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          selectedReciterDemo === reciter.id
                            ? "border-emerald-500 bg-emerald-500/20 text-foreground font-bold ring-1 ring-emerald-500/30"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {reciter.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: HALAL SCANNER                                        */}
          {/* ============================================================ */}
          {step === 3 && (
            <div className="space-y-3 animate-in slide-in-from-right duration-300">
              <div className="p-4 rounded-3xl border border-border/80 bg-white/90 dark:bg-slate-900/90 space-y-3.5 shadow-sm">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: "halal",
                      label: t.sampleHalalLabel || "🟢 Halal",
                      title: t.sampleHalalTitle || "Flocons d'avoine",
                    },
                    {
                      id: "doubtful",
                      label: t.sampleDoubtfulLabel || "🟡 Douteux",
                      title: t.sampleDoubtfulTitle || "Gélules E471",
                    },
                    {
                      id: "haram",
                      label: t.sampleHaramLabel || "🔴 Haram",
                      title: t.sampleHaramTitle || "Gélatine Porcine",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        setActiveHalalSample(item.id as "halal" | "doubtful" | "haram");
                      }}
                      className={`p-2.5 rounded-2xl border text-center transition cursor-pointer ${
                        activeHalalSample === item.id
                          ? "border-emerald-500 bg-emerald-500/15 font-bold text-foreground ring-1 ring-emerald-500/40"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-xs font-extrabold truncate mt-0.5">{item.title}</div>
                    </button>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 text-xs space-y-1.5">
                  {activeHalalSample === "halal" && (
                    <>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                        <Check className="size-4 stroke-[3]" />{" "}
                        {t.sampleHalalVerdict || "Produit Certifié Halal & Sain"}
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {t.sampleHalalDetails ||
                          "Ingrédients : Farine complète, huile d'olive, levure naturelle. Aucun additif d'origine douteuse."}
                      </p>
                    </>
                  )}
                  {activeHalalSample === "doubtful" && (
                    <>
                      <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-xs">
                        <AlertCircle className="size-4" />{" "}
                        {t.sampleDoubtfulVerdict || "Présence d'Émulsifiant Douteux (E471)"}
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {t.sampleDoubtfulDetails ||
                          "Mono- et diglycérides d'acides gras. Origine végétale ou animale non spécifiée sur l'emballage."}
                      </p>
                    </>
                  )}
                  {activeHalalSample === "haram" && (
                    <>
                      <div className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 text-xs">
                        <AlertCircle className="size-4" />{" "}
                        {t.sampleHaramVerdict || "Non Conforme (Gélatine porcine E441)"}
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {t.sampleHaramDetails ||
                          "Contient de la gélatine animale non conforme aux normes rituelles d'abattage islamiques."}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 4: TASBIH & DHIKR                                       */}
          {/* ============================================================ */}
          {step === 4 && (
            <div className="space-y-3 animate-in slide-in-from-right duration-300">
              <div className="p-4 rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-emerald-500/30 flex flex-col items-center justify-center text-center space-y-3 shadow-sm">
                <div className="font-arabic text-2xl font-black text-foreground" dir="rtl">
                  {currentTasbih.ar}
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {currentTasbih.fr} —{" "}
                  <span className="text-muted-foreground font-normal">{currentTasbih.meaning}</span>
                </div>

                <button
                  type="button"
                  onClick={handleTasbihTap}
                  className="size-24 sm:size-28 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white font-mono font-black text-3xl shadow-xl shadow-emerald-500/30 flex flex-col items-center justify-center active:scale-90 transition-all cursor-pointer my-1 border-2 border-emerald-200/50"
                >
                  <span>{tasbihCount}</span>
                  <span className="text-[9px] font-sans font-bold opacity-80">
                    / {currentTasbih.target}
                  </span>
                </button>

                <p className="text-xs text-muted-foreground font-medium">
                  {t.guideTasbihTapHint || "Touchez la boule pour compter le Dhikr"}
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 5: QIBLA & MOSQUES                                      */}
          {/* ============================================================ */}
          {step === 5 && (
            <div className="space-y-3 animate-in slide-in-from-right duration-300">
              <div className="p-4 rounded-3xl border border-border/80 bg-white/90 dark:bg-slate-900/90 space-y-3.5 shadow-sm">
                <div
                  className={`p-3.5 rounded-3xl border transition-all flex items-center justify-between gap-3 relative overflow-hidden ${
                    isQiblaAligned
                      ? "bg-gradient-to-br from-emerald-500/20 via-card to-emerald-500/10 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                      : "bg-gradient-to-br from-muted/40 via-card to-muted/20 border-border/80"
                  }`}
                >
                  {/* Modern 3D Dial */}
                  <div className="relative size-24 shrink-0 flex items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full transition-all duration-700 pointer-events-none ${
                        isQiblaAligned
                          ? "bg-emerald-500/30 blur-xl scale-110"
                          : "bg-emerald-500/10 blur-lg"
                      }`}
                    />

                    <div
                      className={`relative size-24 rounded-full border-2 p-1 flex items-center justify-center transition-colors duration-500 shadow-inner ${
                        isQiblaAligned
                          ? "border-emerald-400 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                          : "border-emerald-500/40 bg-zinc-950/30"
                      }`}
                    >
                      <div className="absolute inset-0 pointer-events-none">
                        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-emerald-500">
                          N
                        </span>
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-muted-foreground/60">
                          S
                        </span>
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted-foreground/60">
                          E
                        </span>
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted-foreground/60">
                          O
                        </span>
                      </div>

                      <div
                        className="relative size-20 flex items-center justify-center transition-transform duration-700 ease-out"
                        style={{
                          transform: isQiblaAligned ? "rotate(0deg)" : "rotate(58deg)",
                        }}
                      >
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[34px] border-b-emerald-500 drop-shadow-md" />
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-r-[5px] border-r-transparent border-b-[34px] border-b-emerald-400 opacity-80" />

                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[28px] border-t-rose-500 drop-shadow-sm opacity-80" />

                        <div className="relative z-10 size-7 rounded-full bg-zinc-950 border border-emerald-400 shadow-md flex items-center justify-center p-0.5">
                          <MiniKaaba3D className="size-full" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        playConfirm();
                        setIsQiblaAligned(!isQiblaAligned);
                      }}
                      className={`text-xs font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5 ${
                        isQiblaAligned
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 border border-emerald-300/40"
                          : "bg-muted/80 text-foreground hover:bg-muted border border-border/80"
                      }`}
                    >
                      <Sparkles className="size-3.5" />
                      <span>
                        {isQiblaAligned
                          ? t.aligned119SE || "✨ Aligné 119° SE"
                          : t.testAlignmentBtn || "Tester alignement"}
                      </span>
                    </button>

                    <div className="space-y-0.5">
                      <div className="text-xs font-extrabold text-foreground">
                        {isQiblaAligned
                          ? t.facingMeccaStatus || "🕋 Face à la Mecque"
                          : t.orientPhoneStatus || "Orientez votre téléphone"}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {isQiblaAligned
                          ? t.accurateSignalReady || "Signal précis • Prêt pour la prière"
                          : t.turnToMeccaHint || "Tournez vers 119° SE pour aligner"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="size-5 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-extrabold text-foreground">
                        {t.sampleGrandMosque || "Mosquée Grande-Mosquée"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.sampleMosqueDistance || "À 450 m • Synchronisation Mawaqit active"}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    {t.mosqueOpenStatus || "Ouverte"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 6: CUSTOMIZATION & LAUNCH                               */}
          {/* ============================================================ */}
          {step === 6 && (
            <div className="space-y-3 animate-in slide-in-from-right duration-300">
              <div className="p-4 rounded-3xl border border-border/80 bg-white/90 dark:bg-slate-900/90 space-y-3.5 shadow-sm">
                {/* Live Widget Preview */}
                <div
                  className="p-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-between text-white"
                  style={{
                    background:
                      themePresets.find((tp) => tp.id === selectedThemePreview)?.grad ||
                      "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
                    color:
                      selectedThemePreview === "w-grad-vert-chartreuse" ? "#0f172a" : "#ffffff",
                  }}
                >
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-black uppercase opacity-80">
                      {t.nextPrayer || "Prochaine Prière"}
                    </div>
                    <div className="text-base font-black font-serif">
                      {t.fajr || "Fajr"} — 05:28
                    </div>
                  </div>
                  <div className="text-xs font-black bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-xl">
                    -02h 15m
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {themePresets.map((preset) => {
                    const isSel = selectedThemePreview === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          playClick();
                          setSelectedThemePreview(preset.id);
                          update({ widgetTheme: preset.id });
                        }}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          isSel
                            ? "border-emerald-500 bg-emerald-500/15 text-foreground font-bold ring-1 ring-emerald-500/40 shadow-xs"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div
                          className="size-3 rounded-full shrink-0 shadow-xs border border-white/20"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="text-xs font-bold truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="size-5 text-emerald-500 shrink-0" />
                <span className="font-semibold">
                  {t.onboardingWelcomeMsg ||
                    "Bienvenue dans Islam-Noor ! Votre expérience est personnalisée et prête."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* BOTTOM CONTROLS (Compact & Fully Responsive)                */}
        {/* ============================================================ */}
        <div className="shrink-0 px-3 py-2.5 sm:px-4 sm:py-3 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2 relative z-20">
          {/* Left: Language count info */}
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-muted-foreground min-w-0 truncate">
            <Globe className="size-3.5 sm:size-4 text-emerald-500 shrink-0" />
            <span className="truncate">
              {t.multilingualSupportSub || "50+ langues"}
            </span>
          </div>

          {/* Right: Compact Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {step === 0 ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkip}
                  className="text-xs font-bold rounded-xl h-8 sm:h-9 px-2.5 sm:px-3.5 cursor-pointer border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-foreground hover:bg-slate-200"
                >
                  {t.close || "Fermer"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 sm:px-4 h-8 sm:h-9 rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1 text-xs cursor-pointer"
                >
                  <span>{t.continue || "Continuer"}</span>
                  <ChevronRight className="size-3.5 shrink-0" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  className="text-xs font-bold rounded-xl gap-1 h-8 sm:h-9 px-2.5 sm:px-3.5 cursor-pointer border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-foreground hover:bg-slate-200"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>{t.back || "Retour"}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => (step === totalSlides ? handleComplete() : handleNext())}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 sm:px-4 h-8 sm:h-9 rounded-xl shadow-sm shadow-emerald-600/20 flex items-center gap-1 text-xs cursor-pointer"
                >
                  <span className="whitespace-nowrap">
                    {step === totalSlides
                      ? t.finish || "Terminer"
                      : t.next || "Suivant"}
                  </span>
                  <ChevronRight className="size-3.5 shrink-0" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
