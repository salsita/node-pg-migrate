--
-- PostgreSQL database dump
--

\restrict E2VrkoTGpN5t9g4O4SFvEq8USILf9Td3XjWe4ZnP6sLXOqAxgniKVNfWBSbP2i2

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
-- Name: begin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin() RETURNS integer
    LANGUAGE sql
    RETURN 1;


--
-- Name: calls_begin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calls_begin() RETURNS integer
    LANGUAGE sql
    BEGIN ATOMIC
 SELECT public.begin() AS begin;
END;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: begin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.begin (
    id integer
);


--
-- Name: count_begin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_begin() RETURNS bigint
    LANGUAGE sql
    BEGIN ATOMIC
 SELECT count(*) AS count
    FROM public.begin;
END;


--
-- Name: shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift (
    id integer,
    begin timestamp with time zone,
    finish timestamp with time zone
);


--
-- Name: first_begin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.first_begin() RETURNS timestamp with time zone
    LANGUAGE sql
    BEGIN ATOMIC
 SELECT s.begin
    FROM public.shift s
   ORDER BY s.id
  LIMIT 1;
END;


--
-- Name: labelled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.labelled() RETURNS integer
    LANGUAGE sql
    BEGIN ATOMIC
 SELECT 1 AS begin;
END;


--
-- Name: after_fn; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_fn (
    id integer
);


--
-- Data for Name: after_fn; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.after_fn (id) FROM stdin;
42
\.


--
-- Data for Name: begin; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.begin (id) FROM stdin;
\.


--
-- Data for Name: shift; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shift (id, begin, finish) FROM stdin;
\.


--
-- PostgreSQL database dump complete
--

\unrestrict E2VrkoTGpN5t9g4O4SFvEq8USILf9Td3XjWe4ZnP6sLXOqAxgniKVNfWBSbP2i2

