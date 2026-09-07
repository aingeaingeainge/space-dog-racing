import raw from './balance.json';

type Numeric<T> = { [K in keyof T as T[K] extends number ? K : never]: T[K] };
/** Every numeric tunable, typed from the generated JSON. */
export type Balance = Numeric<typeof raw>;

export const balance: Balance = raw as Balance;
export const currencyName: string = raw.currencyName;

export function formatBones(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toLocaleString('en-NZ')} ${currencyName}`;
}
