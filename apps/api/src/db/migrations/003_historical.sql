CREATE TABLE historical_import (
 id TEXT PRIMARY KEY, year INTEGER NOT NULL CHECK(year IN (2018,2022)), election TEXT NOT NULL,
 captured_at TEXT NOT NULL, source_url TEXT NOT NULL, raw_digest TEXT NOT NULL,
 encoding TEXT NOT NULL, imported_rows INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status='pending_reconciliation'), UNIQUE(year,raw_digest)
);
CREATE TABLE historical_segment (
 import_id TEXT NOT NULL REFERENCES historical_import(id), uf TEXT NOT NULL, municipality TEXT NOT NULL CHECK(length(municipality)=5), zone TEXT NOT NULL CHECK(length(zone)=4), valid INTEGER NOT NULL CHECK(valid>=0),
 PRIMARY KEY(import_id,uf,municipality,zone)
);
CREATE TABLE historical_vote (
 import_id TEXT NOT NULL, uf TEXT NOT NULL, municipality TEXT NOT NULL, zone TEXT NOT NULL, candidate_id TEXT NOT NULL, number TEXT NOT NULL, name TEXT NOT NULL, votes INTEGER NOT NULL CHECK(votes>=0),
 PRIMARY KEY(import_id,uf,municipality,zone,candidate_id), FOREIGN KEY(import_id,uf,municipality,zone) REFERENCES historical_segment(import_id,uf,municipality,zone)
);
CREATE INDEX historical_zone ON historical_segment(import_id,uf,zone);
CREATE TABLE territorial_audit (
 id TEXT PRIMARY KEY, captured_at TEXT NOT NULL, current_registry_digest TEXT NOT NULL,
 import_2018 TEXT NOT NULL REFERENCES historical_import(id), import_2022 TEXT NOT NULL REFERENCES historical_import(id),
 uf TEXT NOT NULL, zone TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('verified','review','uncertain','unmatched')),
 method TEXT NOT NULL, evidence TEXT NOT NULL
);
CREATE TRIGGER historical_import_no_update BEFORE UPDATE ON historical_import BEGIN SELECT RAISE(ABORT,'Importação imutável'); END;
CREATE TRIGGER historical_import_no_delete BEFORE DELETE ON historical_import BEGIN SELECT RAISE(ABORT,'Importação imutável'); END;
CREATE TRIGGER historical_segment_no_update BEFORE UPDATE ON historical_segment BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;
CREATE TRIGGER historical_segment_no_delete BEFORE DELETE ON historical_segment BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;
CREATE TRIGGER historical_vote_no_update BEFORE UPDATE ON historical_vote BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;
CREATE TRIGGER historical_vote_no_delete BEFORE DELETE ON historical_vote BEGIN SELECT RAISE(ABORT,'Histórico imutável'); END;
CREATE TRIGGER territorial_audit_no_update BEFORE UPDATE ON territorial_audit BEGIN SELECT RAISE(ABORT,'Auditoria imutável'); END;
CREATE TRIGGER territorial_audit_no_delete BEFORE DELETE ON territorial_audit BEGIN SELECT RAISE(ABORT,'Auditoria imutável'); END;
