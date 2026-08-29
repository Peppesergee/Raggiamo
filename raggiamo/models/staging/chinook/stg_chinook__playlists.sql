select
    "PlaylistId" as playlist_id,
    "Name" as playlist_name
from {{ source('chinook', 'playlist') }}
