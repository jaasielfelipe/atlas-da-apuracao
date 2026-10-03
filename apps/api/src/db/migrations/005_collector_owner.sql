CREATE TABLE collector_owner (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX collector_observation_replay ON collector_observation(job_key,completed_at,id);
CREATE TRIGGER collector_observation_no_update BEFORE UPDATE ON collector_observation BEGIN SELECT RAISE(ABORT,'Observação imutável'); END;
CREATE TRIGGER collector_observation_no_delete BEFORE DELETE ON collector_observation BEGIN SELECT RAISE(ABORT,'Observação imutável'); END;
