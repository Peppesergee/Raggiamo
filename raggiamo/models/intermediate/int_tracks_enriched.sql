-- Denormalizza una traccia con album/artista/genere/media type: join
-- riusato sia da dim_tracks che da fct_invoice_lines, per non ripeterlo
-- in due posti.

with tracks as (
    select * from {{ ref('stg_chinook__tracks') }}
),

albums as (
    select * from {{ ref('stg_chinook__albums') }}
),

artists as (
    select * from {{ ref('stg_chinook__artists') }}
),

genres as (
    select * from {{ ref('stg_chinook__genres') }}
),

media_types as (
    select * from {{ ref('stg_chinook__media_types') }}
),

final as (
    select
        tracks.track_id,
        tracks.track_name,
        tracks.composer,
        tracks.duration_ms,
        tracks.unit_price,
        albums.album_id,
        albums.album_title,
        artists.artist_id,
        artists.artist_name,
        genres.genre_id,
        genres.genre_name,
        media_types.media_type_id,
        media_types.media_type_name
    from tracks
    left join albums on tracks.album_id = albums.album_id
    left join artists on albums.artist_id = artists.artist_id
    left join genres on tracks.genre_id = genres.genre_id
    left join media_types on tracks.media_type_id = media_types.media_type_id
)

select * from final
