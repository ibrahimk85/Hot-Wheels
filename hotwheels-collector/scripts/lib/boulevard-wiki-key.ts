/** Stable match key for Boulevard wiki row vs DB variant (Rerelease "No #" uses Toy#). */

export function normBoulevard(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function stableBoulevardKey(
  year: number,
  mix: string,
  cardNumber: string | null | undefined,
  toyNumber: string,
): string {
  const m = normBoulevard(mix);
  const isEarly = year === 2012 || year === 2013;
  const card = (cardNumber ?? '').trim();
  const toy = normBoulevard(toyNumber);
  if (isEarly) {
    return `${m}|${normBoulevard(card)}`;
  }
  if (!card || /^no\.?\s*#$/i.test(card) || /^n\/a$/i.test(card)) {
    return `${m}|t|${toy}`;
  }
  return `${m}|${normBoulevard(card)}`;
}
