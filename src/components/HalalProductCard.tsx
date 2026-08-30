import { useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Eye,
  Flag,
  Info,
  Layers,
  Leaf,
  Package,
  ShieldCheck,
  Sparkles,
  Utensils,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { appToast } from "@/lib/app-toast";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/app-settings";
import { openSubmitReportInExternalBrowser } from "@/lib/bug-tracker-client";
import type { ProductResult } from "@/lib/halal";
import {
  HalalProductDetailModal,
  type HalalDetailTab,
} from "@/components/HalalProductDetailModal";

interface HalalProductCardProps {
  product: ProductResult;
  onOpenDetails?: () => void;
  defaultExpandedTests?: boolean;
}

export function HalalProductCard({
  product,
}: HalalProductCardProps) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<HalalDetailTab>("audit");

  const isSaved = settings.savedProducts.some((s) => s.code === product.code);

  const toggleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved) {
      update({
        savedProducts: settings.savedProducts.filter((s) => s.code !== product.code),
      });
      appToast.success(t.removedFromFavorites || "Produit retiré des favoris", {
        category: "scanner",
      });
    } else {
      update({
        savedProducts: [
          ...settings.savedProducts,
          {
            code: product.code,
            name: product.name,
            brand: product.brand,
            verdict: product.verdict,
            image: product.image,
            ingredients: product.ingredients,
            reasons: product.reasons,
            certified: product.certified,
            nutriscore: product.nutriscore,
            novaGroup: product.novaGroup,
            ecoscore: product.ecoscore,
            allergens: product.allergens,
            traces: product.traces,
            quantity: product.quantity,
            testsPassed: product.testsPassed,
            totalTests: product.totalTests,
          },
        ],
      });
      appToast.success(t.addedToFavorites || "Produit ajouté aux favoris", {
        category: "scanner",
      });
    }
  };

  const handleReportError = (e: React.MouseEvent) => {
    e.stopPropagation();
    openSubmitReportInExternalBrowser();
    appToast.info("Ouverture du portail de signalement...", { category: "scanner" });
  };

  const openDetailsWithTab = (tab: HalalDetailTab) => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const isHalal = product.verdict === "halal";
  const isHaram = product.verdict === "haram";
  const isDoubtful = product.verdict === "doubtful";

  const tests = product.tests || [];
  const testsPassed = product.testsPassed ?? tests.filter((t) => t.status === "passed").length;
  const totalTests = product.totalTests ?? (tests.length > 0 ? tests.length : 5);

  return (
    <>
      <article className="glass rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-md space-y-3.5 transition-all duration-200 hover:shadow-lg">
        {/* 1. Header: Image, Title, Brand & Verdict Badge */}
        <div className="flex items-start gap-3.5">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="size-18 sm:size-20 rounded-2xl object-cover border border-slate-200/60 dark:border-slate-700/60 bg-white/50 shrink-0 shadow-sm cursor-pointer hover:opacity-90 transition"
              loading="lazy"
              referrerPolicy="no-referrer"
              onClick={() => openDetailsWithTab("audit")}
            />
          ) : (
            <div
              onClick={() => openDetailsWithTab("audit")}
              className="size-18 sm:size-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0 shadow-inner cursor-pointer"
            >
              <Package className="size-8" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <h2
              onClick={() => openDetailsWithTab("audit")}
              className="text-sm sm:text-base font-bold text-foreground leading-snug line-clamp-2 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              {product.name}
            </h2>

            {product.brand && (
              <p className="text-xs text-muted-foreground font-medium truncate">
                {product.brand}
                {product.quantity && <span className="ml-1.5 opacity-75">· {product.quantity}</span>}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <VerdictBadge verdict={product.verdict} certified={product.certified} />

              {product.certified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="size-3" />
                  {t.certifiedHalal || "Certifié Halal"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Audit de Sécurité Halal (Compact Clickable Row opening the 5-Test Window) */}
        <button
          type="button"
          onClick={() => openDetailsWithTab("audit")}
          className="w-full text-left rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/90 dark:from-slate-800/60 dark:to-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 p-3.5 space-y-2.5 shadow-2xs hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition group cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`size-7 rounded-xl flex items-center justify-center shrink-0 ${
                  isHalal
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : isHaram
                      ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                      : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}
              >
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                  {t.halalSafetyAudit || "Audit de Sécurité Halal"}
                </h4>
                <p className="text-[10.5px] text-muted-foreground">{t.mandatoryChecks || "5 contrôles d'ingrédients obligatoires"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.8 rounded-full text-[11px] font-black tracking-tight ${
                  testsPassed === totalTests
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : isHaram
                      ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                }`}
              >
                {testsPassed}/{totalTests} {t.validated || "validés"}
              </span>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition" />
            </div>
          </div>

          {/* Mini 5-Segment Colored Status Bar */}
          <div className="grid grid-cols-5 gap-1.5 pt-0.5">
            {(tests.length > 0
              ? tests
              : Array.from({ length: 5 }).map((_, i) => ({
                  id: `stub-${i}`,
                  name: `Test ${i + 1}`,
                  status: (isHalal ? "passed" : isHaram && i === 0 ? "failed" : "warning") as
                    | "passed"
                    | "failed"
                    | "warning",
                }))
            ).map((t, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  t.status === "passed"
                    ? "bg-emerald-500"
                    : t.status === "failed"
                      ? "bg-rose-500"
                      : "bg-amber-500"
                }`}
                title={t.name}
              />
            ))}
          </div>
        </button>

        {/* 3. Official Quality Badges: Nutri-Score, NOVA, Eco-Score (Clickable) */}
        {(product.nutriscore || product.novaGroup || product.ecoscore) && (
          <div
            onClick={() => openDetailsWithTab("nutrition")}
            className="flex flex-wrap items-center gap-2 cursor-pointer pt-0.5"
          >
            {product.nutriscore && <NutriScoreBadge grade={product.nutriscore} />}
            {product.novaGroup && <NovaBadge group={product.novaGroup} />}
            {product.ecoscore && <EcoScoreBadge grade={product.ecoscore} />}
          </div>
        )}

        {/* 4. Reasons Summary Checklist */}
        {product.reasons && product.reasons.length > 0 && (
          <ul
            onClick={() => openDetailsWithTab("audit")}
            className="space-y-1 text-[11.5px] rounded-2xl p-3 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition"
          >
            {product.reasons.slice(0, 2).map((r, i) => {
              const isHaramReason = r.toLowerCase().includes("interdit");
              const isDoubtReason =
                r.toLowerCase().includes("vérification") || r.toLowerCase().includes("indisponible");
              const isHalalReason =
                r.toLowerCase().includes("aucun") ||
                r.toLowerCase().includes("certifi") ||
                r.toLowerCase().includes("conforme");

              return (
                <li
                  key={i}
                  className={`flex items-start gap-1.5 leading-relaxed font-medium ${
                    isHaramReason
                      ? "text-rose-600 dark:text-rose-400 font-semibold"
                      : isDoubtReason
                        ? "text-amber-600 dark:text-amber-400"
                        : isHalalReason
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                  }`}
                >
                  <span className="shrink-0 leading-none mt-1">•</span>
                  <span className="line-clamp-2">{r}</span>
                </li>
              );
            })}
            {product.reasons.length > 2 && (
              <li className="text-[10.5px] font-semibold text-sky-600 dark:text-sky-400 pt-0.5">
                +{product.reasons.length - 2} {t.moreRemarks || "autre(s) remarque(s) dans le rapport complet ➔"}
              </li>
            )}
          </ul>
        )}

        {/* 5. Ingredients Preview Box (Clickable to open full modal) */}
        {product.ingredients && (
          <button
            type="button"
            onClick={() => openDetailsWithTab("ingredients")}
            className="w-full text-left rounded-2xl p-3 bg-white/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2 hover:border-sky-500/40 transition group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Utensils className="size-3.5 text-sky-500" />
                <h4 className="text-xs font-bold text-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
                  {t.ingredientsListTitle || "Liste Complète des Ingrédients"}
                </h4>
              </div>
              <span className="text-[10.5px] font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                {t.seeDetails || "Voir détails"}
                <ChevronRight className="size-3" />
              </span>
            </div>

            {product.ingredientItems && product.ingredientItems.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {product.ingredientItems.slice(0, 6).map((item, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-medium border ${
                      item.status === "haram"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold"
                        : item.status === "doubtful"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : item.status === "certified"
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 font-semibold"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {item.text}
                  </span>
                ))}
                {product.ingredientItems.length > 6 && (
                  <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-semibold text-muted-foreground bg-slate-100 dark:bg-slate-800">
                    +{product.ingredientItems.length - 6} {t.others || "autres..."}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {product.ingredients}
              </p>
            )}
          </button>
        )}

        {/* 6. Footer: Actions & Details Window Trigger */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <Button
            variant="soft"
            size="sm"
            onClick={() => openDetailsWithTab("audit")}
            className="w-full sm:w-auto gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20"
          >
            <Eye className="size-3.5" />
            {t.viewFullReport || "Consulter le rapport complet"}
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant={isSaved ? "outline" : "ghost"}
              size="sm"
              onClick={toggleSave}
              className="gap-1.5 text-xs font-bold"
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  {t.saved || "Enregistré"}
                </>
              ) : (
                <>
                  <Bookmark className="size-3.5" />
                  {t.save || "Sauvegarder"}
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReportError}
              className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
              title={t.reportError || "Signaler une erreur sur ce produit"}
            >
              <Flag className="size-3.5 text-amber-500" />
              {t.report || "Signaler"}
            </Button>
          </div>
        </div>
      </article>

      {/* Dedicated Popup Window / Modal for All In-Depth Information */}
      <HalalProductDetailModal
        product={product}
        initialTab={modalTab}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function VerdictBadge({
  verdict,
  certified,
}: {
  verdict: ProductResult["verdict"];
  certified?: boolean;
}) {
  const { t } = useI18n();
  const config = {
    halal: {
      label: t.verdictHalal || "HALAL (CONFORME)",
      bg: "bg-emerald-500 text-slate-950 shadow-emerald-500/30",
      icon: <CheckCircle2 className="size-3.5" />,
    },
    haram: {
      label: t.verdictHaram || "HARAM (NON CONFORME)",
      bg: "bg-rose-600 text-white shadow-rose-600/30",
      icon: <XCircle className="size-3.5" />,
    },
    doubtful: {
      label: t.verdictDoubt || "DOUTEUX (À VÉRIFIER)",
      bg: "bg-amber-500 text-slate-950 shadow-amber-500/30",
      icon: <AlertTriangle className="size-3.5" />,
    },
    unknown: {
      label: t.verdictUnknown || "INDÉTERMINÉ",
      bg: "bg-slate-500 text-white",
      icon: <Info className="size-3.5" />,
    },
  }[verdict];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-tight shadow-sm ${config.bg}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

/** Authentic French Nutri-Score 5-tier badge */
function NutriScoreBadge({ grade }: { grade: "a" | "b" | "c" | "d" | "e" }) {
  const letters: Array<"a" | "b" | "c" | "d" | "e"> = ["a", "b", "c", "d", "e"];
  const colors: Record<string, string> = {
    a: "#038141",
    b: "#85bb2f",
    c: "#fecb02",
    d: "#ee8100",
    e: "#e63e11",
  };

  return (
    <div
      className="inline-flex items-center rounded-xl bg-slate-900 text-white p-1.5 shadow-sm border border-slate-700 hover:scale-105 transition"
      title={`Nutri-Score : Grade ${grade.toUpperCase()} — Cliquez pour voir les détails`}
    >
      <span className="text-[9px] font-black uppercase tracking-wider px-1 text-slate-300">
        Nutri-Score
      </span>
      <div className="inline-flex items-center gap-0.5">
        {letters.map((l) => {
          const isActive = l === grade;
          return (
            <span
              key={l}
              style={{ backgroundColor: colors[l] }}
              className={`rounded font-black text-center transition-all ${
                isActive
                  ? "size-6 text-xs text-white shadow-md ring-2 ring-white scale-110 flex items-center justify-center z-10"
                  : "size-4.5 text-[9px] text-white/60 opacity-40 flex items-center justify-center"
              }`}
            >
              {l.toUpperCase()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** NOVA Ultra-Transformation Group Badge */
function NovaBadge({ group }: { group: number }) {
  const novaDesc: Record<number, { label: string; bg: string }> = {
    1: { label: "NOVA 1 (Non transformé)", bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
    2: { label: "NOVA 2 (Ingrédient culinaire)", bg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" },
    3: { label: "NOVA 3 (Transformé)", bg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    4: { label: "NOVA 4 (Ultra-transformé)", bg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
  };

  const item = novaDesc[group] || { label: `NOVA ${group}`, bg: "bg-slate-500/15 text-slate-700 border-slate-500/30" };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold border hover:scale-105 transition ${item.bg}`}
      title="Groupe NOVA — Cliquez pour voir les détails"
    >
      <Layers className="size-3" />
      {item.label}
    </span>
  );
}

/** Eco-Score Environmental Impact Badge */
function EcoScoreBadge({ grade }: { grade: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:scale-105 transition"
      title="Eco-Score — Cliquez pour voir les détails"
    >
      <Leaf className="size-3" />
      Eco-Score {grade.toUpperCase()}
    </span>
  );
}
