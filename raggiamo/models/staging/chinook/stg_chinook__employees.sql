select
    "EmployeeId" as employee_id,
    "FirstName" as first_name,
    "LastName" as last_name,
    "Title" as job_title,
    cast("ReportsTo" as bigint) as reports_to_employee_id,
    cast("BirthDate" as timestamp) as birth_date,
    cast("HireDate" as timestamp) as hire_date,
    "Address" as address,
    "City" as city,
    "State" as state,
    "Country" as country,
    "PostalCode" as postal_code,
    "Phone" as phone,
    "Fax" as fax,
    "Email" as email
from {{ source('chinook', 'employee') }}
