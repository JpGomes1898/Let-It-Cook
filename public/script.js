const API_URL = '/api';

// Variáveis temporárias para criação de receita
let tempIngredients = [];
let tempFixedCosts = [];
let recipesCache = [];

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    // Configura datas iniciais
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('op-data').value = hoje;
    document.getElementById('venda-data').value = hoje;
    document.getElementById('rel-inicio').value = hoje;
    document.getElementById('rel-fim').value = hoje;

    // Verifica se está logado
    const res = await fetch(`${API_URL}/check-auth`);
    const data = await res.json();
    
    if (data.loggedIn) {
        mostrarApp();
    } else {
        mostrarLogin();
    }
});

// --- CONTROLE DE TELAS (LOGIN vs APP) ---
function mostrarLogin() {
    document.getElementById('tela-login').classList.remove('d-none');
    document.getElementById('tela-app').classList.add('d-none');
}

function mostrarApp() {
    document.getElementById('tela-login').classList.add('d-none');
    document.getElementById('tela-app').classList.remove('d-none');
    // Carrega os dados ao entrar
    loadIngredients();
    loadRecipes();
    loadOperationalCosts();
    loadSales();
}

// --- LÓGICA DE AUTENTICAÇÃO ---
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;

    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        mostrarApp();
        // Limpa campos de senha
        document.getElementById('login-pass').value = '';
    } else {
        const data = await res.json();
        alert(data.error);
    }
});

async function registrar() {
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    
    if(!username || !password) return alert("Preencha usuário e senha para cadastrar.");

    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password })
    });

    if (res.ok) {
        alert("Conta criada! Você entrou.");
        mostrarApp();
    } else {
        const data = await res.json();
        alert("Erro: " + data.error);
    }
}

async function logout() {
    await fetch(`${API_URL}/logout`, { method: 'POST' });
    mostrarLogin();
}

// =====================================================
// === DAQUI PARA BAIXO É A LÓGICA DO SISTEMA EM SI ===
// =====================================================

// --- INGREDIENTES ---
async function loadIngredients() {
    const res = await fetch(`${API_URL}/ingredients`);
    if(!res.ok) return; // Se der erro (ex: deslogou), para
    const data = await res.json();
    
    const tbody = document.getElementById('tabela-ingredientes');
    const selectRec = document.getElementById('rec-select-ing');
    
    tbody.innerHTML = '';
    selectRec.innerHTML = '<option value="">Selecione...</option>';

    data.forEach(ing => {
        // Tabela
        tbody.innerHTML += `
            <tr>
                <td>${ing.name}</td>
                <td>R$ ${ing.cost.toFixed(2)}</td>
                <td>${ing.unit}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteIngredient(${ing.id})">Excluir</button></td>
            </tr>
        `;
        // Select da Receita
        selectRec.innerHTML += `<option value="${ing.id}" data-cost="${ing.cost}" data-name="${ing.name}" data-unit="${ing.unit}">${ing.name}</option>`;
    });
}

document.getElementById('form-ingrediente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('ing-nome').value;
    const cost = document.getElementById('ing-custo').value;
    const unit = document.getElementById('ing-unidade').value;

    await fetch(`${API_URL}/ingredients`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, cost, unit })
    });
    
    e.target.reset();
    loadIngredients();
});

async function deleteIngredient(id) {
    if(confirm('Excluir ingrediente?')) {
        await fetch(`${API_URL}/ingredients/${id}`, { method: 'DELETE' });
        loadIngredients();
    }
}

// --- RECEITAS ---
function addIngToRecipeList() {
    const select = document.getElementById('rec-select-ing');
    const qty = parseFloat(document.getElementById('rec-qtd-ing').value);
    
    if(select.value && qty) {
        const opt = select.options[select.selectedIndex];
        const costUnit = parseFloat(opt.getAttribute('data-cost'));
        
        tempIngredients.push({
            id: parseInt(select.value),
            name: opt.getAttribute('data-name'),
            unit: opt.getAttribute('data-unit'),
            quantity: qty,
            cost: qty * costUnit
        });
        renderTempRecipeLists();
        document.getElementById('rec-qtd-ing').value = '';
    }
}

function addCostToRecipeList() {
    const name = document.getElementById('rec-fixo-nome').value;
    const val = parseFloat(document.getElementById('rec-fixo-custo').value);
    
    if(name && val) {
        tempFixedCosts.push({ name: name, cost: val });
        renderTempRecipeLists();
        document.getElementById('rec-fixo-nome').value = '';
        document.getElementById('rec-fixo-custo').value = '';
    }
}

function renderTempRecipeLists() {
    const ulIng = document.getElementById('lista-temp-ing');
    const ulCost = document.getElementById('lista-temp-custos');
    
    ulIng.innerHTML = tempIngredients.map(i => `<li class="list-group-item bg-dark text-light py-1 d-flex justify-content-between"><span>${i.quantity} ${i.unit} - ${i.name}</span> <span>R$ ${i.cost.toFixed(2)}</span></li>`).join('');
    ulCost.innerHTML = tempFixedCosts.map(c => `<li class="list-group-item bg-dark text-light py-1 d-flex justify-content-between"><span>${c.name}</span> <span>R$ ${c.cost.toFixed(2)}</span></li>`).join('');
}

async function salvarReceita() {
    const name = document.getElementById('rec-nome').value;
    const yieldVal = document.getElementById('rec-rendimento').value;
    const margin = document.getElementById('rec-margem').value;

    if(!name || !yieldVal || !margin || tempIngredients.length === 0) {
        alert("Preencha nome, rendimento, margem e adicione ingredientes.");
        return;
    }

    const payload = {
        name: name,
        total_quantity_yield: parseFloat(yieldVal),
        profit_margin: parseFloat(margin),
        ingredients: tempIngredients,
        fixed_costs: tempFixedCosts
    };

    await fetch(`${API_URL}/recipes`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });

    // Reset
    tempIngredients = [];
    tempFixedCosts = [];
    renderTempRecipeLists();
    document.getElementById('rec-nome').value = '';
    document.getElementById('rec-rendimento').value = '';
    document.getElementById('rec-margem').value = '';
    
    loadRecipes();
    alert('Receita salva com sucesso!');
}

async function loadRecipes() {
    const res = await fetch(`${API_URL}/recipes`);
    if(!res.ok) return;
    recipesCache = await res.json();
    
    const tbody = document.getElementById('tabela-receitas');
    const selectVenda = document.getElementById('venda-receita');
    
    tbody.innerHTML = '';
    selectVenda.innerHTML = '<option value="">Selecione...</option>';

    recipesCache.forEach(rec => {
        tbody.innerHTML += `
            <tr onclick="showRecipeDetails(${rec.id})" style="cursor:pointer">
                <td>${rec.name}</td>
                <td>R$ ${rec.sale_price}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteRecipe(event, ${rec.id})">X</button></td>
            </tr>
        `;
        selectVenda.innerHTML += `<option value="${rec.id}">${rec.name}</option>`;
    });
}

function showRecipeDetails(id) {
    const rec = recipesCache.find(r => r.id === id);
    const div = document.getElementById('detalhes-receita');
    div.classList.remove('d-none');
    div.innerHTML = `
        <strong>${rec.name}</strong><hr class="my-1">
        Custo Produção (Total): R$ ${rec.total_production_cost}<br>
        Custo Unitário: R$ ${rec.unit_cost}<br>
        Preço Sugerido: R$ ${rec.sale_price} (${rec.profit_margin}%)<br>
        <small class="text-muted">Clique para fechar</small>
    `;
    div.onclick = () => div.classList.add('d-none');
}

async function deleteRecipe(e, id) {
    e.stopPropagation();
    if(confirm("Atenção: Isso apagará também o histórico de vendas desta receita. Continuar?")) {
        await fetch(`${API_URL}/recipes/${id}`, { method: 'DELETE' });
        loadRecipes();
    }
}

// --- CUSTOS OPERACIONAIS ---
document.getElementById('form-custo-op').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('op-nome').value,
        cost: parseFloat(document.getElementById('op-valor').value),
        date_incurred: document.getElementById('op-data').value
    };
    await fetch(`${API_URL}/operational-costs`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    e.target.reset();
    document.getElementById('op-data').value = new Date().toISOString().split('T')[0];
    loadOperationalCosts();
});

async function loadOperationalCosts() {
    const res = await fetch(`${API_URL}/operational-costs`);
    if(!res.ok) return;
    const data = await res.json();
    document.getElementById('tabela-custos-op').innerHTML = data.map(c => `
        <tr>
            <td>${c.date_incurred}</td>
            <td>${c.name}</td>
            <td>R$ ${c.cost.toFixed(2)}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteOpCost(${c.id})">X</button></td>
        </tr>
    `).join('');
}

async function deleteOpCost(id) {
    if(confirm('Apagar lançamento?')) {
        await fetch(`${API_URL}/operational-costs/${id}`, { method: 'DELETE' });
        loadOperationalCosts();
    }
}

// --- VENDAS ---
async function registrarVenda() {
    const recId = parseInt(document.getElementById('venda-receita').value);
    const qtd = parseFloat(document.getElementById('venda-qtd').value);
    const date = document.getElementById('venda-data').value;
    
    if(!recId || !qtd || !date) return alert('Preencha receita, quantidade e data');

    const recipe = recipesCache.find(r => r.id === recId);
    if(!recipe) return alert("Receita não encontrada");
    
    const deliveryFee = parseFloat(document.getElementById('venda-taxa-entrega').value) || 0;
    const deliveryCost = parseFloat(document.getElementById('venda-custo-entrega').value) || 0;
    
    const productCost = parseFloat(recipe.unit_cost) * qtd;
    const productRevenue = parseFloat(recipe.sale_price) * qtd;

    const totalCost = productCost + deliveryCost;
    const totalRevenue = productRevenue + deliveryFee;
    const totalProfit = totalRevenue - totalCost;

    const payload = {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        quantity_sold: qtd,
        sale_date: date,
        payment_method: document.getElementById('venda-pagto').value,
        delivery_fee: deliveryFee,
        delivery_cost: deliveryCost,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        total_profit: totalProfit
    };

    await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });

    alert('Venda Registrada!');
    loadSales();
    document.getElementById('venda-qtd').value = '';
}

async function loadSales() {
    const res = await fetch(`${API_URL}/sales`);
    if(!res.ok) return;
    const data = await res.json();
    document.getElementById('tabela-vendas').innerHTML = data.map(s => `
        <tr>
            <td>${s.sale_date}</td>
            <td>${s.recipe_name}</td>
            <td>${s.quantity_sold}</td>
            <td class="text-success">R$ ${s.total_profit.toFixed(2)}</td>
        </tr>
    `).join('');
}

// --- RELATÓRIOS ---
async function gerarRelatorio() {
    const start = document.getElementById('rel-inicio').value;
    const end = document.getElementById('rel-fim').value;
    
    const res = await fetch(`${API_URL}/reports?start=${start}&end=${end}`);
    if(!res.ok) return;
    const data = await res.json();
    
    const sales = data.sales;
    const costs = data.costs;

    const totalRevenue = sales.reduce((sum, s) => sum + s.total_revenue, 0);
    const totalGrossProfit = sales.reduce((sum, s) => sum + s.total_profit, 0);
    const totalOpCosts = costs.reduce((sum, c) => sum + c.cost, 0);
    const netProfit = totalGrossProfit - totalOpCosts;

    let texto = `=== RELATÓRIO FINANCEIRO ===\n`;
    texto += `Período: ${start} até ${end}\n\n`;
    texto += `RESUMO GERAL:\n`;
    texto += `--------------------------------\n`;
    texto += `(+) Faturamento Total:  R$ ${totalRevenue.toFixed(2)}\n`;
    texto += `(I) Lucro Bruto Vendas: R$ ${totalGrossProfit.toFixed(2)}\n`;
    texto += `(-) Custos Operacionais:R$ ${totalOpCosts.toFixed(2)}\n`;
    texto += `--------------------------------\n`;
    texto += `(=) LUCRO LÍQUIDO FINAL:R$ ${netProfit.toFixed(2)}\n\n`;
    
    texto += `DETALHAMENTO DE CUSTOS FIXOS:\n`;
    if(costs.length === 0) texto += "Nenhum custo lançado.\n";
    costs.forEach(c => {
        texto += `- ${c.date_incurred} | ${c.name.padEnd(15)} | R$ ${c.cost.toFixed(2)}\n`;
    });

    document.getElementById('relatorio-texto').innerText = texto;

}
