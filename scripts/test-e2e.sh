#!/bin/bash

# Hippo Equity Research App - End-to-End Test Script
# This script runs end-to-end tests to verify the complete system

set -e

echo "🧪 Hippo Equity Research App - End-to-End Test"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=${5:-200}
    
    echo -n "   Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected HTTP $expected_status, got HTTP $http_code)"
        echo "      Response: $body"
        return 1
    fi
}

# Check if services are running
echo "🔍 Checking if services are running..."
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${RED}❌ Services are not running. Please start them first with ./scripts/start.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Test 1: Health Check
echo ""
echo "1️⃣  Testing Health Check Endpoint"
echo "-----------------------------------"
test_endpoint "API Gateway Health" "GET" "http://localhost:3000/health" "" 200
test_endpoint "Data Service Health" "GET" "http://localhost:3001/health" "" 200
test_endpoint "Translation Service Health" "GET" "http://localhost:3004/health" "" 200
test_endpoint "User Service Health" "GET" "http://localhost:3005/health" "" 200

# Test 2: API Gateway Root
echo ""
echo "2️⃣  Testing API Gateway"
echo "-----------------------"
test_endpoint "API Gateway Root" "GET" "http://localhost:3000/" "" 200

# Test 3: Translation Service
echo ""
echo "3️⃣  Testing Translation Service"
echo "--------------------------------"
test_endpoint "Get Available Languages" "GET" "http://localhost:3004/languages" "" 200
test_endpoint "Translate String" "POST" "http://localhost:3004/translate" '{"key":"ui.dashboard","language":"en"}' 200

# Test 4: User Service
echo ""
echo "4️⃣  Testing User Service"
echo "------------------------"
test_endpoint "Set Language Preference" "POST" "http://localhost:3005/preferences/language" '{"userId":"test-user","language":"he"}' 200
test_endpoint "Get Language Preference" "GET" "http://localhost:3005/preferences/language/test-user" "" 200

# Test 5: Data Service
echo ""
echo "5️⃣  Testing Data Service"
echo "-------------------------"
test_endpoint "Get Stock Data (via API Gateway)" "GET" "http://localhost:3000/api/data/stock/AAPL?language=en" "" 200

# Test 6: API Documentation
echo ""
echo "6️⃣  Testing API Documentation"
echo "-----------------------------"
test_endpoint "OpenAPI Spec" "GET" "http://localhost:3000/api-docs/openapi.yaml" "" 200
test_endpoint "Swagger UI" "GET" "http://localhost:3000/api-docs" "" 200

# Test 7: Frontend
echo ""
echo "7️⃣  Testing Frontend"
echo "--------------------"
test_endpoint "Frontend" "GET" "http://localhost:5173" "" 200

echo ""
echo "=============================================="
echo -e "${GREEN}✅ End-to-End Test Complete!${NC}"
echo ""
echo "📋 Summary:"
echo "   - All critical endpoints tested"
echo "   - Services are responding correctly"
echo ""
echo "🌐 Access the application:"
echo "   - Frontend: http://localhost:5173"
echo "   - API Documentation: http://localhost:3000/api-docs"
echo "   - Health Check: http://localhost:3000/health"
echo ""

