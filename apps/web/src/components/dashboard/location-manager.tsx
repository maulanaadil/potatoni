"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/client";
import type { LocationSummary } from "@/lib/services/locations";
import { ConfirmButton, PageHeader } from "./common";
import { LocationCard } from "./location-card";

type Draft = {
  id?: string;
  name: string;
  address: string;
  notes: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

const blank: Draft = { name: "", address: "", notes: "", startsOn: "", endsOn: "", isActive: true };

export function LocationManager({ locations: initial }: { locations: LocationSummary[] }) {
  const { data, mutate } = useSWR<{ locations: LocationSummary[] }>("/api/admin/locations", {
    fallbackData: { locations: initial },
  });
  const locations = data?.locations ?? initial;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api(draft.id ? `/api/admin/locations/${draft.id}` : "/api/admin/locations", {
        method: draft.id ? "PATCH" : "POST",
        body: {
          name: draft.name,
          address: draft.address,
          notes: draft.notes,
          startsOn: draft.startsOn || null,
          endsOn: draft.endsOn || null,
          isActive: draft.isActive,
        },
      });
      toast.success(draft.id ? "Location updated" : "Location added");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/admin/locations/${id}`, { method: "DELETE" });
      toast.success("Location deleted");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const scheduled = locations.filter((l) => l.id);
  const untagged = locations.find((l) => !l.id);

  return (
    <>
      <PageHeader
        title="Locations"
        description="Where the stall sets up. Each day's orders and stock purchases are grouped under the location scheduled for that day."
        actions={
          <Button intent="sun" onClick={() => setDraft(blank)}>
            + New location
          </Button>
        }
      />

      {scheduled.length === 0 ? (
        <EmptyState title="No locations yet">
          Add where you&apos;ll sell next, e.g. “SMA Trinitas Bandung” from tomorrow. The register picks it up automatically on
          its start date.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scheduled.map((l) => (
            <LocationCard
              key={l.id}
              summary={l}
              productLimit={5}
              action={
                <Button
                  intent="outline"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      id: l.id!,
                      name: l.name,
                      address: l.address ?? "",
                      notes: l.notes ?? "",
                      startsOn: l.startsOn ?? "",
                      endsOn: l.endsOn ?? "",
                      isActive: l.isActive,
                    })
                  }
                >
                  Edit
                </Button>
              }
            />
          ))}
          {untagged && <LocationCard summary={untagged} productLimit={5} />}
        </div>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit location" : "New location"}
        description="The register switches to this location on its start date."
        footer={
          <div className="flex justify-between gap-2">
            {draft?.id ? <ConfirmButton onConfirm={() => remove(draft.id!)}>Delete</ConfirmButton> : <span />}
            <Button intent="sun" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save location"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="SMA Trinitas Bandung"
                maxLength={80}
              />
            </Field>
            <Field label="Address (optional)" className="sm:col-span-2">
              <Input
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                placeholder="Jl. … , Bandung"
                maxLength={160}
              />
            </Field>
            <Field label="Starts on">
              <DatePicker clearable value={draft.startsOn} onChange={(v) => setDraft({ ...draft, startsOn: v })} />
            </Field>
            <Field label="Ends on" hint="Leave empty if you stay until the next move.">
              <DatePicker clearable placeholder="Until next move" min={draft.startsOn} value={draft.endsOn} onChange={(v) => setDraft({ ...draft, endsOn: v })} />
            </Field>
            <Field label="Notes (optional)" className="sm:col-span-2">
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="School bazaar, open 06:30–15:00"
                maxLength={300}
              />
            </Field>
            <Checkbox
              label="Active (shown on the register)"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
          </div>
        )}
      </Dialog>
    </>
  );
}
