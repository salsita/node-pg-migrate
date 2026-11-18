--
-- PostgreSQL database dump
--

\restrict Idxbt6ooQgI3v9tmS6dhRdO0gQAmjkLnn7G3XaX4c4KniATYL4x3g6QZT1EPo7E

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
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: words; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.words (
    word text NOT NULL
);


--
-- Name: words words_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.words
    ADD CONSTRAINT words_pkey PRIMARY KEY (word);


--
-- Name: words_word_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX words_word_trgm_idx ON public.words USING gin (word public.gin_trgm_ops);


--
-- PostgreSQL database dump complete
--

\unrestrict Idxbt6ooQgI3v9tmS6dhRdO0gQAmjkLnn7G3XaX4c4KniATYL4x3g6QZT1EPo7E

