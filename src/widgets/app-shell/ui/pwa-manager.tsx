"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "sudak-today:pwa-install-dismissed-at";
const DISMISS_DAYS = 14;
const BLOCKED_INSTALL_ROUTES = [
  "/admin",
  "/business",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth"
];

function isServiceWorkerEnabled() {
  return process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_PWA_SW === "true";
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isInstallRouteAllowed(pathname: string) {
  return !BLOCKED_INSTALL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isDismissedRecently() {
  const value = window.localStorage.getItem(DISMISS_KEY);

  if (!value) {
    return false;
  }

  const dismissedAt = Number(value);
  const maxAge = DISMISS_DAYS * 24 * 60 * 60 * 1000;

  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < maxAge;
}

function rememberDismiss() {
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function isIosInstallCandidate() {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return isIos && !isStandalone();
}

export function PwaManager() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const hasReloadedRef = useRef(false);

  useEffect(() => {
    if (!isServiceWorkerEnabled() || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const trackWaitingWorker = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorkerRef.current = registration.waiting;
        setUpdateAvailable(true);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;

        if (!worker) {
          return;
        }

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller && !cancelled) {
            waitingWorkerRef.current = worker;
            setUpdateAvailable(true);
          }
        });
      });
    };

    navigator.serviceWorker
      .getRegistration("/")
      .then((existingRegistration) => {
        if (cancelled) {
          return null;
        }

        if (existingRegistration?.active?.scriptURL.endsWith("/sw.js")) {
          void existingRegistration.update();
          return existingRegistration;
        }

        return navigator.serviceWorker.register("/sw.js", { scope: "/" });
      })
      .then((registration) => {
        if (registration && !cancelled) {
          trackWaitingWorker(registration);
        }
      })
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });

    const handleControllerChange = () => {
      if (hasReloadedRef.current) {
        return;
      }

      hasReloadedRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      if (!isInstallRouteAllowed(pathname) || isStandalone() || isDismissedRecently()) {
        return;
      }

      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowInstall(true);
      setShowIosInstall(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    const installCheckId = window.setTimeout(() => {
      if (!isInstallRouteAllowed(pathname) || isStandalone() || isDismissedRecently()) {
        setShowInstall(false);
        setShowIosInstall(false);
        return;
      }

      setShowIosInstall(isIosInstallCandidate());
    }, 0);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.clearTimeout(installCheckId);
    };
  }, [pathname]);

  const dismissInstall = () => {
    rememberDismiss();
    setShowInstall(false);
    setShowIosInstall(false);
  };

  const installApp = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    dismissInstall();
  };

  const activateUpdate = () => {
    waitingWorkerRef.current?.postMessage({ type: "SKIP_WAITING" });
    setUpdateAvailable(false);
  };

  return (
    <>
      {updateAvailable ? (
        <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 px-4 md:bottom-4">
          <Card className="mx-auto max-w-form">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-foreground-muted">Доступно обновление приложения.</p>
              <Button type="button" size="sm" onClick={activateUpdate}>
                Обновить
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showInstall || showIosInstall ? (
        <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 px-4 md:bottom-4">
          <Card className="mx-auto max-w-form">
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Установить «Судак Сегодня»</p>
                <p className="text-sm leading-6 text-foreground-muted">
                  {showIosInstall
                    ? "Откройте меню «Поделиться» и выберите «На экран Домой»."
                    : "Приложение откроется как отдельное окно и быстрее вернется к городской ленте."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {showInstall ? (
                  <Button type="button" size="sm" onClick={installApp}>
                    Установить
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={dismissInstall}>
                  Позже
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
