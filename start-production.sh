#!/bin/bash

# Production deployment script for Vendor Payout Application

echo "🚀 Starting production deployment for Vendor Payout..."

mkdir -p logs temp uploads
chmod 755 logs temp uploads

export NODE_ENV=production

echo "🧹 Cleaning previous PM2 processes..."
pm2 delete vendor-payout-app 2>/dev/null || echo "No previous process to clean"

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
