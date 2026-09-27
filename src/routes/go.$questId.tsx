import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import {
  Bookmark,
  CalendarPlus,
  Clock,
  Footprints,
  Heart,
  ImagePlus,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button, Chip, PageHeader } from "@/components/ui-kit";
import { getQuest } from "@/data/quests";
import { NEARBY_STUDENTS } from "@/data/people";
import { questImage } from "@/lib/imagery";
import { actions, useUserState } from "@/lib/store";
import { CAMPUS_ORIGIN, distanceMi } from "@/lib/engine";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BackButton } from "@/components/BackButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QuestRouteMap } from "@/components/QuestRouteMap";

export const Route = createFileRoute("/go/$questId")({
  staticData: { sitemap: false },
  loader: ({ params }) => {
    const quest = getQuest(params.questId);
    return { title: quest?.title ?? null };
  },
  head: ({ loaderData }) => ({
    meta: loaderData?.title
      ? [
          { title: `Let's go: ${loaderData.title} — wego` },
          {
            name: "description",
            content: `Pick your crew and a time, then head out for ${loaderData.title}.`,
          },
          { property: "og:title", content: `Let's go: ${loaderData.title} — wego` },
          { property: "og:description", content: "Pick your crew, pick a time, walk over." },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Quest unavailable — wego" }, { name: "robots", content: "noindex" }],
  }),
  component: GoPage,
});

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localDateTimeValue(date: Date) {
  return `${localDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimeInput(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function parseTimeInput(value: string) {
  const twelveHour = value.trim().match(/^(1[0-2]|[1-9]):([0-5]\d)\s*(AM|PM)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]) % 12 + (twelveHour[3]!.toUpperCase() === "PM" ? 12 : 0);
    return { hour, minute: Number(twelveHour[2]) };
  }
  const twentyFourHour = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) return { hour: Number(twentyFourHour[1]), minute: Number(twentyFourHour[2]) };
  return null;
}

function dateTimeLabel(value: string) {
  // Old locally saved schedules used HH:mm. Keep them readable after migration.
  const date = value.includes("T") ? new Date(value) : new Date(`${localDateValue(new Date())}T${value}`);
  return date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function calendarUrl(title: string, location: string, date: Date, startTime: string, endTime: string, scheduled: boolean) {
  if (!scheduled) {
    const start = new Date();
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const params = new URLSearchParams({ action: "TEMPLATE", text: `wego: ${title}`, dates: `${stamp(start)}/${stamp(end)}`, location });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  const startParts = parseTimeInput(startTime);
  const endParts = parseTimeInput(endTime);
  const start = new Date(date);
  start.setHours(startParts?.hour ?? 18, startParts?.minute ?? 0, 0, 0);
  const end = new Date(date);
  end.setHours(endParts?.hour ?? 19, endParts?.minute ?? 30, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `wego: ${title}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function GoPage() {
  const { questId } = Route.useParams();
  const state = useUserState();
  const navigate = useNavigate();
  const quest = useMemo(
    () => state.createdQuests.find((q) => q.id === questId) ?? getQuest(questId),
    [questId, state.createdQuests],
  );
  const [crew, setCrew] = useState<string[] | null>(null);
  const [selectedSquadIds, setSelectedSquadIds] = useState<string[]>([]);
  const [when, setWhen] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [startTime, setStartTime] = useState(() => formatTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [endTime, setEndTime] = useState(() => formatTimeInput(new Date(Date.now() + 150 * 60 * 1000)));
  const [stage, setStage] = useState<"plan" | "out" | "celebrating" | "share">("plan");
  const [celebrationXp, setCelebrationXp] = useState(0);
  const [rating, setRating] = useState(8);
  const [memberRatings, setMemberRatings] = useState<Record<string, number>>({});
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const scheduledWhen = state.scheduledQuests.find((item) => item.questId === questId)?.when;
  const scheduledEndWhen = state.scheduledQuests.find((item) => item.questId === questId)?.endWhen;

  useEffect(() => {
    if (state.inProgress.includes(questId)) setStage((current) => current === "plan" ? "out" : current);
  }, [questId, state.inProgress]);

  useEffect(() => {
    if (scheduledWhen && !state.inProgress.includes(questId)) {
      let start: Date;
      if (scheduledWhen.includes("T")) {
        start = new Date(scheduledWhen);
      } else {
        // Backward compatibility for schedules saved before date selection existed.
        const [hour, minute] = scheduledWhen.split(":").map(Number);
        start = new Date();
        start.setHours(hour ?? 18, minute ?? 0, 0, 0);
      }
      if (!Number.isNaN(start.getTime())) {
        setSelectedDate(start);
        setStartTime(formatTimeInput(start));
      }
      setWhen(scheduledWhen);
      const end = scheduledEndWhen
        ? new Date(scheduledEndWhen.includes("T") ? scheduledEndWhen : `${localDateValue(start)}T${scheduledEndWhen}`)
        : new Date(start.getTime() + 90 * 60 * 1000);
      if (!Number.isNaN(end.getTime())) setEndTime(formatTimeInput(end));
    }
  }, [questId, scheduledWhen, scheduledEndWhen, state.inProgress]);

  if (!quest) throw notFound();

  const squadIds = selectedSquadIds;
  const selectedSquads = state.squads.filter((squad) => squadIds.includes(squad.id));
  const selectedMemberIds = [...new Set(selectedSquads.flatMap((squad) => squad.memberIds))];
  const canLeadSelectedSquads = selectedSquads.every((squad) => squad.leaderId === "me");
  const people = NEARBY_STUDENTS.filter((person) => selectedMemberIds.includes(person.id));
  const chosen = canLeadSelectedSquads ? (crew ?? selectedMemberIds) : [];
  const miles = distanceMi(state.approximateLocation ?? CAMPUS_ORIGIN, quest.location);
  const walkMin = Math.max(2, Math.round(miles * 20));
  const directions = `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${quest.location.lat},${quest.location.lng}`;
  const toggle = (id: string) =>
    setCrew(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const names = people.filter((person) => chosen.includes(person.id)).map((person) => person.name);
  const members = people.filter((person) => chosen.includes(person.id));
  const ratedMembers = members.filter((member) => memberRatings[member.id] !== undefined);
  const ratingTotal =
    rating + ratedMembers.reduce((sum, member) => sum + memberRatings[member.id]!, 0);
  const ratingAverage = ratingTotal / (ratedMembers.length + 1);
  const allMembersRated = ratedMembers.length === members.length;

  function toggleSquad(squadId: string) {
    const current = new Set(squadIds);
    if (current.has(squadId)) current.delete(squadId);
    else current.add(squadId);
    setSelectedSquadIds([...current]);
    setCrew(null);
  }

  function startDateTime() {
    const parts = parseTimeInput(startTime);
    if (!parts) return null;
    const date = new Date(selectedDate);
    date.setHours(parts.hour, parts.minute, 0, 0);
    return date;
  }

  function endDateTime() {
    const start = startDateTime();
    const parts = parseTimeInput(endTime);
    if (!start || !parts) return null;
    const date = new Date(selectedDate);
    date.setHours(parts.hour, parts.minute, 0, 0);
    if (date <= start) date.setDate(date.getDate() + 1);
    return date;
  }

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  function finish() {
    if (!canLeadSelectedSquads && selectedSquads.length) {
      toast.error("Only your squad leader can start a squad activity.");
      return;
    }
    const earned = actions.complete(quest!.id, quest!.title, chosen.length > 0);
    setCelebrationXp(earned);
    setStage("celebrating");
  }

  async function headOut() {
    if (!canLeadSelectedSquads && selectedSquads.length) {
      toast.error("Only a selected squad’s leader can start that squad activity. Deselect it to go solo.");
      return;
    }
    actions.startQuest(quest!.id);
    setStage("out");
    if (!names.length) return;
    const time = when === null ? "right now" : startTime;
    const text = `Want to join us for ${quest!.title} at ${quest!.location.name} ${time}?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: quest!.title, text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        toast.success("Plan copied. Send it to your squad.");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast.error("Could not share the plan.");
    }
  }

  function scheduleQuest() {
    const start = startDateTime();
    const end = endDateTime();
    if (!start || !end) {
      toast.error("Enter a start and end time, like 6:00 PM.");
      return;
    }
    if (!canLeadSelectedSquads && selectedSquads.length) {
      toast.error("Only a selected squad’s leader can schedule that squad activity. Deselect it to plan solo.");
      return;
    }
    actions.scheduleQuest(quest!.id, localDateTimeValue(start), localDateTimeValue(end));
    toast.success(`Scheduled for ${dateTimeLabel(localDateTimeValue(start))}.`);
    void navigate({ to: "/", search: { tab: "yours" } });
  }

  function share() {
    const ratingCount = ratedMembers.length + 1;
    actions.sharePost({
      id: `p_me_${Date.now()}`,
      author: state.name,
      authorId: "me",
      questId: quest!.id,
      rating: Math.round(ratingAverage * 10) / 10,
      ratingCount,
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
        <BackButton fallback="/" label="Back to Quests" />

        <PageHeader
          className="mt-2"
          eyebrow={stage === "share" ? "you did it" : stage === "out" ? "good luck out there" : "let's go"}
          title={quest.title}
          leading={<img src={questImage(quest)} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-border object-cover sm:h-28 sm:w-28" />}
        />

        {stage === "plan" || stage === "out" ? (
          <QuestRouteMap destination={quest.location} origin={state.approximateLocation ?? CAMPUS_ORIGIN} />
        ) : null}

        {stage === "plan" ? (
          <div className="mt-8 space-y-8">
            <section>
              <h2 className="text-base font-semibold">Which squads are going?</h2>
              {state.squads.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">You don’t have a squad yet. <Link to="/squad" className="underline underline-offset-2">Create one</Link>, or head out solo.</p> : <>
                <p className="mt-2 text-sm text-muted-foreground">Choose one or more squads. Then you can remove anyone who can’t make it.</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {state.squads.map((squad) => <li key={squad.id}><Chip active={squadIds.includes(squad.id)} onClick={() => toggleSquad(squad.id)}>{squad.name}</Chip></li>)}
                </ul>
              </>}
              {selectedSquads.length > 0 && !canLeadSelectedSquads ? <p className="mt-3 rounded-md bg-surface p-3 text-sm text-muted-foreground">Only the leader of each selected squad can start its activity. Deselect those squads to go solo.</p> : null}
              {selectedSquads.length > 0 && canLeadSelectedSquads ? <>
                <h3 className="mt-5 text-sm font-semibold">Who’s coming from {selectedSquads.map((squad) => squad.name).join(" + ")}?</h3>
                <p className="mt-1 text-sm text-muted-foreground">You’ll be included automatically. Remove anyone who can’t make it.</p>
              </> : null}
              <ul className="mt-3 flex flex-wrap gap-2">
                {canLeadSelectedSquads ? people.map((u) => (
                  <li key={u.id}>
                    <Chip active={chosen.includes(u.id)} onClick={() => toggle(u.id)}>
                      {u.name}
                    </Chip>
                  </li>
                )) : null}
              </ul>
              <p className="mt-2 font-hand text-base text-muted-foreground">
                {names.length ? `you + ${names.join(", ")}` : selectedSquads.length ? "going solo works too" : "going solo works too"}
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold">When?</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  aria-pressed={when === null}
                  onClick={() => setWhen(null)}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors ${when === null ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card hover:bg-surface"}`}
                >
                  Right now
                </button>
                <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-expanded={timePickerOpen}
                      aria-haspopup="dialog"
                      onClick={() => setWhen("scheduled")}
                      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors ${when !== null ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card hover:bg-surface"}`}
                    >
                      <Clock aria-hidden className="h-4 w-4 shrink-0" />
                      {when === null ? "Pick a date & time" : `${selectedDate.toLocaleDateString([], { month: "short", day: "numeric" })} · ${startTime}`}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-2">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setWhen("scheduled");
                          setTimePickerOpen(false);
                        }
                      }}
                      disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                      showOutsideDays={false}
                      className="[--cell-size:2.5rem]"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {when !== null ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">Start time
                    <input
                      type="text"
                      autoComplete="off"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      placeholder="6:00 PM"
                      aria-describedby="time-format-help"
                      className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                    />
                  </label>
                  <label className="block text-sm font-medium">End time
                    <input
                      type="text"
                      autoComplete="off"
                      value={endTime}
                      onChange={(event) => setEndTime(event.target.value)}
                      placeholder="7:30 PM"
                      aria-describedby="time-format-help"
                      className="mt-1 min-h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                    />
                  </label>
                  <p id="time-format-help" className="text-sm text-muted-foreground sm:col-span-2">Type a time like 6:00 PM. End times earlier than the start are treated as the next day.</p>
                </div>
              ) : null}
              <p className="mt-2 font-hand text-base text-muted-foreground">
                {when === null ? "heading out right now" : startDateTime() ? `aiming for ${dateTimeLabel(localDateTimeValue(startDateTime()!))} · until ${endTime}` : "enter a start time"}
              </p>
            </section>
            <div className="flex flex-wrap gap-3">
              <Button disabled={!canLeadSelectedSquads && selectedSquads.length > 0} onClick={() => { if (when === null) void headOut(); else scheduleQuest(); }}>
                {when === null ? <Footprints aria-hidden className="h-5 w-5" /> : <CalendarPlus aria-hidden className="h-5 w-5" />} {when === null ? "Head out" : "Schedule"}
              </Button>
              <Button
                variant="ghost"
                className="border-border-strong bg-card px-6 text-[15px] font-medium hover:bg-surface"
                onClick={() => {
                  if (!state.saved.includes(quest.id)) actions.toggleSave(quest.id);
                  toast("Saved for later");
                  void navigate({ to: "/" });
                }}
              >
                <Bookmark aria-hidden className="h-5 w-5" /> Save for later
              </Button>
              <a
                href={calendarUrl(quest.title, quest.location.name, selectedDate, startTime, endTime, when !== null)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border-strong bg-card px-6 text-[15px] font-medium transition hover:bg-surface"
              >
                <CalendarPlus aria-hidden className="h-5 w-5" /> Add to calendar
              </a>
            </div>
          </div>
        ) : null}

        {stage === "out" ? (
          <div className="mt-8 space-y-6">
            <p role="status" className="rounded-lg border border-primary/30 bg-secondary px-4 py-3 font-hand text-xl">
              Good luck out there! Your quest is active. Come back here when you’re ready to wrap it up.
            </p>
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 items-center justify-between border border-border-strong bg-card px-4"
            >
              <span>
                <span className="block font-semibold">Walk to {quest.location.name}</span>
                <span className="text-sm text-muted-foreground">
                  {quest.location.area} · opens Google Maps
                </span>
              </span>
              <Footprints aria-hidden className="h-5 w-5" />
            </a>
            <section>
              <h2 className="text-base font-semibold">The quest</h2>
              <p className="mt-2">{quest.mission}</p>
              <ol className="mt-4 space-y-3">
                {quest.steps.map((step, i) => (
                  <li key={step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2">
                    <span className="font-hand text-xl">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
              <Button onClick={finish}>We did it</Button>
          </div>
        ) : null}

        {stage === "share" ? (
          <div className="mt-8 space-y-6">
            <section>
              <h2 className="text-base font-semibold">How did it rate?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {members.length
                  ? "Your rating is enough to share. Add any squad ratings you have; only submitted ratings count toward the average."
                  : "Give it your own score out of 10."}
              </p>
              <div className="mt-4 space-y-4">
                <label htmlFor="rating-you" className="block">
                  <span className="flex items-center justify-between text-sm font-medium">
                    <span>Your rating</span>
                    <output>{rating}/10</output>
                  </span>
                  <input
                    id="rating-you"
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                    className="rating-range mt-2 w-full"
                  />
                </label>
                {members.map((member) => {
                  const value = memberRatings[member.id] ?? 5;
                  return (
                    <label key={member.id} htmlFor={`rating-${member.id}`} className="block">
                      <span className="flex items-center justify-between text-sm font-medium">
                        <span>{member.name}'s rating</span>
                        <output>
                          {memberRatings[member.id] === undefined ? "not rated" : `${value}/10`}
                        </output>
                      </span>
                      <input
                        id={`rating-${member.id}`}
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={value}
                        onChange={(event) =>
                          setMemberRatings((current) => ({
                            ...current,
                            [member.id]: Number(event.target.value),
                          }))
                        }
                        className="rating-range mt-2 w-full"
                      />
                    </label>
                  );
                })}
              </div>
              {members.length ? (
                <p className="mt-4 rounded-md bg-surface p-3 text-sm font-semibold">
                  {allMembersRated ? "Squad average" : "Average so far"}:{" "}
                  {Number.isInteger(ratingAverage) ? ratingAverage : ratingAverage.toFixed(1)}/10
                  {!allMembersRated
                    ? ` · add ${members.length - ratedMembers.length} more ${members.length - ratedMembers.length === 1 ? "rating" : "ratings"}`
                    : null}
                </p>
              ) : null}
            </section>
            <section>
              <label htmlFor="caption" className="text-base font-semibold">
                Say something about it
              </label>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="The best part was…"
                className="mt-2 block w-full rounded-md border border-input bg-card p-3"
              />
            </section>
            <section>
              <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 text-[15px] font-medium">
                <ImagePlus aria-hidden className="h-5 w-5" />{" "}
                {photo ? "Change photo" : "Add a photo"}
                <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
              </label>
              {photo ? (
                <img
                  src={photo}
                  alt="Your photo"
                  className="mx-auto mt-3 block max-h-64 w-[86%] max-w-[420px] rounded-2xl border border-border object-cover"
                />
              ) : null}
            </section>
            <div className="flex flex-wrap gap-3">
              <Button onClick={share}>
                <Heart aria-hidden className="h-5 w-5" /> Share to feed
              </Button>
              <Button variant="ghost" onClick={() => void navigate({ to: "/" })}>
                Skip
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <Dialog open={stage === "celebrating"} onOpenChange={(open) => { if (!open && stage === "celebrating") setStage("share"); }}>
        <DialogContent fullScreen className="quest-celebration-content">
          <div className="quest-celebration-glow" aria-hidden="true" />
          <div className="quest-confetti" aria-hidden="true">
            {Array.from({ length: 42 }, (_, index) => (
              <span
                key={index}
                className={`quest-confetti-piece quest-confetti-piece-${index % 4}`}
                style={{
                  "--confetti-x": `${(index * 37) % 100}vw`,
                  "--confetti-delay": `${(index % 12) * 45}ms`,
                  "--confetti-turn": `${(index * 71) % 360}deg`,
                } as CSSProperties}
              />
            ))}
          </div>
          <section className="quest-celebration-card" aria-labelledby="quest-celebration-title">
            <div className="quest-celebration-icon" aria-hidden="true"><PartyPopper /></div>
            <p className="font-hand text-xl">a little victory lap</p>
            <h2 id="quest-celebration-title" className="mt-2 text-4xl font-extrabold tracking-tight sm:text-6xl">Quest complete!</h2>
            <p className="mt-3 max-w-lg text-base text-muted-foreground sm:text-lg">You made a plan happen. That’s the good stuff.</p>
            <p className="quest-xp-pop mt-7 inline-flex min-h-14 items-center rounded-full bg-secondary px-7 font-hand text-2xl font-bold text-secondary-foreground">
              {celebrationXp > 0 ? `+${celebrationXp} XP` : "Nice work!"}
            </p>
            <p className="mt-4 max-w-md truncate text-sm font-semibold text-muted-foreground">{quest.title}</p>
            <Button className="mt-8 min-h-12 px-7" onClick={() => setStage("share")}>
              Share your win <Heart aria-hidden className="h-5 w-5" />
            </Button>
          </section>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
