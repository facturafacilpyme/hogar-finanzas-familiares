
-- 1. FAMILIES
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'miembro',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_family_members_user ON public.family_members(user_id);

-- 2. HELPERS
CREATE OR REPLACE FUNCTION public.is_family_member(_family_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = _family_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.family_role(_family_id UUID, _user_id UUID)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.family_members WHERE family_id = _family_id AND user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(_family_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = _family_id AND user_id = _user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_write_family(_family_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = _family_id AND user_id = _user_id AND role IN ('admin','miembro'));
$$;

-- 3. POLICIES for families / family_members
CREATE POLICY "ver mis familias" ON public.families FOR SELECT TO authenticated
  USING (public.is_family_member(id, auth.uid()));
CREATE POLICY "crear familia" ON public.families FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "admin edita familia" ON public.families FOR UPDATE TO authenticated
  USING (public.is_family_admin(id, auth.uid()));
CREATE POLICY "admin borra familia" ON public.families FOR DELETE TO authenticated
  USING (public.is_family_admin(id, auth.uid()));

CREATE POLICY "ver miembros de mis familias" ON public.family_members FOR SELECT TO authenticated
  USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "admin agrega miembros" ON public.family_members FOR INSERT TO authenticated
  WITH CHECK (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "admin cambia roles" ON public.family_members FOR UPDATE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "admin quita miembros" ON public.family_members FOR DELETE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));

-- 4. BACKFILL demo family
DO $$
DECLARE fid UUID; owner UUID;
BEGIN
  SELECT id INTO owner FROM public.profiles ORDER BY created_at LIMIT 1;
  IF owner IS NOT NULL THEN
    INSERT INTO public.families (name, created_by) VALUES ('Familia demo', owner) RETURNING id INTO fid;
    INSERT INTO public.family_members (family_id, user_id, role)
      SELECT fid, p.id, COALESCE((SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id ORDER BY ur.role LIMIT 1), 'miembro')
      FROM public.profiles p;
  END IF;
END $$;

-- 5. family_id columns
ALTER TABLE public.debts ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.debt_members ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.savings_goals ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.savings_contributions ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.invitations ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

DO $$
DECLARE fid UUID;
BEGIN
  SELECT id INTO fid FROM public.families ORDER BY created_at LIMIT 1;
  IF fid IS NOT NULL THEN
    UPDATE public.debts SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.debt_members SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.payments SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.savings_goals SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.savings_contributions SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.expenses SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.notifications SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.activity_log SET family_id = fid WHERE family_id IS NULL;
    UPDATE public.invitations SET family_id = fid WHERE family_id IS NULL;
  END IF;
END $$;

DELETE FROM public.debts WHERE family_id IS NULL;
DELETE FROM public.savings_goals WHERE family_id IS NULL;
DELETE FROM public.expenses WHERE family_id IS NULL;
DELETE FROM public.notifications WHERE family_id IS NULL;
DELETE FROM public.activity_log WHERE family_id IS NULL;
DELETE FROM public.invitations WHERE family_id IS NULL;

ALTER TABLE public.debts ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.savings_goals ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.invitations ALTER COLUMN family_id SET NOT NULL;

-- derive family_id for child rows
CREATE OR REPLACE FUNCTION public.set_family_from_debt()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.family_id IS NULL THEN
    SELECT family_id INTO NEW.family_id FROM public.debts WHERE id = NEW.debt_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_family_from_goal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.family_id IS NULL THEN
    SELECT family_id INTO NEW.family_id FROM public.savings_goals WHERE id = NEW.goal_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_debt_members_family BEFORE INSERT ON public.debt_members
  FOR EACH ROW EXECUTE FUNCTION public.set_family_from_debt();
CREATE TRIGGER trg_payments_family BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_family_from_debt();
CREATE TRIGGER trg_contrib_family BEFORE INSERT ON public.savings_contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_family_from_goal();

-- 6. REPLACE POLICIES on domain tables
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN
      ('debts','debt_members','payments','savings_goals','savings_contributions','expenses','notifications','activity_log','invitations')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- debts
CREATE POLICY "debts_select" ON public.debts FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "debts_insert" ON public.debts FOR INSERT TO authenticated WITH CHECK (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "debts_update" ON public.debts FOR UPDATE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "debts_delete" ON public.debts FOR DELETE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));

-- debt_members
CREATE POLICY "dm_select" ON public.debt_members FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "dm_insert" ON public.debt_members FOR INSERT TO authenticated WITH CHECK (public.is_family_admin((SELECT d.family_id FROM public.debts d WHERE d.id = debt_id), auth.uid()));
CREATE POLICY "dm_update" ON public.debt_members FOR UPDATE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "dm_delete" ON public.debt_members FOR DELETE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));

-- payments
CREATE POLICY "pay_select" ON public.payments FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "pay_insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_write_family((SELECT d.family_id FROM public.debts d WHERE d.id = debt_id), auth.uid()));
CREATE POLICY "pay_update" ON public.payments FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "pay_delete" ON public.payments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_family_admin(family_id, auth.uid()));

-- savings_goals
CREATE POLICY "sg_select" ON public.savings_goals FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "sg_insert" ON public.savings_goals FOR INSERT TO authenticated WITH CHECK (public.can_write_family(family_id, auth.uid()));
CREATE POLICY "sg_update" ON public.savings_goals FOR UPDATE TO authenticated USING (public.can_write_family(family_id, auth.uid()));
CREATE POLICY "sg_delete" ON public.savings_goals FOR DELETE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));

-- savings_contributions
CREATE POLICY "sc_select" ON public.savings_contributions FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "sc_insert" ON public.savings_contributions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_write_family((SELECT g.family_id FROM public.savings_goals g WHERE g.id = goal_id), auth.uid()));
CREATE POLICY "sc_delete" ON public.savings_contributions FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_family_admin(family_id, auth.uid()));

-- expenses
CREATE POLICY "exp_select" ON public.expenses FOR SELECT TO authenticated USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "exp_insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.can_write_family(family_id, auth.uid()));
CREATE POLICY "exp_update" ON public.expenses FOR UPDATE TO authenticated USING (paid_by = auth.uid() OR public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "exp_delete" ON public.expenses FOR DELETE TO authenticated USING (paid_by = auth.uid() OR public.is_family_admin(family_id, auth.uid()));

-- notifications
CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- activity_log
CREATE POLICY "act_select" ON public.activity_log FOR SELECT TO authenticated USING (family_id IS NOT NULL AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "act_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (public.is_family_member(family_id, auth.uid()));

-- invitations
CREATE POLICY "inv_select" ON public.invitations FOR SELECT TO authenticated USING (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "inv_insert" ON public.invitations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.is_family_admin(family_id, auth.uid()));
CREATE POLICY "inv_delete" ON public.invitations FOR DELETE TO authenticated USING (public.is_family_admin(family_id, auth.uid()));

-- 7. NEW USER -> own family
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uname TEXT; fid UUID;
BEGIN
  uname := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, email, name) VALUES (NEW.id, NEW.email, uname);
  INSERT INTO public.families (name, created_by) VALUES ('Familia de ' || uname, NEW.id) RETURNING id INTO fid;
  INSERT INTO public.family_members (family_id, user_id, role) VALUES (fid, NEW.id, 'admin');
  RETURN NEW;
END; $$;

-- 8. redeem_invitation v2
DROP FUNCTION IF EXISTS public.redeem_invitation(TEXT);
CREATE OR REPLACE FUNCTION public.redeem_invitation(_token TEXT)
RETURNS TABLE(family_id UUID, role public.app_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations; uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO inv FROM public.invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitación ya utilizada'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitación expirada'; END IF;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (inv.family_id, uid, inv.role)
  ON CONFLICT (family_id, user_id) DO NOTHING;

  UPDATE public.invitations SET accepted_by = uid, accepted_at = now() WHERE id = inv.id;
  RETURN QUERY SELECT inv.family_id, inv.role;
END; $$;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;

-- 9. family-scoped notification triggers
CREATE OR REPLACE FUNCTION public.notify_new_debt_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE debt_name TEXT; fid UUID;
BEGIN
  SELECT name, family_id INTO debt_name, fid FROM public.debts WHERE id = NEW.debt_id;
  INSERT INTO public.notifications (user_id, family_id, type, message, related_id)
  VALUES (NEW.user_id, fid, 'nueva_deuda', 'Nueva deuda asignada: ' || debt_name, NEW.debt_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE debt_name TEXT; payer TEXT; admin_id UUID; fid UUID;
BEGIN
  SELECT name, family_id INTO debt_name, fid FROM public.debts WHERE id = NEW.debt_id;
  SELECT name INTO payer FROM public.profiles WHERE id = NEW.user_id;
  FOR admin_id IN SELECT user_id FROM public.family_members WHERE family_id = fid AND role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, family_id, type, message, related_id)
    VALUES (admin_id, fid, 'abono_registrado',
      payer || ' registró un abono de $' || NEW.amount || ' en ' || debt_name, NEW.debt_id);
  END LOOP;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_goal_on_contribution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_total NUMERIC; target NUMERIC; goal_name TEXT; fid UUID; u_id UUID;
BEGIN
  UPDATE public.savings_goals
  SET current_amount = current_amount + NEW.amount
  WHERE id = NEW.goal_id
  RETURNING current_amount, target_amount, name, family_id INTO new_total, target, goal_name, fid;

  IF new_total >= target THEN
    FOR u_id IN SELECT user_id FROM public.family_members WHERE family_id = fid LOOP
      INSERT INTO public.notifications (user_id, family_id, type, message, related_id)
      VALUES (u_id, fid, 'meta_completada', '¡Meta completada: ' || goal_name || '!', NEW.goal_id);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

-- 10. drop legacy global roles
DROP TABLE IF EXISTS public.user_roles;
DROP FUNCTION IF EXISTS public.current_role_is_admin();
DROP FUNCTION IF EXISTS public.current_role_is_member_or_admin();
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role);

CREATE TRIGGER trg_families_updated BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
