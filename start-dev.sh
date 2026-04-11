#!/bin/bash
# ALIVE Development Startup Script

echo "🧬 ALIVE - Starting Development Environment"
echo "============================================"

# Check if backend is already running
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Backend already running on http://localhost:3001"
else
    echo "📦 Starting backend..."
    cd backend
    bun run src/index.ts > /tmp/backend.log 2>&1 &
    cd ..
    sleep 3
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo "✅ Backend started on http://localhost:3001"
    else
        echo "❌ Failed to start backend. Check /tmp/backend.log"
        exit 1
    fi
fi

# Check if frontend is already running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend already running on http://localhost:3000"
else
    echo "🎨 Starting frontend..."
    npm run dev > /tmp/frontend.log 2>&1 &
    sleep 5
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend started on http://localhost:3000"
    else
        echo "❌ Failed to start frontend. Check /tmp/frontend.log"
        exit 1
    fi
fi

echo ""
echo "============================================"
echo "🚀 ALIVE is ready!"
echo ""
echo "📱 App:      http://localhost:3000"
echo "🔌 API:      http://localhost:3001"
echo "📊 Logs:     /tmp/backend.log, /tmp/frontend.log"
echo "============================================"
