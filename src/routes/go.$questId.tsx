import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeft, Bookmark, Footprints, Heart, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button, Chip } from "@/components/ui-kit";
import { getQuest } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";
import { CAMPUS_ORIGIN, distanceMi } from "@/lib/engine";

export const Route = createFileRoute("/go/$questId")({
  loader: ({ params }) => {
    const quest = getQuest(params.questId);
    return { title: quest?.title ?? null };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title
      ? [
          { title: `Let's go: ${loaderData.title} — wego` },
          { name: "description", content: `Pick your crew and a time, then head out for ${loaderData.title}.` },
          { property: "og:title", content: `Let's go: ${loaderData.title} — wego` },
          { property: "og:description", content: "Pick your crew, pick a time, walk over." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Quest unavailable — wego" }, { name: "robots", content: "noindex" }],
  }),
  component: GoPage,
});

const WHEN = ["Right now", "In 30 min", "In an hour", "Tonight"];

function GoPage() {
  const { questId } = Route.useParams();
  const state = useUserState();
  const navigate = useNavigate();
  const quest = useMemo(() => state.createdQuests.find((q) => q.id === questId) ?? getQuest(questId), [questId, state.createdQuests]);
  const [crew, setCrew] = useState<string[] | null>(null);
  const [when, setWhen] = useState(WHEN[0]!);
  const [stage, setStage] = useState<"plan" | "out" | "share">("plan");
  const [rating, setRating] = useState(4);
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  if (!quest) throw notFound();

  const chosen = crew ?? state.squadIds;
  const people = [...NEARBY_STUDENTS].sort((a, b) => Number(state.squadIds.includes(b.id)) - Number(state.squadIds.includes(a.id)));
  const miles = distanceMi(CAMPUS_ORIGIN, quest.location);
  const walkMin = Math.max(2, Math.round(miles * 20));
  const directions = `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${quest.location.lat},${quest.location.lng}`;
  const toggle = (id: string) => setCrew(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const names = NEARBY_STUDENTS.filter((u) => chosen.includes(u.id)).map((u) => u.name);

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  function finish() {
    const earned = actions.complete(quest!.id, quest!.title);
    if (earned) toast(`Nice. +${earned} XP`);
    setStage("share");
  }

  function share() {
    actions.sharePost({
      id: `p_me_${Date.now()}`,
      author: state.name,
      authorId: "me",
      questId: quest!.id,
      rating,
      caption: caption.trim(),
      photo,
      withNames: names,
      at: Date.now(),
      hearts: 0,
      comments: [],
    });
    void navigate({ to: "/feed" });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to Discover
        </Link>

        <div className="mt-2 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <img src={questImage(quest)} alt="" className="aspect-square w-full border border-border object-cover" />
          <div className="min-w-0">
            <p className="font-hand text-lg">{stage === "share" ? "you did it" : "let's go"}</p>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{quest.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{quest.location.name} · about {walkMin} min on foot</p>
          </div>
        </div>

        {stage === "plan" ? (
          <div className="mt-8 space-y-8">
            <section>
              <h2 className="text-base font-semibold">Who's coming?</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {people.map((u) => (
                  <li key={u.id}>
                    <Chip active={chosen.includes(u.id)} onClick={() => toggle(u.id)}>{u.name}</Chip>
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-hand text-base text-muted-foreground">{names.length ? `you + ${names.join(", ")}` : "going solo works too"}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold">When?</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {WHEN.map((w) => <Chip key={w} active={when === w} onClick={() => setWhen(w)}>{w}</Chip>)}
              </div>
            </section>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => { setStage("out"); if (names.length) toast(`Sent to ${names.join(", ")}: ${when.toLowerCase()}`); }}><Footprints aria-hidden className="h-5 w-5" /> Head out</Button>
              <Button variant="ghost" onClick={() => { if (!state.saved.includes(quest.id)) actions.toggleSave(quest.id); toast("Saved for later"); void navigate({ to: "/" }); }}><Bookmark aria-hidden className="h-5 w-5" /> Save for later</Button>
            </div>
          </div>
        ) : null}

        {stage === "out" ? (
          <div className="mt-8 space-y-6">
            <a href={directions} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-between border border-border-strong bg-card px-4">
              <span><span className="block font-semibold">Walk to {quest.location.name}</span><span className="text-sm text-muted-foreground">{quest.location.area} · opens Google Maps</span></span>
              <Footprints aria-hidden className="h-5 w-5" />
            </a>
            <section>
              <h2 className="text-base font-semibold">The quest</h2>
              <p className="mt-2">{quest.mission}</p>
              <ol className="mt-4 space-y-3">
                {quest.steps.map((step, i) => (
                  <li key={step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2"><span className="font-hand text-xl">{i + 1}.</span><span>{step}</span></li>
                ))}
              </ol>
            </section>
            <Button onClick={finish}>We did it</Button>
          </div>
        ) : null}

        {stage === "share" ? (
          <div className="mt-8 space-y-6">
            <section>
              <h2 className="text-base font-semibold">How was it?</h2>
              <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`Rate ${n} of 5`} onClick={() => setRating(n)}
                    className={`grid min-h-11 min-w-11 place-items-center rounded-md border text-base font-medium ${rating === n ? "border-border-strong bg-secondary" : "border-input bg-card"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <label htmlFor="caption" className="text-base font-semibold">Say something about it</label>
              <textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={280} placeholder="The best part was…" className="mt-2 block w-full rounded-md border border-input bg-card p-3" />
            </section>
            <section>
              <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 text-[15px] font-medium">
                <ImagePlus aria-hidden className="h-5 w-5" /> {photo ? "Change photo" : "Add a photo"}
                <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
              </label>
              {photo ? <img src={photo} alt="Your photo" className="mt-3 max-h-64 border border-border object-cover" /> : null}
            </section>
            <div className="flex flex-wrap gap-3">
              <Button onClick={share}><Heart aria-hidden className="h-5 w-5" /> Share to feed</Button>
              <Button variant="ghost" onClick={() => void navigate({ to: "/" })}>Skip</Button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
