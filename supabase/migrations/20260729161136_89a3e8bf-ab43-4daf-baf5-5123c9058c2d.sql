
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  role public.app_role NOT NULL DEFAULT 'invitado',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan invitaciones"
  ON public.invitations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.redeem_invitation(_token TEXT)
RETURNS TABLE(role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invitations;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO inv FROM public.invitations WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;
  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitación ya utilizada';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitación expirada';
  END IF;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (uid, inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.invitations
    SET accepted_by = uid, accepted_at = now()
    WHERE id = inv.id;

  RETURN QUERY SELECT inv.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
