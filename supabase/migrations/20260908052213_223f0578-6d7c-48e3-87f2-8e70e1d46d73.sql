CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (family_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven categorias de su familia"
ON public.expense_categories FOR SELECT TO authenticated
USING (public.is_family_member(family_id, auth.uid()));

CREATE POLICY "Admin y miembros crean categorias"
ON public.expense_categories FOR INSERT TO authenticated
WITH CHECK (public.can_write_family(family_id, auth.uid()));

CREATE POLICY "Admin y miembros editan categorias"
ON public.expense_categories FOR UPDATE TO authenticated
USING (public.can_write_family(family_id, auth.uid()))
WITH CHECK (public.can_write_family(family_id, auth.uid()));

CREATE POLICY "Admin y miembros borran categorias"
ON public.expense_categories FOR DELETE TO authenticated
USING (public.can_write_family(family_id, auth.uid()));

CREATE TRIGGER trg_expense_categories_updated
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Semilla para familias existentes
INSERT INTO public.expense_categories (family_id, name, slug, sort_order)
SELECT f.id, d.name, d.slug, d.ord
FROM public.families f
CROSS JOIN (VALUES
  ('Mercado','mercado',1),
  ('Transporte','transporte',2),
  ('Servicios','servicios',3),
  ('Salud','salud',4),
  ('Otros','otros',5)
) AS d(name, slug, ord)
ON CONFLICT (family_id, slug) DO NOTHING;

-- Semilla automática para familias nuevas
CREATE OR REPLACE FUNCTION public.seed_expense_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.expense_categories (family_id, name, slug, sort_order)
  VALUES
    (NEW.id, 'Mercado', 'mercado', 1),
    (NEW.id, 'Transporte', 'transporte', 2),
    (NEW.id, 'Servicios', 'servicios', 3),
    (NEW.id, 'Salud', 'salud', 4),
    (NEW.id, 'Otros', 'otros', 5)
  ON CONFLICT (family_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_expense_categories
AFTER INSERT ON public.families
FOR EACH ROW EXECUTE FUNCTION public.seed_expense_categories();

-- Las categorías dejan de ser un enum fijo
ALTER TABLE public.expenses ALTER COLUMN category TYPE TEXT USING category::text;
ALTER TABLE public.budgets ALTER COLUMN category TYPE TEXT USING category::text;

CREATE UNIQUE INDEX IF NOT EXISTS budgets_family_category_key
ON public.budgets (family_id, category);

DROP TYPE IF EXISTS public.expense_category;