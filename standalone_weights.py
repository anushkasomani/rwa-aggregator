#!/usr/bin/env python3
"""
Standalone script to compute portfolio weights using the weight_decider module.
Can be run independently outside of Claude.

Usage:
    python standalone_weights.py
    python standalone_weights.py --plan config/custom_plan.json
    python standalone_weights.py --output my_weights.json
"""

import json
import argparse
import sys
import os
from pathlib import Path

# Add the current directory to Python path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

try:
    from agent.weight_decider import compute_weights_now
except ImportError as e:
    print(f"Error importing weight_decider: {e}")
    print("Make sure you're running this from the rwa-aggregator directory")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Compute portfolio weights')
    parser.add_argument('--plan', 
                       default='config/sample_plan.json',
                       help='Path to the plan JSON file (default: config/sample_plan.json)')
    parser.add_argument('--output', 
                       help='Output file path (optional)')
    parser.add_argument('--pretty', 
                       action='store_true',
                       help='Pretty print the output')
    parser.add_argument('--summary', 
                       action='store_true',
                       help='Show only summary information')
    
    args = parser.parse_args()
    
    # Check if plan file exists
    if not os.path.exists(args.plan):
        print(f"Error: Plan file '{args.plan}' not found")
        sys.exit(1)
    
    try:
        # Load the plan
        with open(args.plan, 'r') as f:
            plan = json.load(f)
        
        print(f"Computing weights using plan: {args.plan}")
        print("=" * 60)
        
        # Run the computation
        result = compute_weights_now(plan)
        
        if args.summary:
            # Show summary only
            print(f"As of: {result['as_of']}")
            print(f"Target Weights: {result['target_weights']}")
            print(f"Eligibility: {result['eligibility']}")
            print(f"Scores: {result['scores']}")
            
            print("\nExplanations:")
            for asset, bullets in result['explain'].items():
                print(f"  {asset}: {bullets}")
                
            if result['warnings']:
                print(f"\nWarnings: {result['warnings']}")
        else:
            # Show full output
            if args.pretty:
                import pprint
                pprint.pprint(result)
            else:
                print(json.dumps(result, indent=2))
        
        # Save to file if requested
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\nResults saved to: {args.output}")
        
        print("=" * 60)
        print("Computation completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()