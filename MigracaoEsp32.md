# Log de Migração: SmartAutomation (ESP32-C3)

Este arquivo registra cada etapa da evolução do projeto, garantindo transparência e rastreabilidade das mudanças.

---

## ✅ Concluído

### [2026-03-24] - Inicialização do Projeto
- **Nome Definido**: `SmartAutomation`.
- **Arquitetura Selecionada**:
  - **MQTT Broker**: HiveMQ Cloud.
  - **Frontend**: Next.js (Dashboard Premium).
  - **Firmware**: C++/Arduino para ESP32-C3.
- **Estrutura de Pastas**: Criados diretórios `apps/`, `firmware/` e `docs/`.

### [2026-03-27] - Controle Multicaixas & Temporização
- **Dashboard Next.js**: 
  - **Seletor de Caixa**: Adicionado campo no cabeçalho para gerenciar múltiplas caixas (`DEVICE_ID`).
  - **Temporização Individual**: Cada `RelayCard` agora possui um seletor de segundos e o botão "Temporizar".
- **Firmware ESP32-C3**: 
  - **Lógica de GPIO**: Atualizada para usar os pinos reais do usuário e suporte a modo Ativo em LOW.
  - **Favicon Export**: Disponibilizado `Favicon.h`.

### [2026-03-28] - Migração Firebase & Multi-tenancy
- **Migração Supabase -> Firebase**: 
  - **Backend**: Substituído Supabase por **Firestore** para maior flexibilidade em projetos NoSQL/IoT.
  - **Realtime**: Implementado `onSnapshot` do Firestore para sincronização instantânea de nomes de relés.
- **Arquitetura Multi-tenant (Isolamento Total)**:
  - **Firestore**: Dados organizados por `/boxes/{deviceId}/relays/relay_{id}`. Cada caixa possui seu próprio conjunto de nomes e configurações.
  - **MQTT Scoped Topics**: Comandos agora seguem o padrão `esp32/{deviceId}/comando/rele`, garantindo que uma caixa nunca acione a outra por engano.
  - **Provisionamento Automático**: Ao digitar uma nova ID de caixa no Dashboard e renomear um item, o sistema cria automaticamente toda a estrutura para aquele novo "Tenant".
- **Correção MQTT**: 
  - **Alinhamento de Payload**: Sincronizados os campos JSON entre Dashboard e Firmware (uso de `id` e `action` em vez de `rele` e `state`).
  - **Broker Seguro**: Conexão do Dashboard agora utiliza as credenciais seguras do HiveMQ Cloud via variáveis de ambiente.

---

## 🛠️ Procedimento de Trabalho: Favicon no ESP32
Para manter a compatibilidade com a rotina anterior do Firebase:
1. O arquivo `Favicon.h` contém o código hexadecimal completo do ícone.
2. Basta copiar o conteúdo deste arquivo para o seu projeto no Arduino IDE.
3. O código principal já faz a chamada automática para servir o ícone no navegador.

---

### [2026-03-31] - Arquitetura v2.0 & Publicação Global
- **Firmware ESP32-C3 (v2.0)**:
  - **Eficiência e Estabilidade**: WiFi configurado com rádio sempre ativo e reconexão automática.
  - **Sincronização de IP**: O dispositivo agora informa seu IP local automaticamente via MQTT.
  - **Portal de Gestão**: Recuperadas as páginas de IP Fixo, Reset de Fábrica e Login Seguro local.
  - **Sincronia de Queda de Energia**: Delay de 70s garantindo o boot do roteador antes do ESP32.
- **Ambiente de Nuvem**:
  - **GitHub**: Novo repositório `ElysonAragao/SmartAutomation` sincronizado.
  - **Vercel**: Deploy global funcional com suporte a CI/CD e TLS Seguro (HiveMQ Cloud).
  - **Build Safe**: Código otimizado para não quebrar durante a exportação na Vercel se chaves de ambiente estiverem ausentes.

### [2026-04-03] - Validação de Regras de Negócio (Box ID & Aliases)
- **Dashboard & Multi-tenancy**: 
  - **Isolamento por ID**: Confirmado que cada `Box ID` (Ex: `Cx-0001`, `Cx-0002`) possui seu próprio bucket de Aliases (apelidos dos interruptores) no Firestore.
  - **Troca Dinâmica**: A mudança do ID no Dashboard reconfigura instantaneamente:
    1.  **Leitura de Nomes**: Carrega os apelidos salvos especificamente para a nova caixa.
    2.  **Comunicação MQTT**: Altera os tópicos de subscrição e publicação para o novo ID.
    3.  **Captura de IP**: O IP da nova caixa é atualizado no cabeçalho assim que ela se comunica via MQTT.
- **Segurança de Registro**: O sistema garante que, ao renomear um interruptor no Dashboard, a alteração seja gravada de forma persistente e vinculada exclusivamente à caixa ativa no momento.

---

## 🛠️ Procedimento de Trabalho: Favicon no ESP32
Para manter a compatibilidade com a rotina anterior do Firebase:
1. O arquivo `Favicon.h` contém o código hexadecimal completo do ícone.
2. Basta copiar o conteúdo deste arquivo para o seu projeto no Arduino IDE.
3. O código principal já faz a chamada automática para servir o ícone no navegador.

### [2026-04-06] - Conclusão da Infraestrutura Firestore & Deploy
- **Configuração Firestore**: 
  - **Credenciais Reais**: Substituídos os placeholders no `.env.local` pelas chaves do projeto `esp32-controle-ilumincao`.
  - **Habilitação Permanente**: Atualizadas as Regras de Segurança no Firebase para acesso permanente (`allow read, write: if true`), eliminando a expiração do Modo de Teste.
- **Correção de UI**: 
  - **Dinamismo de Relés**: Corrigida a lógica de `onSnapshot` no `page.tsx` para garantir que todos os 8 interruptores permaneçam visíveis, mesmo que apenas alguns possuam apelidos salvos no banco.
- **Deploy & CI/CD**: 
  - **GitHub**: Sincronização de código com commit `feat(dashboard): Corrigido o bug de visibilidade dos botões e configurado o Firestore oficial`.
  - **Vercel**: Configuração manual das `Environment Variables` no painel da Vercel para espelhar o `.env.local` e garantir persistência global.
  - **Teste de Persistência**: Validado o funcionamento em modo anônimo, confirmando a correta gravação/leitura do NoSQL.

### [2026-04-16] - Estratégia "Smart Boot" & ID Dinâmico (v2.9)
- **Firmware ESP32-C3 (v2.9)**:
  - **Smart Boot (Anti-Travamento)**: Implementada estratégia de **Deep Sleep (60s)** ao iniciar por queda de energia. Isso garante silêncio total de RF e elétrico para que o roteador carregue sem interferência do ESP32.
  - **ID da Caixa Dinâmico**: O `DEVICE_ID` (Ex: `Cx-0001`) agora é configurável via Portal Web e salvo na memória flash (`Preferences`), eliminando a necessidade de recompilar para cada nova unidade.
  - **Melhoria de UI/UX Local**: Adicionado botão de Logout ("Sair do Sistema") destacado e exibição do ID da Caixa no Dashboard local.
  - **Monitor Serial**: Adicionado log automático do IP e ID do dispositivo no Monitor Serial após a conexão bem-sucedida.
- **Dashboard Next.js**:
  - **Compatibilidade**: Validada a compatibilidade do seletor de IDs dinâmicos com a nova lógica do firmware.
- **Deploy**: Sincronização global via GitHub e Vercel.

---

## 🛠️ Procedimento de Trabalho: Favicon no ESP32
Para manter a compatibilidade com a rotina anterior do Firebase:
1. O arquivo `Favicon.h` contém o código hexadecimal completo do ícone.
2. Basta copiar o conteúdo deste arquivo para o seu projeto no Arduino IDE.
3. O código principal já faz a chamada automática para servir o ícone no navegador.

---

## 🛠️ Em Andamento
- **Histórico de Sensores**: Configurar a gravação de logs de temperatura por caixa no Firestore.

---

## 📝 Próximas Etapas
1. [ ] **Gráficos em Tempo Real**: Implementar visualização de temperatura histórica no Dashboard.
2. [ ] **Notificações PWA**: Configurar o Dashboard para funcionar como App no celular com notificações de status.
