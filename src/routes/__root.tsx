import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SettingsProvider, useSettings } from "../lib/app-settings";
import { AuthProvider } from "../lib/auth";
import { I18nProvider } from "../lib/i18n";
import { AudioProvider } from "../lib/audio-player";
import { EmailChangeHandler } from "@/components/EmailChangeHandler";
import { AppSplashGuard } from "@/components/AppSplashGuard";
import { AppOnboardingModal } from "@/components/AppOnboardingModal";
import { GlobalAppBackground } from "@/components/GlobalAppBackground";
import { GlobalTouchBorderHandler } from "@/components/GlobalTouchBorderHandler";
import { GlobalPrayerScheduler } from "@/components/GlobalPrayerScheduler";
import { cleanupLegacyBugStorage } from "../lib/external-links";
import { initBugTrackerPushService } from "../lib/bug-tracker-client";
import { BottomNav } from "../components/BottomNav";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const str = String(
    error instanceof Error ? `${error.name} ${error.message} ${error.stack || ""}` : typeof error === "object" ? JSON.stringify(error) : error,
  ).toLowerCase();
  return (
    str.includes("importing a module script failed") ||
    str.includes("failed to fetch dynamically imported module") ||
    str.includes("error loading dynamically imported module") ||
    str.includes("loading chunk") ||
    str.includes("loading css chunk") ||
    str.includes("dynamically imported module") ||
    str.includes("failed to resolve module specifier") ||
    str.includes("error resolving module specifier") ||
    str.includes("module script") ||
    str.includes("vite:preloaderror")
  );
}

if (typeof window !== "undefined") {
  // Prevent "NotFoundError: The object can not be found here" / "Failed to execute 'removeChild' on 'Node'"
  // which happens when browser extensions (Google Translate, Grammarly, Safari Translate) or external DOM
  // mutations alter React text nodes before React reconciles or unmounts them.
  if (typeof Node !== "undefined" && Node.prototype) {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (child && child.parentNode !== this) {
        return child;
      }
      try {
        return originalRemoveChild.call(this, child) as T;
      } catch {
        return child;
      }
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
      if (referenceNode && referenceNode.parentNode !== this) {
        try {
          return this.appendChild(newNode) as T;
        } catch {
          return newNode;
        }
      }
      try {
        return originalInsertBefore.call(this, newNode, referenceNode) as T;
      } catch {
        return newNode;
      }
    };
  }

  const triggerChunkReload = () => {
    const lastReload = Number(sessionStorage.getItem("chunk_reload_timestamp") || "0");
    const now = Date.now();
    if (now - lastReload > 3_000) {
      sessionStorage.setItem("chunk_reload_timestamp", String(now));
      window.location.reload();
    }
  };

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
    triggerChunkReload();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      triggerChunkReload();
    }
  });

  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error || event.message)) {
      event.preventDefault();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();
      triggerChunkReload();
    }
  });
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const isChunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!isChunkError) {
      console.error(error);
      reportLovableError(error, { boundary: "tanstack_root_error_component" });
    }

    // Automatically reload the page once if a dynamic import/chunk failed due to an updated build
    if (typeof window !== "undefined" && isChunkError) {
      const lastReload = Number(sessionStorage.getItem("chunk_reload_timestamp") || "0");
      const now = Date.now();
      if (now - lastReload > 3_000) {
        sessionStorage.setItem("chunk_reload_timestamp", String(now));
        window.location.reload();
      }
    }
  }, [error, isChunkError]);

  const handleHardReload = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("chunk_reload_timestamp");
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto size-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl font-bold">
          ⚡
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {isChunkError ? "Mise à jour de l'application" : "Cette page n'a pas pu se charger"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isChunkError
            ? "Une nouvelle version de l'application a été déployée. Veuillez actualiser la page pour charger les derniers fichiers."
            : "Une erreur est survenue lors de l'affichage. Réessayez ou revenez à l'accueil."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {isChunkError ? (
            <button
              onClick={handleHardReload}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Actualiser l&apos;application
            </button>
          ) : (
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Réessayer
            </button>
          )}
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "Islam-Noor" },
      {
        name: "description",
        content: "Islam-Noor, votre application islamique : horaires de prière, Qibla, Coran et scanner halal.",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { name: "theme-color", content: "#b45309" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Islam-Noor" },
      { name: "author", content: "Islam-Noor" },
      { property: "og:title", content: "Islam-Noor" },
      {
        property: "og:description",
        content: "Islam-Noor, votre application islamique : horaires de prière, Qibla, Coran et scanner halal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Amiri:wght@400;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="notranslate" translate="no">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Chrome() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/splash") ||
    pathname.startsWith("/permissions");

  const scrollMapRef = useRef<Record<string, number>>({});
  const prevPathRef = useRef<string>(pathname);

  // Synchronize document lang & dir with user selected language
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = settings.language || "fr";
      document.documentElement.dir =
        settings.language === "ar" || settings.language === "ps" ? "rtl" : "ltr";
    }
  }, [settings.language]);

  // Silently remove obsolete local bug storage keys & init Bug Tracker push service on initialization
  useEffect(() => {
    cleanupLegacyBugStorage();
    void initBugTrackerPushService();
  }, []);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    if (prevPath !== pathname) {
      // Save previous route scroll position
      scrollMapRef.current[prevPath] = window.scrollY;
      prevPathRef.current = pathname;

      // Restore saved scroll position for current route
      const savedY = scrollMapRef.current[pathname] ?? 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: "instant" });
      });
    }
  }, [pathname]);

  return (
    <I18nProvider locale={settings.language}>
      <AppSplashGuard />
      <AppOnboardingModal onComplete={() => {}} />
      <GlobalTouchBorderHandler />
      <GlobalPrayerScheduler />
      <GlobalAppBackground />
      <EmailChangeHandler />
      <div className="mx-auto min-h-screen w-full max-w-md md:max-w-xl lg:max-w-2xl pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
        <div key={pathname} className="page-transition-wrapper min-h-full">
          <Outlet />
        </div>
      </div>
      {!hideNav && <BottomNav />}
      <Toaster position="top-center" />
    </I18nProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <AudioProvider>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Chrome />
          </AudioProvider>
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
