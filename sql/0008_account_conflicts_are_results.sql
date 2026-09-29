-- Optimistic-lock conflicts are expected control flow, not PostgreSQL errors.
-- Returning 0 lets the client reload on its next real sync trigger without
-- filling Postgres logs with ERROR entries.
CREATE OR REPLACE FUNCTION public.save_account_state(expected_revision bigint, new_payload jsonb)
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
  RETURN coalesce(result, 0);
END $$;

REVOKE ALL ON FUNCTION public.save_account_state(bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_account_state(bigint, jsonb) TO authenticated;