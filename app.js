// ============================================================
// Configuração do Contentful
// Substitua pelos seus dados após criar o space no Contentful
// ============================================================
const CONFIG = {
  spaceId: 'evyvfnl7b8lc',
  accessToken: 'Ga8S3DR6Gpg8KZHeRFngjTey5ID2fPtmgF2-SZChSns',
  contentType: 'portfolioItem',
};

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
let activeFilter = 'todos';

const CATEGORIAS = {
  todos: 'Todos',
  anime: 'Anime',
  basico: 'Básico',
  clube: 'Clube',
  fofo: 'Fofo',
  japao: 'Japão',
  profissao: 'Profissão',
  tipografia: 'Tipografia',
};
const filters = document.getElementById('filters');

// ============================================================
// Buscar itens do Contentful
// ============================================================
async function fetchPortfolio() {
  const url =
    `https://cdn.contentful.com/spaces/${CONFIG.spaceId}/entries` +
    `?access_token=${CONFIG.accessToken}` +
    `&content_type=${CONFIG.contentType}` +
    `&order=-sys.createdAt`;

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
// Mapear resposta do Contentful para objetos simples
// ============================================================
function parseItems(data) {
  const assets = {};
  if (data.includes && data.includes.Asset) {
    for (const asset of data.includes.Asset) {
      assets[asset.sys.id] = {
        url: 'https:' + asset.fields.file.url,
        title: asset.fields.title || '',
      };
    }
  }

  return data.items.map((item) => {
    const fields = item.fields;

    // foto pode ser um link único ou um array de links
    const fotoField = fields.foto;
    const images = [];
    if (Array.isArray(fotoField)) {
      for (const ref of fotoField) {
        const id = ref.sys?.id;
        if (id && assets[id]) images.push(assets[id].url);
      }
    } else if (fotoField?.sys?.id && assets[fotoField.sys.id]) {
      images.push(assets[fotoField.sys.id].url);
    }

    // descricao pode ser Rich Text (objeto) ou texto simples
    let description = '';
    if (typeof fields.descricao === 'string') {
      description = fields.descricao;
    } else if (fields.descricao?.content) {
      description = fields.descricao.content
        .filter((block) => block.nodeType === 'paragraph')
        .map((block) => block.content.map((node) => node.value || '').join(''))
        .join(' ');
    }

    // categorias vêm como array de strings do Contentful
    const categories = Array.isArray(fields.categoria)
      ? fields.categoria.map((c) => c.toLowerCase())
      : [];

    return {
      title: fields.titulo || '',
      description,
      images,
      categories,
    };
  });
}

// ============================================================
// Renderizar galeria
// ============================================================
function renderFilters() {
  // Descobre quais categorias existem nos itens carregados
  const usedCategories = new Set();
  for (const item of allItems) {
    for (const cat of item.categories) usedCategories.add(cat);
  }

  filters.innerHTML = Object.entries(CATEGORIAS)
    .filter(([key]) => key === 'todos' || usedCategories.has(key))
    .map(
      ([key, label]) =>
        `<button class="filter-btn${key === activeFilter ? ' active' : ''}" data-filter="${key}">${escapeHtml(label)}</button>`
    )
    .join('');
}

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  activeFilter = btn.dataset.filter;
  filters.querySelector('.filter-btn.active')?.classList.remove('active');
  btn.classList.add('active');
  renderGallery(getFilteredItems());
});

function getFilteredItems() {
  if (activeFilter === 'todos') return allItems;
  return allItems.filter((item) => item.categories.includes(activeFilter));
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
        <img src="${escapeAttr(item.images[0])}?w=600&amp;h=600&amp;fit=fill&amp;q=80&amp;fm=webp"
             alt="${escapeAttr(item.title)}"
             loading="lazy">
        ${item.images.length > 1 ? `<span class="gallery-item-badge">${item.images.length} fotos</span>` : ''}
        ${
          item.title || item.description
            ? `<div class="gallery-item-info">
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

  const newSrc = carouselImages[index] + '?w=1200&q=85&fm=webp';

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
  // Verifica se as credenciais foram configuradas
  if (CONFIG.spaceId === 'SEU_SPACE_ID' || CONFIG.accessToken === 'SEU_ACCESS_TOKEN') {
    loading.hidden = true;
    emptyState.hidden = false;
    emptyState.innerHTML = '<p>Configure suas credenciais do Contentful no arquivo <code>app.js</code></p>';
    console.warn(
      'Contentful não configurado. Edite CONFIG no app.js com seu spaceId e accessToken.'
    );
    return;
  }

  allItems = await fetchPortfolio();
  renderFilters();
  renderGallery(allItems);
}

init();
