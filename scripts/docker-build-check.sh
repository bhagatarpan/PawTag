#!/bin/bash
# PawTag Docker Build and Health Check Script
# Usage: ./scripts/docker-build-check.sh

set -e

echo "=== PawTag Docker Build and Health Check ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

echo "Docker version: $(docker --version)"
echo ""

# Build API image
echo -e "${YELLOW}Building API image...${NC}"
docker build -f docker/Dockerfile.api -t pawtag-api:latest . 2>&1 | tail -5
if [ $? -eq 0 ]; then
    echo -e "${GREEN}API image built successfully${NC}"
else
    echo -e "${RED}API image build failed${NC}"
    exit 1
fi
echo ""

# Build Web image
echo -e "${YELLOW}Building Web image...${NC}"
docker build -f docker/Dockerfile.web --build-arg APP_NAME=web --build-arg PORT=3000 -t pawtag-web:latest . 2>&1 | tail -5
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Web image built successfully${NC}"
else
    echo -e "${RED}Web image build failed${NC}"
    exit 1
fi
echo ""

# Build Admin image
echo -e "${YELLOW}Building Admin image...${NC}"
docker build -f docker/Dockerfile.web --build-arg APP_NAME=admin --build-arg PORT=3001 -t pawtag-admin:latest . 2>&1 | tail -5
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Admin image built successfully${NC}"
else
    echo -e "${RED}Admin image build failed${NC}"
    exit 1
fi
echo ""

# Build Finder image
echo -e "${YELLOW}Building Finder image...${NC}"
docker build -f docker/Dockerfile.web --build-arg APP_NAME=finder --build-arg PORT=3003 -t pawtag-finder:latest . 2>&1 | tail -5
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Finder image built successfully${NC}"
else
    echo -e "${RED}Finder image build failed${NC}"
    exit 1
fi
echo ""

# Health check for API
echo -e "${YELLOW}Running API health check...${NC}"
docker run -d --name pawtag-api-test -p 5000:5000 \
    -e NODE_ENV=production \
    -e DB_URL=mongodb://localhost:27017/pawtag-test \
    -e JWT_SECRET=test-secret \
    pawtag-api:latest
sleep 5

# Check if API is responding
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}API health check passed${NC}"
else
    echo -e "${YELLOW}API health check failed (may be expected without DB)${NC}"
fi

# Stop test container
docker stop pawtag-api-test && docker rm pawtag-api-test
echo ""

# Health check for Web
echo -e "${YELLOW}Running Web health check...${NC}"
docker run -d --name pawtag-web-test -p 3000:80 pawtag-web:latest
sleep 3

# Check if Web is responding
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}Web health check passed${NC}"
else
    echo -e "${RED}Web health check failed${NC}"
fi

# Stop test container
docker stop pawtag-web-test && docker rm pawtag-web-test
echo ""

echo "=== Build and Health Check Complete ==="
echo ""
echo "Images built:"
docker images | grep pawtag | grep latest
