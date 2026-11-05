# fx-570 Practice Calculator

A phone-first web clone of the Casio fx-570EX ClassWiz, built for **exam muscle memory**. Phones aren't allowed in my exams, so the goal is to match the physical calculator's keys, layout, and behavior closely enough that practicing here carries over to the real one.

**Live demo:** https://calculatorcassio.vercel.app



## Why this exists

Most calculator web apps are generic. This one copies the fx-570EX's key positions, shift/alpha labels, Math I/O editing, and result formatting. Finger positions and key sequences should be the same as on the real device.

## Two modes

- **Exam Mode (default):** a strict 1:1 clone. Every shifted function is reached only through SHIFT or ALPHA, with no swipes, tape, or hints.
- **Study Mode:** extras for practice, such as unlimited history, undo, a key-path trainer that shows the real key sequence, and a keystroke counter.

## Features

- Fixed layout scaled uniformly to any phone screen, so nothing reflows or overlaps
- Math I/O editor with fractions, powers, roots, integrals, and brackets, using the real operand rules
- Exact results (fractions, √, π) separate from decimal results, with S⇔D
- Norm1/Norm2/Fix/Sci display formatting that follows the real thresholds
- Haptic feedback, offline support (PWA), and persistent memory variables
- `?test=1` regression suite and `?perf=1` keypress-latency overlay

## Status

Work in progress. Behavior is checked against a physical fx-570EX, and mismatches are tracked as test cases.

**Not implemented yet:** [list, e.g. TABLE, EQN, VECTOR, full STAT regressions]

## Run locally

```bash
git clone https://github.com/[you]/[repo].git
cd [repo]
npx serve .
```

Then open `http://localhost:3000`. Add `?test=1` to run the test suite.

## Disclaimer

Not affiliated with or endorsed by Casio. "Casio" and "ClassWiz" are trademarks of Casio Computer Co., Ltd. This is an educational practice tool, not a replacement for your approved exam calculator. Check your exam rules before relying on any result.

## Contributing

Found a result that differs from a real fx-570EX? Open an issue with the key sequence and what your calculator shows. That's the most useful bug report.
