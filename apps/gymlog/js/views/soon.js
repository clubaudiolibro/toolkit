/** soon.js — schermate non ancora pronte (arrivano nelle fasi successive). */
import { el, icon } from '../ui.js';

const INFO = {
  oggi: { title: 'Oggi', icon: 'today', text: 'Qui comparirà l\'allenamento suggerito per oggi.', phase: 3 },
  diario: { title: 'Diario', icon: 'diary', text: 'Qui comparirà il calendario degli allenamenti.', phase: 3 },
};

export function render(ctx) {
  const key = ctx.path.split('/')[0];
  const info = INFO[key];
  ctx.setTitle(info.title);
  ctx.view.appendChild(el('div', { class: 'placeholder' },
    icon(info.icon, 'ico'),
    el('strong', { text: 'In arrivo' }),
    el('p', { text: info.text + ' (fase ' + info.phase + ')' }),
    el('a', { class: 'btn btn-primary', href: '#/allenamenti', text: 'Vai agli allenamenti' })));
}
