#!/bin/sh

echo "=== TinyEclipse Backend Starting ==="
echo "Python: $(python3 --version 2>&1)"
echo "Time: $(date -u 2>/dev/null || echo unknown)"

# Step 1: Wait for database
echo "[1/4] Waiting for database..."
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
            return True
        except Exception as e:
            print(f'DB not ready ({i+1}/10): {e}')
            time.sleep(3)
    return False
if not asyncio.run(wait_for_db()):
    print('WARNING: DB not available, skipping migrations')
    sys.exit(1)
" || { echo "DB wait failed, starting uvicorn anyway..."; }

# Step 2: Run migrations with Python-based timeout
echo "[2/4] Running database migrations..."
python3 -c "
import subprocess, sys
try:
    result = subprocess.run(
        ['alembic', 'upgrade', 'head'],
        capture_output=True, text=True, timeout=45
    )
    print(result.stdout[-2000:] if result.stdout else '')
    if result.returncode != 0:
        print(f'Alembic stderr: {result.stderr[-2000:]}')
        print(f'WARNING: Alembic exit code {result.returncode}')
    else:
        print('Migrations OK')
except subprocess.TimeoutExpired:
    print('WARNING: Alembic timed out after 45s — skipping')
except Exception as e:
    print(f'WARNING: Alembic error: {e}')
"

# Step 3: Verify app can import
echo "[3/4] Verifying app import..."
python3 -c "
try:
    from app.main import app
    print(f'App loaded OK — {len(app.routes)} routes')
except Exception as e:
    print(f'App import FAILED: {e}')
    import traceback
    traceback.print_exc()
"

# Step 4: Start uvicorn
echo "[4/4] Starting TinyEclipse API on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
