-- Converted to PostgreSQL from MySQL dump
-- ICD-10 Master Data with English and Indonesian names

CREATE TABLE icds (
  code varchar(255) PRIMARY KEY,
  name_en text NOT NULL,
  name_id text NOT NULL
);

COPY icds (code, name_en, name_id) FROM STDIN;
