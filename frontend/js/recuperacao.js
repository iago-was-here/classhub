/**
 * Lógica da Tela de Recuperação / Redefinição de Senha do ClassHub
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recuperacao-form');
  const emailInput = document.getElementById('email');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const submitBtn = document.getElementById('btn-submit');
  const alertBoxId = 'auth-alert';

  // Configuração dos botões de revelar senha
  UIUtils.setupPasswordToggle('new-password', 'toggle-new-password');
  UIUtils.setupPasswordToggle('confirm-password', 'toggle-confirm-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UIUtils.hideAlert(alertBoxId);

    const email = emailInput.value.trim();
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    let hasError = false;

    // 1. E-mail
    if (!email) {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), 'Informe seu e-mail cadastrado');
      hasError = true;
    } else if (!UIUtils.isValidEmail(email)) {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), 'Formato de e-mail inválido');
      hasError = true;
    } else {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), '');
    }

    // 2. Nova Senha
    if (!newPassword) {
      UIUtils.setFieldError(newPasswordInput, document.getElementById('new-password-feedback'), 'Digite a nova senha');
      hasError = true;
    } else if (newPassword.length < 8) {
      UIUtils.setFieldError(newPasswordInput, document.getElementById('new-password-feedback'), 'A senha deve conter no mínimo 8 caracteres');
      hasError = true;
    } else {
      UIUtils.setFieldError(newPasswordInput, document.getElementById('new-password-feedback'), '');
    }

    // 3. Confirmar Senha
    if (!confirmPassword) {
      UIUtils.setFieldError(confirmPasswordInput, document.getElementById('confirm-password-feedback'), 'Confirme a nova senha');
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      UIUtils.setFieldError(confirmPasswordInput, document.getElementById('confirm-password-feedback'), 'As senhas não coincidem');
      hasError = true;
    } else {
      UIUtils.setFieldError(confirmPasswordInput, document.getElementById('confirm-password-feedback'), '');
    }

    if (hasError) {
      UIUtils.showAlert(alertBoxId, 'Por favor, preencha todos os campos corretamente.', 'danger');
      return;
    }

    UIUtils.setLoading(submitBtn, true, 'Redefinir Senha');

    const result = await ClassHubAuth.resetPassword(email, newPassword);

    UIUtils.setLoading(submitBtn, false, 'Redefinir Senha');

    if (result.success) {
      UIUtils.showAlert(alertBoxId, 'Senha redefinida com sucesso! Redirecionando para o login...', 'success');
      setTimeout(() => {
        window.location.href = 'login.html?reset=true';
      }, 1200);
    } else {
      UIUtils.showAlert(alertBoxId, result.error || 'Erro ao redefinir a senha.', 'danger');
    }
  });
});
