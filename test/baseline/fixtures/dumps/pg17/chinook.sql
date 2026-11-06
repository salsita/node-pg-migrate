--
-- PostgreSQL database dump
--

\restrict 2YxH5sVHfcALHbShHgcQRsNPKY0xVjtl67VY2OaheunSyUL3NC92Bp7WxP5cozk

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

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
-- Name: album; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.album (
    album_id integer NOT NULL,
    title character varying(160) NOT NULL,
    artist_id integer NOT NULL
);


--
-- Name: album_album_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.album_album_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: album_album_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.album_album_id_seq OWNED BY public.album.album_id;


--
-- Name: artist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artist (
    artist_id integer NOT NULL,
    name character varying(120)
);


--
-- Name: artist_artist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.artist_artist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: artist_artist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.artist_artist_id_seq OWNED BY public.artist.artist_id;


--
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    customer_id integer NOT NULL,
    first_name character varying(40) NOT NULL,
    last_name character varying(20) NOT NULL,
    company character varying(80),
    address character varying(70),
    city character varying(40),
    state character varying(40),
    country character varying(40),
    postal_code character varying(10),
    phone character varying(24),
    fax character varying(24),
    email character varying(60) NOT NULL,
    support_rep_id integer
);


--
-- Name: customer_customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_customer_id_seq OWNED BY public.customer.customer_id;


--
-- Name: employee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee (
    employee_id integer NOT NULL,
    last_name character varying(20) NOT NULL,
    first_name character varying(20) NOT NULL,
    title character varying(30),
    reports_to integer,
    birth_date timestamp without time zone,
    hire_date timestamp without time zone,
    address character varying(70),
    city character varying(40),
    state character varying(40),
    country character varying(40),
    postal_code character varying(10),
    phone character varying(24),
    fax character varying(24),
    email character varying(60)
);


--
-- Name: employee_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_employee_id_seq OWNED BY public.employee.employee_id;


--
-- Name: genre; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.genre (
    genre_id integer NOT NULL,
    name character varying(120)
);


--
-- Name: genre_genre_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.genre_genre_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: genre_genre_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.genre_genre_id_seq OWNED BY public.genre.genre_id;


--
-- Name: invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice (
    invoice_id integer NOT NULL,
    customer_id integer NOT NULL,
    invoice_date timestamp without time zone NOT NULL,
    billing_address character varying(70),
    billing_city character varying(40),
    billing_state character varying(40),
    billing_country character varying(40),
    billing_postal_code character varying(10),
    total numeric(10,2) NOT NULL
);


--
-- Name: invoice_invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_invoice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_invoice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_invoice_id_seq OWNED BY public.invoice.invoice_id;


--
-- Name: invoice_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line (
    invoice_line_id integer NOT NULL,
    invoice_id integer NOT NULL,
    track_id integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    quantity integer NOT NULL
);


--
-- Name: invoice_line_invoice_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_line_invoice_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_line_invoice_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_line_invoice_line_id_seq OWNED BY public.invoice_line.invoice_line_id;


--
-- Name: media_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_type (
    media_type_id integer NOT NULL,
    name character varying(120)
);


--
-- Name: media_type_media_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_type_media_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_type_media_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_type_media_type_id_seq OWNED BY public.media_type.media_type_id;


--
-- Name: playlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist (
    playlist_id integer NOT NULL,
    name character varying(120)
);


--
-- Name: playlist_playlist_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlist_playlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlist_playlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlist_playlist_id_seq OWNED BY public.playlist.playlist_id;


--
-- Name: playlist_track; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist_track (
    playlist_id integer NOT NULL,
    track_id integer NOT NULL
);


--
-- Name: track; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.track (
    track_id integer NOT NULL,
    name character varying(200) NOT NULL,
    album_id integer,
    media_type_id integer NOT NULL,
    genre_id integer,
    composer character varying(220),
    milliseconds integer NOT NULL,
    bytes integer,
    unit_price numeric(10,2) NOT NULL
);


--
-- Name: track_track_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.track_track_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: track_track_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.track_track_id_seq OWNED BY public.track.track_id;


--
-- Name: album album_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album ALTER COLUMN album_id SET DEFAULT nextval('public.album_album_id_seq'::regclass);


--
-- Name: artist artist_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist ALTER COLUMN artist_id SET DEFAULT nextval('public.artist_artist_id_seq'::regclass);


--
-- Name: customer customer_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer ALTER COLUMN customer_id SET DEFAULT nextval('public.customer_customer_id_seq'::regclass);


--
-- Name: employee employee_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee ALTER COLUMN employee_id SET DEFAULT nextval('public.employee_employee_id_seq'::regclass);


--
-- Name: genre genre_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genre ALTER COLUMN genre_id SET DEFAULT nextval('public.genre_genre_id_seq'::regclass);


--
-- Name: invoice invoice_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice ALTER COLUMN invoice_id SET DEFAULT nextval('public.invoice_invoice_id_seq'::regclass);


--
-- Name: invoice_line invoice_line_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line ALTER COLUMN invoice_line_id SET DEFAULT nextval('public.invoice_line_invoice_line_id_seq'::regclass);


--
-- Name: media_type media_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_type ALTER COLUMN media_type_id SET DEFAULT nextval('public.media_type_media_type_id_seq'::regclass);


--
-- Name: playlist playlist_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist ALTER COLUMN playlist_id SET DEFAULT nextval('public.playlist_playlist_id_seq'::regclass);


--
-- Name: track track_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track ALTER COLUMN track_id SET DEFAULT nextval('public.track_track_id_seq'::regclass);


--
-- Name: album album_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album
    ADD CONSTRAINT album_pkey PRIMARY KEY (album_id);


--
-- Name: artist artist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artist
    ADD CONSTRAINT artist_pkey PRIMARY KEY (artist_id);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (customer_id);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (employee_id);


--
-- Name: genre genre_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.genre
    ADD CONSTRAINT genre_pkey PRIMARY KEY (genre_id);


--
-- Name: invoice_line invoice_line_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line
    ADD CONSTRAINT invoice_line_pkey PRIMARY KEY (invoice_line_id);


--
-- Name: invoice invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_pkey PRIMARY KEY (invoice_id);


--
-- Name: media_type media_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_type
    ADD CONSTRAINT media_type_pkey PRIMARY KEY (media_type_id);


--
-- Name: playlist playlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist
    ADD CONSTRAINT playlist_pkey PRIMARY KEY (playlist_id);


--
-- Name: playlist_track playlist_track_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_track
    ADD CONSTRAINT playlist_track_pkey PRIMARY KEY (playlist_id, track_id);


--
-- Name: track track_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track
    ADD CONSTRAINT track_pkey PRIMARY KEY (track_id);


--
-- Name: album_artist_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX album_artist_id_idx ON public.album USING btree (artist_id);


--
-- Name: customer_support_rep_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_support_rep_id_idx ON public.customer USING btree (support_rep_id);


--
-- Name: employee_reports_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_reports_to_idx ON public.employee USING btree (reports_to);


--
-- Name: invoice_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_customer_id_idx ON public.invoice USING btree (customer_id);


--
-- Name: invoice_line_invoice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_line_invoice_id_idx ON public.invoice_line USING btree (invoice_id);


--
-- Name: invoice_line_track_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_line_track_id_idx ON public.invoice_line USING btree (track_id);


--
-- Name: playlist_track_playlist_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX playlist_track_playlist_id_idx ON public.playlist_track USING btree (playlist_id);


--
-- Name: playlist_track_track_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX playlist_track_track_id_idx ON public.playlist_track USING btree (track_id);


--
-- Name: track_album_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX track_album_id_idx ON public.track USING btree (album_id);


--
-- Name: track_genre_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX track_genre_id_idx ON public.track USING btree (genre_id);


--
-- Name: track_media_type_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX track_media_type_id_idx ON public.track USING btree (media_type_id);


--
-- Name: album album_artist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.album
    ADD CONSTRAINT album_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artist(artist_id);


--
-- Name: customer customer_support_rep_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_support_rep_id_fkey FOREIGN KEY (support_rep_id) REFERENCES public.employee(employee_id);


--
-- Name: employee employee_reports_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_reports_to_fkey FOREIGN KEY (reports_to) REFERENCES public.employee(employee_id);


--
-- Name: invoice invoice_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(customer_id);


--
-- Name: invoice_line invoice_line_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line
    ADD CONSTRAINT invoice_line_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoice(invoice_id);


--
-- Name: invoice_line invoice_line_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line
    ADD CONSTRAINT invoice_line_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.track(track_id);


--
-- Name: playlist_track playlist_track_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_track
    ADD CONSTRAINT playlist_track_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlist(playlist_id);


--
-- Name: playlist_track playlist_track_track_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_track
    ADD CONSTRAINT playlist_track_track_id_fkey FOREIGN KEY (track_id) REFERENCES public.track(track_id);


--
-- Name: track track_album_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track
    ADD CONSTRAINT track_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.album(album_id);


--
-- Name: track track_genre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track
    ADD CONSTRAINT track_genre_id_fkey FOREIGN KEY (genre_id) REFERENCES public.genre(genre_id);


--
-- Name: track track_media_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.track
    ADD CONSTRAINT track_media_type_id_fkey FOREIGN KEY (media_type_id) REFERENCES public.media_type(media_type_id);


--
-- PostgreSQL database dump complete
--

\unrestrict 2YxH5sVHfcALHbShHgcQRsNPKY0xVjtl67VY2OaheunSyUL3NC92Bp7WxP5cozk

