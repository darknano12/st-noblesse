import { bus } from '../../core/bus';
import { pb } from '../../services/pocketbase';
import {
  getLanguageSettings,
  getLocalizedText,
  saveLanguageSettings,
  t,
  NOTRESUCCES_LOCALES,
  type Locale,
} from '../../core/i18n';
import type { CatalogApi } from '../../core/catalog-store';
import type { Family, Gender, LanguageSettings, Product, ProductFormData, Review } from '../../core/types';
import { escapeHtml, must } from '../../utils/dom';
import { getReviewText } from '../reviews/reviews';

export interface AdminStudioApi {
  open(product?: Product): void;
  close(): void;
  switchTab(tab: 'fragrances' | 'languages' | 'reviews'): void;
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
  const tabReviews = must<HTMLButtonElement>('#adminTabReviews');
  const viewFragrances = must('#adminViewFragrances');
  const viewLanguages = must('#adminViewLanguages');
  const viewReviews = must('#adminViewReviews');

  // Fragrance list & form
  const listEl = must('#adminProductList');
  const newBtn = must('#adminNewProductBtn');
  const form = must<HTMLFormElement>('#adminProductForm');
  const formTitle = must('#adminFormTitle');

  // Fragrance Form fields
  const idInput = must<HTMLInputElement>('#adminProductId');
  const recordIdInput = must<HTMLInputElement>('#adminProductRecordId');
  const nameInput = must<HTMLInputElement>('#adminProductName');
  const familySelect = must<HTMLSelectElement>('#adminProductFamily');
  const genderSelect = must<HTMLSelectElement>('#adminProductGender');
  const badgeInput = must<HTMLInputElement>('#adminProductBadge');
  const price50Input = must<HTMLInputElement>('#adminProductPrice50');
  const price100Input = must<HTMLInputElement>('#adminProductPrice100');
  const discountInput = must<HTMLInputElement>('#adminProductDiscount');
  const discountLabelInput = must<HTMLInputElement>('#adminProductDiscountLabel');
  const descTextarea = must<HTMLTextAreaElement>('#adminProductDesc');
  const productLangBadge = must('#adminProductLangBadge');
  const productLangTabs = must('#adminProductLangTabs');
  const notesTopInput = must<HTMLInputElement>('#adminProductNotesTop');
  const notesHeartInput = must<HTMLInputElement>('#adminProductNotesHeart');
  const notesBaseInput = must<HTMLInputElement>('#adminProductNotesBase');
  const inStockCheckbox = must<HTMLInputElement>('#adminProductInStock');
  const stockStatusLabel = must<HTMLElement>('#adminStockStatusLabel');

  function updateStockStatusUi(inStock: boolean) {
    inStockCheckbox.checked = inStock;
    stockStatusLabel.textContent = inStock
      ? (t('admin.stock_in') || 'In Stock (Available)')
      : (t('admin.stock_out') || 'Out of Stock (Unavailable)');
    stockStatusLabel.style.color = inStock ? 'var(--gold-soft)' : '#e08282';
  }

  inStockCheckbox.addEventListener('change', () => {
    updateStockStatusUi(inStockCheckbox.checked);
  });

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

  // Fragrance Buttons
  const saveBtn = must<HTMLButtonElement>('#adminSaveBtn');
  const deleteBtn = must<HTMLButtonElement>('#adminDeleteBtn');

  // Language management elements (Notre Succès standard)
  const toggleLangSwitcher = must<HTMLInputElement>('#adminToggleLangSwitcher');
  const defaultLangSelect = must<HTMLSelectElement>('#adminDefaultLang');
  const switcherPositionSelect = must<HTMLSelectElement>('#adminSwitcherPosition');
  const langEnChk = must<HTMLInputElement>('#adminLangEn');
  const langDeChk = must<HTMLInputElement>('#adminLangDe');
  const langNlChk = must<HTMLInputElement>('#adminLangNl');
  const langFrChk = must<HTMLInputElement>('#adminLangFr');
  const langEsChk = must<HTMLInputElement>('#adminLangEs');
  const langItChk = must<HTMLInputElement>('#adminLangIt');
  const langNbChk = must<HTMLInputElement>('#adminLangNb');
  const langSvChk = must<HTMLInputElement>('#adminLangSv');
  const langDaChk = must<HTMLInputElement>('#adminLangDa');
  const saveLanguagesBtn = must<HTMLButtonElement>('#adminSaveLanguagesBtn');

  // Client Reviews management elements
  const reviewList = must('#adminReviewList');
  const newReviewBtn = must<HTMLButtonElement>('#adminNewReviewBtn');
  const reviewForm = must<HTMLFormElement>('#adminReviewForm');
  const reviewFormTitle = must('#adminReviewFormTitle');
  const reviewIdInput = must<HTMLInputElement>('#adminReviewId');
  const reviewAuthorInput = must<HTMLInputElement>('#adminReviewAuthor');
  const reviewRatingSelect = must<HTMLSelectElement>('#adminReviewRating');
  const reviewLocationInput = must<HTMLInputElement>('#adminReviewLocation');
  const reviewTextInput = must<HTMLTextAreaElement>('#adminReviewText');
  const reviewLangTabs = must('#adminReviewLangTabs');
  const reviewLangBadge = must('#adminReviewLangBadge');
  const deleteReviewBtn = must<HTMLButtonElement>('#adminDeleteReviewBtn');
  const saveReviewBtn = must<HTMLButtonElement>('#adminSaveReviewBtn');

  let activeProductId: string | null = null;
  let activeProdLang: string = 'en';
  let nameMap: Record<string, string> = {
    en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: ''
  };
  let badgeMap: Record<string, string> = {
    en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: ''
  };
  let discountLabelMap: Record<string, string> = {
    en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: ''
  };
  let descMap: Record<string, string> = {
    en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: ''
  };

  let studioReviews: Review[] = [];
  let activeReviewIndex: number | null = null;
  let activeRevLang: string = 'en';
  let revTextMap: Record<string, string> = {
    en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: ''
  };

  /* ------------------------------------------------------------------ */
  /* 1. Modal Open / Close & Tab Switching                              */
  /* ------------------------------------------------------------------ */

  function switchStudioTab(tab: 'fragrances' | 'languages' | 'reviews') {
    tabFragrances.classList.toggle('active', tab === 'fragrances');
    tabLanguages.classList.toggle('active', tab === 'languages');
    tabReviews.classList.toggle('active', tab === 'reviews');

    viewFragrances.style.display = tab === 'fragrances' ? 'grid' : 'none';
    viewLanguages.style.display = tab === 'languages' ? 'flex' : 'none';
    viewReviews.style.display = tab === 'reviews' ? 'grid' : 'none';

    if (tab === 'languages') {
      syncLanguageSettingsForm();
    } else if (tab === 'reviews') {
      syncReviewsList();
    }
  }

  tabFragrances.addEventListener('click', () => switchStudioTab('fragrances'));
  tabLanguages.addEventListener('click', () => switchStudioTab('languages'));
  tabReviews.addEventListener('click', () => switchStudioTab('reviews'));

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
  /* 2. Language Settings Management (Notre Succès standard)            */
  /* ------------------------------------------------------------------ */

  function syncLanguageSettingsForm() {
    const settings = getLanguageSettings();
    toggleLangSwitcher.checked = settings.showSwitcher;
    defaultLangSelect.value = settings.defaultLocale || 'en';
    switcherPositionSelect.value = settings.switcherPosition || 'both';

    langEnChk.checked = true;
    langDeChk.checked = settings.languages.de !== false;
    langNlChk.checked = settings.languages.nl !== false;
    langFrChk.checked = settings.languages.fr !== false;
    langEsChk.checked = settings.languages.es !== false;
    langItChk.checked = settings.languages.it !== false;
    langNbChk.checked = settings.languages.nb !== false;
    langSvChk.checked = settings.languages.sv !== false;
    langDaChk.checked = settings.languages.da !== false;
  }

  saveLanguagesBtn.addEventListener('click', () => {
    const defaultLoc = (defaultLangSelect.value as Locale) || 'en';
    const newSettings: LanguageSettings = {
      showSwitcher: toggleLangSwitcher.checked,
      defaultLocale: defaultLoc,
      switcherPosition: (switcherPositionSelect.value as any) || 'both',
      languages: {
        en: true,
        de: langDeChk.checked,
        nl: langNlChk.checked,
        fr: langFrChk.checked,
        es: langEsChk.checked,
        it: langItChk.checked,
        nb: langNbChk.checked,
        sv: langSvChk.checked,
        da: langDaChk.checked,
      },
    };
    newSettings.languages[defaultLoc] = true;

    saveLanguageSettings(newSettings);
    bus.emit('toast:show', {
      html: t('admin.lang_saved_toast') || 'Language settings saved successfully',
    });
  });

  /* ------------------------------------------------------------------ */
  /* 3. Client Reviews Management                                       */
  /* ------------------------------------------------------------------ */

  async function syncReviewsList() {
    try {
      studioReviews = await pb.getReviews();
    } catch {
      studioReviews = pb.getLocalReviews() || [];
    }

    renderReviewList();

    if (studioReviews.length > 0 && activeReviewIndex === null) {
      loadReview(0);
    } else if (activeReviewIndex !== null && activeReviewIndex < studioReviews.length) {
      loadReview(activeReviewIndex);
    } else {
      createNewReview();
    }
  }

  function parseReviewTexts(text: string | Record<string, string> | undefined) {
    revTextMap = { en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: '' };
    if (!text) return;
    if (typeof text === 'object') {
      for (const [k, v] of Object.entries(text)) {
        revTextMap[k] = typeof v === 'string' ? v : '';
      }
      return;
    }
    if (typeof text === 'string') {
      const trimmed = text.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed === 'object' && parsed !== null) {
            for (const [k, v] of Object.entries(parsed)) {
              revTextMap[k] = typeof v === 'string' ? v : '';
            }
            return;
          }
        } catch {}
      }
      revTextMap.en = text;
    }
  }

  function setReviewLang(lang: string, saveCurrent: boolean = true) {
    if (saveCurrent && activeRevLang) {
      revTextMap[activeRevLang] = reviewTextInput.value;
    }

    activeRevLang = lang;

    reviewLangTabs.querySelectorAll('.desc-lang-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-rev-lang') === lang);
    });

    reviewTextInput.value = revTextMap[lang] || '';

    const meta = NOTRESUCCES_LOCALES.find((l) => l.code === lang);
    const langName = meta ? `${meta.nativeName} (${lang.toUpperCase()})` : lang.toUpperCase();
    reviewLangBadge.textContent = `Editing in ${langName}${lang === 'en' ? ' — Master' : ''}`;
    reviewTextInput.placeholder = `Review testimonial in ${meta?.name || lang}...`;
  }

  reviewLangTabs.querySelectorAll('.desc-lang-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-rev-lang');
      if (lang && lang !== activeRevLang) {
        setReviewLang(lang, true);
      }
    });
  });

  function renderReviewList() {
    reviewList.innerHTML = '';
    if (studioReviews.length === 0) {
      reviewList.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--muted2); font-size: 0.85rem;">
          No reviews yet.<br>Click "+ New Review" to add one.
        </div>
      `;
      return;
    }

    studioReviews.forEach((rev, idx) => {
      const card = document.createElement('div');
      card.className = `admin-review-card ${idx === activeReviewIndex ? 'active' : ''}`;
      card.dataset.index = String(idx);

      const ratingStars = Math.max(1, Math.min(5, Number(rev.s) || 5));
      const starsDisplay = '★'.repeat(ratingStars) + '☆'.repeat(5 - ratingStars);
      const displaySnippet = getReviewText(rev.t);

      card.innerHTML = `
        <div class="admin-review-card-head">
          <strong>${escapeHtml(rev.n || 'Anonymous')}</strong>
          <span class="admin-review-card-stars">${starsDisplay}</span>
        </div>
        <div class="admin-review-card-meta">${escapeHtml(rev.c || '')}</div>
        <div class="admin-review-card-snippet">"${escapeHtml(displaySnippet)}"</div>
      `;

      card.addEventListener('click', () => loadReview(idx));
      reviewList.appendChild(card);
    });
  }

  function loadReview(index: number) {
    if (index < 0 || index >= studioReviews.length) {
      createNewReview();
      return;
    }

    activeReviewIndex = index;
    const r = studioReviews[index];

    reviewFormTitle.textContent = `${t('admin.edit_review_title') || 'Edit Review'}: ${r.n}`;
    reviewIdInput.value = r.id || '';
    reviewAuthorInput.value = r.n || '';
    reviewRatingSelect.value = String(r.s || 5);
    reviewLocationInput.value = r.c || '';

    parseReviewTexts(r.t);
    activeRevLang = 'en';
    setReviewLang('en', false);

    deleteReviewBtn.style.display = 'inline-block';

    reviewList.querySelectorAll('.admin-review-card').forEach((el, j) => {
      el.classList.toggle('active', j === index);
    });
  }

  function createNewReview() {
    activeReviewIndex = null;
    reviewFormTitle.textContent = t('admin.create_review_title') || '+ New Client Review';
    reviewIdInput.value = '';
    reviewAuthorInput.value = '';
    reviewRatingSelect.value = '5';
    reviewLocationInput.value = '';

    revTextMap = { en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: '' };
    activeRevLang = 'en';
    setReviewLang('en', false);

    deleteReviewBtn.style.display = 'none';

    reviewList.querySelectorAll('.admin-review-card').forEach((el) => {
      el.classList.remove('active');
    });
  }

  newReviewBtn.addEventListener('click', () => createNewReview());

  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = reviewAuthorInput.value.trim();
    const location = reviewLocationInput.value.trim();
    const rating = Math.max(1, Math.min(5, Number(reviewRatingSelect.value) || 5));

    revTextMap[activeRevLang] = reviewTextInput.value.trim();
    const hasMultiRev = Object.values(revTextMap).filter(Boolean).length > 1;
    const finalRevText = hasMultiRev ? JSON.stringify(revTextMap) : (revTextMap.en || Object.values(revTextMap).find(Boolean) || '');

    if (!author) {
      bus.emit('toast:show', { html: t('admin.review_author_required') || 'Please enter author name.' });
      return;
    }
    if (!finalRevText) {
      bus.emit('toast:show', { html: t('admin.review_text_required') || 'Please enter review text.' });
      return;
    }

    saveReviewBtn.disabled = true;
    saveReviewBtn.textContent = t('admin.btn_saving') || 'Saving...';

    try {
      const existingId = reviewIdInput.value || (activeReviewIndex !== null ? studioReviews[activeReviewIndex]?.id : undefined);
      const reviewPayload: Review = {
        id: existingId,
        n: author,
        t: finalRevText,
        c: location,
        s: rating,
      };

      const saved = await pb.saveReview(reviewPayload);

      studioReviews = await pb.getReviews();
      const updatedIdx = studioReviews.findIndex((r) => (saved.id && r.id === saved.id) || (r.n === saved.n && r.c === saved.c));
      activeReviewIndex = updatedIdx >= 0 ? updatedIdx : 0;

      bus.emit('reviews:update', { reviews: studioReviews });
      renderReviewList();
      loadReview(activeReviewIndex);

      bus.emit('toast:show', {
        html: `${t('admin.save_review_success') || 'Review saved'}: <b>${escapeHtml(saved.n)}</b>`,
      });
    } catch (err: any) {
      bus.emit('toast:show', {
        html: `Error saving review: ${err.message || 'Unknown error'}`,
      });
    } finally {
      saveReviewBtn.disabled = false;
      saveReviewBtn.textContent = t('admin.save_review_btn') || 'Save Review';
    }
  });

  deleteReviewBtn.addEventListener('click', async () => {
    if (activeReviewIndex === null || activeReviewIndex >= studioReviews.length) return;
    const current = studioReviews[activeReviewIndex];

    if (studioReviews.length <= 1) {
      const proceed = window.confirm(
        'This is the only review currently in the carousel. Deleting it will leave the carousel with the fallback quote. Proceed?'
      );
      if (!proceed) return;
    } else {
      const confirmed = window.confirm(
        t('admin.confirm_delete_review') || `Are you sure you want to remove the review by "${current.n}"?`
      );
      if (!confirmed) return;
    }

    deleteReviewBtn.disabled = true;
    try {
      const targetId = current.id || current.n;
      await pb.deleteReview(targetId);

      studioReviews = await pb.getReviews();
      bus.emit('reviews:update', { reviews: studioReviews });

      bus.emit('toast:show', {
        html: t('admin.delete_review_success') || 'Review removed from carousel.',
      });

      if (studioReviews.length > 0) {
        loadReview(0);
      } else {
        createNewReview();
      }
    } catch (err: any) {
      bus.emit('toast:show', {
        html: `Error deleting review: ${err.message || 'Unknown error'}`,
      });
    } finally {
      deleteReviewBtn.disabled = false;
    }
  });

  /* ------------------------------------------------------------------ */
  /* 4. Unified Multilingual Product Fields Handling                     */
  /* ------------------------------------------------------------------ */

  function parseFieldLocales(val: string | Record<string, string> | undefined): Record<string, string> {
    const res: Record<string, string> = { en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: '' };
    if (!val) return res;
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        res[k] = typeof v === 'string' ? v : '';
      }
      return res;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed === 'object' && parsed !== null) {
            for (const [k, v] of Object.entries(parsed)) {
              res[k] = typeof v === 'string' ? v : '';
            }
            return res;
          }
        } catch {}
      }
      res.en = val;
    }
    return res;
  }

  function setProductLang(lang: string, saveCurrent: boolean = true) {
    if (saveCurrent && activeProdLang) {
      nameMap[activeProdLang] = nameInput.value;
      badgeMap[activeProdLang] = badgeInput.value;
      discountLabelMap[activeProdLang] = discountLabelInput.value;
      descMap[activeProdLang] = descTextarea.value;
    }

    activeProdLang = lang;

    productLangTabs.querySelectorAll('.desc-lang-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-prod-lang') === lang);
    });

    nameInput.value = nameMap[lang] || '';
    badgeInput.value = badgeMap[lang] || '';
    discountLabelInput.value = discountLabelMap[lang] || '';
    descTextarea.value = descMap[lang] || '';

    const meta = NOTRESUCCES_LOCALES.find((l) => l.code === lang);
    const langName = meta ? `${meta.nativeName} (${lang.toUpperCase()})` : lang.toUpperCase();
    productLangBadge.textContent = `Editing in ${langName}${lang === 'en' ? ' — Master' : ''}`;

    if (lang === 'en') {
      nameInput.placeholder = "e.g. Étoile d'Or";
      badgeInput.placeholder = "e.g. Rare Extract, Signature";
      discountLabelInput.placeholder = "e.g. Autumn Privilege, Winter Offer";
      descTextarea.placeholder = "Poetic sensory journey in English...";
    } else {
      nameInput.placeholder = nameMap.en ? `${nameMap.en} (${meta?.name || lang})` : `Fragrance name in ${meta?.name || lang}...`;
      badgeInput.placeholder = badgeMap.en ? `${badgeMap.en} (${meta?.name || lang})` : `Emblem badge in ${meta?.name || lang}...`;
      discountLabelInput.placeholder = discountLabelMap.en ? `${discountLabelMap.en} (${meta?.name || lang})` : `Discount label in ${meta?.name || lang}...`;
      descTextarea.placeholder = `Olfactory narrative in ${meta?.name || lang}...`;
    }
  }

  productLangTabs.querySelectorAll('.desc-lang-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-prod-lang');
      if (lang && lang !== activeProdLang) {
        setProductLang(lang, true);
      }
    });
  });

  function serializeTransField(map: Record<string, string>): string {
    const entries = Object.entries(map).filter(([_, v]) => v && v.trim().length > 0);
    if (entries.length === 0) return '';
    if (entries.length === 1 && entries[0][0] === 'en') {
      return entries[0][1].trim();
    }
    const finalMap: Record<string, string> = {};
    for (const [k, v] of entries) {
      finalMap[k] = v.trim();
    }
    if (!finalMap.en && entries[0]) {
      finalMap.en = entries[0][1].trim();
    }
    return JSON.stringify(finalMap);
  }

  /* ------------------------------------------------------------------ */
  /* 5. Device File Upload & Removal                                    */
  /* ------------------------------------------------------------------ */

  uploadBtn.addEventListener('click', () => fileInput.click());

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
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleImageFile(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleImageFile(fileInput.files[0]);
    }
  });

  removeImageBtn.addEventListener('click', () => {
    imageInput.value = '';
    fileInput.value = '';
    imagePreview.src = PLACEHOLDER_IMG;
    updateRemoveImageBtn();
    bus.emit('toast:show', {
      html: t('admin.image_removed_toast') || 'Image removed from fragrance',
      duration: 2500,
    });
  });

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      bus.emit('toast:show', { html: 'Please upload a valid image file (JPG, PNG, WebP)' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      bus.emit('toast:show', { html: 'Image size exceeds maximum limit of 5 MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      imagePreview.src = base64;
      imageInput.value = base64;
      updateRemoveImageBtn();
      bus.emit('toast:show', { html: 'Image loaded from device' });
    };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------------------ */
  /* 6. Fragrance Form Loading, Creation & Saving                       */
  /* ------------------------------------------------------------------ */

  function loadProduct(p: Product) {
    activeProductId = p.id;
    const displayName = getLocalizedText(p.name);
    formTitle.textContent = `${t('admin.edit_title') || 'Edit'}: ${displayName}`;
    idInput.value = p.id;
    recordIdInput.value = p.recordId || '';
    familySelect.value = p.fam;
    genderSelect.value = p.gender;
    price50Input.value = String(p.price?.['50'] || 89);
    price100Input.value = String(p.price?.['100'] || 129);
    discountInput.value = p.discountPercent ? String(p.discountPercent) : '';
    updateStockStatusUi(p.inStock !== false);

    nameMap = parseFieldLocales(p.name);
    badgeMap = parseFieldLocales(p.badge);
    discountLabelMap = parseFieldLocales(p.discountLabel);
    descMap = parseFieldLocales(p.desc);

    activeProdLang = 'en';
    setProductLang('en', false);

    const notes = p.notes || { top: [], heart: [], base: [] };
    notesTopInput.value = (notes.top || []).join(', ');
    notesHeartInput.value = (notes.heart || []).join(', ');
    notesBaseInput.value = (notes.base || []).join(', ');

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
    familySelect.value = 'floral';
    genderSelect.value = 'Unisex';
    price50Input.value = '95';
    price100Input.value = '145';
    discountInput.value = '';
    updateStockStatusUi(true);

    nameMap = { en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: '' };
    badgeMap = { en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: '' };
    discountLabelMap = { en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: '' };
    descMap = { en: '', de: '', nl: '', fr: '', es: '', it: '', nb: '', sv: '', da: '' };

    activeProdLang = 'en';
    setProductLang('en', false);

    notesTopInput.value = '';
    notesHeartInput.value = '';
    notesBaseInput.value = '';

    imageInput.value = '';
    fileInput.value = '';
    imagePreview.src = PLACEHOLDER_IMG;
    updateRemoveImageBtn();

    deleteBtn.style.display = 'none';
    renderList();
  }

  newBtn.addEventListener('click', createNew);

  function renderList() {
    const products = catalog.all();
    listEl.innerHTML = '';

    products.forEach((p) => {
      const item = document.createElement('div');
      item.className = `admin-item-card ${p.id === activeProductId ? 'active' : ''}`;
      item.setAttribute('data-id', p.id);

      const thumb = resolveProductImg(p.img);
      const displayName = getLocalizedText(p.name);
      const displayDiscountLabel = getLocalizedText(p.discountLabel);
      const discountTag = displayDiscountLabel
        ? `<span class="admin-item-discount">${escapeHtml(displayDiscountLabel)}${p.discountPercent ? ` -${p.discountPercent}%` : ''}</span>`
        : (p.discountPercent ? `<span class="admin-item-discount">-${p.discountPercent}%</span>` : '');
      const stockBadge = p.inStock === false
        ? `<span class="admin-item-stock-out">${escapeHtml(t('catalog.out_of_stock') || 'Out of Stock')}</span>`
        : '';

      item.innerHTML = `
        <img class="admin-item-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(displayName)}" />
        <div class="admin-item-info">
          <div class="admin-item-name">${escapeHtml(displayName)}</div>
          <div class="admin-item-meta">${escapeHtml(p.fam)} · ${escapeHtml(p.gender)}</div>
          <div class="admin-item-price" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">€${p.price['50']} / €${p.price['100']} ${discountTag} ${stockBadge}</div>
        </div>
      `;

      item.addEventListener('click', () => loadProduct(p));
      listEl.appendChild(item);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = t('admin.btn_saving') || 'Saving...';

    nameMap[activeProdLang] = nameInput.value.trim();
    badgeMap[activeProdLang] = badgeInput.value.trim();
    discountLabelMap[activeProdLang] = discountLabelInput.value.trim();
    descMap[activeProdLang] = descTextarea.value.trim();

    const finalName = serializeTransField(nameMap);
    const finalBadge = serializeTransField(badgeMap);
    const finalDiscountLabel = serializeTransField(discountLabelMap);
    const finalDesc = serializeTransField(descMap);

    const formData: ProductFormData = {
      id: idInput.value || undefined,
      recordId: recordIdInput.value || undefined,
      name: finalName || nameInput.value.trim(),
      family: familySelect.value as Family,
      gender: genderSelect.value as Gender,
      badge: finalBadge,
      desc: finalDesc,
      price_50: Number(price50Input.value),
      price_100: Number(price100Input.value),
      discount_percent: discountInput.value ? Math.max(0, Math.min(99, Number(discountInput.value))) : undefined,
      discount_label: finalDiscountLabel || undefined,
      in_stock: inStockCheckbox.checked,
      notes_top: notesTopInput.value.split(',').map((s) => s.trim()).filter(Boolean),
      notes_heart: notesHeartInput.value.split(',').map((s) => s.trim()).filter(Boolean),
      notes_base: notesBaseInput.value.split(',').map((s) => s.trim()).filter(Boolean),
      image: imageInput.value.trim(),
    };

    try {
      const saved = await pb.saveProduct(formData);

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
        html: `${t('admin.save_success') || 'Saved'}: <b>${escapeHtml(getLocalizedText(saved.name))}</b>`,
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
  bus.on('i18n:change', () => {
    updateStockStatusUi(inStockCheckbox.checked);
    renderList();
  });

  const api: AdminStudioApi = {
    open,
    close,
    switchTab: switchStudioTab,
  };

  return api;
}
