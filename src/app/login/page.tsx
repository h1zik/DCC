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
import { Eye, EyeOff, LayoutDashboard, Loader2, Shield } from "lucide-react";
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
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,var(--color-accent),transparent_55%),radial-gradient(ellipse_90%_70%_at_0%_100%,oklch(0.96_0.04_66),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(280px,420px)_1fr]">
        <aside className="border-border/80 relative hidden flex-col justify-between border-b bg-card/70 p-10 backdrop-blur-md lg:flex lg:border-r lg:border-b-0">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5">
                <LayoutDashboard className="size-6" aria-hidden />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  PT Dominatus Clean Solution
                </p>
                <h1 className="font-heading text-xl font-semibold tracking-tight">
                  Control Center
                </h1>
              </div>
            </div>
            <p className="text-muted-foreground max-w-sm text-pretty text-sm leading-relaxed">
              Satu pintu masuk untuk inventori, pipeline produk, ruang kerja
              tim, dan ringkasan eksekutif — aman untuk jaringan internal
              perusahaan.
            </p>
            <ul className="text-muted-foreground space-y-3 text-sm">
              <li className="flex gap-3">
                <Shield
                  className="text-accent-foreground mt-0.5 size-4 shrink-0"
                  aria-hidden
                />
                <span>
                  Otentikasi kredensial internal; sesi mengikuti kebijakan peran
                  Anda.
                </span>
              </li>
            </ul>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            © {new Date().getFullYear()} Dominatus Control Center. Gunakan hanya
            pada perangkat tepercaya.
          </p>
        </aside>

        <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="mb-6 flex w-full max-w-[420px] items-center gap-3 lg:hidden">
            <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5">
              <LayoutDashboard className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Dominatus
              </p>
              <p className="font-heading text-base font-semibold tracking-tight">
                Control Center
              </p>
            </div>
          </div>

          <Card
            className={cn(
              "border-border/80 w-full max-w-[420px] shadow-xl ring-1 ring-black/5",
              "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300",
            )}
          >
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="font-heading text-2xl font-semibold tracking-tight">
                Masuk
              </CardTitle>
              <CardDescription className="text-pretty leading-relaxed">
                Gunakan email kantor dan kata sandi yang diberikan administrator
                sistem.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={onSubmit} className="flex flex-col gap-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
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
                    placeholder="email@perusahaan.co.id"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
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
                      className="h-10 pr-11"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted/80 absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
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
                  className="h-11 w-full gap-2 text-base font-medium"
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
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
