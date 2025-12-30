🍳 Let It Cook - Gestor Financeiro de Receitas
Este é um sistema web completo (SaaS) para gestão financeira de pequenos negócios de alimentação (confeitaria, marmitas, salgados). Ele permite precificar receitas automaticamente, registrar vendas e analisar o lucro líquido real do negócio.

Status: 🟢 Online (Hospedado no Render.com)

🚀 Funcionalidades Principais
O sistema é dividido em 5 módulos estratégicos:

1. 🔐 Autenticação e Segurança
Login e Cadastro: Sistema protegido para garantir que apenas o dono acesse os dados.

Criptografia: As senhas são armazenadas de forma segura (Hash) utilizando bcrypt.

Sessão Persistente: O usuário permanece logado por até 30 dias.

2. 🍎 Gestão de Ingredientes (Matéria-Prima)
Cadastro de insumos com Custo Unitário e Unidade de Medida (kg, L, Unidade).

Base de dados centralizada para usar em múltiplas receitas.

Atualização de preço de ingrediente (impacta novos cálculos, mantendo histórico seguro).

3. 🍰 Precificação Automática de Receitas
A ferramenta mais poderosa do sistema. Você monta a receita e ele calcula a matemática financeira:

Composição: Selecione ingredientes e quantidades.

Custos Extras: Adicione custos específicos da receita (Ex: Embalagem, Gás proporcional).

Cálculos Automáticos:

Custo Total de Produção.

Custo Unitário (baseado no rendimento).

Preço de Venda Sugerido (baseado na Margem de Lucro desejada).

4. 💸 Controle Financeiro (Vendas e Despesas)
Registro de Vendas: Lance vendas diárias selecionando a receita.

Suporte para Taxa de Entrega (Receita) e Custo de Motoboy (Despesa).

Cálculo imediato do lucro da operação.

Custos Operacionais: Registro de despesas fixas/variáveis que não são ingredientes (Ex: Conta de Luz, Aluguel, Marketing, Compra de Gás).

5. 📊 Relatórios e Exportação
DRE Simplificado: Selecione um período (Início e Fim) e veja:

Faturamento Bruto.

Lucro Bruto (Vendas - Custo Produção).

Custos Operacionais Totais.

Lucro Líquido Final.

Exportação PDF: Botão integrado para gerar e baixar o relatório formatado em PDF.

🛠️ Tecnologias Utilizadas
Backend: Node.js + Express.

Banco de Dados: PostgreSQL (Nativo na nuvem).

Frontend: HTML5, CSS3 (Bootstrap 5), Vanilla JavaScript.

Segurança: Bcrypt (Senhas), Express-Session (Login).

PDF: html2pdf.js.

📦 Como Rodar Localmente
Se você quiser rodar este projeto no seu computador para desenvolvimento:

Pré-requisitos: Ter Node.js e PostgreSQL instalados.

Clone o repositório:
git clone https://github.com/seu-usuario/gestor-receitas.git

Instale as dependências:
npm install

Configure as Variáveis de Ambiente: Crie um arquivo .env na raiz ou configure no seu sistema.
DATABASE_URL=postgres://usuario:senha@localhost:5432/nome_do_banco
SESSION_SECRET=uma_senha_secreta_aleatoria

Rode o servidor:
npm start
http://localhost:3000

Desenvolvido para facilitar a vida de quem cozinha. 👨‍🍳👩‍🍳
