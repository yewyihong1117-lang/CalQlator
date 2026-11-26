/**
 * Pure display-layer formatting helpers for thousands separators.
 * Never alters underlying evaluation strings, AST tokens, or calcEngine outputs.
 */

function insertCommasInIntDigits(digits: string): string {
  if (digits.length < 4) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats numbers in a display string with thousands separators (e.g. "1563×6=9378" -> "1,563×6=9,378").
 * Keeps fractional digits after ".", constants (π, e), superscripts (×10⁻⁴),
 * ASCII scientific exponents (1e-10), and identifier suffixes (x1000) untouched.
 */
export function formatDisplayNumberWithCommas(text: string): string {
  if (!text || !/\d{4}/.test(text)) return text;

  let out = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (ch >= '0' && ch <= '9') {
      const prev = i > 0 ? text[i - 1] : '';
      // Do not format fractional part after '.', ASCII scientific exponent after e/E, or identifier suffixes
      const isFractional = prev === '.';
      const isAsciiExponent =
        (prev === 'e' || prev === 'E') &&
        i >= 2 &&
        /[0-9.]/.test(text[i - 2]);
      const isSignedAsciiExponent = false; // handled below when encountering +/- before digits
      const isIdentifierSuffix = /[a-zA-Z_]/.test(prev) && !isAsciiExponent;

      let end = i;
      while (end < len && text[end] >= '0' && text[end] <= '9') {
        end++;
      }
      const run = text.slice(i, end);

      if (isFractional || isAsciiExponent || isSignedAsciiExponent || isIdentifierSuffix) {
        out += run;
      } else {
        // Also check if preceded by e+ / e- / E+ / E- from scientific notation
        const isSignedSci =
          i >= 2 &&
          (text[i - 1] === '+' || text[i - 1] === '-') &&
          (text[i - 2] === 'e' || text[i - 2] === 'E') &&
          i >= 3 &&
          /[0-9.]/.test(text[i - 3]);

        out += isSignedSci ? run : insertCommasInIntDigits(run);
      }

      // Skip fractional digits right after a decimal point if present
      if (end < len && text[end] === '.') {
        let fracEnd = end + 1;
        while (fracEnd < len && text[fracEnd] >= '0' && text[fracEnd] <= '9') {
          fracEnd++;
        }
        out += text.slice(end, fracEnd);
        i = fracEnd;
        continue;
      }

      i = end;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Formats a history entry as a single ColorOS calculation line: "1,563×6=9,378"
 */
export function formatHistoryLine(expression: string, result: string): string {
  const exprPart = formatDisplayNumberWithCommas(expression);
  const cleanResult = result.replace(/^=\s*/, '');
  const resPart = formatDisplayNumberWithCommas(cleanResult);
  return `${exprPart}=${resPart}`;
}
