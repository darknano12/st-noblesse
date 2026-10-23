import type { Product, Review, Volume } from '../core/types';
import fallbackProducts from '../data/products.json';
import fallbackReviews from '../data/reviews.json';

export interface CheckoutPayloadItem {
  productId: string;
  volume: Volume;
  qty: number;
}

export interface CheckoutResponse {
  checkoutUrl: string;
  sessionId?: string;
  total?: number;
  currency?: string;
  mock?: boolean;
}

const PRODUCTS_STORAGE_KEY = 'st_noblesse_products_v1';
const REVIEWS_STORAGE_KEY = 'st_noblesse_reviews_v1';

export class PocketBaseService {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:8090') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  getLocalProducts(): Product[] | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {}
    return null;
  }

  saveLocalProducts(products: Product[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      }
    } catch {}
    try {
      if (typeof fetch !== 'undefined') {
        fetch('/api/sync-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(products),
        }).catch(() => {});
      }
    } catch {}
  }

  updateLocalProduct(product: Product): void {
    const list = this.getLocalProducts() || [...(fallbackProducts as Product[])];
    const idx = list.findIndex(
      (item) => item.id === product.id || (product.recordId && item.recordId === product.recordId)
    );
    if (idx >= 0) {
      list[idx] = product;
    } else {
      list.unshift(product);
    }
    this.saveLocalProducts(list);
  }

  /**
   * Fetch products from PocketBase collection 'products',
   * with automatic fallback to persistent local storage and products.json.
   */
  async getProducts(): Promise<Product[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/api/collections/products/records?sort=-created`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        return this.getLocalProducts() || (fallbackProducts as Product[]);
      }

      // Map PocketBase schema fields to domain Product model
      const mapped = data.items.map((r: any): Product => ({
        id: r.slug || r.id,
        recordId: r.id,
        img: r.image ?? '',
        name: r.name,
        fam: r.family || 'fresh',
        gender: r.gender || 'Unisex',
        badge: r.badge || '',
        desc: r.desc || '',
        notes: {
          top: Array.isArray(r.notes_top) ? r.notes_top : [],
          heart: Array.isArray(r.notes_heart) ? r.notes_heart : [],
          base: Array.isArray(r.notes_base) ? r.notes_base : [],
        },
        price: {
          '50': Number(r.price_50) || 89,
          '100': Number(r.price_100) || 129,
        },
        rating: Number(r.rating) || 5.0,
        rev: Number(r.reviews_count) || 100,
      }));
      this.saveLocalProducts(mapped);
      return mapped;
    } catch (err) {
      // Graceful fallback: return user's saved local products or fallbackProducts
      return this.getLocalProducts() || (fallbackProducts as Product[]);
    }
  }

  /**
   * Fetch customer reviews with fallback to local persistent reviews and reviews.json
   */
  async getReviews(): Promise<Review[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/api/collections/reviews/records?sort=-created`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        return this.getLocalReviews() || (fallbackReviews as Review[]);
      }

      const mapped = data.items.map((r: any): Review => ({
        id: r.id,
        t: r.content,
        n: r.author,
        c: r.location || '',
        s: Number(r.rating) || 5,
        created: r.created,
      }));
      this.saveLocalReviews(mapped);
      return mapped;
    } catch (err) {
      return this.getLocalReviews() || (fallbackReviews as Review[]);
    }
  }

  /**
   * Initiate Stripe Checkout session via PocketBase hook
   */
  async createCheckout(items: CheckoutPayloadItem[]): Promise<CheckoutResponse> {
    try {
      const token = this.getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = token;

      const res = await fetch(`${this.baseUrl}/api/create-checkout-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        throw new Error(`Checkout API returned status ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      // If PocketBase server is offline, return a local mock checkout completion URL
      const mockSessionId = 'mock_cs_' + Math.random().toString(36).slice(2, 10);
      return {
        mock: true,
        sessionId: mockSessionId,
        checkoutUrl: `${window.location.origin}/?order_status=success&session_id=${mockSessionId}`,
      };
    }
  }

  /* ==========================================================================
     AUTHENTICATION (Users & Admins)
     ========================================================================== */

  private TOKEN_KEY = 'st_noblesse_auth_token';
  private USER_KEY = 'st_noblesse_auth_user';

  getAuthToken(): string | null {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (!token) return null;

      // Validate JWT expiration claim
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const decodedJson = typeof atob === 'function' ? atob(payloadBase64) : Buffer.from(payloadBase64, 'base64').toString('utf-8');
          const payload = JSON.parse(decodedJson);
          if (payload.exp && Date.now() >= payload.exp * 1000) {
            this.logout();
            return null;
          }
        } catch {}
      }

      return token;
    } catch {
      return null;
    }
  }

  getCurrentUser(): import('../core/types').AuthUser | null {
    try {
      if (!this.getAuthToken()) {
        return null;
      }
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private saveAuth(token: string, user: import('../core/types').AuthUser): void {
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch {}
  }

  logout(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch {}
  }

  /**
   * Universal Login: tries Admin Auth first, then regular User Auth.
   */
  async login(identity: string, password: string): Promise<import('../core/types').AuthUser> {
    // 1. Try Admin auth
    try {
      const adminRes = await fetch(`${this.baseUrl}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, password }),
      });

      if (adminRes.ok) {
        const data = await adminRes.json();
        const authUser: import('../core/types').AuthUser = {
          id: data.admin?.id || 'admin_id',
          email: data.admin?.email || identity,
          name: 'Atelier Director',
          isAdmin: true,
        };
        this.saveAuth(data.token, authUser);
        return authUser;
      }
    } catch {}

    // 2. Try regular user auth
    try {
      const userRes = await fetch(`${this.baseUrl}/api/collections/users/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, password }),
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        const isSpecialAdmin = Boolean(userData.record?.role === 'admin');
        const authUser: import('../core/types').AuthUser = {
          id: userData.record?.id,
          email: userData.record?.email || identity,
          name: userData.record?.name || identity.split('@')[0],
          isAdmin: isSpecialAdmin,
        };

        this.saveAuth(userData.token, authUser);
        return authUser;
      }
    } catch {}

    // 3. Fallback demo credentials for local development & offline testing
    if (identity === 'admin@noblesse.com' && password === 'noblesse12345') {
      const demoAdmin: import('../core/types').AuthUser = {
        id: 'demo_admin',
        email: 'admin@noblesse.com',
        name: 'Atelier Director',
        isAdmin: true,
      };
      this.saveAuth('demo_token', demoAdmin);
      return demoAdmin;
    }

    throw new Error('Invalid email or password');
  }

  /**
   * Capture newsletter subscriber in PocketBase (with offline graceful fallback)
   */
  async subscribeNewsletter(email: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/collections/subscribers/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return res.ok;
    } catch {
      return true; // Graceful fallback
    }
  }

  /**
   * Register a new boutique client
   */
  async register(email: string, password: string, name: string): Promise<import('../core/types').AuthUser> {
    const res = await fetch(`${this.baseUrl}/api/collections/users/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        passwordConfirm: password,
        name,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Registration failed');
    }

    // Auto login upon registration
    return this.login(email, password);
  }

  /* ==========================================================================
     ORDERS
     ========================================================================== */

  async getUserOrders(): Promise<import('../core/types').OrderRecord[]> {
    const user = this.getCurrentUser();
    if (!user) return [];

    try {
      const token = this.getAuthToken();
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = token;

      // Filter by email or user
      const filter = encodeURIComponent(`customer_email="${user.email}"`);
      const res = await fetch(`${this.baseUrl}/api/collections/orders/records?filter=${filter}&sort=-created`, {
        headers,
      });

      if (!res.ok) {
        // Fallback: fetch without filter if admin or public permitted
        const fallbackRes = await fetch(`${this.baseUrl}/api/collections/orders/records?sort=-created`, { headers });
        if (!fallbackRes.ok) return [];
        const all = await fallbackRes.json();
        return (all.items || []).filter((o: any) => o.customer_email === user.email);
      }

      const data = await res.json();
      return (data.items || []).map((o: any) => ({
        id: o.id,
        stripe_session_id: o.stripe_session_id,
        customer_email: o.customer_email,
        items: Array.isArray(o.items) ? o.items : [],
        total: o.total,
        currency: o.currency || 'EUR',
        status: o.status || 'paid',
        created: o.created,
      }));
    } catch {
      return [];
    }
  }

  /* ==========================================================================
     PRODUCT CRUD (Boutique Studio)
     ========================================================================== */

  async saveProduct(form: import('../core/types').ProductFormData): Promise<Product> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = token;

    const payload = {
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      family: form.family,
      gender: form.gender,
      badge: form.badge || '',
      desc: form.desc,
      notes_top: form.notes_top,
      notes_heart: form.notes_heart,
      notes_base: form.notes_base,
      price_50: form.price_50,
      price_100: form.price_100,
      image: form.image !== undefined ? form.image : '',
    };

    let targetRecordId = form.recordId;
    if (!targetRecordId && form.id) {
      if (/^[a-z0-9]{15}$/.test(form.id)) {
        targetRecordId = form.id;
      } else {
        try {
          const findRes = await fetch(`${this.baseUrl}/api/collections/products/records?filter=(slug="${encodeURIComponent(form.id)}")`, { headers });
          if (findRes.ok) {
            const data = await findRes.json();
            if (data.items && data.items.length > 0) {
              targetRecordId = data.items[0].id;
            }
          }
        } catch {}
      }
    }

    try {
      let res: Response;
      if (targetRecordId) {
        // Update existing record by PocketBase record ID
        res = await fetch(`${this.baseUrl}/api/collections/products/records/${targetRecordId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        // Create new record
        res = await fetch(`${this.baseUrl}/api/collections/products/records`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const r = await res.json();
        const savedProd: Product = {
          id: r.slug || r.id,
          recordId: r.id,
          img: r.image ?? '',
          name: r.name,
          fam: r.family || 'fresh',
          gender: r.gender || 'Unisex',
          badge: r.badge || '',
          desc: r.desc || '',
          notes: {
            top: Array.isArray(r.notes_top) ? r.notes_top : [],
            heart: Array.isArray(r.notes_heart) ? r.notes_heart : [],
            base: Array.isArray(r.notes_base) ? r.notes_base : [],
          },
          price: {
            '50': Number(r.price_50) || 89,
            '100': Number(r.price_100) || 129,
          },
          rating: Number(r.rating) || 5.0,
          rev: Number(r.reviews_count) || 100,
        };
        this.updateLocalProduct(savedProd);
        return savedProd;
      }
    } catch {}

    // Graceful offline / demo fallback
    const offlineProd: Product = {
      id: form.id || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      recordId: targetRecordId || 'demo_' + Date.now(),
      img: form.image !== undefined ? form.image : '',
      name: form.name,
      fam: form.family,
      gender: form.gender,
      badge: form.badge || '',
      desc: form.desc,
      notes: {
        top: form.notes_top,
        heart: form.notes_heart,
        base: form.notes_base,
      },
      price: {
        '50': form.price_50,
        '100': form.price_100,
      },
      rating: 5.0,
      rev: 1,
    };
    this.updateLocalProduct(offlineProd);
    return offlineProd;
  }

  async deleteProduct(productIdOrSlug: string): Promise<void> {
    const list = this.getLocalProducts() || [...(fallbackProducts as Product[])];
    const remaining = list.filter((p) => p.id !== productIdOrSlug && p.recordId !== productIdOrSlug);
    this.saveLocalProducts(remaining);

    const token = this.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = token;

    // Find record by slug or id first
    let recordId = productIdOrSlug;
    try {
      const findRes = await fetch(`${this.baseUrl}/api/collections/products/records?filter=(slug="${productIdOrSlug}")`, { headers });
      if (findRes.ok) {
        const data = await findRes.json();
        if (data.items && data.items.length > 0) {
          recordId = data.items[0].id;
        }
      }
    } catch {}

    try {
      const res = await fetch(`${this.baseUrl}/api/collections/products/records/${recordId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok && res.status !== 404) {
        throw new Error(`Failed to delete product (HTTP ${res.status})`);
      }
    } catch {}
  }

  /* ==========================================================================
     REVIEW CRUD (Boutique Studio)
     ========================================================================== */

  getLocalReviews(): Review[] | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {}
    return null;
  }

  saveLocalReviews(reviews: Review[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
      }
      if (typeof fetch !== 'undefined') {
        fetch('/api/sync-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviews),
        }).catch(() => {});
      }
    } catch {}
  }

  async saveReview(review: Review): Promise<Review> {
    const list = this.getLocalReviews() || [...(fallbackReviews as Review[])];
    const id = review.id || 'rev_' + Date.now();
    const reviewWithId: Review = { ...review, id };

    const idx = list.findIndex(
      (r) => (review.id && r.id === review.id) || (r.n === review.n && r.c === review.c)
    );
    if (idx >= 0) {
      list[idx] = reviewWithId;
    } else {
      list.unshift(reviewWithId);
    }
    this.saveLocalReviews(list);

    // Sync with PocketBase collection 'reviews' if online
    try {
      const token = this.getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = token;

      const payload = {
        author: review.n,
        content: review.t,
        location: review.c,
        rating: review.s,
      };

      if (review.id && !review.id.startsWith('rev_')) {
        await fetch(`${this.baseUrl}/api/collections/reviews/records/${review.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch(`${this.baseUrl}/api/collections/reviews/records`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          reviewWithId.id = data.id;
        }
      }
    } catch {}

    return reviewWithId;
  }

  async deleteReview(reviewIdOrName: string): Promise<void> {
    const list = this.getLocalReviews() || [...(fallbackReviews as Review[])];
    const remaining = list.filter((r) => r.id !== reviewIdOrName && r.n !== reviewIdOrName);
    this.saveLocalReviews(remaining);

    try {
      const token = this.getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = token;

      if (reviewIdOrName && !reviewIdOrName.startsWith('rev_')) {
        await fetch(`${this.baseUrl}/api/collections/reviews/records/${reviewIdOrName}`, {
          method: 'DELETE',
          headers,
        });
      }
    } catch {}
  }
}

export const pb = new PocketBaseService();
