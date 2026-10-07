"""Regression checks for the text used to build the shipped Danish recordings."""
import unittest

from generate_plus_penalhus_audio import NUMBERS, OUTPUT as PLUS_OUTPUT, narration_lines as plus_lines
from generate_letter_audio import LETTER_NAMES, OUTPUT as LETTER_OUTPUT, narration_lines as letter_lines


class LearningAudioTests(unittest.TestCase):
    def test_every_supported_count_and_equation(self):
        lines = dict(plus_lines())
        self.assertEqual(len(lines), 118)
        for n in range(1, 19):
            self.assertEqual(lines[f"count-{n}"], NUMBERS[n].capitalize() + "!")
        for a in range(10):
            for b in range(10):
                self.assertEqual(lines[f"sum-{a}-{b}"],
                                 f"{NUMBERS[a].capitalize()} plus {NUMBERS[b]} giver {NUMBERS[a+b]}!")

    def test_no_abbreviation_full_stops(self):
        for _, text in plus_lines() + letter_lines():
            self.assertNotIn(".", text)
            self.assertTrue(text.endswith("!"))

    def test_all_letters_have_spoken_names_and_both_phrases(self):
        lines = letter_lines()
        self.assertEqual(len(lines), 29)
        self.assertEqual(len({stem for stem, _ in lines}), 29)
        for (_, text), name in zip(lines, LETTER_NAMES.values()):
            self.assertTrue(text.startswith(f"Bogstavet {name} som i "))
            self.assertTrue(text.endswith(f"starter med bogstavet {name}!"))
        self.assertEqual(dict(lines)["f-fisk"],
                         "Bogstavet æf som i fisk! Fisk starter med bogstavet æf!")
        self.assertIn("l-loeve-v2", dict(lines))
        self.assertIn("n-naesehorn-v2", dict(lines))

    def test_every_active_recording_is_shipped(self):
        for output, lines in [(PLUS_OUTPUT, plus_lines()), (LETTER_OUTPUT, letter_lines())]:
            for stem, _ in lines:
                path = output / f"{stem}.mp3"
                self.assertTrue(path.is_file(), str(path))
                self.assertGreater(path.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
