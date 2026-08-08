"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Clicking the emailed link lands here with a recovery token in the URL;
    // the client SDK exchanges it for a session automatically and fires this
    // event once that's done -- only then is updateUser() actually callable.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast.error("Could not reset password", {
        description: "That link may have expired. Request a new one and try again.",
      });
      return;
    }

    toast.success("Password updated", { description: "Please sign in with your new password." });
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-bold">Reset link required</h1>
        <p className="text-sm text-muted-foreground">
          Open the password reset link from your email to continue, or request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm font-semibold text-primary">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">Set a New Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm New Password</Label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            placeholder="Confirm your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? "Saving…" : "Reset Password"}
        </Button>
      </form>
    </div>
  );
}
