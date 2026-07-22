"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleChangePassword() {
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
      toast.error("Could not update password", { description: error.message });
      return;
    }
    toast.success("Password updated");
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Security" backHref="/account" />
      <div className="flex flex-col gap-4 p-4">
        <Card className="border-border/60 bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Change Password</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button disabled={saving} onClick={handleChangePassword}>
              {saving ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </Card>

        <Card className="border-border/60 bg-card p-4">
          <h2 className="text-sm font-semibold">Two-Factor Authentication</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an extra layer of security to your account. Coming soon.
          </p>
        </Card>
      </div>
    </div>
  );
}
