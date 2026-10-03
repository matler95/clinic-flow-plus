import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Org } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Doc = { user_id: string; name: string };

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// M2: planned substitutions. Business rules (who may create, no overlaps, substitute
// not absent at the same time) are enforced by the create_substitution RPC.
export function SubstitutionsTab({ org, me }: { org: Org; me: string | null }) {
  const qc = useQueryClient();
  const isAdmin = org.role === "admin";
  const [absent, setAbsent] = useState<string>(isAdmin ? "" : (me ?? ""));
  const [sub, setSub] = useState("");
  const [starts, setStarts] = useState(() => toLocalInput(new Date()));
  const [ends, setEnds] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const doctors = useQuery({
    queryKey: ["org-doctors", org.id],
    queryFn: async (): Promise<Doc[]> => {
      const { data: ms, error } = await supabase
        .from("memberships")
        .select("user_id, role")
        .eq("org_id", org.id)
        .eq("is_active", true)
        .in("role", ["doctor", "admin"]);
      if (error) throw error;
      const ids = ms.map((m) => m.user_id);
      const { data: ps } = ids.length
        ? await supabase.from("profiles").select("id, display_name, email").in("id", ids)
        : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
      return ms.map((m) => {
        const p = ps?.find((x) => x.id === m.user_id);
        return { user_id: m.user_id, name: p?.display_name || p?.email || "Lekarz" };
      });
    },
  });
  const nameOf = (id: string) => doctors.data?.find((d) => d.user_id === id)?.name ?? "Były członek";

  const subs = useQuery({
    queryKey: ["substitutions", org.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("substitutions")
        .select("*")
        .eq("org_id", org.id)
        .is("cancelled_at", null)
        .gt("ends_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  async function create() {
    if (!absent || !sub) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_substitution", {
      _org: org.id,
      _absent: absent,
      _substitute: sub,
      _starts: new Date(starts).toISOString(),
      _ends: new Date(ends).toISOString(),
      _reason: reason,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Zastępstwo zapisane. Nowe pliki trafią do zastępcy.");
    setReason("");
    setSub("");
    qc.invalidateQueries({ queryKey: ["substitutions", org.id] });
  }

  async function cancel(id: string) {
    if (!confirm("Anulować to zastępstwo?")) return;
    const { error } = await supabase.rpc("cancel_substitution", { _id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Zastępstwo anulowane");
    qc.invalidateQueries({ queryKey: ["substitutions", org.id] });
  }

  const canCancel = (s: { absent_user_id: string; created_by: string }) =>
    isAdmin || s.absent_user_id === me || s.created_by === me;
  const now = Date.now();
  const docs = doctors.data ?? [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Na czas urlopu lub choroby pliki wysłane do nieobecnego lekarza (linkiem lub przypisaniem w skrzynce gabinetu)
        trafiają automatycznie do zastępcy, z oznaczeniem „Zastępstwo za …”.
      </p>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nieobecny lekarz</span>
          <Select value={absent} onValueChange={setAbsent} disabled={!isAdmin}>
            <SelectTrigger aria-label="Nieobecny lekarz"><SelectValue placeholder="Wybierz" /></SelectTrigger>
            <SelectContent>
              {docs.map((d) => <SelectItem key={d.user_id} value={d.user_id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Zastępca</span>
          <Select value={sub} onValueChange={setSub}>
            <SelectTrigger aria-label="Zastępca"><SelectValue placeholder="Wybierz" /></SelectTrigger>
            <SelectContent>
              {docs.filter((d) => d.user_id !== absent).map((d) => <SelectItem key={d.user_id} value={d.user_id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Od</span>
          <Input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Do</span>
          <Input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">Powód (opcjonalnie)</span>
          <Input maxLength={200} placeholder="np. urlop" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <Button className="sm:col-span-2" disabled={!absent || !sub || busy} onClick={create}>
          <CalendarClock /> Zapisz zastępstwo
        </Button>
      </div>

      <ul className="divide-y rounded-xl border">
        {subs.data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">Brak zaplanowanych zastępstw.</li>}
        {subs.data?.map((s) => {
          const active = new Date(s.starts_at).getTime() <= now;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {nameOf(s.absent_user_id)} <ArrowRight className="h-4 w-4 text-muted-foreground" /> {nameOf(s.substitute_user_id)}
                  <Badge variant={active ? "default" : "secondary"}>{active ? "Trwa" : "Zaplanowane"}</Badge>
                </p>
                <p className="text-muted-foreground">
                  {new Date(s.starts_at).toLocaleString("pl-PL")} – {new Date(s.ends_at).toLocaleString("pl-PL")}
                  {s.reason ? ` · ${s.reason}` : ""}
                </p>
              </div>
              {canCancel(s) && (
                <Button size="sm" variant="ghost" onClick={() => cancel(s.id)}>
                  <X /> Anuluj
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
