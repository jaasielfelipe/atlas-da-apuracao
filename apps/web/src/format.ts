export const integer = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n);
export const percent = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      }).format(n);
export const time = (v: string | null | undefined) =>
  v
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(v))
    : '—';
export const dateTime = (v: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(v));
export const colors = ['#24726a', '#637bb1', '#b38b4d', '#9c9d96'];
export const candidateColor = (number: string) =>
  colors[Math.max(0, Number(number) - 91) % colors.length];
export async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const info = await response.json().catch(() => ({}));
    throw Error(info.error ?? `HTTP ${response.status}`);
  }
  return response.json();
}
