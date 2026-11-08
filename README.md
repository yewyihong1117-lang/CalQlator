# fx-570 Practice Calculator

A phone-first web clone of the Casio fx-570EX ClassWiz, built for **exam muscle memory**. Phones aren't allowed in my exams, so the goal is to match the physical calculator's keys, layout, and behavior closely enough that practicing here carries over to the real one.

**Live demo:** https://calculatorcassio.vercel.app

![screenshot](docs/screenshot.png)

## Why this exists

Most calculator web apps are generic. This one copies the fx-570EX's key positions, shift/alpha labels, Math I/O editing, and result formatting. Finger positions and key sequences should be the same as on the real device.

## Two modes

- **Exam Mode (default):** a strict 1:1 clone. Every shifted function is reached only through SHIFT or ALPHA, with no swipes, tape, or hints.
- **Study Mode:** extras for practice, such as unlimited history, undo, a key-path trainer that shows the real key sequence, and a keystroke counter.

## Features

- Fixed layout scaled uniformly to any phone screen, so nothing reflows or moves under your fingers
- 2D Math I/O AST editor: natural-display templates for fractions, roots, powers, logs, and integrals with cursor slot navigation
- Algebraic exact evaluator: strict algebraic exactness for fractions, surds, and $\pi$-multiples; decimal literals remain pure decimals with Norm1, Norm2, Fix, and Sci formatting (no heuristic tolerance matching)
- Full combinatorics support: distinct internal tokens for $n\text{P}r$, $n\text{C}r$, and ALPHA variables $A$–$F$, $x$, $y$, $M$
- D-pad history navigation and multi-line expression recall
- Haptic and click feedback
- Works offline as a PWA
