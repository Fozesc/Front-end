// v-dica="texto": parou o mouse (ou o foco do teclado) em cima por um instante, aparece um
// resuminho logo abaixo. Uma caixa so para a tela inteira; nada muda no visual ate aparecer.
const ESPERA_MS = 700;
let caixa = null;
let dono = null;
let timer = null;

const criar = () => {
  caixa = document.createElement('div');
  caixa.setAttribute('role', 'tooltip');
  caixa.id = 'dica-fozesc';
  caixa.className = 'fixed z-[200] max-w-xs rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg pointer-events-none';
  document.body.appendChild(caixa);
};

const esconder = () => {
  clearTimeout(timer);
  if (caixa) caixa.style.display = 'none';
  if (dono) dono.removeAttribute('aria-describedby');
  dono = null;
};

const mostrar = (el) => {
  if (!el._dica) return;
  if (!caixa) criar();
  caixa.textContent = el._dica;
  caixa.style.display = 'block';
  caixa.style.left = '0px';
  caixa.style.top = '0px';
  const r = el.getBoundingClientRect();
  const { width, height } = caixa.getBoundingClientRect();
  const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, 8), window.innerWidth - width - 8);
  const embaixo = r.bottom + 8;
  caixa.style.left = `${left}px`;
  caixa.style.top = `${embaixo + height > window.innerHeight - 8 ? Math.max(r.top - height - 8, 8) : embaixo}px`;
  dono = el;
  el.setAttribute('aria-describedby', caixa.id);
};

const agendar = (e) => {
  clearTimeout(timer);
  const el = e.currentTarget;
  timer = setTimeout(() => mostrar(el), ESPERA_MS);
};

window.addEventListener('scroll', esconder, true);

export default {
  mounted(el, { value }) {
    el._dica = value;
    el.addEventListener('mouseenter', agendar);
    el.addEventListener('focusin', agendar);
    el.addEventListener('mouseleave', esconder);
    el.addEventListener('focusout', esconder);
    el.addEventListener('mousedown', esconder);
  },
  updated(el, { value }) {
    el._dica = value;
    if (dono === el) caixa.textContent = value;
  },
  beforeUnmount(el) {
    if (dono === el) esconder();
    el.removeEventListener('mouseenter', agendar);
    el.removeEventListener('focusin', agendar);
    el.removeEventListener('mouseleave', esconder);
    el.removeEventListener('focusout', esconder);
    el.removeEventListener('mousedown', esconder);
  },
};
