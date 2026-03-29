-- ============================================================
-- EMOTIA APP — Migration 001: Schema inicial completo
-- Proyecto Supabase: obeigfrljzfsfzgykvix
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ============================================================
-- 0. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. FUNCIÓN GLOBAL PARA updated_at AUTOMÁTICO
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 2. TABLA: users
--    Extiende auth.users con datos de perfil de Emotia.
--    Se crea automáticamente al registrarse (ver trigger abajo).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  avatar_url      TEXT,
  -- Código único de 6 caracteres para vincular pareja
  partner_code    CHAR(6) UNIQUE NOT NULL DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_partner_code ON public.users(partner_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: crea automáticamente la fila en public.users cuando alguien se registra
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 3. TABLA: couples
--    Vincula a dos usuarios como pareja.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.couples (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  anniversary_date  DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT couples_different_users CHECK (user1_id != user2_id),
  CONSTRAINT couples_unique_pair UNIQUE (
    LEAST(user1_id::text, user2_id::text),
    GREATEST(user1_id::text, user2_id::text)
  )
);

CREATE INDEX IF NOT EXISTS idx_couples_user1 ON public.couples(user1_id);
CREATE INDEX IF NOT EXISTS idx_couples_user2 ON public.couples(user2_id);

CREATE TRIGGER couples_updated_at
  BEFORE UPDATE ON public.couples
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Helper functions para RLS ──────────────────────────────

-- Devuelve el couple_id del usuario autenticado actual
CREATE OR REPLACE FUNCTION get_my_couple_id()
RETURNS UUID AS $$
  SELECT id FROM public.couples
  WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Verifica si el usuario autenticado pertenece a un couple dado
CREATE OR REPLACE FUNCTION is_in_couple(couple_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.couples
    WHERE id = couple_uuid
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;


-- ============================================================
-- 4. TABLA: emotion_checkins
--    Registro emocional diario. Máximo 1 por usuario por día.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emotion_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  emotion_name  TEXT NOT NULL,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT emotion_checkins_one_per_day UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_emotion_checkins_user   ON public.emotion_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_checkins_couple ON public.emotion_checkins(couple_id);
CREATE INDEX IF NOT EXISTS idx_emotion_checkins_date   ON public.emotion_checkins(date);


-- ============================================================
-- 5. TABLA: daily_questions
--    Banco de preguntas del día. Solo lectura para usuarios.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('emocional', 'divertida', 'nostalgia', 'futuro')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_questions_category ON public.daily_questions(category);
CREATE INDEX IF NOT EXISTS idx_daily_questions_active   ON public.daily_questions(is_active);


-- ============================================================
-- 6. TABLA: question_answers
--    Respuestas de cada usuario a las preguntas del día.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  couple_id       UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  answer_text     TEXT NOT NULL,
  reaction_emoji  TEXT,
  answered_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT question_answers_once_per_user UNIQUE (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_question_answers_couple   ON public.question_answers(couple_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_question ON public.question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_user     ON public.question_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_date     ON public.question_answers(answered_date);

CREATE TRIGGER question_answers_updated_at
  BEFORE UPDATE ON public.question_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 7. TABLA: audio_capsules
--    Metadatos de cápsulas de audio. El archivo va en Storage.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audio_capsules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  couple_id         UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  category          TEXT NOT NULL CHECK (category IN (
    'gratitud', 'cuento', 'recuerdos', 'carta_amor',
    'hazme_reir', 'animo', 'cancion', 'confesion',
    'buenos_dias', 'sin_categoria'
  )),
  -- Ruta en Storage bucket 'audio-capsules' (no URL completa)
  audio_path        TEXT NOT NULL,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  is_read           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audio_capsules_receiver ON public.audio_capsules(receiver_id);
CREATE INDEX IF NOT EXISTS idx_audio_capsules_sender   ON public.audio_capsules(sender_id);
CREATE INDEX IF NOT EXISTS idx_audio_capsules_couple   ON public.audio_capsules(couple_id);
CREATE INDEX IF NOT EXISTS idx_audio_capsules_read     ON public.audio_capsules(is_read);


-- ============================================================
-- 8. TABLA: fantasies
--    Catálogo de fantasías para el Modo Íntimo.
--    Solo lectura para usuarios autenticados (contenido de la app).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fantasies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL,
  duration_label   TEXT,
  intensity_label  TEXT CHECK (intensity_label IN ('suave', 'moderado', 'intenso')),
  image_url        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fantasies_active ON public.fantasies(is_active);


-- ============================================================
-- 9. TABLA: fantasy_swipes
--    Swipes de cada usuario en el Modo Íntimo.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fantasy_swipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  couple_id   UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  fantasy_id  UUID NOT NULL REFERENCES public.fantasies(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('right', 'left', 'up')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fantasy_swipes_once_per_user UNIQUE (user_id, fantasy_id)
);

CREATE INDEX IF NOT EXISTS idx_fantasy_swipes_couple  ON public.fantasy_swipes(couple_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_swipes_fantasy ON public.fantasy_swipes(fantasy_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_swipes_user    ON public.fantasy_swipes(user_id);


-- ============================================================
-- 10. TABLA: couple_tasks
--     Tareas conjuntas de la pareja.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.couple_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  assigned_to   UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- NULL = ambos
  completed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_couple_tasks_couple    ON public.couple_tasks(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_tasks_assigned  ON public.couple_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_couple_tasks_completed ON public.couple_tasks(completed_at);

CREATE TRIGGER couple_tasks_updated_at
  BEFORE UPDATE ON public.couple_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 11. TABLA: date_plans
--     Catálogo de planes de cita para la Ruleta.
--     Solo lectura para usuarios autenticados.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.date_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  emoji          TEXT NOT NULL,
  location_type  TEXT NOT NULL CHECK (location_type IN ('home', 'outside')),
  cost_type      TEXT NOT NULL CHECK (cost_type IN ('free', 'budget', 'premium')),
  mood_type      TEXT NOT NULL CHECK (mood_type IN ('relaxed', 'energetic', 'romantic')),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_date_plans_location ON public.date_plans(location_type);
CREATE INDEX IF NOT EXISTS idx_date_plans_cost     ON public.date_plans(cost_type);
CREATE INDEX IF NOT EXISTS idx_date_plans_mood     ON public.date_plans(mood_type);


-- ============================================================
-- 12. TABLA: accepted_dates
--     Historial de citas aceptadas por la pareja.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accepted_dates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  date_plan_id  UUID NOT NULL REFERENCES public.date_plans(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  accepted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accepted_dates_couple ON public.accepted_dates(couple_id);
CREATE INDEX IF NOT EXISTS idx_accepted_dates_status ON public.accepted_dates(status);

CREATE TRIGGER accepted_dates_updated_at
  BEFORE UPDATE ON public.accepted_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 13. TABLA: truces
--     Registro de cada sesión de Tregua/SOS.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.truces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  initiated_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'completed', 'expired', 'rejected')
  ),
  phase         INTEGER DEFAULT 1 CHECK (phase IN (1, 2, 3)),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_truces_couple       ON public.truces(couple_id);
CREATE INDEX IF NOT EXISTS idx_truces_status       ON public.truces(status);
CREATE INDEX IF NOT EXISTS idx_truces_initiated_by ON public.truces(initiated_by);

CREATE TRIGGER truces_updated_at
  BEFORE UPDATE ON public.truces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 14. TABLA: user_preferences
--     Configuración personal de cada usuario (tema, PIN, notifs).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  theme                 TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  language              TEXT NOT NULL DEFAULT 'es',
  notif_daily_question  BOOLEAN NOT NULL DEFAULT true,
  notif_emotion_checkin BOOLEAN NOT NULL DEFAULT true,
  notif_audio_capsules  BOOLEAN NOT NULL DEFAULT true,
  notif_truce           BOOLEAN NOT NULL DEFAULT true,
  -- PIN guardado como hash (nunca texto plano). Null = sin PIN configurado.
  pin_hash              TEXT,
  face_id_enabled       BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: crea preferencias por defecto al crear usuario
CREATE OR REPLACE FUNCTION handle_new_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_preferences ON public.users;
CREATE TRIGGER on_user_created_preferences
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_preferences();


-- ============================================================
-- 15. ROW LEVEL SECURITY — Habilitar en todas las tablas
-- ============================================================
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_checkins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_capsules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fantasy_swipes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accepted_dates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 16. POLÍTICAS RLS
-- ============================================================

-- ── users ────────────────────────────────────────────────────
-- Un usuario puede ver su propio perfil y el de su pareja
CREATE POLICY "users_select_own_and_partner" ON public.users
  FOR SELECT USING (
    auth.uid() = id
    OR id IN (
      SELECT CASE WHEN user1_id = auth.uid() THEN user2_id ELSE user1_id END
      FROM public.couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);


-- ── couples ──────────────────────────────────────────────────
CREATE POLICY "couples_select_own" ON public.couples
  FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "couples_insert_as_user1" ON public.couples
  FOR INSERT WITH CHECK (auth.uid() = user1_id);

CREATE POLICY "couples_update_own" ON public.couples
  FOR UPDATE USING (user1_id = auth.uid() OR user2_id = auth.uid());


-- ── emotion_checkins ─────────────────────────────────────────
CREATE POLICY "checkins_select_couple" ON public.emotion_checkins
  FOR SELECT USING (is_in_couple(couple_id));

CREATE POLICY "checkins_insert_own" ON public.emotion_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_in_couple(couple_id));

CREATE POLICY "checkins_update_own" ON public.emotion_checkins
  FOR UPDATE USING (auth.uid() = user_id);


-- ── daily_questions (solo lectura para autenticados) ─────────
CREATE POLICY "questions_read_authenticated" ON public.daily_questions
  FOR SELECT USING (auth.role() = 'authenticated');


-- ── question_answers ─────────────────────────────────────────
CREATE POLICY "answers_select_couple" ON public.question_answers
  FOR SELECT USING (is_in_couple(couple_id));

CREATE POLICY "answers_insert_own" ON public.question_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_in_couple(couple_id));

CREATE POLICY "answers_update_own" ON public.question_answers
  FOR UPDATE USING (auth.uid() = user_id);


-- ── audio_capsules ───────────────────────────────────────────
-- Solo el remitente o el receptor pueden ver una cápsula
CREATE POLICY "capsules_select_participants" ON public.audio_capsules
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "capsules_insert_sender" ON public.audio_capsules
  FOR INSERT WITH CHECK (auth.uid() = sender_id AND is_in_couple(couple_id));

-- Solo el receptor puede marcarla como leída
CREATE POLICY "capsules_update_receiver" ON public.audio_capsules
  FOR UPDATE USING (receiver_id = auth.uid());


-- ── fantasies (solo lectura para autenticados) ───────────────
CREATE POLICY "fantasies_read_authenticated" ON public.fantasies
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);


-- ── fantasy_swipes ───────────────────────────────────────────
CREATE POLICY "swipes_select_couple" ON public.fantasy_swipes
  FOR SELECT USING (is_in_couple(couple_id));

CREATE POLICY "swipes_insert_own" ON public.fantasy_swipes
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_in_couple(couple_id));

CREATE POLICY "swipes_update_own" ON public.fantasy_swipes
  FOR UPDATE USING (auth.uid() = user_id);


-- ── couple_tasks ─────────────────────────────────────────────
CREATE POLICY "tasks_select_couple" ON public.couple_tasks
  FOR SELECT USING (is_in_couple(couple_id));

CREATE POLICY "tasks_insert_couple" ON public.couple_tasks
  FOR INSERT WITH CHECK (is_in_couple(couple_id));

CREATE POLICY "tasks_update_couple" ON public.couple_tasks
  FOR UPDATE USING (is_in_couple(couple_id));

CREATE POLICY "tasks_delete_couple" ON public.couple_tasks
  FOR DELETE USING (is_in_couple(couple_id));


-- ── date_plans (solo lectura para autenticados) ──────────────
CREATE POLICY "date_plans_read_authenticated" ON public.date_plans
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);


-- ── accepted_dates ───────────────────────────────────────────
CREATE POLICY "accepted_dates_select_couple" ON public.accepted_dates
  FOR SELECT USING (is_in_couple(couple_id));

CREATE POLICY "accepted_dates_insert_couple" ON public.accepted_dates
  FOR INSERT WITH CHECK (is_in_couple(couple_id));

CREATE POLICY "accepted_dates_update_couple" ON public.accepted_dates
  FOR UPDATE USING (is_in_couple(couple_id));


-- ── truces ───────────────────────────────────────────────────
CREATE POLICY "truces_select_couple" ON public.truces
  FOR SELECT USING (is_in_couple(couple_id));

CREATE POLICY "truces_insert_own" ON public.truces
  FOR INSERT WITH CHECK (auth.uid() = initiated_by AND is_in_couple(couple_id));

CREATE POLICY "truces_update_couple" ON public.truces
  FOR UPDATE USING (is_in_couple(couple_id));


-- ── user_preferences ─────────────────────────────────────────
CREATE POLICY "prefs_select_own" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prefs_insert_own" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prefs_update_own" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================
-- 17. DATOS INICIALES: daily_questions (20 preguntas)
-- ============================================================
INSERT INTO public.daily_questions (text, category) VALUES
  ('¿Cuál es el momento en el que más me has necesitado y no he estado?', 'emocional'),
  ('¿Qué es lo que más miedo te da de nuestra relación?', 'emocional'),
  ('¿Cuándo fue la última vez que lloraste por algo relacionado conmigo?', 'emocional'),
  ('¿Qué parte de ti sientes que no conozco todavía?', 'emocional'),
  ('¿Qué necesitas de mí que no te estoy dando?', 'emocional'),
  ('¿Cuál es la cosa más ridícula que hemos hecho juntos?', 'divertida'),
  ('Si pudiéramos teletransportarnos ahora mismo, ¿a dónde irías?', 'divertida'),
  ('¿Qué serie describe mejor nuestra relación?', 'divertida'),
  ('¿Cuál es mi peor hábito que secretamente te hace gracia?', 'divertida'),
  ('Si tuvieras que describir nuestro primer beso en una película, ¿qué género sería?', 'divertida'),
  ('¿Cuál fue el primer detalle mío que te enamoró?', 'nostalgia'),
  ('¿Qué momento de nuestra relación revives en tu cabeza a menudo?', 'nostalgia'),
  ('¿Recuerdas qué canción sonaba en nuestra primera cita?', 'nostalgia'),
  ('¿Cuál es la foto favorita que tienes de nosotros?', 'nostalgia'),
  ('¿Qué es lo que más echas de menos del principio de la relación?', 'nostalgia'),
  ('¿Dónde te imaginas que estaremos dentro de 5 años?', 'futuro'),
  ('¿Qué aventura quieres que vivamos juntos antes de ser viejos?', 'futuro'),
  ('¿Cómo imaginas nuestra vida ideal un domingo cualquiera?', 'futuro'),
  ('¿Qué tradición quieres que creemos juntos?', 'futuro'),
  ('Si escribieras una carta a nuestro yo del futuro, ¿qué diría?', 'futuro')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 18. DATOS INICIALES: date_plans (12 planes)
-- ============================================================
INSERT INTO public.date_plans (title, description, emoji, location_type, cost_type, mood_type) VALUES
  ('Desayuno en la cama', 'Prepara el desayuno favorito de tu pareja y sorpréndela. Una mañana especial para empezar el día juntos.', '🍳', 'home', 'free', 'romantic'),
  ('Ver el atardecer desde un mirador', 'Encuentra el mirador más bonito de tu ciudad y disfruta del atardecer juntos con algo de picar.', '🌅', 'outside', 'free', 'romantic'),
  ('Cocinar pasta italiana juntos', 'Elegid una receta nueva, comprad los ingredientes y cocinad juntos. El proceso es tan especial como el resultado.', '🍝', 'home', 'free', 'relaxed'),
  ('Noche de teatro', 'Buscad una obra de teatro local y vivid una noche de cultura. Cenad antes en algún sitio especial.', '🎭', 'outside', 'premium', 'romantic'),
  ('Día de spa en pareja', 'Reservad un día completo de spa. Masajes, jacuzzi y relajación total para recargar pilas juntos.', '🧖', 'outside', 'premium', 'relaxed'),
  ('Torneo de videojuegos con snacks', 'Elegid vuestros juegos favoritos, preparad snacks épicos y competid o cooperad durante toda la tarde.', '🎮', 'home', 'free', 'energetic'),
  ('Cena en restaurante sorpresa', 'Investiga un restaurante que nunca hayáis probado y sorprende a tu pareja sin decir el destino.', '🍷', 'outside', 'premium', 'romantic'),
  ('Escapada a la playa', 'Coged la mochila y marchaos a la playa más cercana. Un día de sol, arena y desconexión total.', '🏖️', 'outside', 'budget', 'energetic'),
  ('Maratón de películas con palomitas', 'Elegid 3 películas que nunca hayáis visto y pasad el día en el sofá sin culpas.', '📺', 'home', 'free', 'relaxed'),
  ('Pintarse retratos mutuos', 'Comprad materiales de pintura y pintaos el uno al otro. Sin juzgar el resultado.', '🎨', 'home', 'free', 'relaxed'),
  ('Picnic en el parque', 'Preparad una cesta con vuestros snacks favoritos y buscad el rincón más bonito del parque.', '🧺', 'outside', 'budget', 'relaxed'),
  ('Escape room', 'Reservad una sesión de escape room. Pondréis a prueba vuestra comunicación y trabajo en equipo.', '🔐', 'outside', 'budget', 'energetic')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 19. DATOS INICIALES: fantasies (5 ejemplos)
-- ============================================================
INSERT INTO public.fantasies (title, description, category, duration_label, intensity_label) VALUES
  ('El Loto de Jade', 'Una postura de profunda conexión emocional y física. Requiere confianza y comunicación abierta entre ambos.', 'conexion', '15-20 min', 'suave'),
  ('Masaje Sensorial', 'Una sesión de masaje completo con los sentidos potenciados. Vendas, aromas, música y contacto consciente.', 'sensorial', '30-45 min', 'suave'),
  ('Baile Íntimo', 'Bailar juntos descalzos en casa con vuestra lista de canciones favoritas. Sin reglas, solo música y movimiento.', 'romantico', '20-30 min', 'suave'),
  ('La Sorpresa Planificada', 'Uno planifica toda la velada en secreto. El otro solo tiene que dejarse llevar sin preguntar nada.', 'aventura', '2-3 horas', 'moderado'),
  ('Juego de Roles', 'Explorad personajes y situaciones ficticias juntos con total libertad. La imaginación es el único límite.', 'juego', '45-60 min', 'moderado')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 20. STORAGE BUCKETS + POLÍTICAS
--
-- OPCIÓN A (recomendada): ejecutar este bloque desde el
--   SQL Editor de Supabase con rol 'service_role'
--
-- OPCIÓN B (manual): crear los buckets desde
--   Supabase Dashboard → Storage → New Bucket
-- ============================================================

-- Bucket público para fotos de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket privado para cápsulas de audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-capsules',
  'audio-capsules',
  false,
  52428800,  -- 50 MB máximo
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/ogg', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- ── Políticas de Storage: avatars ─────────────────────────
-- Lectura pública (las fotos de perfil son visibles)
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Subida: cada usuario solo puede subir a su propia carpeta
-- Estructura esperada: avatars/{user_id}/archivo.jpg
CREATE POLICY "avatars_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Actualización: solo el propio usuario puede reemplazar su avatar
CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Borrado: solo el propio usuario
CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Políticas de Storage: audio-capsules ──────────────────
-- Estructura esperada: audio-capsules/{couple_id}/{timestamp}.m4a
-- Acceso: solo miembros de esa pareja (usando is_in_couple)

CREATE POLICY "audio_capsules_couple_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'audio-capsules'
    AND is_in_couple((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "audio_capsules_couple_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'audio-capsules'
    AND is_in_couple((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "audio_capsules_couple_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'audio-capsules'
    AND is_in_couple((storage.foldername(name))[1]::uuid)
  );


-- ============================================================
-- FIN DEL SCHEMA — Verificación
-- ============================================================
-- Para verificar que todo está correcto, ejecuta:
--
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT id, name, public FROM storage.buckets;
-- ============================================================
