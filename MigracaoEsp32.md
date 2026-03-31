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

## 🛠️ Em Andamento
- **Lógica de Agendamento**: Desenvolvendo interface para salvar agendamentos diários diretamente no documento da caixa no Firestore.

---

## 📝 Próximas Etapas
1. [ ] **Validar Hardware**: Carregar o novo firmware com tópicos dinâmicos no ESP32-C3 e testar comandos via Dashboard.
2. [ ] **Implementar Agendamentos**: Criar a lógica que salva horários de ativação automática no Firestore.
3. [ ] **Histórico de Sensores**: Configurar a gravação de logs de temperatura por caixa no Firestore.
