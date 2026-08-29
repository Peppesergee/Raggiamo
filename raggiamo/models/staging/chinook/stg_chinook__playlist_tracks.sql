select
    "PlaylistId" as playlist_id,
    "TrackId" as track_id
from {{ source('chinook', 'playlisttrack') }}
