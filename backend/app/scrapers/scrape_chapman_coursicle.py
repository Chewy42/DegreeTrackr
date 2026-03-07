#!/usr/bin/env python3
"""
Standalone Chapman Coursicle scraper - combines scraper and decoder in one file.
Run: python chapman_coursicle_standalone.py

Output: backend/data/chapman_coursicle_spring2026.csv.
"""

import base64
import csv
import json
import os
from pathlib import Path
import random
import string
import time
from typing import Any, Dict, List, Generator

import requests

# ============================================================================
# DECODER (from coursicle_decoder.py)
# ============================================================================

def _shift_char(c: str) -> str:
    code = ord(c)
    if code == 0x2f:  # '/'
        return 'f'
    if code == 0x2b:  # '+'
        return 'e'
    if code >= 0x6b:  # >= 'k'
        return chr(code - 0x2a)
    if code >= 0x61:  # >= 'a'
        return chr(code + 0x10)
    if code >= 0x57:  # >= 'W'
        return chr(code + 0x0a)
    if code == 0x4b:  # 'K'
        return '+'
    if code >= 0x4c:  # >= 'L'
        return chr(code - 0x1d)
    if code >= 0x41:  # >= 'A'
        return chr(code + 0x10)
    return chr(code + 0x37)


def _transform_string(s: str) -> str:
    return "".join(_shift_char(c) for c in s)


def decode_coursicle_response(encrypted: str) -> str:
    s = encrypted
    replacements = {
        '-': '2', '?': '5', '(': '7', ')': 'c', ',': 'f', '.': 'h',
        '!': 'l', '&': 'o', '[': 'q', '@': 'u', '#': 'B', '*': 'G',
        '$': 'I', ']': 'K', '%': 'O', '<': 'R', '>': 'S', '^': 'V'
    }
    for old, new in replacements.items():
        s = s.replace(old, new)
    for _ in range(3):
        s = _transform_string(s)
    missing_padding = len(s) % 4
    if missing_padding:
        s += '=' * (4 - missing_padding)
    decoded_bytes = base64.b64decode(s)
    return decoded_bytes.decode('utf-8')


# ============================================================================
# SCRAPER CONFIG
# ============================================================================

BASE_URL = "https://www.coursicle.com/shared/getClasses.php"
SCHOOL = "chapman"
SEMESTER = "spring2026"
UUID = "c8e4ae55-4b07-4fcd-9a5a-ed17fd22b885"
COUNT = 25  # API max per page

HEADERS = {
    "accept": "text/plain, */*; q=0.01",
    "referer": "https://www.coursicle.com/chapman/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    "x-requested-with": "XMLHttpRequest",
}

MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 20.0
EMPTY_PAGE_THRESHOLD = 2


def get_output_path() -> Path:
    """Return the canonical CSV output path under backend/data."""
    backend_root = Path(__file__).resolve().parents[2]
    return backend_root / "data" / f"chapman_coursicle_{SEMESTER}.csv"


def get_available_classes_path() -> Path:
    """Return the app-facing Spring 2026 classes CSV path."""
    return get_output_path().with_name("available_classes_spring_2026.csv")


def get_unique_available_classes_path() -> Path:
    """Return the deduplicated class-code CSV path."""
    return get_output_path().with_name("unique_available_classes_spring_2026.csv")


def load_csv_rows(path: Path) -> List[Dict[str, str]]:
    """Load CSV rows from disk, returning an empty list when the file is absent."""
    if not path.exists():
        return []

    with open(path, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def dedupe_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate rows by class code while preserving first-seen order."""
    deduped: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        class_id = row.get("class", "")
        if class_id and class_id not in deduped:
            deduped[class_id] = row
    return list(deduped.values())


def write_rows(path: Path, rows: List[Dict[str, Any]]) -> None:
    """Write a full CSV, inferring fieldnames from the provided rows."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        return

    fieldnames = sorted({key for row in rows for key in row.keys()})
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def sync_app_data(scraped_rows: List[Dict[str, Any]]) -> None:
    """Refresh app-facing CSVs when the scraped dataset is at least as complete."""
    if not scraped_rows:
        return

    deduped_rows = dedupe_rows(scraped_rows)
    app_path = get_available_classes_path()
    existing_app_rows = dedupe_rows(load_csv_rows(app_path))

    if existing_app_rows and len(deduped_rows) < len(existing_app_rows):
        print(
            f"Skipping {app_path.name} refresh because scraped output has {len(deduped_rows)} unique classes "
            f"vs {len(existing_app_rows)} already present."
        )
        return

    write_rows(app_path, deduped_rows)

    unique_rows = [{"class": row["class"]} for row in deduped_rows if row.get("class")]
    write_rows(get_unique_available_classes_path(), unique_rows)

    print(f"Refreshed {app_path} with {len(deduped_rows)} unique Chapman classes.")
    print(f"Refreshed {get_unique_available_classes_path()} with {len(unique_rows)} class IDs.")


# ============================================================================
# SCRAPER FUNCTIONS
# ============================================================================

def fetch_page(offset: int, query: str = "") -> List[Dict[str, Any]]:
    """Fetch a single page of results with basic retry/backoff for 429s."""
    params = {
        "school": SCHOOL,
        "semester": SEMESTER,
        "uuid": UUID,
        "client": "web",
        "offset": offset,
        "count": COUNT,
        "days": "",
    }
    if query:
        params["query"] = query

    for attempt in range(MAX_RETRIES):
        response = requests.get(BASE_URL, params=params, headers=HEADERS, timeout=30)

        if response.status_code == 429:
            if attempt == MAX_RETRIES - 1:
                raise requests.HTTPError(
                    f"429 Client Error: Too Many Requests for offset={offset}, query={query!r}",
                    response=response,
                )

            backoff_seconds = BASE_BACKOFF_SECONDS * (2 ** attempt) + random.uniform(0, 5)
            print(
                f"Rate limited for query={query!r}, offset={offset}; "
                f"waiting {backoff_seconds:.1f}s before retry {attempt + 2}/{MAX_RETRIES}..."
            )
            time.sleep(backoff_seconds)
            continue

        response.raise_for_status()

        try:
            data = response.json()
        except ValueError:
            decrypted = decode_coursicle_response(response.text)
            start = decrypted.find("{")
            end = decrypted.rfind("}") + 1
            data = json.loads(decrypted[start:end])

        classes = data.get("classes", [])
        return [row for row in classes if isinstance(row, dict)]

    return []


def scrape_letter_pages(letter: str) -> Generator[List[Dict[str, Any]], None, None]:
    """Yield pages of results for a single letter query."""
    offset = 0
    consecutive_empty_pages = 0
    while True:
        try:
            page = fetch_page(offset, letter)
        except Exception as e:
            print(f"Error fetching page {offset} for letter {letter}: {e}")
            break

        if not page:
            consecutive_empty_pages += 1
            if consecutive_empty_pages >= EMPTY_PAGE_THRESHOLD:
                break
        else:
            consecutive_empty_pages = 0
            yield page

        offset += COUNT
        # Random delay between pages to avoid rate limiting
        time.sleep(random.uniform(1.0, 3.0))


def scrape_all() -> None:
    """Scrape all classes by querying each letter a-z, saving incrementally."""
    output_path = get_output_path()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    filename = str(output_path)
    seen_ids = set()
    fieldnames = None

    # Load existing IDs if file exists to avoid duplicates
    if os.path.exists(filename):
        try:
            with open(filename, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if "class" in row:
                        seen_ids.add(row["class"])
            print(f"Resuming. Loaded {len(seen_ids)} existing classes from {filename}")
        except Exception as e:
            print(f"Error reading existing file: {e}")

    print(f"Scraping Chapman {SEMESTER} classes...")

    # Open file in append mode
    with open(filename, "a", newline="", encoding="utf-8") as f:
        writer = None
        if fieldnames:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        
        for i, letter in enumerate(string.ascii_lowercase):
            if i > 0:
                # Random delay between letters
                time.sleep(random.uniform(3.0, 6.0))

            print(f"Scraping letter '{letter}'...")
            letter_new_count = 0
            
            for page_rows in scrape_letter_pages(letter):
                new_rows = []
                for row in page_rows:
                    class_id = row.get("class", "")
                    # Only add if we haven't seen this class ID
                    if class_id and class_id not in seen_ids:
                        seen_ids.add(class_id)
                        new_rows.append(row)
                
                if new_rows:
                    # Initialize writer if this is the first write
                    if writer is None:
                        # Determine fieldnames from the first batch of data
                        all_keys = set().union(*(d.keys() for d in new_rows))
                        fieldnames = sorted(all_keys)
                        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
                        # If file was empty, write header
                        if f.tell() == 0:
                            writer.writeheader()
                    
                    writer.writerows(new_rows)
                    f.flush() # Ensure data is written to disk
                    letter_new_count += len(new_rows)
                    print(f"  Saved {len(new_rows)} new classes (Total unique: {len(seen_ids)})")
            
            print(f"Finished letter '{letter}'. Found {letter_new_count} new classes.")


def main() -> None:
    scrape_all()
    sync_app_data(load_csv_rows(get_output_path()))
    print(f"\nScraping complete. Data saved to {get_output_path()}")


if __name__ == "__main__":
    main()
