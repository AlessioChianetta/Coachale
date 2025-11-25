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

