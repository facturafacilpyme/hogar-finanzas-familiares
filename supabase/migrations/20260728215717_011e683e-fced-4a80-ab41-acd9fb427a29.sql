
CREATE TYPE public.app_role AS ENUM ('admin', 'miembro', 'invitado');
CREATE TYPE public.debt_type AS ENUM ('unico', 'cuotas');
CREATE TYPE public.debt_status AS ENUM ('activa', 'pagada', 'mora');
CREATE TYPE public.expense_category AS ENUM ('mercado', 'transporte', 'salud', 'servicios', 'otros');
CREATE TYPE public.notif_type AS ENUM ('nueva_deuda','por_vencer','en_mora','abono_registrado','meta_completada');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION public.current_role_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin'); $$;

CREATE OR REPLACE FUNCTION public.current_role_is_member_or_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'miembro'); $$;

CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.current_role_is_admin()) WITH CHECK (public.current_role_is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'miembro');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity TEXT NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  debt_type public.debt_type NOT NULL,
  total_cuotas INT,
  current_cuota INT DEFAULT 0,
  cuota_amount NUMERIC(14,2),
  due_date DATE,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.debt_status NOT NULL DEFAULT 'activa',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debts_select_all" ON public.debts FOR SELECT TO authenticated USING (true);
CREATE POLICY "debts_admin_write" ON public.debts FOR ALL TO authenticated
  USING (public.current_role_is_admin()) WITH CHECK (public.current_role_is_admin());

CREATE TABLE public.debt_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  amount_assigned NUMERIC(14,2) NOT NULL,
  UNIQUE (debt_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_members TO authenticated;
GRANT ALL ON public.debt_members TO service_role;
ALTER TABLE public.debt_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_select_all" ON public.debt_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "dm_admin_write" ON public.debt_members FOR ALL TO authenticated
  USING (public.current_role_is_admin()) WITH CHECK (public.current_role_is_admin());

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_select_all" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "pay_insert_member" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is_member_or_admin() AND user_id = auth.uid());
CREATE POLICY "pay_admin_manage" ON public.payments FOR UPDATE TO authenticated
  USING (public.current_role_is_admin());
CREATE POLICY "pay_admin_delete" ON public.payments FOR DELETE TO authenticated
  USING (public.current_role_is_admin());

CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_amount NUMERIC(14,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date DATE,
  is_challenge BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO authenticated;
GRANT ALL ON public.savings_goals TO service_role;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sg_select_all" ON public.savings_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "sg_admin_write" ON public.savings_goals FOR ALL TO authenticated
  USING (public.current_role_is_admin()) WITH CHECK (public.current_role_is_admin());

CREATE TABLE public.savings_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_contributions TO authenticated;
GRANT ALL ON public.savings_contributions TO service_role;
ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_select_all" ON public.savings_contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sc_insert_member" ON public.savings_contributions FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is_member_or_admin() AND user_id = auth.uid());
CREATE POLICY "sc_admin_delete" ON public.savings_contributions FOR DELETE TO authenticated
  USING (public.current_role_is_admin());

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.expense_category NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  paid_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp_select_all" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "exp_insert_member" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is_member_or_admin() AND paid_by = auth.uid());
CREATE POLICY "exp_update_own_or_admin" ON public.expenses FOR UPDATE TO authenticated
  USING (paid_by = auth.uid() OR public.current_role_is_admin());
CREATE POLICY "exp_delete_own_or_admin" ON public.expenses FOR DELETE TO authenticated
  USING (paid_by = auth.uid() OR public.current_role_is_admin());

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notif_type NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_select_all" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "log_insert_auth" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_new_debt_member() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE debt_name TEXT;
BEGIN
  SELECT name INTO debt_name FROM public.debts WHERE id = NEW.debt_id;
  INSERT INTO public.notifications (user_id, type, message, related_id)
  VALUES (NEW.user_id, 'nueva_deuda', 'Nueva deuda asignada: ' || debt_name, NEW.debt_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_debt_member AFTER INSERT ON public.debt_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_debt_member();

CREATE OR REPLACE FUNCTION public.notify_payment() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE debt_name TEXT; payer TEXT; admin_id UUID;
BEGIN
  SELECT name INTO debt_name FROM public.debts WHERE id = NEW.debt_id;
  SELECT name INTO payer FROM public.profiles WHERE id = NEW.user_id;
  FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, message, related_id)
    VALUES (admin_id, 'abono_registrado',
      payer || ' registró un abono de $' || NEW.amount || ' en ' || debt_name, NEW.debt_id);
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_payment AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment();

CREATE OR REPLACE FUNCTION public.update_goal_on_contribution() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_total NUMERIC; target NUMERIC; goal_name TEXT; u_id UUID;
BEGIN
  UPDATE public.savings_goals
  SET current_amount = current_amount + NEW.amount
  WHERE id = NEW.goal_id
  RETURNING current_amount, target_amount, name INTO new_total, target, goal_name;

  IF new_total >= target THEN
    FOR u_id IN SELECT id FROM auth.users LOOP
      INSERT INTO public.notifications (user_id, type, message, related_id)
      VALUES (u_id, 'meta_completada', '¡Meta completada: ' || goal_name || '!', NEW.goal_id);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_update_goal AFTER INSERT ON public.savings_contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_goal_on_contribution();

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "comprobantes_select_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprobantes');
CREATE POLICY "comprobantes_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "comprobantes_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
