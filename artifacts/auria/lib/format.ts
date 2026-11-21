export const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatNumber(value: number, decimals = 2): string {
  const neg = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [i, d] = fixed.split('.');
  return (neg ? '-' : '') + groupThousands(i) + (d ? ',' + d : '');
}

export function formatMoney(value: number, currency = 'BRL'): string {
  const prefix = currency === 'BRL' ? 'R$' : currency;
  const neg = value < 0;
  return (neg ? '- ' : '') + prefix + ' ' + formatNumber(Math.abs(value));
}

/** Parses Brazilian-style input: "1.234,56", "1234,5", "R$ 12", "12.50". */
export function parseAmount(raw: string): number {
  let s = raw.replace(/R\$|\s/gi, '').trim();
  if (!s) return NaN;
  if (!/^[\d.,]+$/.test(s)) return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
    if ((s.match(/,/g) ?? []).length > 0) return NaN;
  } else {
    const dots = (s.match(/\./g) ?? []).length;
    if (dots > 1) s = s.replace(/\./g, '');
    else if (dots === 1 && /\.\d{3}$/.test(s)) s = s.replace('.', '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

export function amountToInput(n: number): string {
  return formatNumber(n);
}

export function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** ISO date (YYYY-MM-DD) -> "DD/MM/AAAA" */
export function isoToBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "DD/MM/AAAA" -> ISO or null */
export function brToISO(br: string): string | null {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Hoje';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yISO = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (iso === yISO) return 'Ontem';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

export function daysUntil(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const t = new Date();
  const now = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((target - now) / 86400000);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Math.round((Date.now() - t) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `há ${diff} min`;
  const h = Math.round(diff / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** Validates an HTTPS origin. Returns normalized origin or an error message. */
export function validateOrigin(input: string): { origin: string } | { error: string } {
  const s = input.trim().replace(/\/+$/, '');
  if (!s) return { error: 'Informe um endereço.' };
  if (!/^https:\/\//i.test(s)) return { error: 'Use apenas endereços HTTPS (https://...).' };
  if (s.includes('@')) return { error: 'Não inclua usuário ou senha no endereço.' };
  const m = s.match(/^https:\/\/([a-z0-9.-]+)(:\d{1,5})?$/i);
  if (!m) return { error: 'Informe só a origem, sem caminhos, parâmetros ou fragmentos. Ex.: https://financas.seudominio.com' };
  if (!m[1].includes('.') && m[1].toLowerCase() !== 'localhost') return { error: 'Domínio inválido.' };
  return { origin: `https://${m[1].toLowerCase()}${m[2] ?? ''}` };
}

export function describeApiError(err: unknown): string {
  if (!err) return '';
  const e = err as { status?: number; data?: unknown; message?: string };
  const data = e.data as { error?: string; message?: string } | null | undefined;
  const serverMsg = data && typeof data === 'object' ? data.error ?? data.message : undefined;
  switch (e.status) {
    case 401:
      return 'Sessão ausente ou expirada. Entre novamente na sua conta.';
    case 403:
      return 'Esta conta não é a proprietária configurada no servidor (OWNER_CLERK_USER_ID). Copie seu ID de usuário em Ajustes e configure no servidor.';
    case 503:
      return serverMsg
        ? `Servidor indisponível: ${serverMsg}`
        : 'O servidor ainda não tem um proprietário configurado (OWNER_CLERK_USER_ID) ou um serviço está desativado.';
    case 404:
      return 'Rota não encontrada neste servidor. Confira se o endereço aponta para a API da Áuria.';
    default:
      break;
  }
  if (typeof e.status === 'number') return serverMsg ?? `O servidor respondeu com erro ${e.status}.`;
  return 'Não foi possível alcançar o servidor. Verifique o endereço e sua conexão.';
}
