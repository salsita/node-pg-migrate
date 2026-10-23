--
-- PostgreSQL database dump
--

\restrict ehm0th2NSlpNjsfdi1sjfOMPOYlMVkEaWXEbKf6dZJ44hdy0bOszdzRRYoHTaRH

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    code text NOT NULL,
    home text DEFAULT 'C:\\data'::text NOT NULL,
    CONSTRAINT accounts_code_check CHECK ((code ~ '^\\d+$'::text))
);


--
-- Name: TABLE accounts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.accounts IS 'back\\slash';


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.accounts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict ehm0th2NSlpNjsfdi1sjfOMPOYlMVkEaWXEbKf6dZJ44hdy0bOszdzRRYoHTaRH

