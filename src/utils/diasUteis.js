// Calendário bancário brasileiro: um cheque não compensa em fim de semana nem em
// feriado, então a parcela que cai nesses dias na prática só entra no próximo dia útil.
// Tudo aqui é cálculo puro de data - não encosta em juros, valor ou IOF.

// Feriados nacionais (data fixa). 24 e 31/12 entram porque não há expediente
// bancário nesses dias, mesmo não sendo feriado oficial.
const FERIADOS_FIXOS = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-24': 'Véspera de Natal (sem expediente bancário)',
  '12-25': 'Natal',
  '12-31': 'Véspera de Ano Novo (sem expediente bancário)',
};

// Feriados de Foz do Iguaçu / Paraná. Coloque aqui no formato 'MM-DD' (todo ano)
// ou 'AAAA-MM-DD' (só naquele ano). Ex.: '06-10': 'Aniversário de Foz do Iguaçu'.
// Está vazio de propósito: feriado municipal errado empurraria cheque sem motivo.
export const FERIADOS_LOCAIS = {};

// Páscoa pelo algoritmo de Meeus/Butcher (calendário gregoriano). É dela que saem
// Carnaval, Sexta-feira Santa e Corpus Christi.
const pascoa = (ano) => {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
};

// meio-dia UTC, igual ao resto do borderô, para o fuso não virar o dia
const emUTC = (dataIso) => {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
};

const paraIso = (d) => d.toISOString().split('T')[0];

const somarDias = (d, n) => {
  const nova = new Date(d.getTime());
  nova.setUTCDate(nova.getUTCDate() + n);
  return nova;
};

const cache = new Map();

const feriadosDoAno = (ano) => {
  if (cache.has(ano)) return cache.get(ano);

  const mapa = {};
  for (const [mmdd, nome] of Object.entries(FERIADOS_FIXOS)) {
    mapa[`${ano}-${mmdd}`] = nome;
  }
  for (const [chave, nome] of Object.entries(FERIADOS_LOCAIS)) {
    mapa[chave.length === 5 ? `${ano}-${chave}` : chave] = nome;
  }

  const p = pascoa(ano);
  // bancos fecham na segunda e na terça de carnaval; na quarta-feira de cinzas
  // abrem mais tarde, mas o dia compensa normal - por isso ela não entra
  mapa[paraIso(somarDias(p, -48))] = 'Carnaval';
  mapa[paraIso(somarDias(p, -47))] = 'Carnaval';
  mapa[paraIso(somarDias(p, -2))] = 'Sexta-feira Santa';
  mapa[paraIso(somarDias(p, 60))] = 'Corpus Christi';

  cache.set(ano, mapa);
  return mapa;
};

/**
 * Por que a data não é dia útil bancário: 'Sábado', 'Domingo' ou o nome do
 * feriado. Devolve null quando o dia é útil.
 */
export const motivoNaoUtil = (dataIso) => {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return null;
  const d = emUTC(dataIso);
  if (Number.isNaN(d.getTime())) return null;

  const semana = d.getUTCDay();
  if (semana === 0) return 'Domingo';
  if (semana === 6) return 'Sábado';

  return feriadosDoAno(d.getUTCFullYear())[dataIso] || null;
};

/** Primeiro dia útil a partir da data (a própria data, se já for útil). */
export const proximoDiaUtil = (dataIso) => {
  let d = emUTC(dataIso);
  // 10 é folga de sobra: nenhum feriado brasileiro emenda tanto dia seguido
  for (let i = 0; i < 10; i++) {
    const iso = paraIso(d);
    if (!motivoNaoUtil(iso)) return iso;
    d = somarDias(d, 1);
  }
  return dataIso;
};
