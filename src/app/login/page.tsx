"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getSession, signIn } from "next-auth/react";
import {
  isAdministratorAppRoute,
  isCeoAppRoute,
  isLogisticsRoute,
  isProfileRoute,
  isStudioWorkspaceRoute,
} from "@/lib/routes";
import { isStudioOrProjectManager } from "@/lib/roles";
import { Eye, EyeOff, LayoutDashboard, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Email atau kata sandi tidak valid.");
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6">
      {/* Soft animated wash */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,var(--color-accent),transparent_58%)] opacity-90 dark:opacity-40"
        aria-hidden
      />
      <div
        className="bg-primary/5 pointer-events-none absolute -left-1/4 top-1/4 size-[min(90vw,520px)] rounded-full blur-3xl animate-login-drift-a dark:bg-primary/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-1/4 size-[min(85vw,480px)] rounded-full bg-accent/40 blur-3xl animate-login-drift-b dark:bg-accent/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[min(120vw,800px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/30 opacity-40 animate-login-drift-c dark:border-border/20 dark:opacity-25"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%23000000' fill-opacity='0.04' d='M36 0v12h12V0H36zm0 60v12h12V60H36zM0 36v12h12V36H0zm60 0v12h12V36H60z'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md animate-login-fade-rise">
        <Card
          className={cn(
            "border-border/60 relative overflow-hidden shadow-2xl",
            "bg-card/85 backdrop-blur-xl dark:bg-card/80",
            "ring-1 ring-black/5 dark:ring-white/10",
          )}
        >
          <div
            className="from-primary/20 via-accent/30 to-transparent pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
            aria-hidden
          >
            <div className="from-primary via-accent to-primary h-full w-1/2 bg-gradient-to-r opacity-70 animate-login-shimmer" />
          </div>

          <CardHeader className="space-y-4 pb-2 pt-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg ring-4 ring-primary/10 transition-transform duration-500 hover:scale-[1.02]">
              <LayoutDashboard className="size-7" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
                Dominatus
              </p>
              <CardTitle className="font-heading text-2xl font-semibold tracking-tight">
                Control Center
              </CardTitle>
              <CardDescription className="text-pretty text-sm leading-relaxed">
                Masuk dengan akun internal perusahaan Anda.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-8 pt-2">
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground text-sm">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@perusahaan.co.id"
                  className="h-11 transition-shadow duration-200 focus-visible:ring-2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground text-sm">
                  Kata sandi
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-11 transition-shadow duration-200 focus-visible:ring-2"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/80 absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword
                        ? "Sembunyikan kata sandi"
                        : "Tampilkan kata sandi"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <Alert variant="destructive" className="border-destructive/40">
                  <AlertTitle>Gagal masuk</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full gap-2 text-base font-medium shadow-md transition-[transform,box-shadow] duration-200 hover:shadow-lg active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    Memproses…
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>

            <p className="text-muted-foreground text-center text-xs leading-relaxed">
              © {new Date().getFullYear()} PT Dominatus Clean Solution — gunakan
              hanya pada perangkat tepercaya.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
