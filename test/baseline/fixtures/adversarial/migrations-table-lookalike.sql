--
-- PostgreSQL database dump
--

\restrict RgAEViOo4oE2QlrNsDZIVd07zl7JwScShz9zU8hWQOdwnksPAQ7fvUzhHXdbuPG

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: pgmigrations; Type: TABLE; Schema: app; Owner: -
--

CREATE TABLE app.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: app; Owner: -
--

CREATE SEQUENCE app.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: -
--

ALTER SEQUENCE app.pgmigrations_id_seq OWNED BY app.pgmigrations.id;


--
-- Name: PgMigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PgMigrations" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: PgMigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."PgMigrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: PgMigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."PgMigrations_id_seq" OWNED BY public."PgMigrations".id;


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pgmigrations ALTER COLUMN id SET DEFAULT nextval('app.pgmigrations_id_seq'::regclass);


--
-- Name: PgMigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PgMigrations" ALTER COLUMN id SET DEFAULT nextval('public."PgMigrations_id_seq"'::regclass);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: app; Owner: -
--

ALTER TABLE ONLY app.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: PgMigrations PgMigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PgMigrations"
    ADD CONSTRAINT "PgMigrations_pkey" PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict RgAEViOo4oE2QlrNsDZIVd07zl7JwScShz9zU8hWQOdwnksPAQ7fvUzhHXdbuPG

