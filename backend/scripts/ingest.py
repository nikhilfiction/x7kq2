"""
Download wind actuals (FUELHH) and wind forecasts (WINDFOR) from Elexon BMRS
for the January 2026 analysis window, and store them in data/wind.db.

Run from the backend folder:
    python scripts/ingest.py
"""

import sqlite3
import time
from datetime import date, timedelta
from pathlib import Path

import requests

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "wind.db"

# Decisions made in January 2026 are for delivery days 2 Jan to 1 Feb.
# Actuals: fetch 1 Jan to 1 Feb (settlement dates, inclusive).
ACTUALS_FROM = date(2026, 1, 1)
ACTUALS_TO = date(2026, 2, 1)

# Forecasts: fetch by publish date. Starting on 30 Dec gives enough history
# for the 48 hour horizon view on the first January delivery days.
FORECASTS_FROM = date(2025, 12, 30)
FORECASTS_TO = date(2026, 1, 31)


def days(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def get_json(dataset: str, params: dict, retries: int = 4) -> list:
    url = f"{BASE_URL}/{dataset}/stream"
    for attempt in range(retries):
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 429 or response.status_code >= 500:
            wait = 2 ** attempt
            print(f"  {response.status_code} from Elexon, retrying in {wait}s")
            time.sleep(wait)
            continue
        response.raise_for_status()
        payload = response.json()
        # Stream endpoints return a plain list, but handle {"data": [...]} too.
        return payload["data"] if isinstance(payload, dict) else payload
    raise RuntimeError(f"Elexon request failed after {retries} attempts: {url} {params}")


def create_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS actuals;
        DROP TABLE IF EXISTS forecasts;

        CREATE TABLE actuals (
            start_time        TEXT PRIMARY KEY,
            settlement_date   TEXT NOT NULL,
            settlement_period INTEGER NOT NULL,
            generation        REAL NOT NULL,
            publish_time      TEXT NOT NULL
        );

        CREATE TABLE forecasts (
            publish_time TEXT NOT NULL,
            start_time   TEXT NOT NULL,
            generation   REAL NOT NULL,
            PRIMARY KEY (publish_time, start_time)
        );

        CREATE INDEX idx_forecasts_start ON forecasts (start_time);
        """
    )


def ingest_actuals(conn: sqlite3.Connection) -> None:
    print("Fetching actuals (FUELHH, WIND)")
    for day in days(ACTUALS_FROM, ACTUALS_TO):
        rows = get_json(
            "FUELHH",
            {
                "settlementDateFrom": day.isoformat(),
                "settlementDateTo": day.isoformat(),
                "fuelType": "WIND",
            },
        )
        # If a slot was revised, keep the most recently published value.
        rows.sort(key=lambda r: r["publishTime"])
        conn.executemany(
            "INSERT OR REPLACE INTO actuals VALUES (?, ?, ?, ?, ?)",
            [
                (
                    r["startTime"],
                    r["settlementDate"],
                    r["settlementPeriod"],
                    r["generation"],
                    r["publishTime"],
                )
                for r in rows
                if r.get("fuelType") == "WIND"
            ],
        )
        print(f"  {day}: {len(rows)} rows")
        time.sleep(0.2)
    conn.commit()


def ingest_forecasts(conn: sqlite3.Connection) -> None:
    print("Fetching forecasts (WINDFOR)")
    for day in days(FORECASTS_FROM, FORECASTS_TO):
        rows = get_json(
            "WINDFOR",
            {
                "publishDateTimeFrom": f"{day.isoformat()}T00:00:00Z",
                "publishDateTimeTo": f"{(day + timedelta(days=1)).isoformat()}T00:00:00Z",
            },
        )
        conn.executemany(
            "INSERT OR REPLACE INTO forecasts VALUES (?, ?, ?)",
            [(r["publishTime"], r["startTime"], r["generation"]) for r in rows],
        )
        print(f"  {day}: {len(rows)} rows")
        time.sleep(0.2)
    conn.commit()


def report(conn: sqlite3.Connection) -> None:
    print("\nSummary")
    actual_count, a_min, a_max = conn.execute(
        "SELECT COUNT(*), MIN(start_time), MAX(start_time) FROM actuals"
    ).fetchone()
    print(f"  actuals:   {actual_count} rows, {a_min} to {a_max}")

    forecast_count, publishes = conn.execute(
        "SELECT COUNT(*), COUNT(DISTINCT publish_time) FROM forecasts"
    ).fetchone()
    print(f"  forecasts: {forecast_count} rows from {publishes} forecast runs")

    gaps = conn.execute(
        "SELECT settlement_date, COUNT(*) FROM actuals "
        "GROUP BY settlement_date HAVING COUNT(*) != 48"
    ).fetchall()
    if gaps:
        print("  days without exactly 48 actual slots:")
        for day, count in gaps:
            print(f"    {day}: {count}")
    else:
        print("  every day has 48 actual slots")


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        create_tables(conn)
        ingest_actuals(conn)
        ingest_forecasts(conn)
        report(conn)
    print(f"\nSaved to {DB_PATH}")


if __name__ == "__main__":
    main()
