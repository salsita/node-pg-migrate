--
-- PostgreSQL database dump
--

\restrict Vm4rE42itcFRfB09FRv6F6EpYrSDJTLY6XjavSgHlSjfq5hneDthswZuuwdjbu8

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
-- Name: psql_help(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.psql_help() RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT 'In psql, run:
\connect app
\dt public.*
and end COPY data with a line that is only
\.
'
$$;


--
-- PostgreSQL database dump complete
--

\unrestrict Vm4rE42itcFRfB09FRv6F6EpYrSDJTLY6XjavSgHlSjfq5hneDthswZuuwdjbu8

