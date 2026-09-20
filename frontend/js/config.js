/**
 * Configuração da API do ClassHub
 * Gateway e rotas de autenticação
 */
const CONFIG = {
  // Endpoints configurados para comunicação direta com o API Gateway (porta 8080)
  GATEWAY_URL: 'http://localhost:8080',
  ENDPOINTS: {
    CHECK: 'http://localhost:8080/api/auth/check',
    CREATE_USER: 'http://localhost:8080/api/auth/create_user',
    RESET_PASSWORD: 'http://localhost:8080/api/auth/reset_user_password'
  },
  STORAGE_KEYS: {
    TOKEN: 'classhub_token',
    USER: 'classhub_user'
  }
};
