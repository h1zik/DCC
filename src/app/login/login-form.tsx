"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getSession, signIn } from "next-auth/react";
import {
  isAdministratorAppRoute,
  isCeoAppRoute,
  isFinanceAppRoute,
  isLogisticsRoute,
  isProfileRoute,
  isStudioWorkspaceRoute,
} from "@/lib/routes";
import { isMarketAnalyst, isStudioOrProjectManager } from "@/lib/roles";
import { isMarketAnalystAppRoute } from "@/lib/routes";
import { ArrowRight, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type LoginBranding = {
  appName: string;
  navTitle: string;
  navSubtitle: string;
  logoImagePath: string | null;
};

export function LoginForm({ branding }: { branding: LoginBranding }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = branding.navTitle.trim() || "Dominatus";
  const subtitle = branding.navSubtitle.trim() || "Control Center";
  const portalLabel = branding.appName.trim() || `${title} — Internal Portal`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    const s = await getSession();
    const userRole = s?.user?.role;
    let dest = callbackUrl;
    if (userRole === UserRole.CEO) {
      dest =
        isCeoAppRoute(callbackUrl) || isProfileRoute(callbackUrl)
          ? callbackUrl
          : "/";
    } else if (userRole === UserRole.LOGISTICS) {
      dest =
        isLogisticsRoute(callbackUrl) || isProfileRoute(callbackUrl)
          ? callbackUrl
          : "/inventory";
    } else if (userRole === UserRole.ADMINISTRATOR) {
      dest =
        isAdministratorAppRoute(callbackUrl) || isProfileRoute(callbackUrl)
          ? callbackUrl
          : "/rooms";
    } else if (userRole === UserRole.FINANCE) {
      dest =
        isFinanceAppRoute(callbackUrl) || isProfileRoute(callbackUrl)
          ? callbackUrl
          : "/finance";
    } else if (isMarketAnalyst(userRole)) {
      dest =
        isMarketAnalystAppRoute(callbackUrl) || isProfileRoute(callbackUrl)
          ? callbackUrl
          : "/research-hub";
    } else if (isStudioOrProjectManager(userRole)) {
      dest =
        isStudioWorkspaceRoute(callbackUrl) || isProfileRoute(callbackUrl)
          ? callbackUrl
          : "/tasks";
    }
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      <div className="animate-login-stagger login-stagger-1 absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div
        className="pointer-events-none absolute -left-24 top-16 size-72 rounded-full bg-sidebar-primary/20 blur-3xl animate-login-drift-a dark:bg-sidebar-primary/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-20 size-80 rounded-full bg-sidebar-primary/15 blur-3xl animate-login-drift-b dark:bg-sidebar-primary/8"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 size-96 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl dark:bg-accent/12"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[420px] animate-login-fade-rise">
        <div
          className={cn(
            "rounded-3xl border border-border bg-card px-8 py-9 text-card-foreground",
            "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)]",
            "transition-shadow duration-300 hover:shadow-[0_28px_90px_-12px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_28px_90px_-12px_rgba(0,0,0,0.5)]",
            "sm:px-10 sm:py-10",
          )}
        >
          <div className="animate-login-stagger login-stagger-2 mb-8 flex items-center gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {branding.logoImagePath ? (
                <Image
                  src={branding.logoImagePath}
                  alt={title}
                  width={40}
                  height={40}
                  priority
                  unoptimized
                  className="size-full object-contain p-1"
                />
              ) : (
                <div
                  className="flex size-full items-center justify-center bg-sidebar-primary text-lg font-bold text-sidebar-primary-foreground"
                  aria-hidden
                >
                  {title.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {title}
              </p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          <div className="animate-login-stagger login-stagger-3 mb-7 space-y-2">
            <h1 className="text-[1.75rem] font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="font-medium text-sidebar-primary transition-colors hover:text-sidebar-primary/80"
                onClick={() =>
                  toast.info("Contact your administrator to request access.")
                }
              >
                Contact your admin
              </button>
            </p>
          </div>

          <form onSubmit={onSubmit} className="animate-login-stagger login-stagger-4 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@dominatus.co.id"
                className="h-11 rounded-xl bg-muted/50 dark:bg-input/30"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-sidebar-primary transition-colors hover:text-sidebar-primary/80"
                  onClick={() =>
                    toast.info("Contact your administrator to reset your password.")
                  }
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl bg-muted/50 pr-11 dark:bg-input/30"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={keepSignedIn}
                onCheckedChange={(v) => setKeepSignedIn(v === true)}
                className="data-checked:border-sidebar-primary data-checked:bg-sidebar-primary data-checked:text-sidebar-primary-foreground"
              />
              <span className="text-sm text-muted-foreground">
                Keep me signed in for 30 days
              </span>
            </label>

            {error ? (
              <Alert
                variant="destructive"
                className="animate-login-shake rounded-xl"
              >
                <AlertTitle>Sign in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "group flex h-12 w-full items-center justify-center gap-2 rounded-xl",
                "bg-sidebar-primary text-base font-semibold text-sidebar-primary-foreground",
                "shadow-[0_8px_24px_-4px_color-mix(in_srgb,var(--sidebar-primary)_45%,transparent)]",
                "transition-all duration-200 hover:bg-sidebar-primary/92 hover:scale-[1.01]",
                "active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60",
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <span className="login-arrow-nudge" aria-hidden>
                    <ArrowRight className="size-4" />
                  </span>
                </>
              )}
            </button>
          </form>

          <p className="animate-login-stagger login-stagger-5 mt-7 text-center text-[11px] leading-relaxed text-muted-foreground">
            By signing in you agree to our{" "}
            <Link
              href="#"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              Terms of Service
            </Link>{" "}
            &{" "}
            <Link
              href="#"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <p className="animate-login-stagger login-stagger-6 mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 text-sidebar-primary/80" aria-hidden />
          {portalLabel}
        </p>
      </div>
    </div>
  );
}
