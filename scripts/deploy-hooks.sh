#!/bin/bash

echo "🚀 XRPL Hooks Deployment Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create a .env file with required variables"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '#' | xargs)

# Verify required environment variables
if [ -z "$XRPL_HOOK_ACCOUNT_SECRET" ]; then
    echo -e "${RED}❌ Error: XRPL_HOOK_ACCOUNT_SECRET not set in .env${NC}"
    echo "Please add your XRPL account secret to .env file"
    exit 1
fi

if [ -z "$XRPL_NETWORK" ]; then
    export XRPL_NETWORK="testnet"
fi

echo -e "${GREEN}📝 Configuration:${NC}"
echo "   Network: $XRPL_NETWORK"
echo ""

# Check if Rust and Cargo are installed
if ! command -v cargo &> /dev/null; then
    echo -e "${YELLOW}⚙️  Rust/Cargo not found. Installing...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Verify Rust installation
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Failed to install Rust${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Rust/Cargo installed${NC}"
echo ""

# Check if xrpl-hooks CLI is installed
if ! command -v xrpl-hooks &> /dev/null; then
    echo -e "${YELLOW}⚙️  Installing xrpl-hooks CLI...${NC}"
    cargo install xrpl-hooks-cli
fi

# Verify xrpl-hooks installation
if ! command -v xrpl-hooks &> /dev/null; then
    echo -e "${RED}❌ Failed to install xrpl-hooks CLI${NC}"
    exit 1
fi

echo -e "${GREEN}✅ xrpl-hooks CLI installed${NC}"
echo ""

# Create hooks directory if it doesn't exist
mkdir -p hooks

# Check if hook source exists
HOOK_FILE="hooks/escrow_hook.rs"
if [ ! -f "$HOOK_FILE" ]; then
    echo -e "${YELLOW}⚠️  Hook source not found. Creating template...${NC}"
    
    cat > "$HOOK_FILE" << 'EOF'
// XRP Escrow Hook for Liquid Staking
// This hook locks XRP in escrow and emits an event for the Flare bridge

use xrpl_hooks::*;

#[no_mangle]
pub extern "C" fn hook(reserved: u32) -> i64 {
    // Hook implementation
    // TODO: Implement escrow logic
    // 1. Validate incoming payment
    // 2. Lock XRP in escrow
    // 3. Emit event for Flare bridge
    // 4. Return success
    
    accept(0)
}
EOF
    
    echo -e "${GREEN}✅ Hook template created at $HOOK_FILE${NC}"
    echo -e "${YELLOW}⚠️  Please implement the hook logic before deployment${NC}"
    exit 0
fi

# Compile the hook
echo -e "${YELLOW}🔨 Compiling hook...${NC}"
cd hooks
cargo build --release --target wasm32-unknown-unknown

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Hook compilation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Hook compiled successfully${NC}"
cd ..

# Deploy the hook
echo ""
echo -e "${YELLOW}🚀 Deploying hook to XRPL $XRPL_NETWORK...${NC}"

# Set XRPL network URL
if [ "$XRPL_NETWORK" == "mainnet" ]; then
    XRPL_URL="wss://xrplcluster.com"
else
    XRPL_URL="wss://s.altnet.rippletest.net:51233"
fi

# Deploy using xrpl-hooks CLI
xrpl-hooks deploy \
    --network "$XRPL_URL" \
    --secret "$XRPL_HOOK_ACCOUNT_SECRET" \
    --hook hooks/target/wasm32-unknown-unknown/release/escrow_hook.wasm

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Hook deployed successfully!${NC}"
    echo ""
    echo "📋 NEXT STEPS:"
    echo "1. Test the hook with a small XRP payment"
    echo "2. Verify escrow creation on XRPL explorer"
    echo "3. Configure Flare bridge to listen for hook events"
    echo "4. Update frontend with hook account address"
else
    echo ""
    echo -e "${RED}❌ Hook deployment failed${NC}"
    echo "Please check your XRPL account has sufficient XRP for fees"
    exit 1
fi
