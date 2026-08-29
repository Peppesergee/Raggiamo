-- Grain: una riga di fattura (una traccia venduta in una fattura).

with invoice_lines as (
    select * from {{ ref('stg_chinook__invoice_lines') }}
),

invoices as (
    select * from {{ ref('stg_chinook__invoices') }}
),

tracks as (
    select * from {{ ref('int_tracks_enriched') }}
),

final as (
    select
        invoice_lines.invoice_line_id,
        invoice_lines.invoice_id,
        invoices.invoice_date,
        invoices.customer_id,
        invoices.billing_country,
        invoice_lines.track_id,
        tracks.track_name,
        tracks.album_title,
        tracks.artist_name,
        tracks.genre_name,
        invoice_lines.unit_price,
        invoice_lines.quantity,
        invoice_lines.unit_price * invoice_lines.quantity as line_amount
    from invoice_lines
    left join invoices on invoice_lines.invoice_id = invoices.invoice_id
    left join tracks on invoice_lines.track_id = tracks.track_id
)

select * from final
