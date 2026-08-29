select
    "InvoiceLineId" as invoice_line_id,
    "InvoiceId" as invoice_id,
    "TrackId" as track_id,
    "UnitPrice" as unit_price,
    "Quantity" as quantity
from {{ source('chinook', 'invoiceline') }}
