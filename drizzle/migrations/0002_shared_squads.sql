CREATE TABLE public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  leader_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.squad_members (
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, user_id)
);
CREATE INDEX squad_members_user_idx ON public.squad_members (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squads TO authenticated;
GRANT ALL ON public.squads TO service_role;
GRANT SELECT, DELETE ON public.squad_members TO authenticated;
GRANT ALL ON public.squad_members TO service_role;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_squad_member(_squad uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = _squad AND user_id = _user)
$$;

CREATE POLICY "Members read squads" ON public.squads FOR SELECT TO authenticated
  USING (leader_id = auth.uid() OR public.is_squad_member(id, auth.uid()));
CREATE POLICY "Leaders create squads" ON public.squads FOR INSERT TO authenticated
  WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Leaders rename squads" ON public.squads FOR UPDATE TO authenticated
  USING (leader_id = auth.uid()) WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Leaders delete squads" ON public.squads FOR DELETE TO authenticated
  USING (leader_id = auth.uid());

CREATE POLICY "Members read members" ON public.squad_members FOR SELECT TO authenticated
  USING (public.is_squad_member(squad_id, auth.uid()));
CREATE POLICY "Leave or remove members" ON public.squad_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.squads s WHERE s.id = squad_id AND s.leader_id = auth.uid())
  );

-- Leader is always a member of their own squad.
CREATE OR REPLACE FUNCTION public.add_squad_leader()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.squad_members (squad_id, user_id) VALUES (NEW.id, NEW.leader_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER squads_add_leader AFTER INSERT ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.add_squad_leader();

-- Accepting an invite adds the invitee to the shared squad.
CREATE OR REPLACE FUNCTION public.join_squad_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.invitee_id IS NOT NULL
     AND NEW.squad_key ~* '^[0-9a-f-]{36}$' THEN
    INSERT INTO public.squad_members (squad_id, user_id)
    SELECT s.id, NEW.invitee_id FROM public.squads s
    WHERE s.id = NEW.squad_key::uuid AND s.leader_id = NEW.inviter_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER squad_invites_join AFTER UPDATE ON public.squad_invites
  FOR EACH ROW EXECUTE FUNCTION public.join_squad_on_accept();