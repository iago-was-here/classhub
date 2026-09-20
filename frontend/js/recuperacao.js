/**
 * Lógica da Tela de Recuperação de Senha do ClassHub
 * Apenas solicitação do e-mail cadastrado e feedback ao usuário
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recuperacao-form');
  const emailInput = document.getElementById('email');
  const submitBtn = document.getElementById('btn-submit');
  const alertBoxId = 'auth-alert';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UIUtils.hideAlert(alertBoxId);

    const email = emailInput.value.trim();
    let hasError = false;

    // Validação do campo de E-mail
    if (!email) {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), 'Informe seu e-mail cadastrado');
      hasError = true;
    } else if (!UIUtils.isValidEmail(email)) {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), 'Formato de e-mail inválido');
      hasError = true;
    } else {
      UIUtils.setFieldError(emailInput, document.getElementById('email-feedback'), '');
    }

    if (hasError) {
      UIUtils.showAlert(alertBoxId, 'Por favor, preencha o e-mail cadastrado corretamente.', 'danger');
      return;
    }

    const defaultBtnHtml = '<i class="bi bi-send-fill me-2"></i> Enviar e-mail de recuperação';
    UIUtils.setLoading(submitBtn, true, defaultBtnHtml);

    const result = await ClassHubAuth.recoverPassword(email);

    UIUtils.setLoading(submitBtn, false, defaultBtnHtml);

    if (result.success) {
      UIUtils.showAlert(
        alertBoxId, 
        result.message || 'Seu e-mail de recuperação foi enviado!', 
        'success'
      );
      // Limpa o campo e destaca o sucesso
      emailInput.value = '';
    } else {
      UIUtils.showAlert(
        alertBoxId, 
        result.error || 'Erro ao processar o pedido. Verifique o e-mail informado.', 
        'danger'
      );
    }
  });
});
