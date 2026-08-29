select
    "MediaTypeId" as media_type_id,
    "Name" as media_type_name
from {{ source('chinook', 'mediatype') }}
