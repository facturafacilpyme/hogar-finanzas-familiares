CREATE TABLE public.community_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alias text NOT NULL,
  category text NOT NULL CHECK (category IN ('sugerencia','experiencia','error','idea')),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'recibido' CHECK (status IN ('recibido','en_revision','planificado','implementado')),
  published boolean NOT NULL DEFAULT false,
  moderation_reason text,
  moderation_model text,
  votes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_feedback TO anon;
GRANT SELECT, DELETE ON public.community_feedback TO authenticated;
GRANT ALL ON public.community_feedback TO service_role;
ALTER TABLE public.community_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback publico visible" ON public.community_feedback FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "autor ve los suyos" ON public.community_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "autor borra los suyos" ON public.community_feedback FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ON public.community_feedback (published, created_at DESC);

CREATE TABLE public.community_votes (
  feedback_id uuid NOT NULL REFERENCES public.community_feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_votes TO authenticated;
GRANT ALL ON public.community_votes TO service_role;
ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver mis votos" ON public.community_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "votar" ON public.community_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.community_feedback f WHERE f.id = feedback_id AND f.published));
CREATE POLICY "quitar voto" ON public.community_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_feedback_votes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.community_feedback SET votes_count = (SELECT count(*) FROM public.community_votes WHERE feedback_id = COALESCE(NEW.feedback_id, OLD.feedback_id))
  WHERE id = COALESCE(NEW.feedback_id, OLD.feedback_id);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_feedback_votes AFTER INSERT OR DELETE ON public.community_votes FOR EACH ROW EXECUTE FUNCTION public.sync_feedback_votes();