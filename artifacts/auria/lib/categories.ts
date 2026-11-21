import type { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Feather>['name'];

export type Category = { id: string; label: string; icon: IconName; income?: boolean };

export const CATEGORIES: Category[] = [
  { id: 'moradia', label: 'Moradia', icon: 'home' },
  { id: 'mercado', label: 'Mercado', icon: 'shopping-cart' },
  { id: 'alimentacao', label: 'Alimentação', icon: 'coffee' },
  { id: 'transporte', label: 'Transporte', icon: 'navigation' },
  { id: 'saude', label: 'Saúde', icon: 'heart' },
  { id: 'educacao', label: 'Educação', icon: 'book-open' },
  { id: 'lazer', label: 'Lazer', icon: 'film' },
  { id: 'assinaturas', label: 'Assinaturas', icon: 'repeat' },
  { id: 'compras', label: 'Compras', icon: 'shopping-bag' },
  { id: 'contas', label: 'Contas da casa', icon: 'zap' },
  { id: 'viagem', label: 'Viagem', icon: 'map' },
  { id: 'impostos', label: 'Impostos e taxas', icon: 'percent' },
  { id: 'presentes', label: 'Presentes', icon: 'gift' },
  { id: 'salario', label: 'Salário', icon: 'briefcase', income: true },
  { id: 'renda-extra', label: 'Renda extra', icon: 'trending-up', income: true },
  { id: 'rendimentos', label: 'Rendimentos', icon: 'bar-chart-2', income: true },
  { id: 'transferencias', label: 'Transferências', icon: 'shuffle' },
  { id: 'cartao', label: 'Fatura do cartão', icon: 'credit-card' },
  { id: 'outros', label: 'Outros', icon: 'more-horizontal' },
];

export function categoryInfo(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? { id, label: id || 'Sem categoria', icon: 'tag' };
}

export const KIND_LABEL: Record<string, string> = {
  income: 'Entrada',
  expense: 'Saída',
  transfer: 'Transferência',
  card_payment: 'Pagamento de fatura',
};
