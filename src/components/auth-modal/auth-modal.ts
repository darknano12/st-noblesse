import { bus } from '../../core/bus';
import { pb } from '../../services/pocketbase';
import { t } from '../../core/i18n';
import { escapeHtml, must } from '../../utils/dom';

export interface AuthModalApi {
  open(tab?: 'login' | 'register'): void;
  close(): void;
  isOpen(): boolean;
}

export function initAuthModal(): AuthModalApi {
  const modal = must('#authModal');
  const closeBtn = must('#authClose');
  const tabLogin = must('#tabLogin');
  const tabRegister = must('#tabRegister');
  const formLogin = must('#formLogin');
  const formRegister = must('#formRegister');
  const errBox = must('#authError');

  let currentTab: 'login' | 'register' = 'login';

  function switchTab(tab: 'login' | 'register') {
    currentTab = tab;
    errBox.textContent = '';
    errBox.classList.remove('on');

    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formRegister.style.display = 'block';
      formLogin.style.display = 'none';
    }
  }

  function open(tab: 'login' | 'register' = 'login') {
    switchTab(tab);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    errBox.textContent = '';
    errBox.classList.remove('on');
  }

  function showError(msg: string) {
    errBox.textContent = msg;
    errBox.classList.add('on');
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // Handle Login submission
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.remove('on');

    const email = (document.querySelector('#loginEmail') as HTMLInputElement)?.value.trim();
    const pass = (document.querySelector('#loginPassword') as HTMLInputElement)?.value;
    const submitBtn = formLogin.querySelector('button[type="submit"]') as HTMLButtonElement;

    if (!email || !pass) {
      showError('Please enter email and password');
      return;
    }

    const prevText = submitBtn.textContent;
    submitBtn.textContent = t('auth.btn_logging');
    submitBtn.disabled = true;

    try {
      const user = await pb.login(email, pass);
      bus.emit('auth:change', { user });
      const safeName = escapeHtml(user.name || user.email);
      bus.emit('toast:show', {
        html: user.isAdmin
          ? `✦ <b>Boutique Studio Activated</b> (Admin: ${safeName})`
          : `✦ Bienvenue, <b>${safeName}</b>`,
      });
      close();
    } catch (err: any) {
      showError(err.message || 'Authentication error');
    } finally {
      submitBtn.textContent = prevText;
      submitBtn.disabled = false;
    }
  });

  // Handle Register submission
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.remove('on');

    const name = (document.querySelector('#regName') as HTMLInputElement)?.value.trim();
    const email = (document.querySelector('#regEmail') as HTMLInputElement)?.value.trim();
    const pass = (document.querySelector('#regPassword') as HTMLInputElement)?.value;
    const submitBtn = formRegister.querySelector('button[type="submit"]') as HTMLButtonElement;

    if (!email || !pass || pass.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    const prevText = submitBtn.textContent;
    submitBtn.textContent = t('auth.btn_registering');
    submitBtn.disabled = true;

    try {
      const user = await pb.register(email, pass, name || email.split('@')[0]);
      bus.emit('auth:change', { user });
      const safeName = escapeHtml(user.name || user.email);
      bus.emit('toast:show', {
        html: `✦ Account created. Welcome, <b>${safeName}</b>`,
      });
      close();
    } catch (err: any) {
      showError(err.message || 'Registration error');
    } finally {
      submitBtn.textContent = prevText;
      submitBtn.disabled = false;
    }
  });

  bus.on('auth:open', (payload) => open(payload?.tab || 'login'));
  bus.on('auth:change', ({ user }) => {
    if (user && modal.classList.contains('open')) {
      close();
    }
  });

  return {
    open,
    close,
    isOpen: () => modal.classList.contains('open'),
  };
}
