/*
  # Add Dodo Payments Product ID

  1. Changes
    - Add `dodo_product_id` column to `subscription_plans` table to store Dodo Payments product IDs
    - Update Professional plan ($29.99) with the Dodo product ID
  
  2. Notes
    - This allows mapping between our internal plans and Dodo Payments products
    - Product ID: pdt_DaLdaNxagTtgUzAiUuLTa is for the $29.99 plan
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'dodo_product_id'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN dodo_product_id text;
  END IF;
END $$;

UPDATE subscription_plans
SET dodo_product_id = 'pdt_DaLdaNxagTtgUzAiUuLTa'
WHERE price_monthly = 29.99;
