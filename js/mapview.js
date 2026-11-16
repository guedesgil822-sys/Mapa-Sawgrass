// Visualizador com arrastar/zoom/giro (mouse, roda, pinça e giro com dois dedos) usado pelo app e pelo editor.
// Tela = (x, y) + giro(r) · (k · ponto do mapa)
const SVG = 'http://www.w3.org/2000/svg';
export const svgEl = (tag, attrs = {}, parent) => {
  const el = document.createElementNS(SVG, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};

export class MapView {
  constructor(container) {
    this.el = container;
    this.content = document.createElement('div');
    this.content.className = 'mv-content';
    this.img = document.createElement('img');
    this.img.alt = '';
    this.img.draggable = false;
    this.svg = svgEl('svg');
    this.content.append(this.img, this.svg);
    this.el.appendChild(this.content);
    this.x = 0; this.y = 0; this.k = 1; this.r = 0; this.w = 100; this.h = 100;   // r: giro em graus (horário)
    this.rotateEnabled = true;
    this.minK = 0.05; this.maxK = 6;
    this.onChange = null; // (view)
    this.onTap = null;    // (ponto no mapa, evento)
    this.panEnabled = () => true;
    this._bind();
  }

  setFloor(src, w, h) {
    this.w = w; this.h = h;
    if (src) this.img.src = src; else this.img.removeAttribute('src');
    this.img.width = w; this.img.height = h;
    this.content.style.width = w + 'px';
    this.content.style.height = h + 'px';
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.setAttribute('width', w); this.svg.setAttribute('height', h);
  }

  apply(animate = false) {
    this.content.classList.toggle('mv-anim', animate);
    this.content.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.r}deg) scale(${this.k})`;
    this.onChange?.(this);
  }

  /** Enquadra a caixa [x0,y0,x1,y1]; pad = margens {t,r,b,l} em px de tela. */
  fit(box, pad = {}, animate = true, maxK = 2.2) {
    const r = this.el.getBoundingClientRect();
    const p = { t: 20, r: 20, b: 20, l: 20, ...pad };
    const bw = Math.max(box[2] - box[0], 1), bh = Math.max(box[3] - box[1], 1);
    const aw = Math.max(r.width - p.l - p.r, 50), ah = Math.max(r.height - p.t - p.b, 50);
    // com o mapa girado, a caixa ocupa mais espaço na tela
    const a = this.r * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    const sw = bw * c + bh * sn, sh = bw * sn + bh * c;
    this.k = Math.max(this.minK, Math.min(maxK, aw / sw, ah / sh));
    // centro da caixa no centro da área livre
    const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, o = this._rot(cx * this.k, cy * this.k);
    this.x = p.l + aw / 2 - o.x;
    this.y = p.t + ah / 2 - o.y;
    this.apply(animate);
  }

  _rot(x, y, deg = this.r) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  toMap(cx, cy) {
    const r = this.el.getBoundingClientRect();
    const u = this._rot(cx - r.left - this.x, cy - r.top - this.y, -this.r);
    return { x: u.x / this.k, y: u.y / this.k };
  }

  toScreen(mx, my) { const o = this._rot(mx * this.k, my * this.k); return { x: o.x + this.x, y: o.y + this.y }; }

  /** Gira deg graus em volta do ponto de tela (cx, cy). */
  rotateAt(cx, cy, deg, animate = false) {
    const r = this.el.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top, o = this._rot(this.x - px, this.y - py, deg);
    this.x = px + o.x; this.y = py + o.y;
    this.r = ((this.r + deg) % 360 + 540) % 360 - 180;   // entre -180 e 180
    this.apply(animate);
  }

  /** Giro absoluto, em volta do centro da tela (ou de um ponto do mapa). */
  setRotation(deg, animate = false, at = null) {
    const r = this.el.getBoundingClientRect();
    const c = at ? this.toScreen(at.x, at.y) : { x: r.width / 2, y: r.height / 2 };
    const d = ((deg - this.r) % 360 + 540) % 360 - 180;
    if (Math.abs(d) < 0.01) return;
    this.rotateAt(r.left + c.x, r.top + c.y, d, animate);
  }

  zoomAt(cx, cy, factor, animate = false) {
    const r = this.el.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const k = Math.max(this.minK, Math.min(this.maxK, this.k * factor));
    this.x = px - (px - this.x) * (k / this.k);
    this.y = py - (py - this.y) * (k / this.k);
    this.k = k;
    this.apply(animate);
  }

  zoomBy(f) {
    const r = this.el.getBoundingClientRect();
    this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, f, true);
  }

  _bind() {
    const el = this.el, ptrs = new Map();
    let moved = 0, start = null, pinch = null, panning = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 1) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        moved = 0; start = { x: e.clientX, y: e.clientY, target: e.target };
        panning = e.button === 1 || this.panEnabled(e);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), turned: 0 }; moved = 99;
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1 && panning) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) {
          if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
          this.x += dx; this.y += dy; this.apply();
        }
      } else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        this.x += dx / 2; this.y += dy / 2;
        if (this.rotateEnabled) {
          // giro com dois dedos: só começa depois de ~12° (para não girar sem querer ao dar zoom)
          let da = (ang - pinch.a) * 180 / Math.PI;
          da = ((da % 360) + 540) % 360 - 180;
          pinch.turned += da;
          if (Math.abs(pinch.turned) > 12 || pinch.rotating) {
            pinch.rotating = true;
            const r = this.el.getBoundingClientRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const o = this._rot(this.x - (mx - r.left), this.y - (my - r.top), da);
            this.x = mx - r.left + o.x; this.y = my - r.top + o.y;
            this.r = ((this.r + da) % 360 + 540) % 360 - 180;
            this.onUserRotate?.();
          }
          pinch.a = ang;
        }
        this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d);
        pinch.d = d;
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0 && e.type === 'pointerup' && moved <= 6 && start) {
        this.onTap?.(this.toMap(e.clientX, e.clientY), e, start.target);
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      this.zoomAt(e.clientX, e.clientY, f);
    }, { passive: false });
  }
}
