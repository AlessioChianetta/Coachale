--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (84ade85)
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: client_analytics_summary; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_analytics_summary (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    consultant_id character varying NOT NULL,
    period text NOT NULL,
    period_start timestamp without time zone NOT NULL,
    period_end timestamp without time zone NOT NULL,
    total_exercises_assigned integer DEFAULT 0,
    total_exercises_completed integer DEFAULT 0,
    completion_rate integer DEFAULT 0,
    avg_completion_time integer DEFAULT 0,
    avg_score integer DEFAULT 0,
    avg_difficulty_rating integer DEFAULT 0,
    avg_satisfaction_rating integer DEFAULT 0,
    total_session_time integer DEFAULT 0,
    login_frequency integer DEFAULT 0,
    engagement_score integer DEFAULT 0,
    streak_days integer DEFAULT 0,
    goals_set integer DEFAULT 0,
    goals_achieved integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.client_analytics_summary OWNER TO neondb_owner;

--
-- Name: client_engagement_metrics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_engagement_metrics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    consultant_id character varying NOT NULL,
    date timestamp without time zone NOT NULL,
    login_count integer DEFAULT 0,
    session_duration integer DEFAULT 0,
    exercises_viewed integer DEFAULT 0,
    exercises_started integer DEFAULT 0,
    exercises_completed integer DEFAULT 0,
    messages_received integer DEFAULT 0,
    messages_read integer DEFAULT 0,
    last_active_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.client_engagement_metrics OWNER TO neondb_owner;

--
-- Name: client_progress; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.client_progress (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    date timestamp without time zone NOT NULL,
    exercises_completed integer DEFAULT 0,
    total_exercises integer DEFAULT 0,
    streak_days integer DEFAULT 0,
    notes text
);


ALTER TABLE public.client_progress OWNER TO neondb_owner;

--
-- Name: consultant_analytics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.consultant_analytics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    consultant_id character varying NOT NULL,
    period text NOT NULL,
    period_start timestamp without time zone NOT NULL,
    period_end timestamp without time zone NOT NULL,
    total_clients integer DEFAULT 0,
    active_clients integer DEFAULT 0,
    new_clients integer DEFAULT 0,
    exercises_created integer DEFAULT 0,
    exercises_assigned integer DEFAULT 0,
    exercises_completed integer DEFAULT 0,
    total_completion_rate integer DEFAULT 0,
    avg_client_engagement integer DEFAULT 0,
    total_consultations integer DEFAULT 0,
    consultation_duration integer DEFAULT 0,
    client_retention_rate integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.consultant_analytics OWNER TO neondb_owner;

--
-- Name: consultations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.consultations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    consultant_id character varying NOT NULL,
    client_id character varying NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    duration integer NOT NULL,
    notes text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.consultations OWNER TO neondb_owner;

--
-- Name: exercise_assignments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exercise_assignments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    exercise_id character varying NOT NULL,
    client_id character varying NOT NULL,
    consultant_id character varying NOT NULL,
    assigned_at timestamp without time zone DEFAULT now(),
    due_date timestamp without time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_at timestamp without time zone,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    score integer,
    consultant_feedback jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.exercise_assignments OWNER TO neondb_owner;

--
-- Name: exercise_performance_metrics; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exercise_performance_metrics (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    exercise_id character varying NOT NULL,
    client_id character varying NOT NULL,
    assignment_id character varying NOT NULL,
    submission_id character varying,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    time_spent integer,
    difficulty_rating integer,
    satisfaction_rating integer,
    score integer,
    attempts integer DEFAULT 1,
    hints_used integer DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.exercise_performance_metrics OWNER TO neondb_owner;

--
-- Name: exercise_revision_history; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exercise_revision_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    assignment_id character varying NOT NULL,
    submission_id character varying,
    action text NOT NULL,
    consultant_feedback text,
    client_notes text,
    score integer,
    previous_status text NOT NULL,
    new_status text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    created_by character varying NOT NULL
);


ALTER TABLE public.exercise_revision_history OWNER TO neondb_owner;

--
-- Name: exercise_submissions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exercise_submissions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    assignment_id character varying NOT NULL,
    answers json DEFAULT '[]'::json,
    attachments json DEFAULT '[]'::json,
    notes text,
    submitted_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.exercise_submissions OWNER TO neondb_owner;

--
-- Name: exercise_templates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exercise_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    type text NOT NULL,
    estimated_duration integer,
    instructions text,
    questions json DEFAULT '[]'::json,
    tags json DEFAULT '[]'::json,
    created_by character varying NOT NULL,
    is_public boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.exercise_templates OWNER TO neondb_owner;

--
-- Name: exercises; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exercises (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    estimated_duration integer,
    instructions text,
    attachments json DEFAULT '[]'::json,
    questions json DEFAULT '[]'::json,
    work_platform text,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.exercises OWNER TO neondb_owner;

--
-- Name: goals; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.goals (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    target_value text NOT NULL,
    current_value text DEFAULT '0'::text,
    unit text,
    target_date timestamp without time zone,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.goals OWNER TO neondb_owner;

--
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_activity_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    activity_type text NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now(),
    details text,
    session_id character varying,
    ip_address text,
    user_agent text
);


ALTER TABLE public.user_activity_logs OWNER TO neondb_owner;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_sessions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    session_id character varying NOT NULL,
    start_time timestamp without time zone DEFAULT now(),
    end_time timestamp without time zone,
    last_activity timestamp without time zone DEFAULT now(),
    ip_address text,
    user_agent text
);


ALTER TABLE public.user_sessions OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    role text NOT NULL,
    avatar text,
    consultant_id character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Data for Name: client_analytics_summary; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_analytics_summary (id, client_id, consultant_id, period, period_start, period_end, total_exercises_assigned, total_exercises_completed, completion_rate, avg_completion_time, avg_score, avg_difficulty_rating, avg_satisfaction_rating, total_session_time, login_frequency, engagement_score, streak_days, goals_set, goals_achieved, created_at) FROM stdin;
\.


--
-- Data for Name: client_engagement_metrics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_engagement_metrics (id, client_id, consultant_id, date, login_count, session_duration, exercises_viewed, exercises_started, exercises_completed, messages_received, messages_read, last_active_at, created_at) FROM stdin;
\.


--
-- Data for Name: client_progress; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.client_progress (id, client_id, date, exercises_completed, total_exercises, streak_days, notes) FROM stdin;
\.


--
-- Data for Name: consultant_analytics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.consultant_analytics (id, consultant_id, period, period_start, period_end, total_clients, active_clients, new_clients, exercises_created, exercises_assigned, exercises_completed, total_completion_rate, avg_client_engagement, total_consultations, consultation_duration, client_retention_rate, created_at) FROM stdin;
\.


--
-- Data for Name: consultations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.consultations (id, consultant_id, client_id, scheduled_at, duration, notes, status, created_at) FROM stdin;
735fa5b2-78fd-4828-9707-ceab36a4062b	0c73bbe5-51e1-4108-866b-6be7a52fce3b	c806e79d-42d5-4f6e-87ae-eb85e63d7da0	2025-09-18 08:00:00	60	Terza consulenza	scheduled	2025-09-12 22:39:20.19
b27d94a1-9efb-4baa-a632-792203e17302	0c73bbe5-51e1-4108-866b-6be7a52fce3b	8a7f6b63-b41e-4071-bf44-28d71df1f4d8	2025-09-15 13:30:00	60	\N	scheduled	2025-09-12 22:46:11.339
8e0aacdf-3550-4315-8dab-9b2a585787a0	0c73bbe5-51e1-4108-866b-6be7a52fce3b	7e40b56c-2cc8-4515-b843-dc105e478f38	2025-09-15 15:00:00	60	\N	scheduled	2025-09-12 22:46:58.055
161a2e2c-e872-429f-921b-49de6a525ad2	0c73bbe5-51e1-4108-866b-6be7a52fce3b	bc1dec4d-8a20-4d23-a109-b4de82a4b4e7	2025-09-16 12:30:00	60	\N	scheduled	2025-09-12 22:47:19.493
63cf1689-2c12-446c-9280-8495a92b780d	0c73bbe5-51e1-4108-866b-6be7a52fce3b	ad0f878c-55b5-48ea-af8d-58b4696e4cd3	2025-09-17 14:00:00	60	\N	scheduled	2025-09-12 22:47:31.819
c24c600d-f0fc-46c5-98b5-ac511c95c667	0c73bbe5-51e1-4108-866b-6be7a52fce3b	7cdfb7ae-d06b-40f6-9840-91f72772a390	2025-09-18 13:15:00	60	\N	scheduled	2025-09-12 22:47:53.396
a52b68a2-1c79-4e0e-9640-167fba228b08	0c73bbe5-51e1-4108-866b-6be7a52fce3b	c806e79d-42d5-4f6e-87ae-eb85e63d7da0	2025-09-25 08:00:00	60	\N	scheduled	2025-09-12 22:48:13.777
\.


--
-- Data for Name: exercise_assignments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exercise_assignments (id, exercise_id, client_id, consultant_id, assigned_at, due_date, status, completed_at, submitted_at, reviewed_at, score, consultant_feedback) FROM stdin;
7af4175e-d6cf-4808-8696-c77e7d353081	419583f0-97dd-402a-b7c9-c798e7daac05	c806e79d-42d5-4f6e-87ae-eb85e63d7da0	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:14:14.166	\N	pending	\N	\N	\N	\N	\N
9da2b6d6-c052-4059-ab2f-3ff3b5ab2775	a8d357bd-119a-462b-83d3-db8130d6c808	ad0f878c-55b5-48ea-af8d-58b4696e4cd3	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:26:46.882	\N	pending	\N	\N	\N	\N	\N
7b297de6-75a7-42bc-bb9b-75d37d114c94	7b3f45c9-a598-4841-a9a6-3b2915e5a65c	ad0f878c-55b5-48ea-af8d-58b4696e4cd3	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:34:52.258	\N	pending	\N	\N	\N	\N	\N
63c7f092-f938-4823-a6cb-7ed8c764c4f2	2439d2aa-4253-44c7-8964-63f1b8df0ccf	ad0f878c-55b5-48ea-af8d-58b4696e4cd3	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:37:59.975	\N	pending	\N	\N	\N	\N	\N
5d657881-d7fc-4920-8e01-966e0b7bbccb	5718c758-63f5-4b73-aeae-7f386899df4a	7cdfb7ae-d06b-40f6-9840-91f72772a390	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:45:20.522	\N	pending	\N	\N	\N	\N	\N
0b892264-5a0e-4535-a8bf-49de5048e877	dee1bb1e-bbca-4ee7-9a4a-a730cb770a8e	7cdfb7ae-d06b-40f6-9840-91f72772a390	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:49:28.543	\N	pending	\N	\N	\N	\N	\N
4686b458-a9e0-41c3-8ca5-4b60bb79c3e5	a7fb9a41-30fd-412c-96bd-29f1f40b1875	7cdfb7ae-d06b-40f6-9840-91f72772a390	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:55:25.757	\N	pending	\N	\N	\N	\N	\N
d9ffbb02-a5ff-4acc-865d-ef50af0c8fc0	493a6630-ac9f-4698-b6d8-9cc4e2649abf	bc1dec4d-8a20-4d23-a109-b4de82a4b4e7	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 21:00:04.081	\N	pending	\N	\N	\N	\N	\N
361ec56d-abc3-4dc1-91be-da592cdc6c2d	74a9ede5-6458-4858-a65a-3405b08a528c	7e40b56c-2cc8-4515-b843-dc105e478f38	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 21:08:30.773	\N	pending	\N	\N	\N	\N	\N
\.


--
-- Data for Name: exercise_performance_metrics; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exercise_performance_metrics (id, exercise_id, client_id, assignment_id, submission_id, started_at, completed_at, time_spent, difficulty_rating, satisfaction_rating, score, attempts, hints_used, notes, created_at) FROM stdin;
\.


--
-- Data for Name: exercise_revision_history; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exercise_revision_history (id, assignment_id, submission_id, action, consultant_feedback, client_notes, score, previous_status, new_status, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: exercise_submissions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exercise_submissions (id, assignment_id, answers, attachments, notes, submitted_at) FROM stdin;
\.


--
-- Data for Name: exercise_templates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exercise_templates (id, name, description, category, type, estimated_duration, instructions, questions, tags, created_by, is_public, usage_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exercises (id, title, description, type, category, estimated_duration, instructions, attachments, questions, work_platform, created_by, created_at) FROM stdin;
419583f0-97dd-402a-b7c9-c798e7daac05	Creazione Libro	Ogni esercizio che troverai in questo libro è pensato per guidarti dall’ispirazione all’azione: non teoria fine a sé stessa, ma strumenti pratici per applicare subito ciò che hai imparato e ottenere risultati concreti.	general	imprenditoria	360	📌 Istruzioni per completare l’esercizio\n\nApri il file Docs associato a questo esercizio.\n\nLeggi attentamente le domande e rispondi in modo completo, concreto e personale.\n\nDedica il tempo necessario: non correre, la qualità delle tue risposte farà la differenza.\n\nSalva il file aggiornato con le tue risposte.\n\nTorna nella pagina di consegna e conferma l’avvenuto completamento dell’esercizio.	[]	[{"id":"1757707934901","question":"Cosa hai scoperto di nuovo su di te svolgendo questo esercizio?","type":"text"},{"id":"1757707962455","question":"Quale parte ti è sembrata più semplice e quale più difficile?","type":"text"},{"id":"1757707968778","question":"Che insegnamento concreto puoi applicare già da domani nella tua vita o nel tuo lavoro?","type":"text"},{"id":"1757707973177","question":"In che modo questo esercizio ti avvicina al tuo obiettivo principale?","type":"text"},{"id":"1757707977747","question":"Qual è il prossimo passo che decidi di fare dopo averlo completato?","type":"text"}]	https://docs.google.com/document/d/1wmEqNtDEXqWsG2b3U3UHJivFUofXoYS21E1yhZcJtHk/edit?tab=t.0	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:14:14.166
a8d357bd-119a-462b-83d3-db8130d6c808	Rimettiamo in break even il locale	Per permetterci di analizzare al meglio l’andamento del tuo locale e fornirti un report accurato, ti chiediamo di inserire i seguenti dati direttamente nel programma e, dove richiesto, caricare i file esterni. La precisione e completezza delle tue risposte è fondamentale per ottenere un’analisi utile e personalizzata.	general	imprenditoria	120	Istruzioni dettagliate\n\nCompila tutti i campi richiesti: quando inserisci valori numerici, utilizza sempre la stessa modalità (es. sempre importi ivati o sempre non ivati).\n\nInserisci i dati mancanti: completa l’inserimento anche per i mesi precedenti, così l’analisi risulta completa e coerente.\n\nCarica i file esterni: per i dati che non possono essere inseriti direttamente (es. margini dei piatti, coperti giornalieri, analisi clienti), allega i documenti richiesti in formato PDF o Excel.\n\nControlla la correttezza dei dati: alcuni valori erano stati salvati in percentuale (es. personale stagionale, contributi), ora devono essere inseriti in euro.\n\nConferma la consegna: una volta completato l’inserimento, torna nella pagina di consegna e conferma di aver caricato e salvato correttamente i dati.	[]	[{"id":"1757708552427","question":"Qual è il fatturato totale mensile? (specifica se sempre ivato o sempre non ivato) Inseriscilo nel software orbitale","type":"text"},{"id":"1757708590439","question":"Inserisci il fatturato, entrate ed uscite dei mesi precedenti","type":"text"},{"id":"1757708618248","question":"Qual è l’importo totale del lavoro straordinario da reinserire (in euro)?","type":"text"},{"id":"1757708627150","question":"Qual è il costo del personale stagionale (in euro)?","type":"text"},{"id":"1757708630436","question":"Qual è l’importo dei contributi sociali versati (in euro)?","type":"text"},{"id":"1757708634167","question":"Hai finanziamenti attivi? Se sì, qual è il costo mensile (in euro) per ciascuno?","type":"text"},{"id":"1757708642340","question":"Vuoi inserire gli ammortamenti come dato a parte per il confronto con il commercialista? (Sì/No)","type":"text"},{"id":"1757708647910","question":"Margini di Ogni Singolo Piatto/Portata: Questo è il dato più complesso da ricavare e richiederà più tempo al cliente. È fondamentale per un'analisi approfondita dei margini. Sarà necessario fornire il menù attuale.","type":"text"},{"id":"1757708665356","question":"Luca dovrà fornire i dati dettagliati dei coperti e dei servizi (clienti che vengono solo per bere), preferibilmente giorno per giorno, se il software lo permette. Più i dati sono dettagliati, migliore sarà l'analisi.","type":"text"},{"id":"1757708708266","question":" Estrapolare i dati dei clienti dal suo software, suddividendoli in: Clienti che non vengono da più di 60 giorni. Clienti abituali che sono venuti negli ultimi 60 giorni. Clienti Totali","type":"text"},{"id":"1757708730488","question":"Hai completato l’inserimento dei dati per febbraio, gennaio e luglio (fino alla data corrente)? (Sì/No)","type":"text"},{"id":"1757708736477","question":"Hai preparato i file esterni (margini piatti, coperti/servizi, dati clienti)? (Carica i file)","type":"text"},{"id":"1757708743148","question":"Ci sono altri valori o sezioni che ritieni mancanti nel programma? Se sì, quali?","type":"text"}]	https://docs.google.com/document/d/1njIGEoZuYwOcCgVTfmlfOIGKIAjDJrQYnAT16CTl31g/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:26:46.882
7b3f45c9-a598-4841-a9a6-3b2915e5a65c	Cameriere Aumentato	In questo esercizio lavorerai sulle strategie di marketing e sull’upselling operativo del tuo ristorante.\nL’obiettivo è aumentare lo scontrino medio, attrarre nuovi clienti e valorizzare i piatti signature attraverso promozioni mirate, QR code, script per il personale e raccolta testimonianze.	general	vendite	60	Apri il file Docs allegato all’esercizio.\n\nRispondi a tutte le domande in modo completo, con esempi pratici o decisioni chiare.\n\nDedica almeno 20 minuti alla riflessione: le risposte guideranno direttamente le prossime azioni operative.\n\nConferma l’avvenuta compilazione così il team potrà utilizzarlo per preparare campagne, script e materiale personalizzato.	[]	[{"id":"1757709107031","question":"Hai effettuato l’implementazione del QR code per dessert e vini? (Sì/No)","type":"text"},{"id":"1757709122528","question":"Quali vini o dessert vorresti inserire come priorità nella lista QR?","type":"text"},{"id":"1757709135315","question":"Quale delle 5 aree di script (accoglienza, hamburger/piatti, contorni, dessert, distillati) ritieni più urgente da introdurre?","type":"text"},{"id":"1757709140144","question":"Hai già deciso come e quando fare le sessioni di role-playing con il personale?","type":"text"},{"id":"1757709165895","question":"I camerieri hanno applicato lo script di accoglienza entro i primi 2 minuti dall’arrivo dei clienti? (Sempre / Spesso / Raramente / Mai)","type":"text"},{"id":"1757709170103","question":"I clienti hanno reagito positivamente alle proposte iniziali (birra artigianale, appetizer)? (Sì/No / Commento)","type":"text"},{"id":"1757709175702","question":"I camerieri hanno suggerito aggiunte o abbinamenti specifici come indicato negli script? (Sempre / Spesso / Raramente / Mai)","type":"text"},{"id":"1757709179821","question":"Ci sono stati ordini aggiuntivi grazie alle proposte dei camerieri? (Numero stimato o commento)","type":"text"},{"id":"1757709183350","question":"Quali difficoltà hanno incontrato nel proporre cross-selling o upselling?","type":"text"},{"id":"1757709190058","question":"I camerieri hanno proposto i dessert secondo lo script? (Sempre / Spesso / Raramente / Mai)","type":"text"},{"id":"1757709192628","question":"Sono stati venduti più dessert/distillati rispetto al periodo precedente? (Sì/No / Percentuale stimata)","type":"text"},{"id":"1757709196473","question":"I clienti hanno mostrato interesse o hanno rifiutato le proposte? (Commento)","type":"text"},{"id":"1757709219884","question":"I camerieri hanno spiegato correttamente il funzionamento dei QR code ai clienti? (Sempre / Spesso / Raramente / Mai)","type":"text"},{"id":"1757709220251","question":"Qual è il punto di forza dei camerieri nell’applicazione degli script?","type":"text"},{"id":"1757709220575","question":"Quali aspetti richiedono ulteriori miglioramenti o formazione?","type":"text"}]	https://docs.google.com/document/d/1kX2hnhPbbRYPFMhk1hnUb-Kbl4LZMbIta02Sc6mXxP0/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:34:52.257
2439d2aa-4253-44c7-8964-63f1b8df0ccf	Configurazione Conti	In questo esercizio verificheremo la corretta configurazione dei conti personali e aziendali, l’avvio del tracciamento delle transazioni tramite il software e l’inserimento dei dati clienti per le future campagne di marketing.\nL’obiettivo è garantire una gestione finanziaria chiara, separata tra personale e aziendale, e preparare il terreno per iniziative di marketing efficaci.	general	risparmio-investimenti	60	Apri i link forniti per i conti correnti personali e aziendali.\n\nApri e configura ciascun conto seguendo le indicazioni: tipologia di conto e funzione (smistamento, risparmio, circolante, emergenze, tasse).\n\nVerifica eventuali addebiti automatici dei finanziamenti e, se possibile, centralizzali su un unico conto.\n\nAccedi al software Orbitale Finanza (profilo personale e aziendale) e inizia a registrare tutte le transazioni già effettuate e quelle future.\n\nInserisci i dati dei clienti nel software per preparare la campagna di referral.\n\nUna volta completato, salva le modifiche e conferma nella sezione “Consegna esercizio”.	[]	[{"id":"1757709372788","question":"Hai aperto tutti i conti personali indicati (Buddybank, Revolut, Hype, N26)? (Sì/No)","type":"text"},{"id":"1757709381194","question":"Tutti i conti sono stati configurati secondo le funzioni indicate (Ingresso/Smistamento, Risparmio, Circolante, Emergenze, Tasse)? (Sì/No / Commento)","type":"text"},{"id":"1757709385242","question":"Hai riorganizzato i conti aziendali secondo le istruzioni (Smistamento, Risparmio Aziendale, Circolante, Emergenze, Tasse)? (Sì/No)","type":"text"},{"id":"1757709388492","question":"Hai verificato con le banche se è possibile spostare gli addebiti dei finanziamenti su un unico conto? (Sì/No / Commento)","type":"text"},{"id":"1757709392004","question":"Hai iniziato a tracciare tutte le transazioni personali? (Sì/No)","type":"text"},{"id":"1757709397049","question":"Hai iniziato a tracciare tutte le transazioni aziendali? (Sì/No)","type":"text"},{"id":"1757709400598","question":"Hai riscontrato difficoltà nell’inserimento dei dati? Se sì, quali?","type":"text"},{"id":"1757709405235","question":"Hai inserito i dati dei clienti nel software? (Sì/No)","type":"text"},{"id":"1757709409375","question":"Il database clienti è completo e aggiornato? (Sì/No / Commento)","type":"text"},{"id":"1757709416461","question":"Quanto tempo hai impiegato per completare tutte le configurazioni?","type":"text"},{"id":"1757709416785","question":"Ci sono difficoltà o problemi riscontrati durante la configurazione dei conti o l’uso del software?","type":"text"}]	https://docs.google.com/document/d/1RKK5G8NsVK5zF2uxQfcbKJRkSvTpbNo1dKtJVt9Quis/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:37:59.974
5718c758-63f5-4b73-aeae-7f386899df4a	Flusso di Cassa	In questo esercizio lavorerai sulla gestione del flusso di cassa, apertura conti dedicati, primo investimento e consolidamento della disciplina finanziaria.\nL’obiettivo è iniziare a trasformare il reddito attivo in patrimonio duraturo, costruire una rendita passiva e consolidare le abitudini necessarie per raggiungere la libertà finanziaria (2.000€/mese di rendita passiva).	general	risparmio-investimenti	360	Apri i nuovi conti correnti (personali e aziendali) secondo il sistema dei 6 conti descritto nella Tabella 2.\n\nConfigura il software di gestione finanziaria e inserisci tutte le entrate e le uscite degli ultimi 30 giorni, verificando la baseline finanziaria.\n\nImposta trasferimenti automatici dai conti smistamento ai conti specifici secondo le regole indicate.\n\nAnalizza le spese e identifica almeno 1-2 aree di ottimizzazione per generare un surplus aggiuntivo.\n\nApri un conto presso un broker regolamentato e realizza il primo investimento simbolico di 100€ su un ETF globale.\n\nReplicare il ciclo di smistamento, risparmio e investimento in modo disciplinato nelle settimane successive.\n\nCompila il questionario seguente con dati concreti e riflessioni personali, che servirà come base per la prossima call.	[]	[{"id":"1757709706886","question":"Confermi che il flusso di cassa attuale corrisponde alla Tabella 1 (entrate 1.000€, uscite 1.048€)? (Sì/No / Commento)","type":"text"},{"id":"1757709719584","question":"Qual è il tuo principale ostacolo percepito nel generare surplus mensile?","type":"text"},{"id":"1757709720093","question":"Quali spese consideri investimenti strategici per il tuo business?","type":"text"},{"id":"1757709720221","question":"Hai aperto e configurato correttamente tutti i conti secondo la Tabella 2? (Sì/No / Commento)","type":"text"},{"id":"1757709720352","question":"Sei riuscito a impostare i trasferimenti automatici secondo le regole dei conti? (Sì/No)","type":"text"},{"id":"1757709720490","question":"Quale conto ti sembra più difficile da gestire o comprendere?","type":"text"},{"id":"1757709720623","question":"Hai aperto un conto presso il broker regolamentato? (Sì/No)","type":"text"},{"id":"1757709720772","question":"Hai effettuato il primo investimento simbolico di 100€ su un ETF globale? (Sì/No / Commento)","type":"text"},{"id":"1757709720911","question":"Qual è stata la tua sensazione psicologica nel completare il primo investimento?","type":"text"},{"id":"1757709721050","question":"Quali spese hai identificato come ottimizzabili per generare un surplus aggiuntivo?","type":"text"},{"id":"1757709721188","question":"Quanto surplus aggiuntivo sei riuscito a creare dopo la revisione delle spese?","type":"text"},{"id":"1757709721330","question":"Su una scala da 1 a 10, qual è la tua tolleranza al rischio oggi?","type":"text"},{"id":"1757709721465","question":"Oltre alla rendita passiva, ci sono altri grandi obiettivi finanziari nei prossimi 5-10 anni? (Es. casa, progetti personali)","type":"text"},{"id":"1757709721598","question":"Qual è il singolo ostacolo più grande che oggi ti impedisce di aumentare il numero di clienti attivi e il reddito?","type":"text"},{"id":"1757709721739","question":"Immaginando di aver raggiunto i 100.000€ di patrimonio, quale sarebbe la tua prima emozione e cosa cambierebbe concretamente nella tua vita quotidiana?","type":"text"}]	https://docs.google.com/document/d/1i6shV4ZHT1mrGudU62rAoX8UwkzxUuKGJhCuEPOUdZs/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:45:20.521
dee1bb1e-bbca-4ee7-9a4a-a730cb770a8e	Da Precarietà a Redditività e Libertà Finanziaria	Questo documento è il manuale operativo di trasformazione finanziaria e di business per Fernando.\nL’obiettivo è portare l’attività di Personal Trainer da una situazione di precarietà a una gestione redditizia e sostenibile, creando un patrimonio personale e una libertà finanziaria duratura.\n\nIl report è organizzato in sezioni chiare:\n\nFondamenta Finanziarie: Implementazione del sistema dei 6 conti per gestione intelligente del denaro.\n\nDisciplina e Vendita: Aumento del volume di chiamate, script strutturato e KPI da monitorare.\n\nValorizzazione dell’Offerta: Ristrutturazione dei prezzi e dei pacchetti di coaching.\n\nVisione a Lungo Termine: Focalizzazione sulla crescita del patrimonio personale e sulla sostenibilità finanziaria.\n\nPiano d’Azione Operativo: Attività settimanali con azioni misurabili e KPI.\n\nDomande Strategiche: Approfondimenti per personalizzare ulteriormente la strategia e preparare la prossima sessione di coaching.\n\nOgni sezione è pensata come una leva operativa concreta. Non si tratta di teoria: ogni azione ha un obiettivo specifico misurabile, e ogni campo da compilare o checkbox da spuntare rappresenta un passo tangibile verso i risultati desiderati.	general	risparmio-investimenti	30	Istruzioni Generali per l’Esecuzione\n\nLeggere attentamente ogni sezione: Comprendere perché ogni azione è necessaria prima di iniziare.\n\nSpuntare le checkbox: Quando un’azione è completata, spunta la casella corrispondente.\n\nCompilare i campi “Commento / Risposta”: Inserire dati reali, numeri o riflessioni. Questo permette di monitorare progressi e problemi.\n\nAggiornare KPI e dati finanziari quotidianamente: Usare i fogli di calcolo forniti e registrare ogni chiamata, transazione e risultato.\n\nAutomatizzare dove possibile: Trasferimenti automatici tra conti, pagamenti Stripe, e tracciamento delle transazioni riducono errori e stress.\n\nMantenere disciplina e costanza: L’esecuzione giornaliera è più importante di grandi cambiamenti sporadici. La crescita sostenibile si ottiene tramite routine rigorose.\n\nPreparazione per la prossima sessione di coaching: Le risposte alle domande strategiche devono essere riflettute e concrete, per massimizzare il valore della consulenza.	[]	[{"id":"1757710053342","question":"Chi è esattamente il tuo cliente ideale (niche) e quali problemi ha?","type":"text"},{"id":"1757710054922","question":"Qual è la tua proposta di valore unica (UVP)? Che trasformazione offri?","type":"text"},{"id":"1757710055416","question":"Come funziona il processo di onboarding di un nuovo cliente? Come può essere standardizzato o automatizzato?","type":"text"},{"id":"1757710055711","question":"Quali strategie di fidelizzazione clientela hai in atto oltre al rinnovo mensile?","type":"text"},{"id":"1757710055993","question":"Quale impatto vuoi avere sulla vita dei tuoi clienti e sulla tua tra 5 anni?","type":"text"},{"id":"1757710056240","question":"Quali sono le 3 competenze principali su cui devi investire nei prossimi 6 mesi per crescere professionalmente?","type":"text"}]	https://docs.google.com/document/d/16RbOHxnK6wTEsQy5-x70iiW1i4WLonTPbNPVSrXnmGM/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:49:28.542
a7fb9a41-30fd-412c-96bd-29f1f40b1875	La tua vita	Questa sezione serve a verificare se Fernando ha compreso e interiorizzato i concetti chiave della gestione finanziaria personale, della crescita del business e degli investimenti. Non si tratta di memorizzare numeri, ma di dimostrare che può applicare i principi in situazioni reali e prendere decisioni coerenti con la strategia.\n\nGli esercizi precedenti hanno aiutato a mappare il budget, creare un sistema CRM, definire l’offerta commerciale e impostare un piano di investimento. Ora è il momento di riflettere sulle scelte fatte e capire se la strategia può essere applicata in modo autonomo e consapevole.	general	risparmio-investimenti	30	Istruzioni Dettagliate\n\nRivedi tutte le risposte date negli esercizi precedenti.\n\nPer ogni domanda qui sotto, rispondi in modo chiaro e conciso, motivando le tue scelte.\n\nNon ci sono risposte giuste o sbagliate in senso assoluto; si valuta la coerenza logica e la comprensione dei concetti strategici.\n\nSe necessario, fai riferimento a dati o calcoli presenti nel foglio di esercizi.\n\nIl tempo stimato per completare questa sezione è 30-40 minuti.	[]	[{"id":"1757710364421","question":"Qual è la tua attuale situazione patrimoniale e perché è importante conoscerla prima di trasferirti a Milano?","type":"text"},{"id":"1757710365490","question":"Quanto denaro ti serve come minimo per coprire le spese essenziali mensili nella nuova città?","type":"text"},{"id":"1757710366120","question":"Come hai calcolato l’importo necessario per il fondo di emergenza e quali spese hai incluso?","type":"text"},{"id":"1757710366254","question":"Qual è il vantaggio principale di utilizzare un CRM nella tua attività di personal trainer?","type":"text"},{"id":"1757710366386","question":"Come puoi misurare se il sistema di acquisizione clienti sta funzionando correttamente?","type":"text"},{"id":"1757710366528","question":"Quali azioni concrete intraprenderesti se noti che i lead non si trasformano in clienti?","type":"text"},{"id":"1757710366657","question":"Perché hai scelto i prezzi dei pacchetti 3, 6 e 12 mesi? Qual è il principio strategico alla base?","type":"text"},{"id":"1757710366874","question":"Come il prodotto a basso costo (ebook) aiuta nella conversione dei lead?","type":"text"},{"id":"1757710392608","question":"Se un potenziale cliente obietta sul prezzo, quali strategie useresti per mostrare il valore della tua offerta?","type":"text"},{"id":"1757710392737","question":"Come funziona il Piano di Accumulo del Capitale (PAC) e perché è consigliato agli investitori principianti?","type":"text"},{"id":"1757710392849","question":"Se il mercato dovesse scendere del 20%, quale sarebbe la tua reazione e perché?","type":"text"},{"id":"1757710392981","question":"Come bilanci il risparmio, il fondo di emergenza e gli investimenti senza compromettere la tua sopravvivenza finanziaria?","type":"text"},{"id":"1757710416341","question":"Quali sono le tre principali paure che hai identificato e come le affronteresti concretamente?","type":"text"},{"id":"1757710416461","question":"Come priorizzi le attività settimanali per massimizzare il reddito e risparmiare tempo?","type":"text"},{"id":"1757710416600","question":"Perché è importante distinguere tra “sprint di sopravvivenza” e “piano di crescita a lungo termine”?","type":"text"},{"id":"1757710416734","question":"Quali sono i tre KPI più importanti per valutare la tua crescita finanziaria e del business?","type":"text"},{"id":"1757710416872","question":"Come misureresti l’efficacia del tuo PAC mensile?","type":"text"},{"id":"1757710416994","question":"Se noti che il reddito netto mensile non raggiunge i 2.000 €, quali azioni correttive prenderesti?","type":"text"}]	https://docs.google.com/document/d/1fl9PXl1KxW5c1-TMnOHi2QhUkHmvMwoolV0psz_TG3o/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 20:55:25.756
493a6630-ac9f-4698-b6d8-9cc4e2649abf	La tua prima vendita	Questi esercizi permettono al partecipante di applicare concretamente il Metodo Giulia, passando dalla scoperta del problema alla presentazione dell’offerta e gestione delle obiezioni. L’obiettivo non è memorizzare le domande, ma saperle adattare, improvvisare e integrare nel flusso della consulenza.	general	vendite	60	Leggi attentamente ogni scenario.\n\nRispondi alle domande con frasi complete, come se stessi conducendo una consulenza reale.\n\nDedica almeno 5 minuti per ogni esercizio per riflettere sulle strategie.\n\nConfronta le tue risposte con un modello ideale o con il feedback di un coach.\n\nRipeti gli esercizi periodicamente per affinare la tua capacità di vendita e consulenza.	[]	[{"id":"1757710690296","question":"Perché è importante definire subito la struttura della consulenza?","type":"text"},{"id":"1757710691481","question":"Come puoi far emergere il problema reale del cliente partendo da risposte generiche?","type":"text"},{"id":"1757710692032","question":"Perché il concetto di “coupon” protegge il valore percepito rispetto a uno “sconto”?","type":"text"},{"id":"1757710692361","question":"In che modo la scrittura del prezzo su un foglio può ridurre l’ansia e aumentare l’autorevolezza?","type":"text"},{"id":"1757710692669","question":"Come si crea urgenza senza forzare il cliente?","type":"text"},{"id":"1757710692998","question":"Quali sono le principali fasi per trasformare un’obiezione come “Ci penso” in un’opportunità di approfondimento?","type":"text"},{"id":"1757710693315","question":"Perché il modello di pacchetti ad alto valore è più efficace rispetto alle sessioni singole?","type":"text"},{"id":"1757710693565","question":"Quali domande aiutano il cliente a visualizzare concretamente il successo futuro?","type":"text"},{"id":"1757710693841","question":"Come il framework guida il cliente dal problema alla soluzione desiderata senza shock da prezzo?","type":"text"},{"id":"1757710694107","question":"Come il ciclo di auto-registrazione e feedback migliora le competenze di vendita e consulenza?","type":"text"}]	https://docs.google.com/document/d/1oqd5jL8TvcZzhFZuTRmOXNY1uXWW1OtEOIyMwzmwOVc/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 21:00:04.08
74a9ede5-6458-4858-a65a-3405b08a528c	La tua libertà finanziaria	Ecco una serie di domande di riflessione basate sulla nostra conversazione e sul report strategico. Non ci sono risposte "giuste" o "sbagliate". Lo scopo di questo esercizio è aiutarti a interiorizzare i principi discussi, a esplorare il tuo rapporto con il denaro e a pianificare mentalmente i tuoi prossimi passi.\n\n	general	risparmio-investimenti	360	Prenditi il tempo necessario per rispondere in modo ponderato e onesto. Le tue risposte saranno la nostra guida per personalizzare ulteriormente il tuo percorso verso la libertà finanziaria.\n\nvai sul documento e rispondi agli esercizi\nrispondi alle domande\ninvia l'esercitazione	[]	[{"id":"1757711181080","question":"Qual è il tuo stipendio mensile netto dal lavoro in ospedale?","type":"text"},{"id":"1757711181912","question":"A quanto ammonta la trattenuta mensile fissa sul tuo stipendio a causa del debito?","type":"text"},{"id":"1757711182418","question":"Qual è l'obiettivo di risparmio mensile che ti è stato suggerito nella strategia?","type":"text"},{"id":"1757711182736","question":"Quanti conti bancari separati ti è stato consigliato di usare per implementare la tua nuova strategia finanziaria?","type":"text"},{"id":"1757711183015","question":"Qual è l'obiettivo di reddito mensile che vuoi raggiungere con la tua attività su Amazon?","type":"text"},{"id":"1757711183305","question":"Oltre all'attività su Amazon, quale altro progetto imprenditoriale vuoi avviare?","type":"text"},{"id":"1757711183635","question":"Qual è l'obiettivo finale di rendita passiva mensile che desideri raggiungere?","type":"text"},{"id":"1757711183996","question":"Quale spesa importante, come l'affitto, è attualmente coperta da tua madre?","type":"text"},{"id":"1757711184314","question":"Qual è lo strumento legale (il nome della legge) che stai usando per provare a risolvere la situazione del tuo debito?","type":"text"},{"id":"1757711222665","question":"Secondo le proiezioni, quale capitale potresti accumulare in 5 anni risparmiando 300 € al mese con un rendimento del 10%?","type":"text"}]	https://docs.google.com/document/d/11MOIhE5O-VvqLD-G4LEzQ2onew0MZjDqdLm10z7baHA/edit?usp=sharing	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 21:08:30.769
\.


--
-- Data for Name: goals; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.goals (id, client_id, title, description, target_value, current_value, unit, target_date, status, created_at) FROM stdin;
\.


--
-- Data for Name: user_activity_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_activity_logs (id, user_id, activity_type, "timestamp", details, session_id, ip_address, user_agent) FROM stdin;
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_sessions (id, user_id, session_id, start_time, end_time, last_activity, ip_address, user_agent) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, email, password, first_name, last_name, role, avatar, consultant_id, created_at) FROM stdin;
0c73bbe5-51e1-4108-866b-6be7a52fce3b	Orbitale	alessio@gmail.com	$2b$10$b0L8aChqJXZYGc3TzL.64.WcS7x630SsSVuPw/t87cU8bwEDdMvc6	alessio	chianetta	consultant	\N	\N	2025-09-12 00:28:25.74
7cdfb7ae-d06b-40f6-9840-91f72772a390	FernandoVillon	fernandovillon96@hotmail.com	$2b$10$ubJ3wHml8Y.eDMd4k1bvPuhlDeVScaALXOBqHT7USm565.i3YoMRi	Fernando	Villon	client	\N	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 00:28:50.922
c806e79d-42d5-4f6e-87ae-eb85e63d7da0	marcoMassi	famiglia838@gmail.com	$2b$10$d1mOORkMJ409SaPMOrhfEOpsDkR3A4JQE4QuyzWO6x91PgTD9MVz6	marco	massi	client	\N	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 00:55:42.406
bc1dec4d-8a20-4d23-a109-b4de82a4b4e7	GiuliaTuratto	giuliacell23@gmail.com	$2b$10$T3FlNHMEbzWNMheCoFYfNuiN5qh8aK1yWq791MzQJipPnGChv0AyC	Giulia	Turatto	client	\N	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 12:13:10.626
8a7f6b63-b41e-4071-bf44-28d71df1f4d8	CristinaRossetti	crissy782004@libero.it	$2b$10$aRwPyne6Nx2NA9eTgUWV0u9TD3kyYkW2A4xZMA1QqAsik00XaC7lO	Cristina	Rossetti	client	\N	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 12:14:59.746
7e40b56c-2cc8-4515-b843-dc105e478f38	GiusyDattilo	giusy.dattilo@gmail.com	$2b$10$k93TY645tTcv68aBy4jmfeUWD1YkjMJlpriWVMmJf/HDssImGVvVm	Giusy	Dattilo	client	\N	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 12:17:37.038
ad0f878c-55b5-48ea-af8d-58b4696e4cd3	LucaMattei	mattei.luca2@gmail.com	$2b$10$tqQy6X2rxuxnwLgscNKUmOCXkxYfP5HwLqiiV4PTgsn53qZvFtVHa	Luca	Mattei	client	\N	0c73bbe5-51e1-4108-866b-6be7a52fce3b	2025-09-12 12:19:13.297
\.


--
-- Name: client_analytics_summary client_analytics_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_analytics_summary
    ADD CONSTRAINT client_analytics_summary_pkey PRIMARY KEY (id);


--
-- Name: client_engagement_metrics client_engagement_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_engagement_metrics
    ADD CONSTRAINT client_engagement_metrics_pkey PRIMARY KEY (id);


--
-- Name: client_progress client_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_progress
    ADD CONSTRAINT client_progress_pkey PRIMARY KEY (id);


--
-- Name: consultant_analytics consultant_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultant_analytics
    ADD CONSTRAINT consultant_analytics_pkey PRIMARY KEY (id);


--
-- Name: consultations consultations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_pkey PRIMARY KEY (id);


--
-- Name: exercise_assignments exercise_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_assignments
    ADD CONSTRAINT exercise_assignments_pkey PRIMARY KEY (id);


--
-- Name: exercise_performance_metrics exercise_performance_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_performance_metrics
    ADD CONSTRAINT exercise_performance_metrics_pkey PRIMARY KEY (id);


--
-- Name: exercise_revision_history exercise_revision_history_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_revision_history
    ADD CONSTRAINT exercise_revision_history_pkey PRIMARY KEY (id);


--
-- Name: exercise_submissions exercise_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_submissions
    ADD CONSTRAINT exercise_submissions_pkey PRIMARY KEY (id);


--
-- Name: exercise_templates exercise_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_templates
    ADD CONSTRAINT exercise_templates_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_id_unique UNIQUE (session_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: client_analytics_summary client_analytics_summary_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_analytics_summary
    ADD CONSTRAINT client_analytics_summary_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: client_analytics_summary client_analytics_summary_consultant_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_analytics_summary
    ADD CONSTRAINT client_analytics_summary_consultant_id_users_id_fk FOREIGN KEY (consultant_id) REFERENCES public.users(id);


--
-- Name: client_engagement_metrics client_engagement_metrics_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_engagement_metrics
    ADD CONSTRAINT client_engagement_metrics_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: client_engagement_metrics client_engagement_metrics_consultant_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_engagement_metrics
    ADD CONSTRAINT client_engagement_metrics_consultant_id_users_id_fk FOREIGN KEY (consultant_id) REFERENCES public.users(id);


--
-- Name: client_progress client_progress_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.client_progress
    ADD CONSTRAINT client_progress_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: consultant_analytics consultant_analytics_consultant_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultant_analytics
    ADD CONSTRAINT consultant_analytics_consultant_id_users_id_fk FOREIGN KEY (consultant_id) REFERENCES public.users(id);


--
-- Name: consultations consultations_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: consultations consultations_consultant_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.consultations
    ADD CONSTRAINT consultations_consultant_id_users_id_fk FOREIGN KEY (consultant_id) REFERENCES public.users(id);


--
-- Name: exercise_assignments exercise_assignments_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_assignments
    ADD CONSTRAINT exercise_assignments_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: exercise_assignments exercise_assignments_consultant_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_assignments
    ADD CONSTRAINT exercise_assignments_consultant_id_users_id_fk FOREIGN KEY (consultant_id) REFERENCES public.users(id);


--
-- Name: exercise_assignments exercise_assignments_exercise_id_exercises_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_assignments
    ADD CONSTRAINT exercise_assignments_exercise_id_exercises_id_fk FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: exercise_performance_metrics exercise_performance_metrics_assignment_id_exercise_assignments; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_performance_metrics
    ADD CONSTRAINT exercise_performance_metrics_assignment_id_exercise_assignments FOREIGN KEY (assignment_id) REFERENCES public.exercise_assignments(id);


--
-- Name: exercise_performance_metrics exercise_performance_metrics_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_performance_metrics
    ADD CONSTRAINT exercise_performance_metrics_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: exercise_performance_metrics exercise_performance_metrics_exercise_id_exercises_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_performance_metrics
    ADD CONSTRAINT exercise_performance_metrics_exercise_id_exercises_id_fk FOREIGN KEY (exercise_id) REFERENCES public.exercises(id);


--
-- Name: exercise_performance_metrics exercise_performance_metrics_submission_id_exercise_submissions; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_performance_metrics
    ADD CONSTRAINT exercise_performance_metrics_submission_id_exercise_submissions FOREIGN KEY (submission_id) REFERENCES public.exercise_submissions(id);


--
-- Name: exercise_revision_history exercise_revision_history_assignment_id_exercise_assignments_id; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_revision_history
    ADD CONSTRAINT exercise_revision_history_assignment_id_exercise_assignments_id FOREIGN KEY (assignment_id) REFERENCES public.exercise_assignments(id);


--
-- Name: exercise_revision_history exercise_revision_history_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_revision_history
    ADD CONSTRAINT exercise_revision_history_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: exercise_revision_history exercise_revision_history_submission_id_exercise_submissions_id; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_revision_history
    ADD CONSTRAINT exercise_revision_history_submission_id_exercise_submissions_id FOREIGN KEY (submission_id) REFERENCES public.exercise_submissions(id);


--
-- Name: exercise_submissions exercise_submissions_assignment_id_exercise_assignments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_submissions
    ADD CONSTRAINT exercise_submissions_assignment_id_exercise_assignments_id_fk FOREIGN KEY (assignment_id) REFERENCES public.exercise_assignments(id);


--
-- Name: exercise_templates exercise_templates_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercise_templates
    ADD CONSTRAINT exercise_templates_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: exercises exercises_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: goals goals_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: user_activity_logs user_activity_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_sessions user_sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

