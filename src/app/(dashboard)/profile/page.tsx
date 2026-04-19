import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, bio: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ubah nama tampilan, foto, dan bio — santai saja.
        </p>
      </div>
      <ProfileForm
        email={user.email}
        initialName={user.name ?? ""}
        initialBio={user.bio ?? ""}
        initialImage={user.image}
      />
    </div>
  );
}
