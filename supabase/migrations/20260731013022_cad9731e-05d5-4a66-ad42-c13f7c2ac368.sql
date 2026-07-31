
-- 1. Deudas: permitir asignación por valor fijo (sin porcentaje)
ALTER TABLE public.debt_members ALTER COLUMN percentage DROP NOT NULL;

-- 2. Abonos: separar quien registra de la persona asignada
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
UPDATE public.payments SET created_by = user_id WHERE created_by IS NULL;
DROP POLICY IF EXISTS pay_insert ON public.payments;
CREATE POLICY pay_insert ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND can_write_family((SELECT d.family_id FROM public.debts d WHERE d.id = payments.debt_id), auth.uid())
);

-- 3. Aportes de ahorro: comprobante, tipo, quien registra
ALTER TABLE public.savings_contributions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'aporte',
  ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE public.savings_contributions SET created_by = user_id WHERE created_by IS NULL;
ALTER TABLE public.savings_contributions
  ADD CONSTRAINT savings_contributions_kind_check CHECK (kind IN ('aporte','retiro'));

DROP POLICY IF EXISTS sc_insert ON public.savings_contributions;
CREATE POLICY sc_insert ON public.savings_contributions FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND can_write_family((SELECT g.family_id FROM public.savings_goals g WHERE g.id = savings_contributions.goal_id), auth.uid())
);
DROP POLICY IF EXISTS sc_update ON public.savings_contributions;
CREATE POLICY sc_update ON public.savings_contributions FOR UPDATE TO authenticated
USING (is_family_admin(family_id, auth.uid()));

-- trigger de meta: soportar retiros
CREATE OR REPLACE FUNCTION public.update_goal_on_contribution()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.savings_goals
     SET current_amount = GREATEST(0, current_amount + CASE WHEN NEW.kind = 'retiro' THEN -NEW.amount ELSE NEW.amount END)
   WHERE id = NEW.goal_id;
  RETURN NEW;
END; $$;

-- 4. Metas de ahorro: responsables y estado "rota"
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS broken_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.savings_goal_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (goal_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goal_members TO authenticated;
GRANT ALL ON public.savings_goal_members TO service_role;
ALTER TABLE public.savings_goal_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_family_from_goal_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.family_id IS NULL THEN
    SELECT family_id INTO NEW.family_id FROM public.savings_goals WHERE id = NEW.goal_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_sgm_family ON public.savings_goal_members;
CREATE TRIGGER trg_sgm_family BEFORE INSERT ON public.savings_goal_members
FOR EACH ROW EXECUTE FUNCTION public.set_family_from_goal_member();

CREATE POLICY sgm_select ON public.savings_goal_members FOR SELECT TO authenticated
USING (is_family_member(family_id, auth.uid()));
CREATE POLICY sgm_insert ON public.savings_goal_members FOR INSERT TO authenticated
WITH CHECK (can_write_family((SELECT g.family_id FROM public.savings_goals g WHERE g.id = savings_goal_members.goal_id), auth.uid()));
CREATE POLICY sgm_delete ON public.savings_goal_members FOR DELETE TO authenticated
USING (can_write_family(family_id, auth.uid()));

-- 5. Historial completo: log automático de todos los movimientos
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE det JSONB; fid UUID; eid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN det := to_jsonb(OLD); ELSE det := to_jsonb(NEW); END IF;
  fid := NULLIF(det->>'family_id','')::uuid;
  eid := NULLIF(det->>'id','')::uuid;
  IF fid IS NULL AND TG_TABLE_NAME = 'families' THEN fid := eid; END IF;
  IF fid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  INSERT INTO public.activity_log (user_id, family_id, action, entity, entity_id, details)
  VALUES (auth.uid(), fid, lower(TG_OP), TG_TABLE_NAME, eid, det);
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_activity() FROM anon, authenticated, public;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['debts','debt_members','payments','expenses','savings_goals','savings_contributions','savings_goal_members','family_members','families','invitations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_log_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_log_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.log_activity()', t);
  END LOOP;
END $$;
