# Resumo das Atualizações do Painel Master

## 1. Exclusão de Clientes
- Foi adicionado um botão com ícone de lixeira na seção "Base de Clientes" do Painel Master.
- **Motivo**: O e-mail no Firebase é um identificador único. Se um e-mail for cadastrado com erro de digitação, a melhor prática é excluir o registro incorreto e cadastrá-re novamente com o e-mail certo.
- **Funcionamento**: Ao clicar no ícone da lixeira, o usuário recebe um alerta de confirmação. Se confirmado, o documento do cliente é permanentemente apagado da coleção `users` do Firestore.

## 2. Recuperação de Senha
- Foi implementado um link de **"Esqueci minha senha"** na tela de Login.
- **Motivo**: Permitir que os clientes que tenham o e-mail real e válido cadastrado consigam criar uma nova senha sem precisar da intervenção do administrador.
- **Funcionamento**: O cliente digita seu e-mail na tela de login e clica no link. O sistema envia um e-mail com um link seguro gerado pelo Firebase Authentication. O sistema também avisa caso o e-mail não seja encontrado na base, indicando que o cliente pode estar digitando a credencial incorreta (ou que ela nunca existiu).
