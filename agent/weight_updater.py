#!/usr/bin/env python3
"""
Simple Weight Updater Service

This script:
1. Fetches active strategies from Supabase database
2. Calculates weights for each strategy using weight_decider.py
3. Updates the database with new weights
4. Can run once or in daemon mode
"""

import os
import sys
import json
import time
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

# Load environment variables from services/.env
load_dotenv("services/.env")

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py not installed. Install with: pip install supabase")
    sys.exit(1)

# Import weight calculation function
from agent.weight_decider import compute_weights_now

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s"
)
log = logging.getLogger("weight-updater")

class WeightUpdater:
    def __init__(self):
        """Initialize the weight updater with database connection."""
        # Get Supabase credentials
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE", "")
        
        if not self.supabase_url or not self.supabase_key:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in services/.env")
        
        # Create Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        log.info(f"Connected to Supabase: {self.supabase_url}")
        
        # Get CryptoPanic key for sentiment data
        self.cp_key = os.getenv("CP_AUTH_TOKEN", "")
        if not self.cp_key:
            log.warning("CP_AUTH_TOKEN not found, sentiment analysis will be limited")
    
    def get_active_strategies(self) -> List[Dict]:
        """Fetch all active strategies from the database."""
        try:
            result = self.supabase.table("strategies").select("*").eq("status", "active").execute()
            strategies = result.data or []
            log.info(f"Found {len(strategies)} active strategies")
            return strategies
        except Exception as e:
            log.error(f"Failed to fetch strategies: {e}")
            return []
    
    def calculate_weights_for_strategy(self, strategy: Dict) -> Optional[Dict]:
        """Calculate weights for a single strategy using weight_decider."""
        try:
            strategy_id = strategy["id"]
            strategy_name = strategy["name"]
            plan_json = strategy["plan_json"]
            
            log.info(f"Calculating weights for strategy {strategy_name} ({strategy_id})")
            
            # Extract universe from plan
            universe = plan_json.get("universe") or plan_json.get("universe_list", [])
            log.info(f"  Universe: {universe}")
            
            # Call weight_decider with the plan
            weights_result = compute_weights_now(
                plan=plan_json,
                cp_key=self.cp_key if self.cp_key else None
            )
            
            # Extract target weights
            target_weights = weights_result.get("target_weights", {})
            eligibility = weights_result.get("eligibility", {})
            scores = weights_result.get("scores", {})
            
            log.info(f"  Calculated weights: {target_weights}")
            log.info(f"  Eligibility: {eligibility}")
            log.info(f"  Scores: {scores}")
            
            return {
                "target_weights": target_weights,
                "eligibility": eligibility,
                "scores": scores,
                "as_of": weights_result.get("as_of"),
                "features_used": weights_result.get("features_used", []),
                "warnings": weights_result.get("warnings", [])
            }
            
        except Exception as e:
            log.error(f"Failed to calculate weights for strategy {strategy.get('id', 'unknown')}: {e}")
            return None
    
    def convert_weights_to_array_format(self, strategy: Dict, target_weights: Dict) -> List:
        """Convert target weights dict to array format expected by database."""
        # Get universe from strategy plan
        plan_json = strategy.get("plan_json", {})
        universe = plan_json.get("universe") or plan_json.get("universe_list", [])
        
        # Create array in same order as universe
        weights_array = []
        for asset in universe:
            weight = target_weights.get(asset, 0.0)
            weights_array.append(float(weight))
        
        log.info(f"  Converted weights to array format:")
        for i, asset in enumerate(universe):
            log.info(f"    {asset}: {weights_array[i]:.4f}")
            
        return weights_array

    def update_strategy_weights(self, strategy_id: str, strategy: Dict, weights_data: Dict) -> bool:
        """Update strategy weights in the database."""
        try:
            # Convert target weights to array format
            weights_array = self.convert_weights_to_array_format(strategy, weights_data["target_weights"])
            
            # Prepare update data
            update_data = {
                "weights": weights_array,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Store original weights dict in plan_json for reference
            plan_json = strategy.get("plan_json", {}).copy()
            plan_json["computed_weights"] = weights_data["target_weights"]
            plan_json["weights_metadata"] = {
                "calculated_at": weights_data.get("as_of"),
                "eligibility": weights_data.get("eligibility"),
                "scores": weights_data.get("scores")
            }
            update_data["plan_json"] = plan_json
            
            # Update the database
            result = self.supabase.table("strategies").update(update_data).eq("id", strategy_id).execute()
            
            if result.data:
                log.info(f"  ✓ Updated weights in database for strategy {strategy_id}")
                log.info(f"    Array format: {weights_array}")
                return True
            else:
                log.error(f"  ✗ Failed to update weights for strategy {strategy_id}")
                return False
                
        except Exception as e:
            log.error(f"Failed to update database for strategy {strategy_id}: {e}")
            return False
    
    def should_update_weights(self, strategy: Dict, new_weights: Dict) -> bool:
        """Determine if weights should be updated based on change threshold."""
        current_weights_array = strategy.get("weights")
        
        # If no current weights, always update
        if not current_weights_array:
            log.info(f"  No existing weights, will update")
            return True
        
        # Convert current weights array to dict for comparison
        plan_json = strategy.get("plan_json", {})
        universe = plan_json.get("universe") or plan_json.get("universe_list", [])
        
        if len(current_weights_array) != len(universe):
            log.info(f"  Weights array length mismatch, will update")
            return True
        
        # Create current weights dict from array
        current_weights_dict = {}
        for i, asset in enumerate(universe):
            current_weights_dict[asset] = current_weights_array[i]
        
        # Compare new vs current weights
        new_target = new_weights["target_weights"]
        
        # Simple change detection: check if any weight changed by more than 2%
        threshold = 0.02
        significant_change = False
        
        # Check all assets in both old and new weights
        all_assets = set(current_weights_dict.keys()) | set(new_target.keys())
        
        for asset in all_assets:
            old_weight = current_weights_dict.get(asset, 0.0)
            new_weight = new_target.get(asset, 0.0)
            change = abs(new_weight - old_weight)
            
            if change > threshold:
                log.info(f"  Significant change in {asset}: {old_weight:.3f} → {new_weight:.3f} (Δ{change:.3f})")
                significant_change = True
        
        if not significant_change:
            log.info(f"  No significant changes (threshold={threshold}), skipping update")
        
        return significant_change
    
    def update_all_weights(self, force_update: bool = False) -> Dict:
        """Update weights for all active strategies."""
        log.info("=" * 60)
        log.info("Starting weight update cycle")
        
        strategies = self.get_active_strategies()
        if not strategies:
            log.warning("No active strategies found")
            return {"updated": 0, "skipped": 0, "failed": 0}
        
        stats = {"updated": 0, "skipped": 0, "failed": 0}
        
        for strategy in strategies:
            strategy_id = strategy["id"]
            strategy_name = strategy["name"]
            
            log.info(f"\nProcessing strategy: {strategy_name} ({strategy_id})")
            
            # Calculate new weights
            weights_data = self.calculate_weights_for_strategy(strategy)
            if not weights_data:
                log.error(f"  ✗ Weight calculation failed")
                stats["failed"] += 1
                continue
            
            # Check if update is needed
            if not force_update and not self.should_update_weights(strategy, weights_data):
                log.info(f"  ⏭ Skipping update (no significant changes)")
                stats["skipped"] += 1
                continue
            
            # Update database
            if self.update_strategy_weights(strategy_id, strategy, weights_data):
                stats["updated"] += 1
            else:
                stats["failed"] += 1
        
        log.info(f"\nWeight update cycle complete: {stats}")
        return stats

def main():
    """Main function to handle command line arguments and run the updater."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Update strategy weights in database")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--daemon", action="store_true", help="Run continuously")
    parser.add_argument("--force", action="store_true", help="Force update all weights regardless of changes")
    parser.add_argument("--interval", type=int, default=120, help="Update interval in seconds (default: 120s/2min)")
    
    args = parser.parse_args()
    
    # Initialize updater
    try:
        updater = WeightUpdater()
    except Exception as e:
        log.error(f"Failed to initialize weight updater: {e}")
        return 1
    
    if args.daemon:
        log.info(f"Starting weight updater daemon (interval: {args.interval}s)")
        while True:
            try:
                updater.update_all_weights(force_update=args.force)
                log.info(f"Sleeping for {args.interval} seconds...")
                time.sleep(args.interval)
            except KeyboardInterrupt:
                log.info("Received interrupt signal, shutting down...")
                break
            except Exception as e:
                log.error(f"Error in daemon loop: {e}")
                log.info("Continuing after error...")
                time.sleep(60)  # Wait 1 minute before retrying
    else:
        # Run once
        try:
            stats = updater.update_all_weights(force_update=args.force)
            log.info(f"Weight update completed: {stats}")
            return 0
        except Exception as e:
            log.error(f"Weight update failed: {e}")
            return 1

if __name__ == "__main__":
    sys.exit(main())