--
-- PostgreSQL database dump
--

\restrict vYujKkMBpe6OtV2qvJAFZSEch0pWvcBgouXaPsfD1fRaBNFSLxRwSQyVSyhv0gK

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    body text NOT NULL
);


--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.notes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notes OVERRIDING SYSTEM VALUE VALUES (1, 'first note');
INSERT INTO public.notes OVERRIDING SYSTEM VALUE VALUES (2, 'second; note with a tab	and a backslash \');


--
-- Name: notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notes_id_seq', 2, true);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict vYujKkMBpe6OtV2qvJAFZSEch0pWvcBgouXaPsfD1fRaBNFSLxRwSQyVSyhv0gK

