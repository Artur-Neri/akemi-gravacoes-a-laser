// ============================================================
// Configuração do Directus (self-hosted)
// ============================================================
const CONFIG = {
  baseUrl: 'https://cms.arturneri.me',
  collection: 'trabalhos',
};

// Parâmetros de transformação de imagem do Directus
const THUMB_PARAMS = 'width=600&height=600&fit=cover&quality=80&format=webp';
const FULL_PARAMS  = 'width=1200&quality=85&format=webp';

// ============================================================
// Elementos do DOM
// ============================================================
const gallery = document.getElementById('gallery');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('empty');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const modalCaption = document.getElementById('modal-caption');
const modalClose = document.querySelector('.modal-close');
const modalPrev = document.getElementById('modal-prev');
const modalNext = document.getElementById('modal-next');
const modalCounter = document.getElementById('modal-counter');

// ============================================================
// Estado do carrossel e filtro
// ============================================================
let carouselImages = [];
let carouselIndex = 0;
let carouselCaption = '';
let lastFocusedElement = null;
let allItems = [];
let activeTema = 'todos';
let activeModelo = 'todos';
let temaMap = {};
let modeloMap = {};

const filters = document.getElementById('filters');

// ============================================================
// Buscar itens do Directus
// ============================================================
async function fetchPortfolio() {
  const url =
    `${CONFIG.baseUrl}/items/${CONFIG.collection}` +
    `?fields=id,titulo,descricao,tema,modelo,sort,fotos.ordem,fotos.arquivo.id` +
    `&sort=sort&limit=100`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return parseItems(data);
  } catch (err) {
    console.error('Erro ao carregar portfolio:', err);
    return [];
  }
}

// ============================================================
// Mapear resposta do Directus para objetos simples
// ============================================================
function parseItems(data) {
  const toFacet = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((c) => ({ key: String(c).toLowerCase().trim(), label: String(c).trim() }))
      .filter((e) => e.key.length > 0);

  return (data.data || []).map((item) => {
    const images = (item.fotos || [])
      .slice()
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((f) => (f.arquivo?.id ? `${CONFIG.baseUrl}/assets/${f.arquivo.id}` : null))
      .filter(Boolean);

    const temas = toFacet(item.tema);
    const modelos = toFacet(item.modelo);

    return {
      title: item.titulo || '',
      description: item.descricao || '',
      images,
      temas: temas.map((e) => e.key),
      temaLabels: temas.map((e) => e.label),
      modelos: modelos.map((e) => e.key),
      modeloLabels: modelos.map((e) => e.label),
    };
  });
}

// ============================================================
// Renderizar galeria
// ============================================================
function renderFilters() {
  const temaEntries   = [['todos', 'Todos'], ...Object.entries(temaMap)];
  const modeloEntries = [['todos', 'Todos'], ...Object.entries(modeloMap)];

  const makeBtn = (type, key, label, active) =>
    `<button class="filter-btn${active ? ' active' : ''}" data-type="${type}" data-filter="${key}">${escapeHtml(label)}</button>`;

  filters.innerHTML = `
    <div class="filter-group">
      <span class="filter-group-label">Tema</span>
      ${temaEntries.map(([k, l]) => makeBtn('tema', k, l, k === activeTema)).join('')}
    </div>
    <div class="filter-group">
      <span class="filter-group-label">Modelo</span>
      ${modeloEntries.map(([k, l]) => makeBtn('modelo', k, l, k === activeModelo)).join('')}
    </div>`;
}

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  const { type, filter } = btn.dataset;
  if (type === 'tema') {
    activeTema   = filter;
    activeModelo = 'todos';
  } else if (type === 'modelo') {
    activeModelo = filter;
    activeTema   = 'todos';
  }

  renderFilters();
  renderGallery(getFilteredItems());
});

function getFilteredItems() {
  return allItems.filter((item) => {
    const temaOk   = activeTema   === 'todos' || item.temas.includes(activeTema);
    const modeloOk = activeModelo === 'todos' || item.modelos.includes(activeModelo);
    return temaOk && modeloOk;
  });
}

function renderGallery(items) {
  loading.hidden = true;

  if (items.length === 0) {
    emptyState.hidden = false;
    gallery.innerHTML = '';
    return;
  }

  emptyState.hidden = true;
  gallery.innerHTML = items
    .filter((item) => item.images.length > 0)
    .map(
      (item) => `
      <article class="gallery-item"
               data-images="${escapeAttr(JSON.stringify(item.images))}"
               data-caption="${escapeAttr(item.title)}${item.description ? ' — ' + escapeAttr(item.description) : ''}">
        <img src="${escapeAttr(item.images[0])}?${THUMB_PARAMS}"
             alt="${escapeAttr(item.title)}"
             loading="lazy">
        ${item.images.length > 1 ? `<span class="gallery-item-badge">${item.images.length} fotos</span>` : ''}
        ${
          item.title || item.description || item.temaLabels.length > 0
            ? `<div class="gallery-item-info">
                ${item.temaLabels.length > 0 ? `<div class="gallery-item-tags">${item.temaLabels.map((t) => `<span class="gallery-item-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                ${item.title ? `<p class="gallery-item-title">${escapeHtml(item.title)}</p>` : ''}
                ${item.description ? `<p class="gallery-item-desc">${escapeHtml(item.description)}</p>` : ''}
               </div>`
            : ''
        }
      </article>
    `
    )
    .join('');
}

// ============================================================
// Modal / Carrossel
// ============================================================
function showSlide(index) {
  carouselIndex = index;

  const hasMultiple = carouselImages.length > 1;
  modalPrev.hidden = !hasMultiple;
  modalNext.hidden = !hasMultiple;
  modalCounter.hidden = !hasMultiple;

  if (hasMultiple) {
    modalCounter.textContent = `${index + 1} / ${carouselImages.length}`;
  }

  // Fade out + mostrar spinner
  modalImg.classList.add('is-loading');
  modal.classList.add('is-loading');

  const newSrc = carouselImages[index] + '?' + FULL_PARAMS;

  const img = new Image();
  img.onload = () => {
    modalImg.src = newSrc;
    modalImg.alt = carouselCaption;
    modalImg.classList.remove('is-loading');
    modal.classList.remove('is-loading');
  };
  img.onerror = () => {
    modalImg.src = newSrc;
    modalImg.alt = carouselCaption;
    modalImg.classList.remove('is-loading');
    modal.classList.remove('is-loading');
  };
  img.src = newSrc;
}

gallery.addEventListener('click', (e) => {
  const item = e.target.closest('.gallery-item');
  if (!item) return;

  carouselImages = JSON.parse(item.dataset.images);
  carouselCaption = item.dataset.caption;

  modalCaption.textContent = carouselCaption;
  showSlide(0);
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
});

gallery.addEventListener('focusin', (e) => {
  const item = e.target.closest('.gallery-item');
  if (item) lastFocusedElement = item;
});

function closeModal() {
  modal.hidden = true;
  modalImg.src = '';
  carouselImages = [];
  document.body.style.overflow = '';
  if (lastFocusedElement) lastFocusedElement.focus();
}

function prevSlide() {
  if (carouselImages.length <= 1) return;
  const index = carouselIndex === 0 ? carouselImages.length - 1 : carouselIndex - 1;
  showSlide(index);
}

function nextSlide() {
  if (carouselImages.length <= 1) return;
  const index = carouselIndex === carouselImages.length - 1 ? 0 : carouselIndex + 1;
  showSlide(index);
}

modalClose.addEventListener('click', closeModal);
modalPrev.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });
modalNext.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (modal.hidden) return;
  if (e.key === 'Escape') closeModal();
  if (e.key === 'ArrowLeft') prevSlide();
  if (e.key === 'ArrowRight') nextSlide();
});

// ============================================================
// Touch/swipe no modal
// ============================================================
let touchStartX = 0;
let touchEndX = 0;

modal.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

modal.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchStartX - touchEndX;
  if (Math.abs(diff) > 50) {
    if (diff > 0) nextSlide();
    else prevSlide();
  }
});

// ============================================================
// Helpers
// ============================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// Init
// ============================================================
async function init() {
  allItems = await fetchPortfolio();

  // Constrói os mapas de tema e modelo a partir da resposta da API
  temaMap = {};
  modeloMap = {};
  for (const item of allItems) {
    for (let i = 0; i < item.temas.length; i++) {
      if (!temaMap[item.temas[i]]) temaMap[item.temas[i]] = item.temaLabels[i];
    }
    for (let i = 0; i < item.modelos.length; i++) {
      if (!modeloMap[item.modelos[i]]) modeloMap[item.modelos[i]] = item.modeloLabels[i];
    }
  }

  renderFilters();
  renderGallery(allItems);
}

init();
