const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Format integer cents to USD. Division by 100 happens only at render. */
export function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

export function MoneyAmount({
  cents,
  className = '',
}: {
  cents: number;
  className?: string;
}) {
  return (
    <span className={`tabular-nums ${className}`}>{formatCents(cents)}</span>
  );
}
