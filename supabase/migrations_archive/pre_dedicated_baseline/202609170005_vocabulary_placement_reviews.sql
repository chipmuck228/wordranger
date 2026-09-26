-- Curated vocabulary placement reviews. Reference metadata, not learner state.
-- BAND_* validity stays in domain/server validation against PlacementBandDefinition.

create table if not exists vocabulary_placement_reviews (
  lexeme_id uuid primary key references lexemes (id),
  band_id text not null,
  status text not null,
  source text not null,
  provenance jsonb not null,
  review_note text,
  reviewed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint vocabulary_placement_reviews_status_reviewed
    check (status = 'REVIEWED'),
  constraint vocabulary_placement_reviews_source_curated
    check (source = 'CURATED'),
  constraint vocabulary_placement_reviews_provenance_nonempty
    check (
      jsonb_typeof(provenance) = 'array'
      and jsonb_array_length(provenance) > 0
    )
);

create index if not exists vocabulary_placement_reviews_band_id_idx
  on vocabulary_placement_reviews (band_id);
create index if not exists vocabulary_placement_reviews_reviewed_at_idx
  on vocabulary_placement_reviews (reviewed_at);

comment on table vocabulary_placement_reviews is
  'Human-reviewed CURATED placement overrides keyed by lexemes.id. Not learner progress.';

alter table vocabulary_placement_reviews enable row level security;

revoke all on table vocabulary_placement_reviews from public;
revoke all on table vocabulary_placement_reviews from anon;
revoke all on table vocabulary_placement_reviews from authenticated;
grant select, insert, update on table vocabulary_placement_reviews to service_role;
