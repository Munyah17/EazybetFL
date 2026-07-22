"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth/session-provider";

export default function PersonalInfoPage() {
  const supabase = createClient();
  const { profile } = useSession();
  // Layout's SessionProvider already resolves `profile` before this page
  // mounts, so a lazy initializer (not an effect) is enough to seed the
  // editable copy -- this is a one-time edit form, not a live mirror.
  const [fullName, setFullName] = useState(() => profile?.full_name ?? "");
  const [country, setCountry] = useState(() => profile?.country ?? "");
  const [dob, setDob] = useState(() => profile?.date_of_birth ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, country, date_of_birth: dob || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Could not save changes", { description: error.message });
      return;
    }
    toast.success("Profile updated");
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Personal Information" backHref="/account" />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" value={profile?.email ?? ""} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" value={profile?.phone ?? ""} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <Button disabled={saving} onClick={handleSave} className="mt-2">
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
