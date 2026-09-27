CREATE TABLE public.squad_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_key text NOT NULL,
  squad_name text NOT NULL,
  inviter_id uuid NOT NULL,
  inviter_name text NOT NULL,
  invitee_email text NOT NULL,
  invitee_id uuid,
  invitee_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX squad_invites_email_idx ON public.squad_invites (lower(invitee_email));
CREATE INDEX squad_invites_inviter_idx ON public.squad_invites (inviter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_invites TO authenticated;
GRANT ALL ON public.squad_invites TO service_role;
ALTER TABLE public.squad_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inviter or invitee can read" ON public.squad_invites FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
CREATE POLICY "Inviter creates own invites" ON public.squad_invites FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND status = 'pending');
CREATE POLICY "Invitee responds" ON public.squad_invites FOR UPDATE TO authenticated
  USING (lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')) AND status IN ('accepted','declined'));
CREATE POLICY "Inviter cancels" ON public.squad_invites FOR DELETE TO authenticated
  USING (inviter_id = auth.uid());