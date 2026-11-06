--
-- PostgreSQL database dump
--

\restrict jOUQ1nTG3ubhoy5pmMy4UalWhHHS4q3gXid6HTdQJOKXqya5hkGAIQijqt59ZfP

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

SET SESSION AUTHORIZATION 'app_owner';

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: items; Type: TABLE; Schema: public; Owner: app_owner
--

CREATE TABLE public.items (
    id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: app_owner
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict jOUQ1nTG3ubhoy5pmMy4UalWhHHS4q3gXid6HTdQJOKXqya5hkGAIQijqt59ZfP

