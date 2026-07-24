-- RestauranteOS.V1 - Cleanup for Order Security Locking
-- This script marks all items of already completed orders as completed.

UPDATE order_items 
SET completed = 1 
WHERE order_id IN (SELECT id FROM orders WHERE status = 'completed');

-- Optional: Verify the update
-- SELECT COUNT(*) FROM order_items WHERE completed = 1;
