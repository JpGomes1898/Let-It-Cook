const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'segredo-padrao123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } 
}));

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            )
            WITH (OIDS=FALSE);
            ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
        `).catch(() => {}); 

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS ingredients (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                cost DECIMAL(10,2) NOT NULL,
                unit TEXT NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS recipes (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                total_quantity_yield DECIMAL(10,2) NOT NULL,
                profit_margin DECIMAL(10,2) NOT NULL,
                ingredients_json TEXT NOT NULL,
                fixed_costs_json TEXT NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
                recipe_name TEXT,
                quantity_sold DECIMAL(10,2),
                sale_date DATE,
                payment_method TEXT,
                delivery_fee DECIMAL(10,2),
                delivery_cost DECIMAL(10,2),
                total_revenue DECIMAL(10,2),
                total_cost DECIMAL(10,2),
                total_profit DECIMAL(10,2)
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS operational_costs (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                cost DECIMAL(10,2) NOT NULL,
                date_incurred DATE
            );
        `);
        console.log("Tabelas verificadas/criadas com sucesso.");
    } catch (err) {
        console.error("Erro ao criar tabelas:", err);
    }
}

initDB();

function calculateRecipeMetrics(recipe) {
    try {
        const ingredients = JSON.parse(recipe.ingredients_json);
        const fixedCosts = JSON.parse(recipe.fixed_costs_json);
        const totalIngredientCost = ingredients.reduce((acc, item) => acc + Number(item.cost), 0);
        const totalFixedCost = fixedCosts.reduce((acc, item) => acc + Number(item.cost), 0);
        const totalProductionCost = totalIngredientCost + totalFixedCost;

        let unitCost = 0;
        let salePrice = 0;
        const yieldVal = Number(recipe.total_quantity_yield);
        const margin = Number(recipe.profit_margin);

        if (yieldVal > 0) {
            unitCost = totalProductionCost / yieldVal;
            salePrice = unitCost * (1 + margin / 100);
        }

        return {
            ...recipe,
            ingredients,
            fixedCosts,
            total_ingredient_cost: totalIngredientCost.toFixed(2),
            total_fixed_cost: totalFixedCost.toFixed(2),
            total_production_cost: totalProductionCost.toFixed(2),
            unit_cost: unitCost.toFixed(2),
            sale_price: salePrice.toFixed(2)
        };
    } catch (e) { return recipe; }
}

function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    res.status(401).json({ error: "Não autorizado" });
}

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id", 
            [username, hashedPassword]
        );
        req.session.userId = result.rows[0].id;
        res.json({ message: "Registrado" });
    } catch (e) {
        res.status(400).json({ error: "Usuário já existe ou erro." });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Usuário não encontrado" });
        
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user.id;
            res.json({ message: "Logado" });
        } else {
            res.status(400).json({ error: "Senha incorreta" });
        }
    } catch (e) { res.status(500).json({ error: "Erro servidor" }); }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: "Saiu" });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ loggedIn: !!req.session.userId });
});

app.get('/api/ingredients', isAuthenticated, async (req, res) => {
    const result = await pool.query("SELECT * FROM ingredients ORDER BY name");
    const rows = result.rows.map(r => ({...r, cost: parseFloat(r.cost)}));
    res.json(rows);
});

app.post('/api/ingredients', isAuthenticated, async (req, res) => {
    const { name, cost, unit } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO ingredients (name, cost, unit) VALUES ($1, $2, $3) RETURNING id",
            [name, cost, unit]
        );
        res.json({ id: result.rows[0].id });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/ingredients/:id', isAuthenticated, async (req, res) => {
    await pool.query("DELETE FROM ingredients WHERE id = $1", [req.params.id]);
    res.json({ message: "OK" });
});

app.get('/api/recipes', isAuthenticated, async (req, res) => {
    const result = await pool.query("SELECT * FROM recipes ORDER BY name");
    const recipes = result.rows.map(calculateRecipeMetrics);
    res.json(recipes);
});

app.post('/api/recipes', isAuthenticated, async (req, res) => {
    const { name, total_quantity_yield, profit_margin, ingredients, fixed_costs } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO recipes (name, total_quantity_yield, profit_margin, ingredients_json, fixed_costs_json) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [name, total_quantity_yield, profit_margin, JSON.stringify(ingredients), JSON.stringify(fixed_costs)]
        );
        res.json({ id: result.rows[0].id });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/recipes/:id', isAuthenticated, async (req, res) => {
    await pool.query("DELETE FROM recipes WHERE id = $1", [req.params.id]);
    res.json({ message: "OK" });
});

app.get('/api/operational-costs', isAuthenticated, async (req, res) => {
    const result = await pool.query("SELECT * FROM operational_costs ORDER BY date_incurred DESC");
    const rows = result.rows.map(r => ({...r, cost: parseFloat(r.cost)}));
    res.json(rows);
});

app.post('/api/operational-costs', isAuthenticated, async (req, res) => {
    const { name, cost, date_incurred } = req.body;
    const result = await pool.query(
        "INSERT INTO operational_costs (name, cost, date_incurred) VALUES ($1, $2, $3) RETURNING id",
        [name, cost, date_incurred]
    );
    res.json({ id: result.rows[0].id });
});

app.delete('/api/operational-costs/:id', isAuthenticated, async (req, res) => {
    await pool.query("DELETE FROM operational_costs WHERE id = $1", [req.params.id]);
    res.json({ message: "OK" });
});

app.get('/api/sales', isAuthenticated, async (req, res) => {
    const result = await pool.query("SELECT * FROM sales ORDER BY sale_date DESC");
    const rows = result.rows.map(r => ({
        ...r, 
        quantity_sold: parseFloat(r.quantity_sold),
        total_revenue: parseFloat(r.total_revenue),
        total_profit: parseFloat(r.total_profit)
    }));
    res.json(rows);
});

app.post('/api/sales', isAuthenticated, async (req, res) => {
    const d = req.body;
    const result = await pool.query(
        `INSERT INTO sales (recipe_id, recipe_name, quantity_sold, sale_date, payment_method, delivery_fee, delivery_cost, total_revenue, total_cost, total_profit) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [d.recipe_id, d.recipe_name, d.quantity_sold, d.sale_date, d.payment_method, d.delivery_fee, d.delivery_cost, d.total_revenue, d.total_cost, d.total_profit]
    );
    res.json({ id: result.rows[0].id });
});

app.get('/api/reports', isAuthenticated, async (req, res) => {
    const { start, end } = req.query;
    const sales = await pool.query("SELECT * FROM sales WHERE sale_date BETWEEN $1 AND $2", [start, end]);
    const costs = await pool.query("SELECT * FROM operational_costs WHERE date_incurred BETWEEN $1 AND $2", [start, end]);
    
    const sRows = sales.rows.map(r => ({...r, total_revenue: parseFloat(r.total_revenue), total_profit: parseFloat(r.total_profit)}));
    const cRows = costs.rows.map(r => ({...r, cost: parseFloat(r.cost)}));

    res.json({ sales: sRows, costs: cRows });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});