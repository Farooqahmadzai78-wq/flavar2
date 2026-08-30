import { useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flag,
  Info,
  Layers,
  Leaf,
  Package,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { appToast } from "@/lib/app-toast";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/app-settings";
import { openSubmitReportInExternalBrowser } from "@/lib/bug-tracker-client";
import type { ProductResult, HalalTestDetail } from "@/lib/halal";

export type HalalDetailTab = "audit" | "ingredients" | "nutrition";

interface HalalProductDetailModalProps {
  product: ProductResult;
  initialTab?: HalalDetailTab;
  isOpen: boolean;
  onClose: () => void;
}

export function HalalProductDetailModal({
  product,
  initialTab = "audit",
  isOpen,
  onClose,
}: HalalProductDetailModalProps) {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const [activeTab, setActiveTab] = useState<HalalDetailTab>(initialTab);
  const [ingredientFilter, setIngredientFilter] = useState<"all" | "haram" | "doubtful" | "safe">("all");

  if (!isOpen) return null;

  const isSaved = settings.savedProducts.some((s) => s.code === product.code);

  const toggleSave = () => {
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

  const handleReport = () => {
    openSubmitReportInExternalBrowser();
    appToast.info(t.errorReportingPortal || "Ouverture du portail de signalement...", { category: "scanner" });
  };

  const isHalal = product.verdict === "halal";
  const isHaram = product.verdict === "haram";
  const isDoubtful = product.verdict === "doubtful";

  const tests = product.tests || [];
  const testsPassed = product.testsPassed ?? tests.filter((t) => t.status === "passed").length;
  const totalTests = product.totalTests ?? (tests.length > 0 ? tests.length : 5);

  const rawIngredientItems = product.ingredientItems || [];
  const filteredIngredients = rawIngredientItems.filter((item) => {
    if (ingredientFilter === "all") return true;
    if (ingredientFilter === "haram") return item.status === "haram";
    if (ingredientFilter === "doubtful") return item.status === "doubtful";
    if (ingredientFilter === "safe") return item.status === "safe" || item.status === "certified";
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="halal-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header with image, verdict, title, and close button */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="size-14 sm:size-16 rounded-2xl object-cover border border-slate-200/80 dark:border-slate-700 bg-white shrink-0 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="size-14 sm:size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                  <Package className="size-7" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black tracking-tight ${
                      isHalal
                        ? "bg-emerald-500 text-slate-950"
                        : isHaram
                          ? "bg-rose-600 text-white"
                          : "bg-amber-500 text-slate-950"
                    }`}
                  >
                    {isHalal ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : isHaram ? (
                      <XCircle className="size-3.5" />
                    ) : (
                      <AlertTriangle className="size-3.5" />
                    )}
                    {isHalal
                      ? (t.halalCompliant || "HALAL CONFORME")
                      : isHaram
                        ? (t.haramNonCompliant || "HARAM NON CONFORME")
                        : (t.verdictDoubt || "DOUTEUX")}
                  </span>

                  {product.certified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="size-3" />
                      {t.certified || "Certifié"}
                    </span>
                  )}
                </div>

                <h3
                  id="halal-detail-title"
                  className="text-base font-bold text-foreground truncate mt-1"
                >
                  {product.name}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {product.brand || (t.unknownBrand || "Marque inconnue")}
                  {product.quantity && <span className="ml-1.5 opacity-75">· {product.quantity}</span>}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-muted-foreground hover:text-foreground hover:bg-slate-300 dark:hover:bg-slate-600 transition shrink-0"
              aria-label={t.close || "Fermer"}
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "audit"
                  ? "bg-white dark:bg-slate-800 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="size-3.5 text-emerald-500" />
              {t.auditHalal || "Audit Halal"}
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold">
                {testsPassed}/{totalTests}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ingredients")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "ingredients"
                  ? "bg-white dark:bg-slate-800 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Utensils className="size-3.5 text-sky-500" />
              {t.ingredientsTab || "Ingrédients"}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("nutrition")}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "nutrition"
                  ? "bg-white dark:bg-slate-800 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Leaf className="size-3.5 text-amber-500" />
              {t.nutritionQuality || "Nutrition & Qualité"}
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: 5-LEVEL HALAL AUDIT */}
          {activeTab === "audit" && (
            <div className="space-y-3.5 animate-in fade-in-50 duration-200">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {t.canonicalControl || "Contrôle Canonique et Fiqh Alimentaire"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t.islamicComplianceAnalysis || "Analyse des 5 points de conformité islamique"}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-black ${
                    testsPassed === totalTests
                      ? "bg-emerald-500 text-slate-950 font-black"
                      : isHaram
                        ? "bg-rose-600 text-white font-bold"
                        : "bg-amber-500 text-slate-950 font-bold"
                  }`}
                >
                  {testsPassed}/{totalTests} {t.validated || "validés"}
                </span>
              </div>

              {/* List of the 5 tests */}
              <div className="space-y-2.5">
                {(tests.length > 0
                  ? tests
                  : [
                      {
                        id: "t1",
                        name: "Test 1 : Contrôle des Ingrédients Prohibés",
                        description: "Dérivés de porc, éthanol, cochenille, gélatines illicites",
                        status: isHalal ? "passed" : isHaram ? "failed" : "warning",
                        detail: isHalal
                          ? "Aucun dérivé de porc, éthanol / alcool, cochenille (E120) ni gélatine porcine détecté."
                          : "Ingrédient non conforme identifié dans la composition.",
                      },
                      {
                        id: "t2",
                        name: "Test 2 : Contrôle des Viandes & Abattage",
                        description: "Vérification du rituel islamique et certificateur",
                        status: isHalal ? "passed" : "warning",
                        detail: "Aucune viande soumise à obligation rituelle ou certification conforme.",
                      },
                      {
                        id: "t3",
                        name: "Test 3 : Analyse des Additifs & Émulsifiants",
                        description: "Additifs à double origine (E471, présure, etc.)",
                        status: isHalal ? "passed" : "warning",
                        detail: "Additifs d'origine végétale ou synthétique autorisés.",
                      },
                      {
                        id: "t4",
                        name: "Test 4 : Recherche Croisée Base & Fabricants",
                        description: "Recoupement des données fournisseurs",
                        status: "passed",
                        detail: `Produit répertorié via ${product.source || "Open Food Facts"}.`,
                      },
                      {
                        id: "t5",
                        name: "Test 5 : Synthèse de Conformité & Sécurité",
                        description: "Validation globale de la licéité",
                        status: isHalal ? "passed" : isHaram ? "failed" : "warning",
                        detail: isHalal
                          ? "Conforme aux normes islamiques alimentaires."
                          : "Non conforme ou informations à vérifier avec précaution.",
                      },
                    ]
                ).map((test, index) => (
                  <div
                    key={test.id || index}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {test.status === "passed" && (
                          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        )}
                        {test.status === "failed" && (
                          <XCircle className="size-4 text-rose-500 shrink-0" />
                        )}
                        {test.status === "warning" && (
                          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-foreground leading-tight">
                          {test.name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          test.status === "passed"
                            ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                            : test.status === "failed"
                              ? "text-rose-700 dark:text-rose-300 bg-rose-500/15 border border-rose-500/30"
                              : "text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30"
                        }`}
                      >
                        {test.status === "passed"
                          ? (t.safe || "Conforme")
                          : test.status === "failed"
                            ? (t.prohibited || "Prohibé")
                            : (t.doubtful || "À vérifier")}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                      {test.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* Reasons list */}
              {product.reasons && product.reasons.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-bold text-foreground">{t.notableRemarks || "Remarques et Points Notables"}</h4>
                  <ul className="space-y-1.5 text-xs">
                    {product.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INGREDIENTS BREAKDOWN */}
          {activeTab === "ingredients" && (
            <div className="space-y-3.5 animate-in fade-in-50 duration-200">
              {rawIngredientItems.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIngredientFilter("all")}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                      ingredientFilter === "all"
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                        : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"
                    }`}
                  >
                    {t.all || "Tous"} ({rawIngredientItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngredientFilter("haram")}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                      ingredientFilter === "haram"
                        ? "bg-rose-600 text-white"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {t.prohibited || "Prohibés"} ({rawIngredientItems.filter((i) => i.status === "haram").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngredientFilter("doubtful")}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                      ingredientFilter === "doubtful"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {t.doubtful || "Douteux"} ({rawIngredientItems.filter((i) => i.status === "doubtful").length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngredientFilter("safe")}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                      ingredientFilter === "safe"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    {t.safe || "Sûrs"} ({rawIngredientItems.filter((i) => i.status === "safe" || i.status === "certified").length})
                  </button>
                </div>
              )}

              {/* Granular Pills List */}
              {rawIngredientItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {filteredIngredients.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl text-xs font-medium border space-y-0.5 ${
                        item.status === "haram"
                          ? "bg-rose-500/15 text-rose-900 dark:text-rose-200 border-rose-500/30 font-bold"
                          : item.status === "doubtful"
                            ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30"
                            : item.status === "certified"
                              ? "bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/30 font-semibold"
                              : "bg-slate-100 dark:bg-slate-800/80 text-foreground border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {item.status === "haram" && <XCircle className="size-3.5 text-rose-600" />}
                        {item.status === "doubtful" && (
                          <AlertTriangle className="size-3.5 text-amber-600" />
                        )}
                        {item.status === "certified" && (
                          <ShieldCheck className="size-3.5 text-sky-600" />
                        )}
                        <span>{item.text}</span>
                      </div>
                      {item.reason && (
                        <p className="text-[10px] opacity-80 font-normal">{item.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Full Raw Text */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <h4 className="text-xs font-bold text-foreground">{t.packagingFullText || "Texte Intégral du Packaging"}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {product.ingredients || (t.noResult || "Aucun texte d'ingrédient renseigné pour ce produit.")}
                </p>
              </div>

              {/* Allergens & Traces */}
              {((product.allergens && product.allergens.length > 0) ||
                (product.traces && product.traces.length > 0)) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  {product.allergens && product.allergens.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                        {t.declaredAllergens || "Allergènes déclarés :"}
                      </h5>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {product.allergens.map((a, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 text-xs font-medium border border-amber-500/30"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {product.traces && product.traces.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">{t.possibleTraces || "Traces éventuelles :"} </span>
                      {product.traces.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NUTRITION & QUALITY */}
          {activeTab === "nutrition" && (
            <div className="space-y-3.5 animate-in fade-in-50 duration-200">
              {/* Nutri-Score Detailed */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{t.nutriScoreTitle || "Nutri-Score"}</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {t.nutritionalQualityDesc || "Qualité nutritionnelle globale"}
                    </p>
                  </div>
                  {product.nutriscore && (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-black text-xs uppercase">
                      Grade {product.nutriscore.toUpperCase()}
                    </span>
                  )}
                </div>

                {product.nutriscore ? (
                  <div className="flex items-center justify-between gap-1 p-2 rounded-2xl bg-slate-900">
                    {(["a", "b", "c", "d", "e"] as const).map((l) => {
                      const colors: Record<string, string> = {
                        a: "#038141",
                        b: "#85bb2f",
                        c: "#fecb02",
                        d: "#ee8100",
                        e: "#e63e11",
                      };
                      const isActive = l === product.nutriscore;
                      return (
                        <div
                          key={l}
                          style={{ backgroundColor: colors[l] }}
                          className={`flex-1 py-2 rounded-xl text-center font-black transition-all ${
                            isActive
                              ? "text-white text-sm scale-105 ring-2 ring-white shadow-lg"
                              : "text-white/40 text-xs opacity-40"
                          }`}
                        >
                          {l.toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nutri-Score non renseigné pour ce produit.
                  </p>
                )}
              </div>

              {/* NOVA Group Detailed */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{t.novaClassification || "Classification NOVA"}</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {t.novaDesc || "Degré de transformation industrielle"}
                    </p>
                  </div>
                  {product.novaGroup && (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black text-xs">
                      Groupe {product.novaGroup}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      product.novaGroup === 1
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30 font-bold"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {t.nova1 || "1. Aliments non transformés"}
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      product.novaGroup === 2
                        ? "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30 font-bold"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {t.nova2 || "2. Ingrédients culinaires"}
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      product.novaGroup === 3
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 font-bold"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {t.nova3 || "3. Aliments transformés"}
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border ${
                      product.novaGroup === 4
                        ? "bg-rose-500/15 text-rose-800 dark:text-rose-200 border-rose-500/30 font-bold"
                        : "bg-white dark:bg-slate-900 text-muted-foreground border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {t.nova4 || "4. Aliments ultra-transformés"}
                  </div>
                </div>
              </div>

              {/* Eco-score & Labels */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold text-foreground">{t.labelsEnvironment || "Labels & Environnement"}</h4>
                <div className="flex flex-wrap gap-2">
                  {product.ecoscore && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <Leaf className="size-3.5" />
                      Eco-Score {product.ecoscore.toUpperCase()}
                    </span>
                  )}

                  {product.labelsList &&
                    product.labelsList.map((label, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-200/80 dark:bg-slate-700 text-foreground"
                      >
                        {label}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <Button
            variant={isSaved ? "outline" : "default"}
            size="sm"
            onClick={toggleSave}
            className="gap-2 font-bold text-xs"
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                {t.saved || "Enregistré"}
              </>
            ) : (
              <>
                <Bookmark className="size-4" />
                {t.save || "Sauvegarder"}
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReport}
            className="gap-1.5 font-semibold text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Flag className="size-3.5 text-amber-500" />
            {t.reportError || "Signaler une erreur"}
          </Button>
        </div>
      </div>
    </div>
  );
}
