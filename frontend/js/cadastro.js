/**
 * Lógica da Tela de Cadastro de Usuários do ClassHub
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('cadastro-form');
  const nameInput = document.getElementById('name');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const submitBtn = document.getElementById('btn-submit');
  const alertBoxId = 'auth-alert';

  // Configuração dos botões de revelar senha
  UIUtils.setupPasswordToggle('password', 'toggle-password');
  UIUtils.setupPasswordToggle('confirm-password', 'toggle-confirm-password');

  // Validação do campo username para não permitir espaços
  usernameInput.addEventListener('input', () => {
    usernameInput.value = usernameInput.value.replace(/\s+/g, '').toLowerCase();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UIUtils.hideAlert(alertBoxId);

    const name = nameInput.value.trim();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    let hasError = false;

    // 1. Nome completo
    if (!name) {
      UIUtils.setFieldError(nameInput, document.getElementById('name-feedback'), 'Informe seu nome completo');
      hasError = true;
    } else {
      UIUtils.setFieldError(nameInput, document.getElementById('name-feedback'), '');
    }

    // 2. Nome de usuário (username)
    if (!username) {
      UIUtils.setFieldError(usernameInput, document.getElementById('username-feedback'), 'Informe um nome de usuário');
      hasError = true;
    } else if (username.length < 3) {
      UIUtils.setFieldError(usernameInput, document.getElementById('username-feedback'), 'Mínimo de 3 caracteres');
      hasError = true;
    } else {
      UIUtils.setFieldError(usernameInput, document.getElementById('username-feedback'), '');
    }

    // 3. E-mail
    if (!email) {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), 'Informe seu e-mail');
      hasError = true;
    } else if (!UIUtils.isValidEmail(email)) {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), 'Formato de e-mail inválido');
      hasError = true;
    } else {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), '');
    }

    // 4. Senha (mínimo 8 caracteres)
    if (!password) {
      UIUtils.setFieldError(passwordInput, document.getElementById('password-feedback'), 'Defina uma senha');
      hasError = true;
    } else if (password.length < 8) {
      UIUtils.setFieldError(passwordInput, document.getElementById('password-feedback'), 'A senha deve conter no mínimo 8 caracteres');
      hasError = true;
    } else {
      UIUtils.setFieldError(passwordInput, document.getElementById('password-feedback'), '');
    }

    // 5. Confirmação de Senha
    if (!confirmPassword) {
      UIUtils.setFieldError(confirmPasswordInput, document.getElementById('confirm-password-feedback'), 'Confirme sua senha');
      hasError = true;
    } else if (password !== confirmPassword) {
      UIUtils.setFieldError(confirmPasswordInput, document.getElementById('confirm-password-feedback'), 'As senhas não coincidem');
      hasError = true;
    } else {
      UIUtils.setFieldError(confirmPasswordInput, document.getElementById('confirm-password-feedback'), '');
    }

    if (hasError) {
      UIUtils.showAlert(alertBoxId, 'Por favor, corrija os erros sinalizados no formulário.', 'danger');
      return;
    }

    // Envia APENAS { name, username, email, password } para o backend (não envia o campo confirm_password)
    UIUtils.setLoading(submitBtn, true, 'Cadastrar');

    const result = await ClassHubAuth.register(name, username, email, password);

    UIUtils.setLoading(submitBtn, false, 'Cadastrar');

    if (result.success) {
      UIUtils.showAlert(alertBoxId, 'Conta criada com sucesso! Redirecionando para o login...', 'success');
      setTimeout(() => {
        window.location.href = 'login.html?registered=true';
      }, 1200);
    } else {
      UIUtils.showAlert(alertBoxId, result.error || 'Erro ao realizar cadastro.', 'danger');
    }
  });
});
