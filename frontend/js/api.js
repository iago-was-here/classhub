/**
 * Camada de integração com os serviços de autenticação do ClassHub
 */
const ClassHubAuth = {
/**
   * Realiza login no sistema verificando credenciais
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async login(username, password) {
    try {
      const response = await fetch(CONFIG.ENDPOINTS.CHECK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // AQUI FOI ALTERADO: enviando username em vez de email
        body: JSON.stringify({ username, password })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.valid) {
        if (data.token) {
          this.saveAuth(data.token, data.user);
        }
        return { success: true, data };
      }

      return {
        success: false,
        error: data.error || 'Falha ao realizar login. Verifique seus dados.'
      };
    } catch (err) {
      console.error('[ClassHub Auth] Erro de rede:', err);
      return {
        success: false,
        error: 'Não foi possível conectar ao servidor (Gateway na porta 8080). Verifique se os serviços estão ativos.'
      };
    }
  },

  /**
   * Registra um novo usuário no ClassHub
   * @param {string} name 
   * @param {string} username 
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async register(name, username, email, password) {
    try {
      const response = await fetch(CONFIG.ENDPOINTS.CREATE_USER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 201 || response.ok) {
        return { success: true, data };
      }

      if (response.status === 409) {
        return {
          success: false,
          error: data.error || 'Este e-mail ou nome de usuário já está cadastrado.'
        };
      }

      return {
        success: false,
        error: data.error || 'Erro ao realizar cadastro. Verifique as informações fornecidas.'
      };
    } catch (err) {
      console.error('[ClassHub Auth] Erro de rede:', err);
      return {
        success: false,
        error: 'Não foi possível conectar ao servidor (Gateway na porta 8080).'
      };
    }
  },

  /**
   * Redefine a senha de um usuário existente
   * @param {string} email 
   * @param {string} newPassword 
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async resetPassword(email, newPassword) {
    try {
      const response = await fetch(CONFIG.ENDPOINTS.RESET_PASSWORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password: newPassword, password: newPassword })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return { success: true, data };
      }

      if (response.status === 404) {
        return {
          success: false,
          error: data.error || 'Usuário não encontrado com o e-mail informado.'
        };
      }

      return {
        success: false,
        error: data.error || 'Não foi possível redefinir a senha.'
      };
    } catch (err) {
      console.error('[ClassHub Auth] Erro de rede:', err);
      return {
        success: false,
        error: 'Não foi possível conectar ao servidor (Gateway na porta 8080).'
      };
    }
  },

  /**
   * Solicita envio de e-mail de recuperação de senha
   * @param {string} email 
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async recoverPassword(email) {
    try {
      const response = await fetch(CONFIG.ENDPOINTS.RECOVER_PASSWORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          success: true,
          message: data.message || 'Seu e-mail de recuperação foi enviado!'
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          error: data.error || 'E-mail não encontrado no banco de dados.'
        };
      }

      return {
        success: false,
        error: data.error || 'Não foi possível processar o pedido de recuperação.'
      };
    } catch (err) {
      console.error('[ClassHub Auth] Erro de rede:', err);
      return {
        success: false,
        error: 'Não foi possível conectar ao servidor (Gateway na porta 8080).'
      };
    }
  },

  /**
   * Salva os dados de autenticação no localStorage
   */
  saveAuth(token, user) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
      if (user) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
      }
    } catch (e) {
      console.error('Erro ao salvar no storage:', e);
    }
  },

  /**
   * Retorna o token salvo
   */
  getToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  },

  /**
   * Retorna os dados do usuário autenticado
   */
  getUser() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Remove os dados da sessão
   */
  clearAuth() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
  },

  /**
   * Verifica se há um usuário com token salvo
   */
  isAuthenticated() {
    return !!this.getToken();
  }
};

/**
 * Utilitários de Interface e Notificações Estilo SUAP
 */
const UIUtils = {
  showAlert(containerId, message, type = 'danger') {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.className = `suap-alert suap-alert-${type} show`;
    const iconClass = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
    el.innerHTML = `
      <i class="bi ${iconClass} suap-alert-icon"></i>
      <div class="suap-alert-text">${message}</div>
    `;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  hideAlert(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
      el.className = 'suap-alert';
      el.innerHTML = '';
    }
  },

  setLoading(buttonElement, isLoading, normalText = 'Entrar') {
    if (!buttonElement) return;
    if (isLoading) {
      buttonElement.disabled = true;
      buttonElement.dataset.originalText = buttonElement.innerHTML;
      buttonElement.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Processando...
      `;
    } else {
      buttonElement.disabled = false;
      buttonElement.innerHTML = buttonElement.dataset.originalText || normalText;
    }
  },

  setupPasswordToggle(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);
    if (!input || !btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
      }
    });
  },

  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
  },

  setFieldError(inputElement, feedbackElement, errorMessage) {
    if (errorMessage) {
      inputElement.classList.add('is-invalid');
      if (feedbackElement) {
        feedbackElement.textContent = errorMessage;
        feedbackElement.style.display = 'block';
      }
    } else {
      inputElement.classList.remove('is-invalid');
      if (feedbackElement) {
        feedbackElement.textContent = '';
        feedbackElement.style.display = 'none';
      }
    }
  }
};
