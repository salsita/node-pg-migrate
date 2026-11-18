--
-- PostgreSQL database dump
--

\restrict 3sOoSMwBtaTPg4zAmLMi512guI5KUbMkx5T05bGQW86OCpaDfuPYMrLeihLVFKN

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
-- Name: migration_template(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migration_template() RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT '
-- Up Migration
CREATE TABLE example (id integer);

-- Down Migration
DROP TABLE example;
'
$$;


--
-- PostgreSQL database dump complete
--

\unrestrict 3sOoSMwBtaTPg4zAmLMi512guI5KUbMkx5T05bGQW86OCpaDfuPYMrLeihLVFKN

