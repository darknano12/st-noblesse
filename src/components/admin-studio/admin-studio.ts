import { bus } from '../../core/bus';
import { pb } from '../../services/pocketbase';
import { getLanguageSettings, saveLanguageSettings, t } from '../../core/i18n';
import type { CatalogApi } from '../../core/catalog-store';
import type { Family, Gender, LanguageSettings, Product, ProductFormData } from '../../core/types';
import { escapeHtml, must } from '../../utils/dom';

export interface AdminStudioApi {
  open(product?: Product): void;
  close(): void;
}

export function initAdminStudio(
  catalog: CatalogApi,
  images: Record<string, string>
): AdminStudioApi {
  const modal = must('#adminStudioModal');
  const overlay = must('#adminStudioOverlay');
  const closeBtn = must('#adminStudioClose');

  // Navigation tabs & views
  const tabFragrances = must<HTMLButtonElement>('#adminTabFragrances');
  const tabLanguages = must<HTMLButtonElement>('#adminTabLanguages');
  const viewFragrances = must('#adminViewFragrances');
  const viewLanguages = must('#adminViewLanguages');

  // Fragrance list & form
  const listEl = must('#adminProductList');
  const newBtn = must('#adminNewProductBtn');
  const form = must<HTMLFormElement>('#adminProductForm');
  const formTitle = must('#adminFormTitle');

  // Form fields
  const idInput = must<HTMLInputElement>('#adminProductId');
  const recordIdInput = must<HTMLInputElement>('#adminProductRecordId');
  const nameInput = must<HTMLInputElement>('#adminProductName');
  const familySelect = must<HTMLSelectElement>('#adminProductFamily');
  const genderSelect = must<HTMLSelectElement>('#adminProductGender');
  const badgeInput = must<HTMLInputElement>('#adminProductBadge');
  const price50Input = must<HTMLInputElement>('#adminProductPrice50');
  const price100Input = must<HTMLInputElement>('#adminProductPrice100');
  const descTextarea = must<HTMLTextAreaElement>('#adminProductDesc');
  const descBadge = must('#adminDescLangBadge');
  const descLangTabs = must('#adminDescLangTabs');
  const notesTopInput = must<HTMLInputElement>('#adminProductNotesTop');
  const notesHeartInput = must<HTMLInputElement>('#adminProductNotesHeart');
  const notesBaseInput = must<HTMLInputElement>('#adminProductNotesBase');

  // Device Image upload elements
  const uploadZone = must('#adminUploadZone');
  const fileInput = must<HTMLInputElement>('#adminProductFileInput');
  const imageInput = must<HTMLInputElement>('#adminProductImage');
  const imagePreview = must<HTMLImageElement>('#adminProductImagePreview');
  const uploadBtn = must<HTMLButtonElement>('#adminUploadBtn');
  const removeImageBtn = must<HTMLButtonElement>('#adminRemoveImageBtn');

  const PLACEHOLDER_IMG = 'img/placeholder.svg';

  function resolveProductImg(imgStr?: string): string {
    if (!imgStr || !imgStr.trim()) return PLACEHOLDER_IMG;
    const trimmed = imgStr.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('http') || trimmed.startsWith('img/')) {
      return trimmed;
    }
    return images[trimmed] || PLACEHOLDER_IMG;
  }

  function updateRemoveImageBtn(): void {
    const val = imageInput.value.trim();
    const hasImage = Boolean(val && val !== PLACEHOLDER_IMG);
    removeImageBtn.style.display = hasImage ? 'inline-flex' : 'none';
  }

  // Buttons
  const saveBtn = must<HTMLButtonElement>('#adminSaveBtn');
  const deleteBtn = must<HTMLButtonElement>('#adminDeleteBtn');

  // Language management elements
  const toggleLangSwitcher = must<HTMLInputElement>('#adminToggleLangSwitcher');
  const langDeChk = must<HTMLInputElement>('#adminLangDe');
  const langEnChk = must<HTMLInputElement>('#adminLangEn');
  const langFrChk = must<HTMLInputElement>('#adminLangFr');
  const langEsChk = must<HTMLInputElement>('#adminLangEs');
  const saveLanguagesBtn = must<HTMLButtonElement>('#adminSaveLanguagesBtn');

  let activeProductId: string | null = null;
  let activeDescLang: 'de' | 'en' | 'fr' | 'es' = 'en';
  let descMap: Record<'de' | 'en' | 'fr' | 'es', string> = { de: '', en: '', fr: '', es: '' };

  /* ------------------------------------------------------------------ */
  /* 1. Modal Open / Close & Tab Switching                              */
  /* ------------------------------------------------------------------ */

  function switchStudioTab(tab: 'fragrances' | 'languages') {
    if (tab === 'fragrances') {
      tabFragrances.classList.add('active');
      tabLanguages.classList.remove('active');
      viewFragrances.style.display = 'grid';
      viewLanguages.style.display = 'none';
    } else {
      tabLanguages.classList.add('active');
      tabFragrances.classList.remove('active');
      viewLanguages.style.display = 'flex';
      viewFragrances.style.display = 'none';
      syncLanguageSettingsForm();
    }
  }

  tabFragrances.addEventListener('click', () => switchStudioTab('fragrances'));
  tabLanguages.addEventListener('click', () => switchStudioTab('languages'));

  function open(product?: Product) {
    const user = pb.getCurrentUser();
    if (!user || !user.isAdmin) {
      bus.emit('toast:show', {
        html: 'Access restricted to Atelier Directors. Please authenticate.',
      });
      bus.emit('auth:open', undefined);
      return;
    }

    switchStudioTab('fragrances');
    renderList();

    if (product) {
      loadProduct(product);
    } else {
      const all = catalog.all();
      if (all.length > 0) {
        loadProduct(all[0]);
      } else {
        createNew();
      }
    }

    modal.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    modal.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);

  /* ------------------------------------------------------------------ */
  /* 2. Language Settings Management                                    */
  /* ------------------------------------------------------------------ */

  function syncLanguageSettingsForm() {
    const settings = getLanguageSettings();
    toggleLangSwitcher.checked = settings.showSwitcher;
    langDeChk.checked = settings.languages.de !== false;
    langEnChk.checked = true;
    langFrChk.checked = settings.languages.fr !== false;
    langEsChk.checked = settings.languages.es !== false;
  }

  saveLanguagesBtn.addEventListener('click', () => {
    const newSettings: LanguageSettings = {
      showSwitcher: toggleLangSwitcher.checked,
      languages: {
        de: langDeChk.checked,
        en: true,
        fr: langFrChk.checked,
        es: langEsChk.checked,
      },
    };

    saveLanguageSettings(newSettings);
    bus.emit('toast:show', {
      html: t('admin.lang_saved_toast') || 'Language settings saved successfully',
    });
  });

  /* ------------------------------------------------------------------ */
  /* 3. Product List & Selection                                        */
  /* ------------------------------------------------------------------ */

  function renderList() {
    const products = catalog.all();
    listEl.innerHTML = products.map((p) => {
      const imgSrc = resolveProductImg(p.img);
      const isActive = p.id === activeProductId ? 'active' : '';
      return `
        <div class="admin-item-card ${isActive}" data-id="${escapeHtml(p.id)}">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.name)}" class="admin-item-thumb" />
          <div class="admin-item-info">
            <span class="admin-item-name">${escapeHtml(p.name)}</span>
            <span class="admin-item-sub">${escapeHtml(p.fam)} • €${p.price['50'] || 89}</span>
          </div>
          ${p.badge ? `<span class="admin-item-badge">${escapeHtml(p.badge)}</span>` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.admin-item-card').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) {
          const found = catalog.byId(id);
          if (found) loadProduct(found);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 4. Multilingual Description Tabs                                   */
  /* ------------------------------------------------------------------ */

  function parseDescriptions(desc: any) {
    descMap = { de: '', en: '', fr: '', es: '' };
    if (!desc) return;
    if (typeof desc === 'object' && desc !== null) {
      descMap.de = desc.de || '';
      descMap.en = desc.en || '';
      descMap.fr = desc.fr || '';
      descMap.es = desc.es || '';
      return;
    }
    if (typeof desc === 'string') {
      const trimmed = desc.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed === 'object' && parsed !== null) {
            descMap.de = parsed.de || '';
            descMap.en = parsed.en || '';
            descMap.fr = parsed.fr || '';
            descMap.es = parsed.es || '';
            return;
          }
        } catch {}
      }
      descMap.en = desc;
    }
  }

  function setDescLang(lang: 'de' | 'en' | 'fr' | 'es', saveCurrent: boolean = true) {
    if (saveCurrent) {
      descMap[activeDescLang] = descTextarea.value;
    }

    activeDescLang = lang;

    // Update tab pills
    descLangTabs.querySelectorAll('.desc-lang-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-desc-lang') === lang);
    });

    // Populate textarea with selected translation
    descTextarea.value = descMap[lang] || '';

    if (lang === 'de') {
      descBadge.textContent = 'Editing in Deutsch (DE)';
      descTextarea.placeholder = 'Poetische olfaktorische Reise auf Deutsch...';
    } else if (lang === 'fr') {
      descBadge.textContent = 'Editing in Français (FR)';
      descTextarea.placeholder = 'Voyage sensoriel poétique en français...';
    } else if (lang === 'es') {
      descBadge.textContent = 'Editing in Español (ES)';
      descTextarea.placeholder = 'Viaje sensorial poético en español...';
    } else {
      descBadge.textContent = 'Editing in English (EN)';
      descTextarea.placeholder = 'Poetic sensory journey in English...';
    }
  }

  descLangTabs.querySelectorAll('.desc-lang-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-desc-lang') as 'de' | 'en' | 'fr' | 'es';
      if (lang && lang !== activeDescLang) {
        setDescLang(lang, true);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* 5. Device Image Upload & Optimization                              */
  /* ------------------------------------------------------------------ */

  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleImageFile(file);
  });

  // Drag and drop handlers
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageFile(file);
  });

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      bus.emit('toast:show', { html: 'Please select a valid image file (JPG, PNG, WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      bus.emit('toast:show', { html: 'Image file is too large. Maximum size is 5 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      optimizeImage(rawDataUrl, (optimizedDataUrl) => {
        imageInput.value = optimizedDataUrl;
        imagePreview.src = optimizedDataUrl;
        updateRemoveImageBtn();
        bus.emit('toast:show', { html: 'Image loaded from device successfully.' });
      });
    };
    reader.readAsDataURL(file);
  }

  function optimizeImage(dataUrl: string, callback: (result: string) => void) {
    const img = new Image();
    img.onload = () => {
      const maxW = 1000;
      const maxH = 1250;
      let width = img.width;
      let height = img.height;

      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        callback(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      // High-quality JPEG or WebP representation
      const optimized = canvas.toDataURL('image/jpeg', 0.88);
      callback(optimized);
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  }

  removeImageBtn.addEventListener('click', () => {
    imageInput.value = '';
    fileInput.value = '';
    imagePreview.src = PLACEHOLDER_IMG;
    updateRemoveImageBtn();
    bus.emit('toast:show', {
      html: t('admin.image_removed_toast') || 'Image removed from fragrance.',
    });
  });

  /* ------------------------------------------------------------------ */
  /* 6. Form Loading, Creation & Saving                                 */
  /* ------------------------------------------------------------------ */

  function loadProduct(p: Product) {
    activeProductId = p.id;
    formTitle.textContent = `${t('admin.edit_title') || 'Edit'}: ${p.name}`;
    idInput.value = p.id;
    recordIdInput.value = p.recordId || '';
    nameInput.value = p.name;
    familySelect.value = p.fam;
    genderSelect.value = p.gender;
    badgeInput.value = p.badge || '';
    price50Input.value = String(p.price?.['50'] || 89);
    price100Input.value = String(p.price?.['100'] || 129);

    // Multilingual description - preserve loaded text without overwriting from empty textarea
    parseDescriptions(p.desc);
    activeDescLang = 'en';
    setDescLang('en', false);

    const notes = p.notes || { top: [], heart: [], base: [] };
    notesTopInput.value = (notes.top || []).join(', ');
    notesHeartInput.value = (notes.heart || []).join(', ');
    notesBaseInput.value = (notes.base || []).join(', ');

    // Image
    const imgSrc = resolveProductImg(p.img);
    imageInput.value = p.img || '';
    fileInput.value = '';
    imagePreview.src = imgSrc;
    updateRemoveImageBtn();

    deleteBtn.style.display = 'inline-block';
    renderList();
  }

  function createNew() {
    activeProductId = null;
    formTitle.textContent = t('admin.create_title') || '+ New Fragrance';
    idInput.value = '';
    recordIdInput.value = '';
    nameInput.value = '';
    familySelect.value = 'floral';
    genderSelect.value = 'Unisex';
    badgeInput.value = '';
    price50Input.value = '95';
    price100Input.value = '145';

    descMap = { de: '', en: '', fr: '', es: '' };
    activeDescLang = 'en';
    setDescLang('en', false);

    notesTopInput.value = '';
    notesHeartInput.value = '';
    notesBaseInput.value = '';

    imageInput.value = '';
    fileInput.value = '';
    imagePreview.src = PLACEHOLDER_IMG;
    updateRemoveImageBtn();

    deleteBtn.style.display = 'none';
    nameInput.focus();
    renderList();
  }

  newBtn.addEventListener('click', () => {
    createNew();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    if (!name) return;

    // Flush current typing in description tab
    descMap[activeDescLang] = descTextarea.value.trim();

    // Prepare description: if multiple translations present, store JSON
    const hasTranslations = Boolean(descMap.de || descMap.fr || descMap.es);
    const finalDesc = hasTranslations ? JSON.stringify(descMap) : (descMap.en || '');

    const parseNotes = (str: string) =>
      str.split(',').map((s) => s.trim()).filter(Boolean);

    const formData: ProductFormData = {
      id: idInput.value || undefined,
      recordId: recordIdInput.value || undefined,
      name,
      family: familySelect.value as Family,
      gender: genderSelect.value as Gender,
      badge: badgeInput.value.trim(),
      desc: finalDesc,
      desc_translations: descMap,
      price_50: Number(price50Input.value) || 89,
      price_100: Number(price100Input.value) || 129,
      notes_top: parseNotes(notesTopInput.value),
      notes_heart: parseNotes(notesHeartInput.value),
      notes_base: parseNotes(notesBaseInput.value),
      image: imageInput.value.trim(),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const saved = await pb.saveProduct(formData);
      
      // Update catalog and persist immediately
      const all = catalog.all();
      const idx = all.findIndex((p) => p.id === saved.id || (saved.recordId && p.recordId === saved.recordId));
      if (idx >= 0) {
        all[idx] = saved;
      } else {
        all.unshift(saved);
      }
      catalog.setProducts([...all]);
      pb.saveLocalProducts(catalog.all());

      bus.emit('admin:product-saved', saved);
      renderList();
      bus.emit('toast:show', {
        html: `${t('admin.save_success') || 'Saved'}: <b>${saved.name}</b>`,
      });

      loadProduct(saved);
    } catch (err: any) {
      bus.emit('toast:show', {
        html: `Error: ${err.message || 'Could not save fragrance.'}`,
      });
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = t('admin.save_btn') || 'Save Fragrance';
    }
  });

  deleteBtn.addEventListener('click', async () => {
    if (!activeProductId) return;
    const current = catalog.byId(activeProductId);
    const confirmed = window.confirm(
      `Are you sure you want to retire ${current?.name || 'this fragrance'} from the boutique?`
    );
    if (!confirmed) return;

    deleteBtn.disabled = true;

    try {
      const targetId = current?.recordId || recordIdInput.value || activeProductId;
      await pb.deleteProduct(targetId);

      const remaining = catalog.all().filter((p) => p.id !== activeProductId && p.recordId !== targetId);
      catalog.setProducts(remaining);
      pb.saveLocalProducts(remaining);

      bus.emit('admin:product-deleted', { productId: activeProductId });
      bus.emit('toast:show', { html: t('admin.delete_success') || 'Fragrance retired.' });

      createNew();
    } catch (err: any) {
      bus.emit('toast:show', {
        html: `Error: ${err.message || 'Could not remove fragrance.'}`,
      });
    } finally {
      deleteBtn.disabled = false;
    }
  });

  bus.on('admin:open', () => open());

  return { open, close };
}
