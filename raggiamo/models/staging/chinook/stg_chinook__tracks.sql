select
    "TrackId" as track_id,
    "Name" as track_name,
    "AlbumId" as album_id,
    "MediaTypeId" as media_type_id,
    "GenreId" as genre_id,
    "Composer" as composer,
    "Milliseconds" as duration_ms,
    "Bytes" as size_bytes,
    "UnitPrice" as unit_price
from {{ source('chinook', 'track') }}
