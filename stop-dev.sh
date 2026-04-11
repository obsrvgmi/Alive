#!/bin/bash
# ALIVE Development Stop Script

echo "🛑 Stopping ALIVE services..."

# Stop frontend
pkill -f "next dev" 2>/dev/null && echo "✅ Frontend stopped" || echo "⚠️ Frontend was not running"

# Stop backend
pkill -f "bun run src/index.ts" 2>/dev/null && echo "✅ Backend stopped" || echo "⚠️ Backend was not running"

echo "Done."
