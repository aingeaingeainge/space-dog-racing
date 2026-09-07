import type { ButtonHTMLAttributes } from 'react';

export type NeonVariant = 'default' | 'primary' | 'danger' | 'link' | 'ghost';

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** default = a plate; primary = the planet's accent; danger = pink; link/ghost = no plate. */
  variant?: NeonVariant;
  small?: boolean;
  wide?: boolean;
}

/**
 * The one button in the game (GDD §16 "neon button states").
 *
 * Hover lights the cyan edge, active presses it into the plate, focus-visible gets a hazard
 * ring that never depends on colour alone, and disabled goes dashed and grey — a shut venue
 * or an unaffordable purchase should look shut, not missing. `title` carries the reason and
 * every screen sets it, which is how M1's "a shut venue says why" survives the reskin.
 */
export function NeonButton({
  variant = 'default',
  small,
  wide,
  className,
  type = 'button',
  ...rest
}: NeonButtonProps) {
  const cls = ['nb', variant === 'default' ? null : variant, small ? 'small' : null, wide ? 'wide' : null, className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
