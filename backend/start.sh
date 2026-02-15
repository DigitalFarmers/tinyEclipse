#!/bin/sh

echo "=== TinyEclipse Backend Starting ==="
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."

echo "Waiting for database..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  python3 -c "
import sys
try:
    import asyncio, asyncpg
    async def check():
        url = '${DATABASE_URL}'.replace('+asyncpg','')
        conn = await asyncpg.connect(url)
        await conn.close()
        print('DB connected!')
    asyncio.run(check())
except Exception as e:
    print(f'DB not ready: {e}')
    sys.exit(1)
" && break
  echo "Retry $i/10..."
  sleep 3
done

echo "Running database migrations..."
alembic upgrade head || echo "WARNING: Alembic migration failed (may already be applied)"

echo "Starting TinyEclipse API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
