select
    "GenreId" as genre_id,
    "Name" as genre_name
from {{ source('chinook', 'genre') }}
