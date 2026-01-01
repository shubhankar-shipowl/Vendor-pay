#!/bin/bash

# Production deployment script for Vendor Payout Application

echo "🚀 Starting production deployment for Vendor Payout..."

mkdir -p logs temp uploads
chmod 755 logs temp uploads

export NODE_ENV=production

echo "🧹 Cleaning previous PM2 processes..."
# Ensure PM2 daemon is running
pm2 ping >/dev/null 2>&1 || pm2 resurrect >/dev/null 2>&1 || true

# Stop and delete the PM2 process
pm2 stop vendor-payout-app 2>/dev/null || true
pm2 delete vendor-payout-app 2>/dev/null || echo "No previous process to clean"

# Give PM2 time to fully stop the process
sleep 2

# Load PORT from .env if it exists, otherwise use default
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep PORT | xargs) 2>/dev/null || true
fi
PORT=${PORT:-5000}
echo "🔍 Checking for processes on port $PORT..."

# Function to kill process on a port
kill_port() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
      echo "⚠️  Found process $PID using port $port, killing it..."
      kill -9 $PID 2>/dev/null || true
      return 0
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k $port/tcp 2>/dev/null || true
    return 0
  fi
  return 1
}

# Kill any process using the configured port
kill_port $PORT

# Also check common ports (3000, 5000) in case of misconfiguration
if [ "$PORT" != "3000" ]; then
  kill_port 3000
fi
if [ "$PORT" != "5000" ]; then
  kill_port 5000
fi

# Wait a moment for ports to be released
sleep 2

echo "📥 Installing dependencies (including dev dependencies for build)..."
npm ci --include=dev || npm install --include=dev

echo "📦 Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
else
    echo "❌ Build failed"
    exit 1
fi

if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found."
    echo "💡 Copy .env.example to .env and update it"
fi

echo "🔄 Starting application with PM2..."
pm2 start ecosystem.config.cjs --env production

echo "💾 Saving PM2 configuration..."
pm2 save

echo "📊 PM2 Status:"
pm2 list

echo "📝 Recent logs:"
pm2 logs vendor-payout-app --lines 15

echo "🏥 Performing health check..."
sleep 5
if pm2 show vendor-payout-app | grep -q "online"; then
    echo "✅ Application is running successfully!"
else
    echo "❌ Application failed to start properly"
    echo "🔍 Check logs with: pm2 logs vendor-payout-app"
    exit 1
fi

echo "🎉 Vendor Payout deployment completed successfully!"
