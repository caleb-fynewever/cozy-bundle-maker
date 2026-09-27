import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { setState, useUserState } from "@/lib/store";
import { syncProfile } from "@/lib/profiles.functions";

export const Route = createFileRoute("/setup")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Set up your account — wego" },
      { name: "description", content: "Tell wego who you are so your friends can find you." },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const state = useUserState();
  const navigate = useNavigate();
  const [name, setName] = useState(state.name === "You" ? "" : state.name);
  const [handle, setHandle] = useState(state.handle === "sidequester" ? "" : state.handle);
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const syncProfileFn = useServerFn(syncProfile);

  function onSave(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedHandle = handle.trim().replace(/^@+/, "").toLowerCase();
    if (!trimmedName) {
      toast.error("Give yourself a name — your friends need to recognize you.");
      return;
    }
    if (!trimmedHandle) {
      toast.error("Pick a handle so people can find your profile.");
      return;
    }
    setBusy(true);
    try {
      await syncProfileFn({ data: { handle: trimmedHandle, name: trimmedName, bio: bio.trim() || "New around here. Looking for something to do.", avatarUrl: null } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your profile. Try again.");
      setBusy(false);
      return;
    }
    setState((current) => ({
      ...current,
      configured: true,
      name: trimmedName,
      handle: trimmedHandle,
      bio: bio.trim() || current.bio,
    }));
    toast.success("You're set up. Go find something to do.");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm">
        <p className="font-hand text-4xl leading-none">wego</p>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Set up your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One time only. This is how you show up to your friends.
        </p>

        <form onSubmit={onSave} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Your name</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={40}
              placeholder="Alex"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Handle</span>
            <input
              type="text"
              required
              maxLength={24}
              placeholder="alexoutdoors"
              value={handle}
              onChange={(event) => setHandle(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="mt-1 min-h-12 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Bio <span className="text-muted-foreground">(optional)</span></span>
            <textarea
              maxLength={140}
              rows={3}
              placeholder="Usually down for coffee walks and cheap eats."
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground"
          >
            Save and start
          </button>
        </form>

        <p className="mt-8 font-hand text-lg text-muted-foreground">make it you.</p>
      </div>
    </div>
  );
}
