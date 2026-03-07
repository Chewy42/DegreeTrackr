import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.scrapers import scrape_chapman_coursicle


class ChapmanCoursicleScraperTests(unittest.TestCase):
    def test_output_path_uses_single_backend_segment(self) -> None:
        path = scrape_chapman_coursicle.get_output_path()
        self.assertTrue(path.name.startswith("chapman_coursicle_"))
        self.assertEqual(path.suffix, ".csv")
        backend_segments = [part for part in path.parts if part == "backend"]
        self.assertEqual(len(backend_segments), 1)
        self.assertIn("backend", path.parts)
        self.assertIn("data", path.parts)

    def test_scrape_letter_pages_uses_count_sized_offsets(self) -> None:
        offsets: list[int] = []

        def fake_fetch_page(offset: int, query: str = ""):
            offsets.append(offset)
            if len(offsets) <= 2:
                return [{"class": f"TEST {len(offsets)}"}]
            return []

        with patch.object(scrape_chapman_coursicle, "fetch_page", side_effect=fake_fetch_page), \
             patch.object(scrape_chapman_coursicle.time, "sleep", return_value=None):
            pages = list(scrape_chapman_coursicle.scrape_letter_pages("a"))

        self.assertEqual(len(pages), 2)
        self.assertEqual(offsets, [0, scrape_chapman_coursicle.COUNT, scrape_chapman_coursicle.COUNT * 2, scrape_chapman_coursicle.COUNT * 3])

    def test_sync_app_data_skips_smaller_scrape_output(self) -> None:
        with TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            app_path = tmp_path / "available_classes_spring_2026.csv"
            unique_path = tmp_path / "unique_available_classes_spring_2026.csv"

            existing_rows = [
                {"class": "ACTG 210-01", "semester": "spring2026", "title": "Existing A"},
                {"class": "ACTG 210-02", "semester": "spring2026", "title": "Existing B"},
            ]
            scrape_chapman_coursicle.write_rows(app_path, existing_rows)

            smaller_rows = [
                {"class": "ACTG 210-01", "semester": "spring2026", "title": "Smaller"},
            ]

            with patch.object(scrape_chapman_coursicle, "get_available_classes_path", return_value=app_path), \
                 patch.object(scrape_chapman_coursicle, "get_unique_available_classes_path", return_value=unique_path):
                scrape_chapman_coursicle.sync_app_data(smaller_rows)

            persisted_rows = scrape_chapman_coursicle.load_csv_rows(app_path)
            self.assertEqual([row["class"] for row in persisted_rows], ["ACTG 210-01", "ACTG 210-02"])
            self.assertFalse(unique_path.exists())


if __name__ == "__main__":
    unittest.main()
