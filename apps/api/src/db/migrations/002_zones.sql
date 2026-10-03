CREATE TABLE zone_registry (
  id TEXT PRIMARY KEY, environment TEXT NOT NULL CHECK(environment IN ('fixture','simulated','official')),
  captured_at TEXT NOT NULL, complete INTEGER NOT NULL CHECK(complete IN (0,1)), digest TEXT NOT NULL,
  UNIQUE(environment, digest)
);
CREATE TABLE zone_segment (
  registry_id TEXT NOT NULL REFERENCES zone_registry(id), uf TEXT NOT NULL,
  municipality TEXT NOT NULL CHECK(length(municipality)=5), zone TEXT NOT NULL CHECK(length(zone)=4),
  PRIMARY KEY(registry_id,uf,municipality,zone)
);
CREATE TABLE zone_candidate_mapping (
  registry_id TEXT NOT NULL REFERENCES zone_registry(id), year INTEGER NOT NULL CHECK(year IN (2018,2022,2026)),
  bolsonaro TEXT NOT NULL, lula_haddad TEXT NOT NULL, CHECK(bolsonaro <> lula_haddad), PRIMARY KEY(registry_id,year)
);
CREATE TABLE zone_result (
  id TEXT PRIMARY KEY, environment TEXT NOT NULL CHECK(environment IN ('fixture','simulated','official')),
  year INTEGER NOT NULL CHECK(year IN (2018,2022,2026)), election TEXT NOT NULL, round TEXT NOT NULL CHECK(round='1'),
  uf TEXT NOT NULL, municipality TEXT NOT NULL CHECK(length(municipality)=5), zone TEXT NOT NULL CHECK(length(zone)=4),
  captured_at TEXT NOT NULL, source_url TEXT NOT NULL, source_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('complete','partial','needs_review')),
  total INTEGER NOT NULL CHECK(total>=0), totalized INTEGER NOT NULL CHECK(totalized>=0), not_totalized INTEGER NOT NULL CHECK(not_totalized>=0),
  valid INTEGER CHECK(valid>=0), UNIQUE(environment,year,election,uf,municipality,zone,captured_at)
);
CREATE INDEX zone_result_replay ON zone_result(environment,year,uf,zone,municipality,captured_at);
CREATE TABLE zone_candidate_vote (
  result_id TEXT NOT NULL REFERENCES zone_result(id), candidate_id TEXT NOT NULL, votes INTEGER NOT NULL CHECK(votes>=0),
  PRIMARY KEY(result_id,candidate_id)
);
CREATE TABLE zone_match (
  id TEXT PRIMARY KEY, registry_id TEXT NOT NULL REFERENCES zone_registry(id), current_key TEXT NOT NULL,
  historical_2018 TEXT NOT NULL, historical_2022 TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('verified','uncertain','unmatched','review')), captured_at TEXT NOT NULL,
  method TEXT NOT NULL, evidence TEXT NOT NULL, registry_digest TEXT NOT NULL,
  UNIQUE(registry_id,current_key,captured_at)
);
CREATE INDEX zone_match_replay ON zone_match(registry_id,current_key,captured_at);
CREATE TRIGGER zone_result_no_update BEFORE UPDATE ON zone_result BEGIN SELECT RAISE(ABORT,'Resultados zonais imutáveis'); END;
CREATE TRIGGER zone_result_no_delete BEFORE DELETE ON zone_result BEGIN SELECT RAISE(ABORT,'Resultados zonais imutáveis'); END;
CREATE TRIGGER zone_votes_no_update BEFORE UPDATE ON zone_candidate_vote BEGIN SELECT RAISE(ABORT,'Votos imutáveis'); END;
CREATE TRIGGER zone_votes_no_delete BEFORE DELETE ON zone_candidate_vote BEGIN SELECT RAISE(ABORT,'Votos imutáveis'); END;
CREATE TRIGGER zone_match_no_update BEFORE UPDATE ON zone_match BEGIN SELECT RAISE(ABORT,'Auditoria imutável'); END;
CREATE TRIGGER zone_match_no_delete BEFORE DELETE ON zone_match BEGIN SELECT RAISE(ABORT,'Auditoria imutável'); END;
CREATE TRIGGER zone_registry_no_update BEFORE UPDATE ON zone_registry BEGIN SELECT RAISE(ABORT,'Cadastro imutável'); END;
CREATE TRIGGER zone_registry_no_delete BEFORE DELETE ON zone_registry BEGIN SELECT RAISE(ABORT,'Cadastro imutável'); END;
CREATE TRIGGER zone_segment_no_update BEFORE UPDATE ON zone_segment BEGIN SELECT RAISE(ABORT,'Cadastro imutável'); END;
CREATE TRIGGER zone_segment_no_delete BEFORE DELETE ON zone_segment BEGIN SELECT RAISE(ABORT,'Cadastro imutável'); END;
CREATE TRIGGER zone_mapping_no_update BEFORE UPDATE ON zone_candidate_mapping BEGIN SELECT RAISE(ABORT,'Identidades imutáveis'); END;
CREATE TRIGGER zone_mapping_no_delete BEFORE DELETE ON zone_candidate_mapping BEGIN SELECT RAISE(ABORT,'Identidades imutáveis'); END;
