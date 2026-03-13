import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import morgan from 'morgan';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Database Setup ---
const db = new Database('marmita.db');
db.pragma('journal_mode = WAL'); // Better performance for concurrent reads/writes

// Initialize database schema with indexes for performance
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    observation TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    is_shortcut INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    total_value REAL NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    observation TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    value REAL NOT NULL,
    date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Helper to log activity
const logActivity = (action: string, details: string) => {
  try {
    db.prepare('INSERT INTO activity_logs (action, details) VALUES (?, ?)').run(action, details);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

// Migration: Add is_shortcut to products if it doesn't exist
const tableInfo = db.prepare("PRAGMA table_info(products)").all() as any[];
if (!tableInfo.some(col => col.name === 'is_shortcut')) {
  db.exec('ALTER TABLE products ADD COLUMN is_shortcut INTEGER DEFAULT 0');
}

// Migration: Add status to orders if it doesn't exist
const ordersTableInfo = db.prepare("PRAGMA table_info(orders)").all() as any[];
if (!ordersTableInfo.some(col => col.name === 'status')) {
  db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'");
}

// Seed initial data
const seedData = () => {
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count < 6) {
    const insertProduct = db.prepare('INSERT INTO products (name, price, is_shortcut) VALUES (?, ?, ?)');
    const existingProducts = db.prepare('SELECT name FROM products').all() as { name: string }[];
    const existingNames = existingProducts.map(p => p.name);

    if (!existingNames.includes('Marmita Pequena')) insertProduct.run('Marmita Pequena', 15.00, 1);
    if (!existingNames.includes('Marmita Média')) insertProduct.run('Marmita Média', 18.00, 1);
    if (!existingNames.includes('Marmita Grande')) insertProduct.run('Marmita Grande', 22.00, 1);
    if (!existingNames.includes('Suco de Laranja 300ml')) insertProduct.run('Suco de Laranja 300ml', 7.00, 1);
    if (!existingNames.includes('Suco de Limão 300ml')) insertProduct.run('Suco de Limão 300ml', 6.00, 1);
    if (!existingNames.includes('Refrigerante Lata')) insertProduct.run('Refrigerante Lata', 6.00, 1);
  }

  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
  if (customerCount.count === 0) {
    db.prepare('INSERT INTO customers (name) VALUES (?)').run('Consumidor Final');
  }
};
seedData();

// --- Validation Schemas ---
const ProductSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  price: z.number().positive("Preço deve ser positivo"),
  is_shortcut: z.union([z.boolean(), z.number()]).transform(val => (typeof val === 'boolean' ? (val ? 1 : 0) : val))
});

const CustomerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional().nullable(),
  observation: z.string().optional().nullable()
});

const OrderSchema = z.object({
  customer_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int().positive(),
  total_value: z.number().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
  observation: z.string().optional().nullable(),
  status: z.string().optional().default('pending')
});

const ExpenseSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  value: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

// --- Server Setup ---
async function startServer() {
  const app = express();
  
  // Middleware
  app.use(morgan('dev')); // Logging
  app.use(express.json());

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- API Routes ---

  // Products
  app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
    res.json(products);
  });

  app.post('/api/products', (req, res) => {
    const data = ProductSchema.parse(req.body);
    const info = db.prepare('INSERT INTO products (name, price, is_shortcut) VALUES (?, ?, ?)').run(data.name, data.price, data.is_shortcut);
    logActivity('CREATE_PRODUCT', `Produto criado: ${data.name} (R$ ${data.price})`);
    res.status(201).json({ id: info.lastInsertRowid, ...data });
  });

  app.put('/api/products/:id', (req, res) => {
    const data = ProductSchema.parse(req.body);
    const { id } = req.params;
    const result = db.prepare('UPDATE products SET name = ?, price = ?, is_shortcut = ? WHERE id = ?').run(data.name, data.price, data.is_shortcut, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    logActivity('UPDATE_PRODUCT', `Produto atualizado: ${data.name} (R$ ${data.price})`);
    res.json({ id, ...data });
  });

  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      // Check for linked orders
      const linkedOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE product_id = ?').get(id) as any;
      if (linkedOrders.count > 0) {
        return res.status(400).json({ error: 'Não é possível excluir este produto pois existem pedidos vinculados a ele.' });
      }

      const product = db.prepare('SELECT name FROM products WHERE id = ?').get(id) as any;
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      if (product) logActivity('DELETE_PRODUCT', `Produto excluído: ${product.name}`);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        res.status(400).json({ error: 'Não é possível excluir este produto pois existem pedidos vinculados a ele.' });
      } else {
        res.status(500).json({ error: 'Erro ao excluir produto.' });
      }
    }
  });

  app.post('/api/products/toggle-shortcut/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('UPDATE products SET is_shortcut = CASE WHEN is_shortcut = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(product);
  });

  // Customers
  app.get('/api/customers', (req, res) => {
    const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    res.json(customers);
  });

  app.post('/api/customers', (req, res) => {
    const data = CustomerSchema.parse(req.body);
    const info = db.prepare('INSERT INTO customers (name, phone, observation) VALUES (?, ?, ?)').run(data.name, data.phone, data.observation);
    res.status(201).json({ id: info.lastInsertRowid, ...data });
  });

  app.put('/api/customers/:id', (req, res) => {
    const data = CustomerSchema.parse(req.body);
    const { id } = req.params;
    const result = db.prepare('UPDATE customers SET name = ?, phone = ?, observation = ? WHERE id = ?').run(data.name, data.phone, data.observation, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    logActivity('UPDATE_CUSTOMER', `Cliente atualizado: ${data.name}`);
    res.json({ id, ...data });
  });

  app.delete('/api/customers/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      // Check for linked orders
      const linkedOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?').get(id) as any;
      if (linkedOrders.count > 0) {
        return res.status(400).json({ error: 'Não é possível excluir este cliente pois existem pedidos vinculados a ele.' });
      }

      const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(id) as any;
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      if (customer) logActivity('DELETE_CUSTOMER', `Cliente excluído: ${customer.name}`);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        res.status(400).json({ error: 'Não é possível excluir este cliente pois existem pedidos vinculados a ele.' });
      } else {
        res.status(500).json({ error: 'Erro ao excluir cliente.' });
      }
    }
  });

  // Orders
  app.get('/api/orders', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const orders = db.prepare(`
      SELECT o.*, c.name as customer_name, c.observation as customer_observation, c.phone as customer_phone, p.name as product_name 
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.date = ?
      ORDER BY o.time DESC
    `).all(date);
    res.json(orders);
  });

  app.post('/api/orders', (req, res) => {
    const data = OrderSchema.parse(req.body);
    const info = db.prepare(`
      INSERT INTO orders (customer_id, product_id, quantity, total_value, date, time, observation, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.customer_id, data.product_id, data.quantity, data.total_value, data.date, data.time, data.observation, data.status);
    logActivity('CREATE_ORDER', `Pedido criado: Qtd ${data.quantity}, Total R$ ${data.total_value}`);
    res.status(201).json({ id: info.lastInsertRowid, ...data });
  });

  app.put('/api/orders/:id', (req, res) => {
    const data = OrderSchema.parse(req.body);
    const { id } = req.params;
    const result = db.prepare(`
      UPDATE orders 
      SET customer_id = ?, product_id = ?, quantity = ?, total_value = ?, date = ?, time = ?, observation = ?, status = ?
      WHERE id = ?
    `).run(data.customer_id, data.product_id, data.quantity, data.total_value, data.date, data.time, data.observation, data.status, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    logActivity('UPDATE_ORDER', `Pedido atualizado: ID ${id}, Total R$ ${data.total_value}`);
    res.json({ id, ...data });
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (status !== 'pending' && status !== 'delivered') {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json({ success: true, status });
  });

  app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    logActivity('DELETE_ORDER', `Pedido excluído: ID ${id}`);
    res.json({ success: true });
  });

  // Expenses
  app.get('/api/expenses', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const expenses = db.prepare('SELECT * FROM expenses WHERE date = ? ORDER BY id DESC').all(date);
    res.json(expenses);
  });

  app.post('/api/expenses', (req, res) => {
    const data = ExpenseSchema.parse(req.body);
    const info = db.prepare('INSERT INTO expenses (description, value, date) VALUES (?, ?, ?)').run(data.description, data.value, data.date);
    logActivity('CREATE_EXPENSE', `Gasto criado: ${data.description} (R$ ${data.value})`);
    res.status(201).json({ id: info.lastInsertRowid, ...data });
  });

  app.put('/api/expenses/:id', (req, res) => {
    const data = ExpenseSchema.parse(req.body);
    const { id } = req.params;
    const result = db.prepare('UPDATE expenses SET description = ?, value = ?, date = ? WHERE id = ?').run(data.description, data.value, data.date, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    logActivity('UPDATE_EXPENSE', `Gasto atualizado: ${data.description} (R$ ${data.value})`);
    res.json({ id, ...data });
  });

  app.delete('/api/expenses/:id', (req, res) => {
    const { id } = req.params;
    const expense = db.prepare('SELECT description FROM expenses WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    if (expense) logActivity('DELETE_EXPENSE', `Gasto excluído: ${expense.description}`);
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get('/api/stats', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    
    const sales = db.prepare('SELECT SUM(total_value) as total, SUM(quantity) as count, COUNT(*) as orders FROM orders WHERE date = ?').get(date) as any;
    const expenses = db.prepare('SELECT SUM(value) as total FROM expenses WHERE date = ?').get(date) as any;
    
    res.json({
      totalSales: sales.total || 0,
      totalOrders: sales.orders || 0,
      totalMarmitas: sales.count || 0,
      totalExpenses: expenses.total || 0,
      profit: (sales.total || 0) - (expenses.total || 0)
    });
  });

  app.get('/api/stats/monthly', (req, res) => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const sales = db.prepare("SELECT SUM(total_value) as total FROM orders WHERE strftime('%Y-%m', date) = ?").get(month) as any;
    const expenses = db.prepare("SELECT SUM(value) as total FROM expenses WHERE strftime('%Y-%m', date) = ?").get(month) as any;
    
    const topProducts = db.prepare(`
      SELECT p.name, SUM(o.quantity) as total_quantity, SUM(o.total_value) as total_value
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE strftime('%Y-%m', o.date) = ?
      GROUP BY p.id
      ORDER BY total_quantity DESC
      LIMIT 5
    `).all(month);

    const topCustomers = db.prepare(`
      SELECT c.name, SUM(o.quantity) as total_quantity, SUM(o.total_value) as total_value
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE strftime('%Y-%m', o.date) = ?
      GROUP BY c.id
      ORDER BY total_value DESC
      LIMIT 5
    `).all(month);

    res.json({
      revenue: sales.total || 0,
      expenses: expenses.total || 0,
      profit: (sales.total || 0) - (expenses.total || 0),
      topProducts,
      topCustomers
    });
  });

  // Trends for Charts (Last 7 days)
  app.get('/api/stats/trends', (req, res) => {
    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const sales = db.prepare('SELECT SUM(total_value) as total FROM orders WHERE date = ?').get(dateStr) as any;
      const expenses = db.prepare('SELECT SUM(value) as total FROM expenses WHERE date = ?').get(dateStr) as any;
      
      trends.push({
        date: dateStr.split('-').slice(1).reverse().join('/'), // DD/MM
        vendas: sales.total || 0,
        gastos: expenses.total || 0
      });
    }
    res.json(trends);
  });

  // Activity Logs
  app.get('/api/logs', (req, res) => {
    const logs = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50').all();
    res.json(logs);
  });

  // --- Error Handling Middleware ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);

    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Erro de validação',
        details: err.issues.map(e => ({ path: e.path.join('.'), message: e.message }))
      });
    }

    res.status(500).json({
      error: 'Erro interno do servidor',
      message: process.env.NODE_ENV === 'production' ? 'Ocorreu um erro inesperado' : err.message
    });
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
