/**
 * Lógica da Tela de Login do ClassHub
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('username'); // Corrigido para usernameInput
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('btn-submit');
  const alertBoxId = 'auth-alert';

  // Configura alternador de visibilidade de senha
  UIUtils.setupPasswordToggle('password', 'toggle-password');

  // Verifica parâmetros de URL para exibir mensagens de sucesso prévias
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('registered') === 'true') {
    UIUtils.showAlert(alertBoxId, 'Cadastro realizado com sucesso! Faça login para continuar.', 'success');
  } else if (urlParams.get('reset') === 'true') {
    UIUtils.showAlert(alertBoxId, 'Senha redefinida com sucesso! Acesse sua conta.', 'success');
  }

  // Validações em tempo real ao digitar
  usernameInput.addEventListener('input', () => {
    if (!usernameInput.value.trim()) {
      UIUtils.setFieldError(usernameInput, document.getElementById('username-feedback'), 'O campo nome de usuário é obrigatório');
    } else {
      UIUtils.setFieldError(usernameInput, document.getElementById('username-feedback'), '');
    }
  });

  passwordInput.addEventListener('input', () => {
    if (passwordInput.value.trim()) {
      UIUtils.setFieldError(passwordInput, document.getElementById('password-feedback'), '');
    }
  });

  // Submissão do formulário
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UIUtils.hideAlert(alertBoxId);

    const username = usernameInput.value.trim(); // Corrigido para capturar o username
    const password = passwordInput.value;
    let hasError = false;

    // 1. Validação do Nome de Usuário
    if (!username) {
      UIUtils.setFieldError(usernameInput, document.getElementById('username-feedback'), 'O campo nome de usuário é obrigatório');
      hasError = true;
    } else {
      UIUtils.setFieldError(usernameInput, document.getElementById('username-feedback'), '');
    }

    // 2. Validação da Senha
    if (!password) {
      UIUtils.setFieldError(passwordInput, document.getElementById('password-feedback'), 'A senha é obrigatória');
      hasError = true;
    } else {
      UIUtils.setFieldError(passwordInput, document.getElementById('password-feedback'), '');
    }

    if (hasError) {
      UIUtils.showAlert(alertBoxId, 'Preencha todos os campos corretamente antes de continuar.', 'danger');
      return;
    }

    // Envio para o Gateway (endpoint check)
    UIUtils.setLoading(submitBtn, true, 'Acessar');

    const result = await ClassHubAuth.login(username, password); // Variáveis corretas

    UIUtils.setLoading(submitBtn, false, 'Acessar');

    if (result.success) {
      UIUtils.showAlert(alertBoxId, 'Autenticado com sucesso! Redirecionando...', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } else {
      UIUtils.showAlert(alertBoxId, result.error || 'Nome de usuário ou senha incorretos.', 'danger'); // Mensagem de erro atualizada
    }
  });
});