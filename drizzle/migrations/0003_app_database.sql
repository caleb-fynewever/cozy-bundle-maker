-- Public demo identities never get auth.users rows or login credentials.
CREATE TABLE public.demo_people (
  id text PRIMARY KEY CHECK (id LIKE 'u_%'),
  handle text NOT NULL UNIQUE,
  name text NOT NULL,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
);
ALTER TABLE public.demo_people ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.demo_people TO authenticated;
CREATE POLICY "Read demo people" ON public.demo_people FOR SELECT TO authenticated USING (true);

CREATE TABLE public.quests (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quest_content_valid CHECK ((
    jsonb_typeof(content) = 'object' AND content->>'id' = id
    AND length(btrim(content->>'title')) BETWEEN 1 AND 120
    AND jsonb_typeof(content->'steps') = 'array'
    AND jsonb_typeof(content->'vibes') = 'array'
    AND jsonb_typeof(content->'location') = 'object'
    AND content ?& ARRAY['id','title','hook','mission','steps','vibes','location','durationMin','costPerPerson','groupMin','groupMax','weirdness','adventure','bestTime','indoor']
    AND jsonb_array_length(content->'steps') BETWEEN 1 AND 30
    AND jsonb_array_length(content->'vibes') BETWEEN 1 AND 9
    AND (content->>'durationMin')::numeric BETWEEN 1 AND 10080
    AND (content->>'costPerPerson')::numeric BETWEEN 0 AND 10000
    AND (content->>'groupMin')::integer BETWEEN 1 AND 1000
    AND (content->>'groupMax')::integer BETWEEN (content->>'groupMin')::integer AND 1000
    AND (content->>'weirdness')::integer BETWEEN 1 AND 5
    AND (content->>'adventure')::integer BETWEEN 1 AND 5
    AND (content->'location'->>'lat')::numeric BETWEEN -90 AND 90
    AND (content->'location'->>'lng')::numeric BETWEEN -180 AND 180
    AND octet_length(content::text) <= 100000
  ) IS TRUE)
);
CREATE INDEX quests_owner_idx ON public.quests(owner_id);
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.quests TO authenticated;
CREATE POLICY "Read quests including history" ON public.quests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create own quests" ON public.quests FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Edit own quests" ON public.quests FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.squad_demo_members (
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  person_id text REFERENCES public.demo_people(id) ON DELETE CASCADE,
  PRIMARY KEY(squad_id, person_id)
);
ALTER TABLE public.squad_demo_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.squad_demo_members TO authenticated;
CREATE POLICY "Members read demo members" ON public.squad_demo_members FOR SELECT TO authenticated
  USING (public.is_squad_member(squad_id, auth.uid()));
CREATE POLICY "Leaders add demo members" ON public.squad_demo_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.squads WHERE id = squad_id AND leader_id = auth.uid()));
CREATE POLICY "Leaders remove demo members" ON public.squad_demo_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.squads WHERE id = squad_id AND leader_id = auth.uid()));

-- Private account state is versioned; stale devices cannot overwrite newer writes.
CREATE TABLE public.account_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 1,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 4000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_state ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.account_state TO authenticated;
CREATE POLICY "Read own account state" ON public.account_state FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.save_account_state(expected_revision bigint, new_payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(new_payload->'publicProfile') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid privacy preference'; END IF;
  IF new_payload ? 'approximateLocation' OR new_payload ? 'email' OR new_payload ? 'squads' THEN
    RAISE EXCEPTION 'Unsupported private state fields';
  END IF;
  IF expected_revision = 0 THEN
    INSERT INTO public.account_state(user_id, payload) VALUES (auth.uid(), new_payload)
      ON CONFLICT DO NOTHING RETURNING revision INTO result;
  ELSE
    UPDATE public.account_state SET payload = new_payload, revision = revision + 1, updated_at = now()
      WHERE user_id = auth.uid() AND revision = expected_revision RETURNING revision INTO result;
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'Account changed on another device' USING ERRCODE = '40001'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_account_state(bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_account_state(bigint, jsonb) TO authenticated;
GRANT ALL ON public.demo_people, public.quests, public.squad_demo_members, public.account_state TO service_role;

-- Keep private contact details out of public profile reads.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT(id, handle, name, bio, avatar_url, updated_at) ON public.profiles TO authenticated;

-- A leader cannot leave their own squad without deleting it.
CREATE FUNCTION public.protect_squad_leader() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.squads WHERE id = OLD.squad_id AND leader_id = OLD.user_id) THEN
    RAISE EXCEPTION 'Delete the squad before leaving as its leader';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER protect_squad_leader BEFORE DELETE ON public.squad_members FOR EACH ROW EXECUTE FUNCTION public.protect_squad_leader();

-- An invite response cannot change its recipient, sender, or target squad.
CREATE FUNCTION public.protect_invite_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.inviter_id, NEW.invitee_email, NEW.squad_key) IS DISTINCT FROM (OLD.inviter_id, OLD.invitee_email, OLD.squad_key)
    OR (OLD.invitee_id IS NOT NULL AND NEW.invitee_id IS DISTINCT FROM OLD.invitee_id)
    OR (NEW.invitee_id IS NOT NULL AND NEW.invitee_id IS DISTINCT FROM auth.uid() AND current_user = 'authenticated') THEN
    RAISE EXCEPTION 'Invite identity cannot change';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_invite_identity BEFORE UPDATE ON public.squad_invites FOR EACH ROW EXECUTE FUNCTION public.protect_invite_identity();

DROP POLICY "Invitee responds" ON public.squad_invites;
CREATE POLICY "Invitee responds" ON public.squad_invites FOR UPDATE TO authenticated
  USING (status = 'pending' AND (invitee_id = auth.uid() OR lower(invitee_email) = lower(coalesce(auth.jwt()->>'email', ''))))
  WITH CHECK (invitee_id = auth.uid() AND status IN ('accepted','declined'));
DROP POLICY "Inviter creates own invites" ON public.squad_invites;
CREATE POLICY "Inviter creates own invites" ON public.squad_invites FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND status = 'pending' AND EXISTS (
    SELECT 1 FROM public.squads WHERE id::text = squad_key AND leader_id = auth.uid()
  ));

-- Public ranks are computed from database records, never from client-submitted XP totals.
CREATE TABLE public.quest_completions (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id text REFERENCES public.quests(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(user_id, quest_id)
);
ALTER TABLE public.quest_completions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.quest_completions TO authenticated;
GRANT ALL ON public.quest_completions TO service_role;
CREATE POLICY "Read own completions" ON public.quest_completions FOR SELECT TO authenticated USING(user_id = auth.uid());
CREATE FUNCTION public.project_completions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(NEW.payload->'completed') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid completion list'; END IF;
  INSERT INTO public.quest_completions(user_id, quest_id)
    SELECT NEW.user_id, q.id FROM jsonb_array_elements_text(NEW.payload->'completed') c(id)
    JOIN public.quests q ON q.id = c.id
    ON CONFLICT(user_id,quest_id) DO UPDATE SET active = true;
  UPDATE public.quest_completions SET active = false
    WHERE user_id = NEW.user_id AND NOT (NEW.payload->'completed' ? quest_id);
  RETURN NEW;
END $$;
CREATE TRIGGER project_completions AFTER INSERT OR UPDATE ON public.account_state FOR EACH ROW EXECUTE FUNCTION public.project_completions();

CREATE FUNCTION public.profile_is_public(person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (payload->>'publicProfile')::boolean FROM public.account_state WHERE user_id = person), true)
$$;
REVOKE ALL ON FUNCTION public.profile_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_is_public(uuid) TO authenticated;
DROP POLICY "Signed-in users can browse profiles" ON public.profiles;
CREATE POLICY "Read public or own profile" ON public.profiles FOR SELECT TO authenticated
  USING(id = auth.uid() OR public.profile_is_public(id) OR EXISTS (
    SELECT 1 FROM public.squad_members m WHERE m.user_id = profiles.id AND public.is_squad_member(m.squad_id, auth.uid())
  ));

CREATE FUNCTION public.completion_week_streak(person uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE weeks AS (
    SELECT DISTINCT date_trunc('week',completed_at)::date AS w FROM public.quest_completions WHERE user_id=person AND active
  ), chain AS (
    SELECT max(w) AS w FROM weeks HAVING max(w) >= date_trunc('week',now())::date - 7
    UNION ALL SELECT weeks.w FROM weeks JOIN chain ON weeks.w = chain.w - 7
  ) SELECT count(*) FROM chain
$$;
REVOKE ALL ON FUNCTION public.completion_week_streak(uuid) FROM PUBLIC;

CREATE FUNCTION public.people_directory() RETURNS TABLE(id uuid, handle text, name text, bio text, avatar_url text, xp bigint, week_xp bigint, completed bigint, created bigint, weekly_streak bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.handle, p.name, p.bio, p.avatar_url,
    (SELECT count(*) * 120 FROM public.quest_completions c WHERE c.user_id = p.id AND c.active)
      + (SELECT count(*) * 90 FROM public.quests q WHERE q.owner_id = p.id),
    (SELECT count(*) * 120 FROM public.quest_completions c WHERE c.user_id = p.id AND c.active AND c.completed_at >= now() - interval '7 days')
      + (SELECT count(*) * 90 FROM public.quests q WHERE q.owner_id = p.id AND q.created_at >= now() - interval '7 days'),
    (SELECT count(*) FROM public.quest_completions c WHERE c.user_id = p.id AND c.active),
    (SELECT count(*) FROM public.quests q WHERE q.owner_id = p.id),
    public.completion_week_streak(p.id)
  FROM public.profiles p WHERE auth.uid() IS NOT NULL AND (p.id = auth.uid() OR public.profile_is_public(p.id)
    OR EXISTS (SELECT 1 FROM public.squad_members m WHERE m.user_id=p.id AND public.is_squad_member(m.squad_id, auth.uid())))
  ORDER BY p.id LIMIT 1000
$$;
REVOKE ALL ON FUNCTION public.people_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.people_directory() TO authenticated;

CREATE TABLE public.demo_squads(id text PRIMARY KEY, name text NOT NULL, leader_id text REFERENCES public.demo_people(id));
CREATE TABLE public.demo_squad_members(squad_id text REFERENCES public.demo_squads(id) ON DELETE CASCADE, person_id text REFERENCES public.demo_people(id), PRIMARY KEY(squad_id,person_id));
ALTER TABLE public.demo_squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_squad_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.demo_squads, public.demo_squad_members TO authenticated;
GRANT ALL ON public.demo_squads, public.demo_squad_members TO service_role;
CREATE POLICY "Read demo squads" ON public.demo_squads FOR SELECT TO authenticated USING(true);
CREATE POLICY "Read demo squad members" ON public.demo_squad_members FOR SELECT TO authenticated USING(true);

-- Only editable quest fields are writable; clients cannot forge creation dates or transfer ownership.
REVOKE INSERT, UPDATE ON public.quests FROM authenticated;
GRANT INSERT(id, owner_id, archived, content, updated_at), UPDATE(content, archived, updated_at) ON public.quests TO authenticated;

CREATE FUNCTION public.sync_squad_invites() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.squad_invites WHERE squad_key = OLD.id::text AND status = 'pending';
    RETURN OLD;
  END IF;
  UPDATE public.squad_invites SET squad_name = NEW.name WHERE squad_key = NEW.id::text AND status = 'pending';
  RETURN NEW;
END $$;
CREATE TRIGGER sync_squad_invite_names AFTER UPDATE OF name ON public.squads FOR EACH ROW EXECUTE FUNCTION public.sync_squad_invites();
CREATE TRIGGER remove_pending_squad_invites BEFORE DELETE ON public.squads FOR EACH ROW EXECUTE FUNCTION public.sync_squad_invites();

CREATE FUNCTION public.publish_quest(quest_content jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.quests(id,owner_id,content) VALUES(quest_content->>'id',auth.uid(),quest_content)
    ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=now()
    WHERE quests.owner_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'You cannot edit this quest'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.publish_quest(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_quest(jsonb) TO authenticated;

-- Append-only awards make repeated requests idempotent and keep public XP server-owned.
CREATE TABLE public.xp_events (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('complete','squad','create','join','verify')),
  ref_id text NOT NULL,
  xp integer NOT NULL CHECK(xp > 0),
  label text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(user_id,kind,ref_id)
);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
CREATE POLICY "Read own awards" ON public.xp_events FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.award_quest_creation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.xp_events(user_id,kind,ref_id,xp,label) VALUES(NEW.owner_id,'create',NEW.id,90,'Made ' || (NEW.content->>'title')) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER award_quest_creation AFTER INSERT ON public.quests FOR EACH ROW EXECUTE FUNCTION public.award_quest_creation();
CREATE FUNCTION public.award_completion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.xp_events(user_id,kind,ref_id,xp,label,active)
    VALUES(NEW.user_id,'complete',NEW.quest_id,120,'Did ' || (SELECT content->>'title' FROM public.quests WHERE id=NEW.quest_id),NEW.active)
    ON CONFLICT(user_id,kind,ref_id) DO UPDATE SET active=excluded.active;
  IF NOT NEW.active THEN UPDATE public.xp_events SET active=false WHERE user_id=NEW.user_id AND kind='squad' AND ref_id=NEW.quest_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER award_completion AFTER INSERT OR UPDATE ON public.quest_completions FOR EACH ROW EXECUTE FUNCTION public.award_completion();
CREATE FUNCTION public.award_squad_join() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE leader uuid; person text;
BEGIN
  SELECT leader_id INTO leader FROM public.squads WHERE id=NEW.squad_id;
  IF TG_TABLE_NAME='squad_demo_members' THEN person=NEW.person_id;
  ELSE
    IF NEW.user_id=leader THEN RETURN NEW; END IF;
    person='f_' || NEW.user_id::text;
  END IF;
  INSERT INTO public.xp_events(user_id,kind,ref_id,xp,label) VALUES(leader,'join',person,40,'Added a squadmate') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER award_real_squad_join AFTER INSERT ON public.squad_members FOR EACH ROW EXECUTE FUNCTION public.award_squad_join();
CREATE TRIGGER award_demo_squad_join AFTER INSERT ON public.squad_demo_members FOR EACH ROW EXECUTE FUNCTION public.award_squad_join();

CREATE FUNCTION public.award_squad_completions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Completion with a squad is self-reported, but an actual squad membership is required.
  IF EXISTS(SELECT 1 FROM public.squad_members m WHERE m.user_id=NEW.user_id AND (
    EXISTS(SELECT 1 FROM public.squad_members other WHERE other.squad_id=m.squad_id AND other.user_id<>NEW.user_id)
    OR EXISTS(SELECT 1 FROM public.squad_demo_members d WHERE d.squad_id=m.squad_id))) THEN
    INSERT INTO public.xp_events(user_id,kind,ref_id,xp,label)
      SELECT DISTINCT NEW.user_id,'squad',e->>'refId',60,'Went with the squad'
      FROM jsonb_array_elements(coalesce(NEW.payload->'log','[]'::jsonb)) e
      WHERE e->>'kind'='squad' AND EXISTS(SELECT 1 FROM public.quest_completions c WHERE c.user_id=NEW.user_id AND c.quest_id=e->>'refId' AND c.active)
      ON CONFLICT(user_id,kind,ref_id) DO UPDATE SET active=true;
  END IF;
  RETURN NEW;
END $$;
-- PostgreSQL fires same-kind triggers alphabetically; completions must exist first.
CREATE TRIGGER zz_award_squad_completions AFTER INSERT OR UPDATE ON public.account_state FOR EACH ROW EXECUTE FUNCTION public.award_squad_completions();

CREATE OR REPLACE FUNCTION public.people_directory() RETURNS TABLE(id uuid, handle text, name text, bio text, avatar_url text, xp bigint, week_xp bigint, completed bigint, created bigint, weekly_streak bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,p.handle,p.name,p.bio,p.avatar_url,
    coalesce((SELECT sum(e.xp) FROM public.xp_events e WHERE e.user_id=p.id AND e.active),0),
    coalesce((SELECT sum(e.xp) FROM public.xp_events e WHERE e.user_id=p.id AND e.active AND e.awarded_at>=now()-interval '7 days'),0),
    (SELECT count(*) FROM public.quest_completions c WHERE c.user_id=p.id AND c.active),
    (SELECT count(*) FROM public.quests q WHERE q.owner_id=p.id),public.completion_week_streak(p.id)
  FROM public.profiles p WHERE auth.uid() IS NOT NULL AND (p.id=auth.uid() OR public.profile_is_public(p.id)
    OR EXISTS(SELECT 1 FROM public.squad_members m WHERE m.user_id=p.id AND public.is_squad_member(m.squad_id,auth.uid())))
  ORDER BY p.id LIMIT 1000
$$;

CREATE FUNCTION public.valid_quest_document(q jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (
    jsonb_typeof(q->'id')='string' AND jsonb_typeof(q->'title')='string'
    AND jsonb_typeof(q->'hook')='string' AND length(q->>'hook')<=600
    AND jsonb_typeof(q->'mission')='string' AND length(q->>'mission')<=6000
    AND jsonb_typeof(q->'indoor')='boolean'
    AND q->'vibes' <@ '["chill","active","food","creative","social","weird","outdoors","competitive","late-night"]'::jsonb
    AND jsonb_typeof(q->'bestTime')='array' AND jsonb_array_length(q->'bestTime')<=4
    AND q->'bestTime' <@ '["morning","afternoon","evening","late"]'::jsonb
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'steps') s WHERE jsonb_typeof(s)<>'string' OR length(s#>>'{}') NOT BETWEEN 1 AND 1500)
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['durationMin','costPerPerson','groupMin','groupMax','weirdness','adventure']) k WHERE jsonb_typeof(q->k) IS DISTINCT FROM 'number')
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['durationMin','groupMin','groupMax','weirdness','adventure']) k WHERE (q->>k)::numeric <> trunc((q->>k)::numeric))
    AND jsonb_typeof(q->'location'->'name')='string' AND length(q->'location'->>'name')<=200
    AND jsonb_typeof(q->'location'->'area')='string' AND length(q->'location'->>'area')<=200
    AND jsonb_typeof(q->'location'->'lat')='number' AND jsonb_typeof(q->'location'->'lng')='number'
    AND (NOT q ? 'createdBy' OR (jsonb_typeof(q->'createdBy')='string' AND length(q->>'createdBy')<=100))
    AND (NOT q ? 'generated' OR jsonb_typeof(q->'generated')='boolean')
  ) IS TRUE
$$;
ALTER TABLE public.quests ADD CONSTRAINT quest_document_types CHECK(public.valid_quest_document(content));

CREATE TABLE public.student_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK(email ~* '^[^@ ]+@[^@ ]+\.edu$'),
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.student_verifications TO authenticated;
GRANT ALL ON public.student_verifications TO service_role;
CREATE POLICY "Read own student verification" ON public.student_verifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.award_student_verification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.xp_events(user_id,kind,ref_id,xp,label) VALUES(NEW.user_id,'verify','student',60,'Verified your student email') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER award_student_verification AFTER INSERT ON public.student_verifications FOR EACH ROW EXECUTE FUNCTION public.award_student_verification();
CREATE TABLE public.verification_limits(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, window_start timestamptz NOT NULL DEFAULT now(), sends integer NOT NULL DEFAULT 0, attempts integer NOT NULL DEFAULT 0);
ALTER TABLE public.verification_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.verification_limits TO service_role;
CREATE FUNCTION public.take_verification_attempt(person uuid, checking boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.verification_limits;
BEGIN
  INSERT INTO public.verification_limits(user_id) VALUES(person) ON CONFLICT DO NOTHING;
  SELECT * INTO row FROM public.verification_limits WHERE user_id=person FOR UPDATE;
  IF row.window_start < now()-interval '1 hour' THEN
    UPDATE public.verification_limits SET window_start=now(),sends=0,attempts=0 WHERE user_id=person;
    row.sends=0; row.attempts=0;
  END IF;
  IF (checking AND row.attempts>=20) OR (NOT checking AND row.sends>=5) THEN RETURN false; END IF;
  UPDATE public.verification_limits SET sends=sends+CASE WHEN checking THEN 0 ELSE 1 END, attempts=attempts+CASE WHEN checking THEN 1 ELSE 0 END WHERE user_id=person;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.take_verification_attempt(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.take_verification_attempt(uuid,boolean) TO service_role;

CREATE TABLE public.feed_posts (
  id text PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  demo_id text REFERENCES public.demo_people(id),
  quest_id text NOT NULL REFERENCES public.quests(id),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_id IS NULL) <> (demo_id IS NULL)),
  CHECK ((jsonb_typeof(content->'caption')='string' AND length(content->>'caption')<=3000
    AND jsonb_typeof(content->'rating')='number' AND (content->>'rating')::numeric BETWEEN 0 AND 10
    AND jsonb_typeof(content->'ratingCount')='number' AND (content->>'ratingCount')::numeric BETWEEN 1 AND 1000
    AND jsonb_typeof(content->'withNames')='array' AND octet_length(content::text)<=2500000) IS TRUE)
);
CREATE INDEX feed_posts_owner_idx ON public.feed_posts(owner_id,created_at DESC);
CREATE TABLE public.post_hearts(post_id text REFERENCES public.feed_posts(id) ON DELETE CASCADE,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,PRIMARY KEY(post_id,user_id));
CREATE TABLE public.post_comments(id text PRIMARY KEY,post_id text REFERENCES public.feed_posts(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hearts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.feed_posts,public.post_hearts,public.post_comments TO authenticated;
GRANT ALL ON public.feed_posts,public.post_hearts,public.post_comments TO service_role;
CREATE FUNCTION public.can_read_post(post text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.feed_posts p WHERE p.id=post AND
    (p.demo_id IS NOT NULL OR p.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.squad_members m WHERE m.user_id=p.owner_id AND public.is_squad_member(m.squad_id,auth.uid()))))
$$;
REVOKE ALL ON FUNCTION public.can_read_post(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_post(text) TO authenticated;
CREATE POLICY "Read visible feed posts" ON public.feed_posts FOR SELECT TO authenticated USING(public.can_read_post(id));
CREATE POLICY "Read visible hearts" ON public.post_hearts FOR SELECT TO authenticated USING(public.can_read_post(post_id));
CREATE POLICY "Read visible comments" ON public.post_comments FOR SELECT TO authenticated USING(public.can_read_post(post_id));

CREATE FUNCTION public.read_feed() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(item ORDER BY at DESC),'[]'::jsonb) FROM (
    SELECT extract(epoch FROM p.created_at)*1000 AS at, jsonb_build_object(
      'id',p.id,'questId',p.quest_id,'author',coalesce(pr.name,d.name,'Squadmate'),
      'authorId',CASE WHEN p.owner_id=auth.uid() THEN 'me' WHEN p.owner_id IS NOT NULL THEN 'f_'||p.owner_id::text ELSE p.demo_id END,
      'rating',p.content->'rating','ratingCount',p.content->'ratingCount','caption',p.content->'caption',
      'photo',p.content->'photo','withNames',p.content->'withNames','at',extract(epoch FROM p.created_at)*1000,
      'hearts',coalesce((p.content->>'hearts')::integer,0)+(SELECT count(*) FROM public.post_hearts h WHERE h.post_id=p.id AND h.user_id<>auth.uid()),
      'comments',coalesce(p.content->'comments','[]'::jsonb)||coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'author',coalesce(cp.name,'Squadmate'),'text',c.body,'at',extract(epoch FROM c.created_at)*1000) ORDER BY c.created_at)
        FROM public.post_comments c LEFT JOIN public.profiles cp ON cp.id=c.user_id WHERE c.post_id=p.id AND c.user_id<>auth.uid()),'[]'::jsonb)
    ) AS item FROM public.feed_posts p LEFT JOIN public.profiles pr ON pr.id=p.owner_id LEFT JOIN public.demo_people d ON d.id=p.demo_id
    WHERE public.can_read_post(p.id) ORDER BY p.created_at DESC LIMIT 500
  ) rows
$$;
REVOKE ALL ON FUNCTION public.read_feed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_feed() TO authenticated;

CREATE FUNCTION public.sync_social(posts jsonb, heart_ids jsonb, comments jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p jsonb; pair record; c jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(posts)<>'array' OR jsonb_typeof(heart_ids)<>'array' OR jsonb_typeof(comments)<>'object'
     OR jsonb_array_length(posts)>1000 OR octet_length(comments::text)>2000000 THEN RAISE EXCEPTION 'Invalid social data'; END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(posts) LOOP
    INSERT INTO public.feed_posts(id,owner_id,quest_id,content) VALUES(p->>'id',auth.uid(),p->>'questId',jsonb_build_object(
      'rating',p->'rating','ratingCount',p->'ratingCount','caption',p->'caption','photo',p->'photo','withNames',p->'withNames'))
      ON CONFLICT(id) DO NOTHING;
  END LOOP;
  DELETE FROM public.post_hearts WHERE user_id=auth.uid() AND NOT (heart_ids ? post_id);
  INSERT INTO public.post_hearts(post_id,user_id) SELECT h,auth.uid() FROM jsonb_array_elements_text(heart_ids) h WHERE public.can_read_post(h) ON CONFLICT DO NOTHING;
  FOR pair IN SELECT * FROM jsonb_each(comments) LOOP
    IF NOT public.can_read_post(pair.key) THEN CONTINUE; END IF;
    FOR c IN SELECT value FROM jsonb_array_elements(pair.value) LOOP
      INSERT INTO public.post_comments(id,post_id,user_id,body) VALUES(c->>'id',pair.key,auth.uid(),c->>'text') ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  RETURN public.read_feed();
END $$;
REVOKE ALL ON FUNCTION public.sync_social(jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_social(jsonb,jsonb,jsonb) TO authenticated;
CREATE FUNCTION public.valid_post_document(p jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ((NOT p ? 'photo' OR jsonb_typeof(p->'photo')='null' OR (jsonb_typeof(p->'photo')='string' AND length(p->>'photo')<=2000000))
    AND (p->>'ratingCount')::numeric=trunc((p->>'ratingCount')::numeric)
    AND jsonb_array_length(p->'withNames')<=1000
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'withNames') n WHERE jsonb_typeof(n)<>'string' OR length(n#>>'{}')>60)) IS TRUE
$$;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_post_document_types CHECK(public.valid_post_document(content));

CREATE FUNCTION public.reserve_demo_handles() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='UPDATE' AND lower(NEW.handle)=lower(OLD.handle) THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.demo_people WHERE lower(handle)=lower(NEW.handle)) THEN
    RAISE EXCEPTION 'This handle belongs to a demo profile';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reserve_demo_handles BEFORE INSERT OR UPDATE OF handle ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.reserve_demo_handles();
