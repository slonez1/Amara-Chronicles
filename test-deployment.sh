#!/bin/bash

# Local Deployment Test Script for Amara Chronicles
# This script helps verify the app works before deploying to Cloud Run

set -e

echo "==================================="
echo "Amara Chronicles - Local Test Script"
echo "==================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker is installed"

# Check if .env.local exists and has required keys
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Creating from example..."
    cp .env.example .env.local
    echo "📝 Please edit .env.local and add your API keys"
    exit 1
fi

# Check for API keys in .env.local
if grep -q "your_gemini_api_key_here" .env.local; then
    echo "❌ Please set your GEMINI_API_KEY in .env.local"
    exit 1
fi

echo "✅ Environment file configured"
echo ""

# Test local build first
echo "Step 1: Testing local build..."
if npm run build; then
    echo "✅ Local build successful"
else
    echo "❌ Local build failed. Please fix build errors before deploying."
    exit 1
fi

echo ""
echo "Step 2: Building Docker image..."
if docker build -t amara-chronicles-test:latest .; then
    echo "✅ Docker build successful"
else
    echo "❌ Docker build failed."
    exit 1
fi

echo ""
echo "Step 3: Starting container on port 8080..."
echo "   Access at: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the container"
echo ""

# Run the container with environment variables from .env.local
docker run --rm -p 8080:8080 \
  --env-file .env.local \
  amara-chronicles-test:latest

echo ""
echo "Container stopped."
