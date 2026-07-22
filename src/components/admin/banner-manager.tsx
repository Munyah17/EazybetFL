"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Banner = Database["public"]["Tables"]["banners"]["Row"];
type BannerKind = Database["public"]["Enums"]["banner_kind"];
type BannerAccent = Database["public"]["Enums"]["banner_accent"];

type FormState = {
  id?: string;
  title: string;
  eyebrow: string;
  description: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  accent: BannerAccent;
  active: boolean;
  display_order: number;
};

function emptyForm(kind: BannerKind, nextOrder: number): FormState {
  return {
    title: "",
    eyebrow: "",
    description: "",
    cta_label: kind === "hero_slide" ? "Learn More" : "",
    cta_href: "",
    image_url: "",
    accent: "primary",
    active: true,
    display_order: nextOrder,
  };
}

export function BannerManager({
  kind,
  title,
  description,
  initialBanners,
}: {
  kind: BannerKind;
  title: string;
  description: string;
  initialBanners: Banner[];
}) {
  const supabase = createClient();
  const [banners, setBanners] = useState(initialBanners);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(kind, banners.length + 1));
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setForm(emptyForm(kind, banners.length + 1));
    setOpen(true);
  }

  function openEdit(b: Banner) {
    setForm({
      id: b.id,
      title: b.title,
      eyebrow: b.eyebrow ?? "",
      description: b.description ?? "",
      cta_label: b.cta_label ?? "",
      cta_href: b.cta_href ?? "",
      image_url: b.image_url ?? "",
      accent: b.accent,
      active: b.active,
      display_order: b.display_order,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);

    const payload = {
      kind,
      title: form.title.trim(),
      eyebrow: form.eyebrow.trim() || null,
      description: form.description.trim() || null,
      cta_label: form.cta_label.trim() || null,
      cta_href: form.cta_href.trim() || null,
      image_url: form.image_url.trim() || null,
      accent: form.accent,
      active: form.active,
      display_order: form.display_order,
    };

    if (form.id) {
      const { data, error } = await supabase
        .from("banners")
        .update(payload)
        .eq("id", form.id)
        .select()
        .single();
      setSaving(false);
      if (error) {
        toast.error("Could not save banner", { description: error.message });
        return;
      }
      setBanners((prev) =>
        prev
          .map((b) => (b.id === data.id ? data : b))
          .sort((a, b) => a.display_order - b.display_order)
      );
    } else {
      const { data, error } = await supabase.from("banners").insert(payload).select().single();
      setSaving(false);
      if (error) {
        toast.error("Could not create banner", { description: error.message });
        return;
      }
      setBanners((prev) => [...prev, data].sort((a, b) => a.display_order - b.display_order));
    }

    setOpen(false);
    toast.success("Banner saved");
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) {
      toast.error("Could not delete banner", { description: error.message });
      return;
    }
    setBanners((prev) => prev.filter((b) => b.id !== id));
    toast.success("Banner deleted");
  }

  async function toggleActive(b: Banner) {
    const { error } = await supabase.from("banners").update({ active: !b.active }).eq("id", b.id);
    if (error) {
      toast.error("Could not update banner", { description: error.message });
      return;
    }
    setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, active: !x.active } : x)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit" : "New"} {kind === "hero_slide" ? "Slide" : "Announcement"}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="eyebrow">Eyebrow (small kicker text)</Label>
                <Input
                  id="eyebrow"
                  value={form.eyebrow}
                  onChange={(e) => setForm((f) => ({ ...f, eyebrow: e.target.value }))}
                  placeholder="e.g. Welcome Bonus"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. 100% Welcome Bonus"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cta_label">Button Label</Label>
                  <Input
                    id="cta_label"
                    value={form.cta_label}
                    onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))}
                    placeholder="e.g. Deposit Now"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cta_href">Button Link</Label>
                  <Input
                    id="cta_href"
                    value={form.cta_href}
                    onChange={(e) => setForm((f) => ({ ...f, cta_href: e.target.value }))}
                    placeholder="/wallet/deposit"
                  />
                </div>
              </div>
              {kind === "hero_slide" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="image_url">Background Image URL (optional)</Label>
                  <Input
                    id="image_url"
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                    placeholder="https://…"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Accent Color</Label>
                  <Select
                    value={form.accent}
                    onValueChange={(v) => setForm((f) => ({ ...f, accent: v as BannerAccent }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary (green)</SelectItem>
                      <SelectItem value="boost">Boost (gold)</SelectItem>
                      <SelectItem value="info">Info (blue)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded bg-secondary px-3 py-2.5">
                <Label htmlFor="active" className="!mb-0">
                  Active
                </Label>
                <Switch
                  id="active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button disabled={saving} onClick={handleSave} className="w-full">
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {banners.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No {kind === "hero_slide" ? "slides" : "announcements"} yet.
          </p>
        ) : (
          banners.map((b) => (
            <div key={b.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{b.title}</span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    #{b.display_order}
                  </Badge>
                </div>
                {b.description && (
                  <p className="truncate text-xs text-muted-foreground">{b.description}</p>
                )}
              </div>
              <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(b)} aria-label="Edit">
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                onClick={() => handleDelete(b.id)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
