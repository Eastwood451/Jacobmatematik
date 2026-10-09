"""Check active narration filenames and prevent abbreviation expansions."""
import re
from pathlib import Path
import unittest

from generate_plus_penalhus_audio import OUTPUT as PLUS_OUTPUT, narration_lines as plus_lines
from generate_letter_audio import OUTPUT as LETTER_OUTPUT, narration_lines as letter_lines


class LearningAudioTests(unittest.TestCase):
    def test_shipped_counts_equations_and_letters(self):
        self.assertEqual(len(plus_lines()), 118)
        self.assertEqual(len(letter_lines()), 29)
        for output, lines in [(PLUS_OUTPUT, plus_lines()), (LETTER_OUTPUT, letter_lines())]:
            self.assertEqual(len(lines), len({stem for stem, _ in lines}))
            for stem, text in lines:
                path = output / (stem + ".mp3")
                self.assertTrue(path.is_file(), str(path))
                self.assertGreater(path.stat().st_size, 1000)
                self.assertTrue(text.endswith("!"), text)
                self.assertNotRegex(text, r"\b(?:fem|ti|[FGTU])\.")

    def test_runtime_uses_the_newer_equation_variants(self):
        source = Path("plus-penalhus.js").read_text()
        self.assertIn("audio-v2/", source)
        self.assertIn("-ti-v3", source)
        self.assertIn("-fem-v4", source)
        lines = dict(plus_lines())
        self.assertIn("sum-2-3-fem-v4", lines)
        self.assertIn("sum-5-5-ti-v3", lines)
        self.assertIn("sum-9-9", lines)

    def test_letters_have_spoken_names_and_cache_versions(self):
        source = Path("app.js").read_text()
        self.assertIn("?v=20261009-letters3", source)
        lines = dict(letter_lines())
        for stem in ("f-fisk", "g-gris", "t-tiger", "u-ugle"):
            self.assertIn("bogstavet", lines[stem])
            self.assertNotIn(".", lines[stem])


if __name__ == "__main__":
    unittest.main()
