#!/bin/bash
# Run once: sudo bash scripts/setup-db.sh
set -e

DB_USER="voices_user"
DB_PASS="voices_dev_2026"
DB_NAME="voices"

echo "Creating PostgreSQL user and database..."

sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
CREATE DATABASE IF NOT EXISTS ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

echo "Done. Connection string:"
echo "postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
