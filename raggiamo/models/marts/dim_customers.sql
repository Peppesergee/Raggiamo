with customers as (
    select * from {{ ref('stg_chinook__customers') }}
),

employees as (
    select * from {{ ref('stg_chinook__employees') }}
),

final as (
    select
        customers.customer_id,
        customers.first_name || ' ' || customers.last_name as customer_name,
        customers.company,
        customers.city,
        customers.state,
        customers.country,
        customers.email,
        employees.employee_id as support_rep_employee_id,
        employees.first_name || ' ' || employees.last_name as support_rep_name
    from customers
    left join employees on customers.support_rep_employee_id = employees.employee_id
)

select * from final
