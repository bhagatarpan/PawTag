#!/bin/bash
# PawTag Backup and Restore Rehearsal Script
# Usage: ./scripts/backup-restore-rehearsal.sh [backup|restore|verify|full]

set -e

echo "=== PawTag Backup and Restore Rehearsal ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/pawtag}"

# Check if mongodump/mongorestore are available
if ! command -v mongodump &> /dev/null; then
    echo -e "${RED}Error: mongodump is not installed or not in PATH${NC}"
    echo "Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools"
    exit 1
fi

if ! command -v mongorestore &> /dev/null; then
    echo -e "${RED}Error: mongorestore is not installed or not in PATH${NC}"
    echo "Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools"
    exit 1
fi

# Function: Take backup
take_backup() {
    echo -e "${YELLOW}Taking backup...${NC}"
    echo "Database: $MONGODB_URI"
    echo "Backup directory: $BACKUP_DIR"
    echo ""
    
    mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Backup completed successfully${NC}"
        echo "Backup location: $BACKUP_DIR"
        echo ""
        echo "Backup contents:"
        ls -la "$BACKUP_DIR"
    else
        echo -e "${RED}Backup failed${NC}"
        exit 1
    fi
}

# Function: Record current state
record_state() {
    echo -e "${YELLOW}Recording current database state...${NC}"
    echo ""
    
    mongosh "$MONGODB_URI" --quiet --eval "
        print('=== Current Database State ===');
        print('Users:', db.users.countDocuments());
        print('Pets:', db.pets.countDocuments());
        print('Tags:', db.tags.countDocuments());
        print('Orders:', db.orders.countDocuments());
        print('Carts:', db.carts.countDocuments());
        print('Notifications:', db.notifications.countDocuments());
        print('Products:', db.products.countDocuments());
        print('Subscriptions:', db.subscriptions.countDocuments());
        print('');
        print('Timestamp:', new Date().toISOString());
    "
}

# Function: Restore from backup
restore_backup() {
    local backup_path="${1:-$BACKUP_DIR}"
    
    echo -e "${YELLOW}Restoring from backup...${NC}"
    echo "Backup location: $backup_path"
    echo "Target database: $MONGODB_URI"
    echo ""
    
    if [ ! -d "$backup_path" ]; then
        echo -e "${RED}Error: Backup directory not found: $backup_path${NC}"
        exit 1
    fi
    
    mongorestore --uri="$MONGODB_URI" --drop "$backup_path"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Restore completed successfully${NC}"
    else
        echo -e "${RED}Restore failed${NC}"
        exit 1
    fi
}

# Function: Verify restored data
verify_restore() {
    echo -e "${YELLOW}Verifying restored data...${NC}"
    echo ""
    
    mongosh "$MONGODB_URI" --quiet --eval "
        print('=== Post-Restore Verification ===');
        
        const counts = {
            users: db.users.countDocuments(),
            pets: db.pets.countDocuments(),
            tags: db.tags.countDocuments(),
            orders: db.orders.countDocuments(),
            carts: db.carts.countDocuments(),
            notifications: db.notifications.countDocuments(),
            products: db.products.countDocuments(),
            subscriptions: db.subscriptions.countDocuments()
        };
        
        print('Users:', counts.users);
        print('Pets:', counts.pets);
        print('Tags:', counts.tags);
        print('Orders:', counts.orders);
        print('Carts:', counts.carts);
        print('Notifications:', counts.notifications);
        print('Products:', counts.products);
        print('Subscriptions:', counts.subscriptions);
        
        // Verify relationships
        print('');
        print('=== Relationship Verification ===');
        
        const petsWithOwners = db.pets.countDocuments({ ownerId: { \$exists: true } });
        print('Pets with owner reference:', petsWithOwners);
        
        const tagsWithPets = db.tags.countDocuments({ petId: { \$exists: true } });
        print('Tags with pet reference:', tagsWithPets);
        
        const ordersWithUsers = db.orders.countDocuments({ userId: { \$exists: true } });
        print('Orders with user reference:', ordersWithUsers);
        
        print('');
        print('=== Verification Complete ===');
        print('Timestamp:', new Date().toISOString());
    "
}

# Function: Simulate data loss (for testing)
simulate_data_loss() {
    echo -e "${YELLOW}Simulating data loss (for testing only)...${NC}"
    echo ""
    
    mongosh "$MONGODB_URI" --quiet --eval "
        print('=== Simulating Data Loss ===');
        
        // Delete a pet
        const petResult = db.pets.deleteOne({ name: 'Test Pet' });
        print('Deleted pet:', petResult.deletedCount);
        
        // Delete an order
        const orderResult = db.orders.deleteOne({ orderNumber: 'PT-TEST-001' });
        print('Deleted order:', orderResult.deletedCount);
        
        // Corrupt a user
        const userResult = db.users.updateOne(
            { email: 'test@example.com' },
            { \$set: { fullName: 'CORRUPTED' } }
        );
        print('Corrupted user:', userResult.modifiedCount);
        
        print('');
        print('Data loss simulated. Run restore to recover.');
    "
}

# Function: Full rehearsal
full_rehearsal() {
    echo -e "${YELLOW}Starting full backup/restore rehearsal...${NC}"
    echo ""
    
    # Step 1: Record initial state
    echo "Step 1: Recording initial state..."
    record_state
    echo ""
    
    # Step 2: Take backup
    echo "Step 2: Taking backup..."
    take_backup
    echo ""
    
    # Step 3: Simulate data loss
    echo "Step 3: Simulating data loss..."
    simulate_data_loss
    echo ""
    
    # Step 4: Record damaged state
    echo "Step 4: Recording damaged state..."
    record_state
    echo ""
    
    # Step 5: Restore from backup
    echo "Step 5: Restoring from backup..."
    restore_backup "$BACKUP_DIR"
    echo ""
    
    # Step 6: Verify restored data
    echo "Step 6: Verifying restored data..."
    verify_restore
    echo ""
    
    echo -e "${GREEN}=== Rehearsal Complete ===${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review the output above"
    echo "2. Verify all counts match pre-loss state"
    echo "3. Test application functionality"
    echo "4. Document results in docs/BACKUP-RESTORE-REHEARSAL.md"
}

# Parse command
case "${1:-help}" in
    backup)
        take_backup
        ;;
    restore)
        restore_backup "${2:-$BACKUP_DIR}"
        ;;
    verify)
        verify_restore
        ;;
    state)
        record_state
        ;;
    loss)
        simulate_data_loss
        ;;
    full)
        full_rehearsal
        ;;
    help|*)
        echo "Usage: $0 [backup|restore|verify|state|loss|full]"
        echo ""
        echo "Commands:"
        echo "  backup    - Take a backup of the database"
        echo "  restore   - Restore from backup (optionally specify backup dir)"
        echo "  verify    - Verify restored data integrity"
        echo "  state     - Record current database state"
        echo "  loss      - Simulate data loss (for testing)"
        echo "  full      - Run full backup/restore rehearsal"
        echo ""
        echo "Environment variables:"
        echo "  MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/pawtag)"
        echo ""
        echo "Examples:"
        echo "  $0 backup"
        echo "  $0 restore ./backup-20260919-120000"
        echo "  MONGODB_URI=mongodb+srv://... $0 full"
        ;;
esac
