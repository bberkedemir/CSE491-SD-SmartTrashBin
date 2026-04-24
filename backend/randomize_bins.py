"""Randomize fill levels for all bins. Run from backend/ with: python randomize_bins.py"""
import random
import argparse
from app.core.database import SessionLocal
from app.models.bin import Bin


def main():
    parser = argparse.ArgumentParser(description="Randomize bin fill levels.")
    parser.add_argument("--min", type=int, default=0, help="minimum fill (default 0)")
    parser.add_argument("--max", type=int, default=100, help="maximum fill (default 100)")
    parser.add_argument(
        "--bias-full",
        action="store_true",
        help="bias toward higher fills so routes have more pickups",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        bins = db.query(Bin).all()
        if not bins:
            print("No bins in database.")
            return

        for b in bins:
            if args.bias_full:
                # 60% chance to be above the 75% pickup threshold
                b.fill = random.randint(75, 100) if random.random() < 0.6 else random.randint(args.min, 74)
            else:
                b.fill = random.randint(args.min, args.max)

        db.commit()
        print(f"Randomized {len(bins)} bins.")
        for b in bins:
            print(f"  #{b.id:>3}  {b.title:<30}  {b.fill}%")
    finally:
        db.close()


if __name__ == "__main__":
    main()
