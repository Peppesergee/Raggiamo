select
    track_id,
    track_name,
    album_title,
    artist_name,
    genre_name,
    media_type_name,
    composer,
    duration_ms,
    unit_price
from {{ ref('int_tracks_enriched') }}
