#!/bin/sh
echo "=== TinyEclipse Backend Starting ==="
echo "Python: $(python3 --version 2>&1)"

# Wait for database (5 retries, fast)
python3 -c "
import asyncio, time, os, sys
async def wait():
    import asyncpg
    url = os.environ.get('DATABASE_URL','').replace('+asyncpg','')
    for i in range(5):
        try:
            conn = await asyncpg.connect(url)
            await conn.close()
            print('DB ready')
            return
        except:
            time.sleep(2)
    print('DB not ready — starting anyway')
asyncio.run(wait())
" 2>&1 || true

# Run migrations in background (non-blocking)
python3 -c "
import subprocess
try:
    r = subprocess.run(['alembic','upgrade','head'], capture_output=True, text=True, timeout=30)
    if r.returncode == 0:
        print('Migrations OK')
    else:
        print(f'Migration warning: {r.stderr[-500:]}')
except Exception as e:
    print(f'Migration skipped: {e}')
" 2>&1 || true

echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
