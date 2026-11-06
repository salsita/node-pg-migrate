--
-- PostgreSQL database dump
--

\restrict Ezg4cYAAhxxfegrr4ZdFTl6lCwGyRNIUwwLh7c5W8GfYHMDuWTUamF1zf4XJJjV

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'LATIN1';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: mood; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mood AS ENUM (
    'café',
    'naïve'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: desserts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.desserts (
    id integer NOT NULL,
    name text DEFAULT 'crème brûlée'::text NOT NULL,
    mood public.mood DEFAULT 'café'::public.mood NOT NULL
);


--
-- Name: TABLE desserts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.desserts IS 'déjà vu';


--
-- Name: desserts desserts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.desserts
    ADD CONSTRAINT desserts_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict Ezg4cYAAhxxfegrr4ZdFTl6lCwGyRNIUwwLh7c5W8GfYHMDuWTUamF1zf4XJJjV

