# Resumo das Atualizações do Painel Master

## 1. Exclusão de Clientes
- Foi adicionado um botão com ícone de lixeira na seção "Base de Clientes" do Painel Master.
- **Motivo**: O e-mail no Firebase é um identificador único. Se um e-mail for cadastrado com erro de digitação, a melhor prática é excluir o registro incorreto e cadastrá-re novamente com o e-mail certo.
- **Funcionamento**: Ao clicar no ícone da lixeira, o usuário recebe um alerta de confirmação. Se confirmado, o documento do cliente é permanentemente apagado da coleção `users` do Firestore.

## 2. Recuperação de Senha
- Foi implementado um link de **"Esqueci minha senha"** na tela de Login.
- **Motivo**: Permitir que os clientes que tenham o e-mail real e válido cadastrado consigam criar uma nova senha sem precisar da intervenção do administrador.
- **Funcionamento**: O cliente digita seu e-mail na tela de login e clica no link. O sistema envia um e-mail com um link seguro gerado pelo Firebase Authentication. O sistema também avisa caso o e-mail não seja encontrado na base, indicando que o cliente pode estar digitando a credencial incorreta (ou que ela nunca existiu).

## 3. Exclusão Completa de Cliente (Auth + Firestore)
- A lógica de exclusão foi migrada para o Backend usando o Firebase Admin SDK (`/api/admin/delete-user`).
- **Motivo**: O cliente web não possui permissões de segurança para apagar as credenciais de autenticação de terceiros.
- **Funcionamento**: Agora a lixeira deleta simultaneamente o documento do Firestore e a credencial do Firebase Auth, garantindo que nenhum dado residual (login antigo) permaneça no sistema.

## 4. Reset Rápido de Senha (Painel Master)
- Adicionado o botão "Chave" (🔑) ao lado da lixeira na base de clientes.
- **Motivo**: Clientes com e-mails genéricos/falsos não podem usar a recuperação por e-mail.
- **Funcionamento**: O clique chama a API `/api/admin/reset-password`, altera a senha do usuário instantaneamente para `123456` e ativa a flag `mustChangePassword=true` no Firestore para forçar a redefinição de senha no primeiro acesso.

## 5. Contingência Offline Automática (IP Local)
- Implementado fallback dinâmico para perda de conectividade com a nuvem (MQTT).
- **Motivo**: Garantir o controle da residência caso o provedor de internet caia, mas o Wi-Fi continue operante.
- **Funcionamento**: O Dashboard Next.js armazena o último IP da placa no `localStorage` a cada atualização MQTT. Se o comando via MQTT falhar ou a central constar como Offline, o Dashboard intercepta a falha e automaticamente redireciona o cliente via navegador (nova aba) para a interface local C++ do ESP32 (ex: `http://192.168.1.15`).

## 6. Permissões de Interface
- O botão de "Configurações" (barra lateral) e as opções de gerência foram ocultados de perfis `client`.
- **Motivo**: Manter a interface enxuta e evitar configurações acidentais pelos usuários finais. A visualização das caixas e IPs permanece, pois os clientes podem possuir múltiplos ambientes (ex: Jardim, Piscina).
