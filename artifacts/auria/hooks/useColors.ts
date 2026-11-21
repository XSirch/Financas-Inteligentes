import colors from '@/constants/colors';

/**
 * Returns the design tokens. The chosen "Escuro e tecnológico" direction is
 * enforced independently of the device appearance setting.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
