/* eslint-disable prettier/prettier */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Plus, Settings2, Sparkles, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuestDna } from "@/components/QuestDna";
import { BackButton } from "@/components/BackButton";
import { Avatar, Button, Chip, PageHeader, Panel, SectionHeading, Verified } from "@/components/ui-kit";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LEVELS, levelFor, NEARBY_STUDENTS } from "@/data/people";
import { QUESTS } from "@/data/quests";
import { buildTasteVector } from "@/lib/engine";
import { rankBoard } from "@/lib/leaderboard";
import { badges, weeklyStreak, levelName, weekXp, XP_RULES } from "@/lib/progress";
import { signOut } from "@/lib/auth";
import { actions, useUserState } from "@/lib/store";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { syncProfile } from "@/lib/profiles.functions";
import { VIBES, VIBE_EMOJI, VIBE_LABEL, type DemoUser, type Quest } from "@/lib/types";

async function makeAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose an image smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  if (dataUrl.length > 500_000) throw new Error("That image could not be compressed enough. Try a smaller one.");
  return dataUrl;
}

export const Route = createFileRoute("/profile")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search["handle"] === "string" ? { handle: search["handle"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Your profile — wego" },
      { name: "description", content: "Your quests, XP, weekly streak, and badges." },
      { property: "og:title", content: "Your profile — wego" },
      { property: "og:description", content: "Your quests, XP, weekly streak, and badges." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const state = useUserState();
  const navigate = useNavigate();
  const syncMyProfile = useServerFn(syncProfile);
  const { handle } = Route.useSearch();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ name: state.name, handle: state.handle, bio: state.bio, avatarUrl: state.avatarUrl, favoriteVibes: state.favoriteVibes, optInNearby: state.optInNearby, shareLocation: state.shareLocation, publicProfile: state.publicProfile });
  const [avatarError, setAvatarError] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");
  const allQuests = useMemo(() => [...state.createdQuests, ...QUESTS], [state.createdQuests]);
  const questById = useMemo(() => new Map(allQuests.map((quest) => [quest.id, quest] as const)), [allQuests]);
  const taste = useMemo(() => buildTasteVector(state), [state]);
  const level = levelFor(state.xp);
  const entries = useMemo(() => rankBoard(state, "xp", "friends"), [state]);
  const myRank = entries.findIndex((entry) => entry.you) + 1;
  const completed = state.completed.map((id) => questById.get(id)).filter((quest): quest is Quest => Boolean(quest));
  const earnedBadges = badges(state);
  const currentRun = weeklyStreak(state);
  const thisWeek = weekXp(state);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("This browser can’t share your location.");
      return;
    }
    setLocationBusy(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        actions.setApproximateLocation(coords.latitude, coords.longitude);
        setSettingsDraft((draft) => ({ ...draft, shareLocation: true }));
        setLocationBusy(false);
      },
      (error) => {
        setLocationError(error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow it in your browser settings, then try again."
          : "Couldn’t get your location. Check your connection and try again.");
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 12_000 },
    );
  };

  const publicPerson = handle && handle !== state.handle
    ? NEARBY_STUDENTS.find((person) => person.handle === handle)
    : undefined;

  if (handle && handle !== state.handle) {
    if (!publicPerson) throw notFound();
    return <PublicProfile person={publicPerson} />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="your field notes"
          title={state.name}
          leading={<Avatar name={state.name} you size={68} imageUrl={state.avatarUrl} />}
          action={
            <Dialog open={settingsOpen} onOpenChange={(open) => { if (open) { setSettingsDraft({ name: state.name, handle: state.handle, bio: state.bio, avatarUrl: state.avatarUrl, favoriteVibes: state.favoriteVibes, optInNearby: state.optInNearby, shareLocation: state.shareLocation, publicProfile: state.publicProfile }); setAvatarError(""); } setSettingsOpen(open); }}>
              <DialogTrigger asChild>
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong px-3 text-sm font-semibold hover:bg-surface">
                  <Settings2 aria-hidden className="h-4 w-4" /> Settings
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Make it yours</DialogTitle>
                  <DialogDescription>Choose what your profile says and who can find you. Your exact location is never shown.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                  <div>
                    <span className="block text-sm font-medium">Profile picture</span>
                    <div className="mt-2 flex items-center gap-3">
                      <Avatar name={settingsDraft.name || state.name} size={56} you imageUrl={settingsDraft.avatarUrl} />
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-3 text-sm font-semibold hover:bg-surface">
                        <Upload aria-hidden className="h-4 w-4" /> Choose image
                        <input type="file" accept="image/*" className="sr-only" onChange={async (event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          if (!file) return;
                          try { setAvatarError(""); const avatarUrl = await makeAvatarDataUrl(file); setSettingsDraft((draft) => ({ ...draft, avatarUrl })); }
                          catch (error) { setAvatarError(error instanceof Error ? error.message : "Could not load that image."); }
                        }} />
                      </label>
                      {settingsDraft.avatarUrl ? <button type="button" className="min-h-11 px-2 text-sm text-muted-foreground underline underline-offset-2" onClick={() => setSettingsDraft((draft) => ({ ...draft, avatarUrl: null }))}>Remove</button> : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Your image stays in this browser on this device.</p>
                    {avatarError ? <p role="alert" className="mt-1 text-sm text-destructive">{avatarError}</p> : null}
                  </div>
                  <label className="block text-sm font-medium">
                    Name
                    <input value={settingsDraft.name} maxLength={40} onChange={(event) => setSettingsDraft({ ...settingsDraft, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-md border border-input bg-card px-3" />
                  </label>
                  <label className="block text-sm font-medium">
                    Handle
                    <span className="mt-1 flex min-h-11 items-center rounded-md border border-input bg-card px-3">
                      <span className="text-muted-foreground">@</span>
                      <input value={settingsDraft.handle} maxLength={24} onChange={(event) => setSettingsDraft({ ...settingsDraft, handle: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} className="min-w-0 flex-1 bg-transparent pl-1 outline-none" />
                    </span>
                  </label>
                  <label className="block text-sm font-medium">
                    Bio
                    <textarea value={settingsDraft.bio} maxLength={160} rows={3} onChange={(event) => setSettingsDraft({ ...settingsDraft, bio: event.target.value })} className="mt-1 w-full rounded-md border border-input bg-card p-3" />
                  </label>
                  <fieldset>
                    <legend className="text-sm font-medium">Your vibes</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {VIBES.map((vibe) => (
                        <Chip key={vibe} active={settingsDraft.favoriteVibes.includes(vibe)} onClick={() => setSettingsDraft({ ...settingsDraft, favoriteVibes: settingsDraft.favoriteVibes.includes(vibe) ? settingsDraft.favoriteVibes.filter((v) => v !== vibe) : [...settingsDraft.favoriteVibes, vibe] })}>
                          {VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}
                        </Chip>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-sm font-medium">Privacy</legend>
                    <div className="mt-1 divide-y divide-border">
                      {([
                        ["publicProfile", "Public profile"],
                        ["optInNearby", "Show me to students nearby"],
                        ["shareLocation", "Use my rough location for suggestions"],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-sm">
                          <span>{label}</span>
                          <input type="checkbox" checked={settingsDraft[key]} onChange={(event) => setSettingsDraft({ ...settingsDraft, [key]: event.target.checked })} className="settings-toggle h-5 w-5" />
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {state.approximateLocation ? "Using your approximate area for quest distances." : "Quest distances currently start from East Bank."}
                      </p>
                      <Button type="button" variant="outline" disabled={locationBusy} onClick={requestLocation}>
                        {locationBusy ? "Finding you…" : state.approximateLocation ? "Update area" : "Use my location"}
                      </Button>
                    </div>
                    {locationError ? <p role="alert" className="mt-2 text-xs text-destructive">{locationError}</p> : null}
                  </fieldset>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        void signOut().then(() => navigate({ to: "/auth" }));
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                  <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Demo tools</summary><div className="mt-2 flex flex-wrap gap-2"><Button variant="ghost" onClick={actions.loadDemo}>Load demo</Button><Button variant="ghost" onClick={actions.reset}>Reset app</Button></div></details>
                  <div className="flex gap-2"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={() => { actions.saveSettings(settingsDraft); setSettingsOpen(false); void syncMyProfile({ data: { handle: settingsDraft.handle, name: settingsDraft.name, bio: settingsDraft.bio, avatarUrl: settingsDraft.avatarUrl } }).catch((error) => toast.error(error instanceof Error ? error.message : "Couldn't share your profile.")); }}>Save</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          }
        />
        <div className="-mt-3 mb-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>@{state.handle}</span>{state.verified ? <Verified label="UMN student" /> : null}
          </div>
          <p className="mt-2 max-w-xl text-muted-foreground">{state.bio}</p>
        </div>

        <Panel className="mt-6" aria-labelledby="level-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionHeading id="level-heading" eyebrow={`level ${level.level}`} title={level.name} />
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums">{state.xp.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">total XP</p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)} aria-label="Progress to next level">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${level.progress * 100}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            <span>{level.next ? `${(state.xp - level.xp).toLocaleString()} / ${(level.next.xp - level.xp).toLocaleString()} XP this level` : "Top level reached"}</span>
            <span>{level.next ? `${(level.next.xp - state.xp).toLocaleString()} XP to ${level.next.name}` : "All the way up"}</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">+{thisWeek.toLocaleString()} XP this week</span>
            {entries.length > 1 ? <Link to="/leaderboard" className="font-semibold underline underline-offset-4">#{myRank} in your squad by XP</Link> : <Link to="/squad" className="font-semibold underline underline-offset-4">Build a squad leaderboard</Link>}
          </div>
        </Panel>

        <dl className="mt-6 grid grid-cols-3 border-y border-border">
          {[
            { value: state.completed.length, label: "quests finished", icon: Check },
            { value: state.createdQuests.length, label: "quests made", icon: Plus },
            { value: currentRun, label: "weekly streak", icon: Sparkles },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex min-w-0 flex-col items-center justify-center gap-1 border-r border-border px-1 py-4 text-center last:border-r-0 sm:flex-row sm:gap-3 sm:px-3 sm:text-left">
              <Icon aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                <dt className="text-xs text-muted-foreground">{label}</dt>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <section aria-labelledby="stamps-heading">
            <SectionHeading id="stamps-heading" eyebrow="little milestones" title="Stamps" action={<span className="text-sm text-muted-foreground">{earnedBadges.filter((badge) => badge.earned).length}/{earnedBadges.length}</span>} />
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {earnedBadges.map((badge) => (
                <li key={badge.id} className={`min-h-24 rounded-lg border p-3 ${badge.earned ? "border-border-strong bg-card" : "border-dashed border-border text-muted-foreground"}`}>
                  <p className={`font-hand text-lg leading-tight ${badge.earned ? "" : "opacity-60"}`}>{badge.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{badge.earned ? "earned" : badge.note}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-10" aria-labelledby="activity-heading">
          <SectionHeading id="activity-heading" eyebrow="small steps add up" title="XP trail" action={<span className="text-sm text-muted-foreground">{thisWeek.toLocaleString()} earned this week</span>} />
          {state.log.length ? (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {state.log.slice(0, 6).map((event, index) => (
                <li key={`${event.at}-${event.kind}-${index}`} className="flex min-h-14 items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">+{event.xp}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{event.label}</span>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-y border-border py-5 text-muted-foreground">Your XP trail starts with your first quest.</p>
          )}
          <details className="mt-4 rounded-lg border border-border bg-card px-4">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 font-medium">How XP works <span className="text-sm text-muted-foreground">{XP_RULES.length} ways to earn</span></summary>
            <ul className="divide-y divide-border border-t border-border">
              {XP_RULES.map((rule) => (
                <li key={rule.kind} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  <span>{rule.label}</span><span className="text-muted-foreground">+{rule.xp} XP</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="mt-10" aria-labelledby="dna-heading">
          <QuestDna vibes={taste.vibes} note={taste.hasHistory ? "Changes as you go." : "Do a few quests and this fills in."} />
        </section>

        <div className="mt-10">
          <section aria-labelledby="done-heading">
            <SectionHeading id="done-heading" title="Done" action={<span className="text-sm text-muted-foreground">{completed.length}</span>} />
            {completed.length ? <ul className="mt-3 divide-y divide-border border-y border-border">{completed.slice(0, 6).map((quest) => <li key={quest.id}><Link to="/quest/$questId" params={{ questId: quest.id }} className="flex min-h-12 items-center justify-between gap-3 py-3"><span className="truncate font-medium">{quest.title}</span><span className="shrink-0 text-sm text-muted-foreground">{quest.location.area}</span></Link></li>)}</ul> : <p className="mt-3 border-y border-border py-4 text-sm text-muted-foreground">Finish a quest to start your trail.</p>}
          </section>
        </div>

      </div>
    </AppShell>
  );
}

function PublicProfile({ person }: { person: DemoUser }) {
  const topVibes = VIBES.map((vibe) => ({ vibe, weight: person.taste[vibe] }))
    .sort((a, b) => b.weight - a.weight)
    .filter((item) => item.weight > 0)
    .slice(0, 4);
  const level = LEVELS.find((item) => item.level === person.level);
  const recentQuests = (person.recentQuestIds ?? []).map((id) => QUESTS.find((quest) => quest.id === id)).filter((quest): quest is Quest => Boolean(quest));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <BackButton fallback="/leaderboard" label="Back to ranks" className="mb-4 underline underline-offset-4" />
        <PageHeader eyebrow="student profile" title={person.name} leading={<Avatar name={person.name} size={68} />} />
        <div className="-mt-3 mb-6">
          <p className="text-sm text-muted-foreground">@{person.handle} · {person.university}{person.verified ? " · verified student" : ""}</p>
          <p className="mt-2 max-w-xl text-muted-foreground">{person.bio}</p>
        </div>
        <dl className="mt-6 grid grid-cols-2 border-y border-border sm:grid-cols-4">
          {[
            [level?.name ?? levelName(person.level), "level"],
            [person.completed, "quests finished"],
            [person.created, "quests made"],
            [person.weeklyStreak, "weekly streak"],
          ].map(([value, label]) => (
            <div key={label} className="border-b border-border p-4 even:border-l sm:border-b-0 sm:even:border-l-0 sm:[&:not(:first-child)]:border-l">
              <dd className="text-xl font-semibold">{value}</dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
        <section className="mt-8">
          <SectionHeading title="Into lately" />
          <div className="mt-3 flex flex-wrap gap-2">
            {topVibes.map(({ vibe }) => <Chip key={vibe}>{VIBE_EMOJI[vibe]} {VIBE_LABEL[vibe]}</Chip>)}
          </div>
        </section>
        <section className="mt-8" aria-labelledby="public-quest-trail">
          <SectionHeading id="public-quest-trail" title="Quest trail" />
          {recentQuests.length ? <ul className="mt-3 divide-y divide-border border-y border-border">{recentQuests.map((quest) => <li key={quest.id}><Link to="/quest/$questId" params={{ questId: quest.id }} className="flex min-h-12 items-center justify-between gap-3 py-3"><span className="font-medium">{quest.title}</span><span className="shrink-0 text-sm text-muted-foreground">{quest.location.area}</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Their quest trail will show up here.</p>}
        </section>
      </div>
    </AppShell>
  );
}
