#!/bin/sh

echo "=== TinyEclipse Backend Starting ==="
echo "Python: $(python3 --version)"
echo "Time: $(date -u)"

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

echo "Running database migrations (timeout 60s)..."
timeout 60 alembic upgrade head 2>&1
ALEMBIC_EXIT=$?
if [ $ALEMBIC_EXIT -ne 0 ]; then
    echo "WARNING: Alembic exit code $ALEMBIC_EXIT (may already be applied or timed out)"
fi

echo "Verifying app import..."
python3 -c "
try:
    from app.main import app
    print(f'App loaded OK — {len(app.routes)} routes')
except Exception as e:
    print(f'App import FAILED: {e}')
    import traceback
    traceback.print_exc()
"

echo "Starting TinyEclipse API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
