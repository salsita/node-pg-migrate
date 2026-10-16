import type { Logger } from '../logger';

export function warnAmbiguousNullability(
  logger: Logger,
  label: () => string,
  { notNull, allowNull }: { notNull?: boolean; allowNull?: boolean }
): void {
  if (notNull === false && allowNull === false) {
    logger.warn(
      `${label()}: notNull: false conflicts with allowNull: false. notNull takes precedence; NOT NULL will be dropped.`
    );
  } else if (allowNull === false && notNull !== true) {
    logger.warn(
      `${label()}: allowNull: false does not set NOT NULL. Use notNull: true to disallow null values.`
    );
  } else if (notNull === true && allowNull === true) {
    logger.warn(
      `${label()}: notNull: true conflicts with allowNull: true. notNull takes precedence.`
    );
  }
}
