
#!/bin/bash

export_dir="./DATABASE"

# Export complete database (schema + data)
PGPASSWORD="${PGPASSWORD}" pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" > "${export_dir}/complete.sql"

# Export only data
PGPASSWORD="${PGPASSWORD}" pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" --data-only > "${export_dir}/solo_data.sql"

# Export only schema
PGPASSWORD="${PGPASSWORD}" pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" --schema-only > "${export_dir}/solo_raw.sql"

echo "Esporzione completata con successo!"
