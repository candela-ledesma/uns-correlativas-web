"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Options = {
  carreraId: string;
  versionId: string;
  forceShowOnboarding: boolean;
};

type Return = {
  isOpen: boolean;
  isSubmitting: boolean;
  open: () => void;
  dismiss: () => Promise<void>;
  complete: () => Promise<void>;
};

export function useOnboarding({ carreraId, versionId, forceShowOnboarding }: Options): Return {
  const { status: sessionStatus } = useSession();
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [isOpen,        setIsOpen]        = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const stateKeyRef = useRef<string | null>(null);

  function openDeferred() {
    window.requestAnimationFrame(() => setIsOpen(true));
  }

  useEffect(() => {
    const key = `${carreraId}::${versionId}::${sessionStatus}::${forceShowOnboarding ? "forced" : "auto"}`;
    if (stateKeyRef.current === key) return;
    stateKeyRef.current = key;

    if (forceShowOnboarding) {
      openDeferred();
      const params = new URLSearchParams(searchParams.toString());
      if (params.has("onboarding")) {
        params.delete("onboarding");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }
      return;
    }

    if (sessionStatus === "authenticated") {
      fetch("/api/perfil/onboarding")
        .then((r) => (r.ok ? r.json() : null))
        .then((payload: { shouldAutoShowOnboarding?: boolean } | null) => {
          if (payload?.shouldAutoShowOnboarding) openDeferred();
        })
        .catch(() => undefined);
      return;
    }

    if (sessionStatus === "unauthenticated") {
      if (!window.localStorage.getItem("onboarding::guest::state")) {
        openDeferred();
      }
    }
  }, [carreraId, versionId, forceShowOnboarding, pathname, router, searchParams, sessionStatus]);

  async function persist(action: "dismiss" | "complete") {
    setIsSubmitting(true);
    if (sessionStatus === "authenticated") {
      await fetch("/api/perfil/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).catch(() => null);
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem("onboarding::guest::state", action);
    }
    setIsSubmitting(false);
    setIsOpen(false);
  }

  return {
    isOpen,
    isSubmitting,
    open:     () => setIsOpen(true),
    dismiss:  () => persist("dismiss"),
    complete: () => persist("complete"),
  };
}
