"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appUrl}/reset-password`,
    });

    setLoading(false);
    // Always show the same confirmation regardless of whether the email
    // matched an account -- otherwise this becomes an account-enumeration
    // oracle.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email}</span>,
          we&apos;ve sent a link to reset your password.
        </p>
        <Link href="/login" className="text-sm font-semibold text-primary">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">Forgot Password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send Reset Link"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Sign In
        </Link>
      </p>
    </div>
  );
}
