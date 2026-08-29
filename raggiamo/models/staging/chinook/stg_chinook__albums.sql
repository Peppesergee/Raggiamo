select
    "AlbumId" as album_id,
    "Title" as album_title,
    "ArtistId" as artist_id
from {{ source('chinook', 'album') }}
