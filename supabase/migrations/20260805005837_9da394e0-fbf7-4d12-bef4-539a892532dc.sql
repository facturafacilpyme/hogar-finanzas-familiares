-- 1) Nuevo rol educativo
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'educativo';

-- 2) Nuevo tipo de notificacion
ALTER TYPE public.notif_type ADD VALUE IF NOT EXISTS 'riesgo_mora';

-- 3) Campos nuevos
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS monthly_income numeric NOT NULL DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS interest_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS goal_kind text NOT NULL DEFAULT 'meta';
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS period_end date;

-- 4) Presupuestos por categoria
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL,
  monthly_limit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY bud_select ON public.budgets FOR SELECT TO authenticated
  USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY bud_insert ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY bud_update ON public.budgets FOR UPDATE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));
CREATE POLICY bud_delete ON public.budgets FOR DELETE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));

CREATE TRIGGER trg_budgets_updated BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Insignias / medallas
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  goal_id uuid REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id, code, goal_id)
);

GRANT SELECT, INSERT, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY bdg_select ON public.badges FOR SELECT TO authenticated
  USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY bdg_insert ON public.badges FOR INSERT TO authenticated
  WITH CHECK (public.is_family_member(family_id, auth.uid()));
CREATE POLICY bdg_delete ON public.badges FOR DELETE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));
