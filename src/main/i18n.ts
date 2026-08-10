import { fillPlaceholders, stringsFor, type StringKey } from '../shared/i18n';
import { getAppearance } from './appearance';

/** Tłumaczenia w procesie głównym — język czytany ze stanu przy każdym wywołaniu. */

export function t(key: StringKey): string {
  return stringsFor(getAppearance().language)[key];
}

export function tf(key: StringKey, vars: Record<string, string | number>): string {
  return fillPlaceholders(t(key), vars);
}
