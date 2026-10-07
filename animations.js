/* Animaciones de Dental Medina (JS propio, sin librerías).
   - ?captura=1 o prefers-reduced-motion: no se activa nada y todo se ve en su estado final.
   - Los elementos solo se ocultan (html.anim-on) cuando este script ya marcó y observó todo;
     si algo falla, se revierte y el contenido queda completo. */
(function () {
  'use strict';
  var root = document.documentElement;
  var qs = function (s, c) { return (c || document).querySelector(s); };
  var qsa = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var captura = /(?:^|[?&])captura=1(?:&|$)/.test(location.search);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (captura || reduce || !('IntersectionObserver' in window)) {
    root.classList.add('anim-off');
    return;
  }

  var marked = [];   // elementos con data-reveal / data-star para poder revertir
  var pending = [];  // elementos de scroll aún no revelados

  function mark(el, kind) {
    el.setAttribute(kind === 'star' ? 'data-star' : 'data-reveal', kind === 'hero' ? 'hero' : '');
    marked.push(el);
  }
  function kids(el) { return Array.prototype.slice.call(el.children); }

  // Grupo = rejilla o contenedor cuyos hijos son todos tarjetas redondeadas
  function isGroup(el) {
    var c = kids(el);
    if (el.classList.contains('grid') && c.length > 1) return true;
    return c.length > 1 && c.every(function (k) { return /(^|\s)rounded-/.test(k.className || ''); });
  }
  // Devuelve los elementos "unidad" de una sección (encabezado, tarjetas, banners...)
  function sectionItems(container) {
    var out = [];
    kids(container).forEach(function (child) {
      if (isGroup(child)) {
        kids(child).forEach(function (card) { out.push({ el: card, card: true }); });
      } else {
        out.push({ el: child, card: false });
      }
    });
    return out;
  }

  function setupCard(el) {
    el.classList.add('anim-card');
    if (!/(^|\s)transition/.test(el.className)) el.classList.add('anim-trans');
  }

  function init() {
    var d = qs('#vista-escritorio');
    var m = qs('#vista-movil');
    if (!d || !m) throw new Error('contenedores no encontrados');

    var heroItems = [];   // { el, delay }
    var scrollItems = []; // el

    // ---------- HERO (se anima al cargar: texto y luego imagen) ----------
    var dGrid = qs('#inicio .grid', d);
    if (dGrid) {
      var left = dGrid.children[0], right = dGrid.children[1];
      kids(left).forEach(function (k, i) { heroItems.push({ el: k, delay: i * 110 }); });
      heroItems.push({ el: right, delay: kids(left).length * 110 + 150 });
      var portrait = qs('.shadow-card', right);
      if (portrait) setupCard(portrait);
    }
    var mHero = qs('#m-inicio', m);
    if (mHero) {
      var t = 0;
      kids(mHero).forEach(function (k) {
        if (k.querySelector('img')) t += 150;
        heroItems.push({ el: k, delay: t });
        t += 110;
      });
    }

    // ---------- SECCIONES (al hacer scroll) ----------
    var dSections = qsa('section', d).filter(function (s) { return s.id !== 'inicio'; });
    dSections.forEach(function (s) {
      var container = kids(s).length === 1 && kids(s)[0].tagName === 'DIV' ? s.children[0] : s;
      sectionItems(container).forEach(function (it) { scrollItems.push(it); });
    });
    var dFooter = qs('footer', d);
    if (dFooter) sectionItems(dFooter.children[0]).forEach(function (it) { it.card = false; scrollItems.push(it); });

    qsa('main section', m).filter(function (s) { return s.id !== 'm-inicio'; }).forEach(function (s) {
      sectionItems(s).forEach(function (it) { scrollItems.push(it); });
    });
    var mFooter = qs('footer', m);
    if (mFooter) kids(mFooter).forEach(function (k) { scrollItems.push({ el: k, card: false }); });

    // Tarjetas: hover en escritorio
    scrollItems.forEach(function (it) { if (it.card && d.contains(it.el)) setupCard(it.el); });

    // ---------- ESTRELLAS de testimonios ----------
    var testiSecs = qsa('section').filter(function (s) { return /Lo que dicen los pacientes/.test(s.textContent); });
    testiSecs.forEach(function (s) {
      qsa('.material-symbols-outlined', s).forEach(function (ic) {
        if (ic.textContent.trim() === 'star') mark(ic, 'star');
      });
    });

    // ---------- Marcar todo ANTES de activar el estado oculto ----------
    heroItems.forEach(function (h) { mark(h.el, 'hero'); });
    scrollItems.forEach(function (it) { mark(it.el, 'reveal'); pending.push(it.el); });

    // ---------- Revelado ----------
    function showStars(el, baseDelay) {
      var stars = qsa('[data-star]', el);
      stars.forEach(function (st, i) {
        st.style.animationDelay = (baseDelay + 280 + i * 70) + 'ms';
        st.classList.add('star-in');
      });
    }
    function reveal(el, delay) {
      if (el.classList.contains('is-visible')) return;
      el.style.animationDelay = delay + 'ms';
      el.classList.add('is-visible');
      showStars(el, delay);
      var i = pending.indexOf(el);
      if (i > -1) pending.splice(i, 1);
      if (io) io.unobserve(el);
    }

    var io = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (e) {
        // visible, o ya quedó por encima del viewport (carga con scroll previo / salto de ancla)
        return e.isIntersecting || e.boundingClientRect.top < 0;
      });
      batch.sort(function (a, b) {
        return (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });
      var n = 0;
      batch.forEach(function (e) {
        var above = !e.isIntersecting;
        reveal(e.target, above ? 0 : Math.min(n * 100, 400));
        if (!above) n++;
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    scrollItems.forEach(function (it) { io.observe(it.el); });

    // Al llegar al final de la página, revelar lo que quede (pie de página)
    function checkEnd() {
      if (window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 4) {
        pending.slice().forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) reveal(el, 0);
        });
      }
    }
    window.addEventListener('scroll', checkEnd, { passive: true });

    // Activar estado oculto y lanzar el hero al cargar
    root.classList.add('anim-on');
    void root.offsetWidth;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        heroItems.forEach(function (h) { reveal(h.el, h.delay); });
      });
    });
  }

  try {
    init();
  } catch (err) {
    root.classList.remove('anim-on');
    root.classList.add('anim-off');
    marked.forEach(function (el) { el.removeAttribute('data-reveal'); el.removeAttribute('data-star'); });
    if (window.console) console.warn('animations.js desactivado:', err);
  }
})();
