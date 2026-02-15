#!/bin/sh

echo "=== TinyEclipse Backend Starting ==="

echo "Waiting for database..."
python3 -c "
import sys, asyncio, time, os
async def wait_for_db():
    import asyncpg
    url = os.environ.get('DATABASE_URL','').replace('+asyncpg','')
    for i in range(10):
        try:
            conn = await asyncpg.connect(url)
            await conn.close()
            print('DB connected!')
            return
        except Exception as e:
            print(f'DB not ready ({i+1}/10): {e}')
            time.sleep(3)
    print('ERROR: Could not connect to DB after 10 retries')
    sys.exit(1)
asyncio.run(wait_for_db())
"

echo "Running database migrations..."
alembic upgrade head || echo "WARNING: Alembic migration failed (may already be applied)"

echo "Starting TinyEclipse API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
