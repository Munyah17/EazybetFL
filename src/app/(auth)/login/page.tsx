"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginBody />
    </Suspense>
  );
}

function LoginBody() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">Welcome Back!</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
      </div>
      {/* super_admin never authenticates through the public login -- they
          use /super-admin only. The API signs the session out and returns
          a generic 401 so this form doesn't reveal privileged accounts. */}
      <LoginForm redirectTo={next} deniedRoles={["super_admin"]} showSocial showSignUpLink />
    </div>
  );
}
