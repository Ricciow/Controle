import { TransferFunction } from './types';

function polynomialText(coefficients: number[]): string {
  return coefficients.flatMap((coefficient, i) => {
    if (coefficient === 0) return [];
    const power = coefficients.length - i - 1;
    // Decimal notation stays compatible with the expression input, even for
    // very small coefficients that JavaScript normally prints with an 'e'.
    const value = Math.abs(coefficient).toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 21 });
    const variable = power === 0 ? '' : power === 1 ? 's' : `s^${power}`;
    const term = variable ? `${Math.abs(coefficient) === 1 ? '' : `${value}*`}${variable}` : value;
    return [`${coefficient < 0 ? '-' : '+'}${term}`];
  }).join('').replace(/^\+/, '') || '0';
}

export function numericTransferText(system: TransferFunction): string {
  return `(${polynomialText(system.numerator)})/(${polynomialText(system.denominator)})`;
}
