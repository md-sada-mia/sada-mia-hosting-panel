#!/bin/bash
# Local development script to start the panel

echo "Starting Sada Mia Hosting Panel locally..."

cd backend
export FRONTEND_URL="http://localhost:5173"
export APP_URL="http://localhost:8000"
php artisan serve --port=8000 &
BACKEND_PID=$!

cd ../frontend
npm run dev -- --port=5173 &
FRONTEND_PID=$!

echo "Backend running on http://localhost:8000"
echo "Frontend running on http://localhost:5173"

trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT
wait
