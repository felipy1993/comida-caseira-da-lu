import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  Receipt, 
  FileText, 
  UserPlus,
  Download,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Zap,
  Settings,
  Star,
  StarOff,
  Edit2,
  X,
  History,
  PieChart as PieChartIcon,
  Printer,
  Users,
  CalendarDays,
  CheckCircle2,
  Circle,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  doc, 
  deleteDoc, 
  limit, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import Login from './components/Login';
import { Customer, Product, Order, Expense, Stats, ActivityLog } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // Form states
  const [newOrder, setNewOrder] = useState({
    customer_id: '',
    product_id: '',
    quantity: 1,
    observation: '',
    time: getCurrentTime()
  });
  const [cart, setCart] = useState<{product_id: string, quantity: number}[]>([]);
  const [newExpense, setNewExpense] = useState({ description: '', value: '' });
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', observation: '' });
  const [newProduct, setNewProduct] = useState({ name: '', price: '', is_shortcut: true });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ type: string, data: any } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: string, id: string, label: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'monthly-report') {
      fetchMonthlyData();
    }
  }, [activeTab, selectedMonth]);

  const logActivity = async (action: string, details: string) => {
    try {
      await addDoc(collection(db, 'activity_logs'), {
        action,
        details,
        timestamp: serverTimestamp()
      });
      fetchLogs();
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const logsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setLogs(logsData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const fetchMonthlyData = async () => {
    // Basic aggregation for monthly report
    try {
      const q = query(collection(db, 'orders'), where('date', '>=', `${selectedMonth}-01`), where('date', '<=', `${selectedMonth}-31`));
      const querySnapshot = await getDocs(q);
      let revenue = 0;
      querySnapshot.docs.forEach(doc => revenue += doc.data().total_value);

      const eq = query(collection(db, 'expenses'), where('date', '>=', `${selectedMonth}-01`), where('date', '<=', `${selectedMonth}-31`));
      const eqSnapshot = await getDocs(eq);
      let expensesVal = 0;
      eqSnapshot.docs.forEach(doc => expensesVal += doc.data().value);

      setMonthlyStats({
        revenue,
        expenses: expensesVal,
        profit: revenue - expensesVal,
        topProducts: [], // Simplified for now
        topCustomers: [] // Simplified for now
      });
    } catch (error) {
      console.error('Error fetching monthly stats:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Products
      const productsSnapshot = await getDocs(query(collection(db, 'products'), orderBy('name', 'asc')));
      const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      
      // Seed initial products if empty
      if (productsData.length === 0) {
        const initialProducts = [
          { name: 'Marmita Pequena', price: 15.00, is_shortcut: 1 },
          { name: 'Marmita Média', price: 18.00, is_shortcut: 1 },
          { name: 'Marmita Grande', price: 22.00, is_shortcut: 1 },
          { name: 'Suco de Laranja 300ml', price: 7.00, is_shortcut: 1 },
          { name: 'Suco de Limão 300ml', price: 6.00, is_shortcut: 1 },
          { name: 'Refrigerante Lata', price: 6.00, is_shortcut: 1 },
        ];
        for (const p of initialProducts) {
          await addDoc(collection(db, 'products'), p);
        }
        const refreshedProducts = await getDocs(query(collection(db, 'products'), orderBy('name', 'asc')));
        setProducts(refreshedProducts.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      } else {
        setProducts(productsData);
      }

      // 2. Fetch Customers
      const customersSnapshot = await getDocs(query(collection(db, 'customers'), orderBy('name', 'asc')));
      const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      
      // Seed default customer if empty
      if (customersData.length === 0) {
        const docRef = await addDoc(collection(db, 'customers'), { name: 'Consumidor Final' });
        setCustomers([{ id: docRef.id, name: 'Consumidor Final' }]);
      } else {
        setCustomers(customersData);
      }

      // 3. Fetch Today's Orders
      const ordersSnapshot = await getDocs(query(collection(db, 'orders'), where('date', '==', today)));
      const ordersData = ordersSnapshot.docs.map(doc => {
        const data = doc.data();
        const customer = customersData.find(c => c.id === data.customer_id);
        const product = productsData.find(p => p.id === data.product_id);
        return { 
          id: doc.id, 
          ...data,
          customer_name: customer?.name || 'Desconhecido',
          product_name: product?.name || 'Deletado'
        };
      }) as Order[];
      setOrders(ordersData);

      // 4. Fetch Today's Expenses
      const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('date', '==', today)));
      const expensesData = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];
      setExpenses(expensesData);

      // 5. Calculate Stats
      const totalSales = ordersData.reduce((acc, o) => acc + o.total_value, 0);
      const totalExpenses = expensesData.reduce((acc, e) => acc + e.value, 0);
      const totalMarmitas = ordersData.reduce((acc, o) => acc + o.quantity, 0);
      setStats({
        totalSales,
        totalOrders: ordersData.length,
        totalMarmitas,
        totalExpenses,
        profit: totalSales - totalExpenses
      });

      // 6. Fetch Logs & Trends (Trends simplified for now)
      fetchLogs();
      setTrends([]); 
      
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Erro ao carregar dados da nuvem.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrder = async (e?: React.FormEvent, quickOrderData?: any) => {
    if (e) e.preventDefault();
    
    if (quickOrderData) {
      const product = products.find(p => p.id === quickOrderData.product_id);
      if (!product || !quickOrderData.customer_id) return;
      const total_value = product.price * (quickOrderData.quantity || 1);
      
      try {
        setLoading(true);
        await addDoc(collection(db, 'orders'), {
          customer_id: quickOrderData.customer_id,
          product_id: quickOrderData.product_id,
          quantity: quickOrderData.quantity || 1,
          total_value,
          date: today,
          time: quickOrderData.time || getCurrentTime(),
          observation: quickOrderData.observation || '',
          status: 'pending'
        });
        
        logActivity('CREATE_ORDER', `Venda rápida: ${product.name}`);
        showToast('Venda realizada com sucesso!');
        fetchData();
        return;
      } catch (error) {
        console.error('Error adding quick order:', error);
        showToast('Erro ao realizar venda rápida.');
        return;
      } finally {
        setLoading(false);
      }
    }

    const itemsToSubmit = [...cart];
    
    // Always include the current selection if it's valid
    if (newOrder.product_id && newOrder.quantity > 0) {
      itemsToSubmit.push({ product_id: newOrder.product_id, quantity: newOrder.quantity });
    }

    if (itemsToSubmit.length === 0) {
      showToast('Adicione ao menos um item ao pedido.');
      return;
    }

    if (!newOrder.customer_id) {
      showToast('Selecione um cliente.');
      return;
    }

    try {
      setLoading(true);
      // Submit each item
      for (const item of itemsToSubmit) {
        const product = products.find(p => p.id === item.product_id);
        if (!product) continue;
        
        const total_value = product.price * item.quantity;
        
        await addDoc(collection(db, 'orders'), {
          customer_id: newOrder.customer_id,
          product_id: item.product_id,
          quantity: item.quantity,
          total_value,
          date: today,
          time: newOrder.time,
          observation: newOrder.observation,
          status: 'pending'
        });
      }
      
      logActivity('CREATE_ORDER', `Pedido finalizado: ${itemsToSubmit.length} itens`);
      setCart([]);
      setNewOrder({
        customer_id: '',
        product_id: '',
        quantity: 1,
        observation: '',
        time: getCurrentTime()
      });
      showToast('Pedido finalizado com sucesso!');
      setActiveTab('orders');
      fetchData();
    } catch (error) {
      console.error('Error finalizing order:', error);
      showToast('Erro ao finalizar pedido.');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = () => {
    if (!newOrder.product_id || !newOrder.quantity || Number.isNaN(newOrder.quantity)) {
      showToast('Selecione um produto e quantidade válida.');
      return;
    }
    
    setCart([...cart, { product_id: newOrder.product_id, quantity: newOrder.quantity }]);
    setNewOrder({ ...newOrder, product_id: '', quantity: 1 });
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const toggleShortcut = async (productId: string | number) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      await updateDoc(doc(db, 'products', productId.toString()), {
        is_shortcut: product.is_shortcut === 1 ? 0 : 1
      });
      await fetchData();
    } catch (error) {
      console.error('Error toggling shortcut:', error);
    }
  };

  const handleQuickSale = (product: Product) => {
    const defaultCustomer = customers.find(c => c.name === 'Consumidor Final') || customers[0];
    if (!defaultCustomer) {
      showToast('Por favor, cadastre ao menos um cliente primeiro.');
      return;
    }

    handleAddOrder(undefined, {
      customer_id: defaultCustomer.id,
      product_id: product.id,
      quantity: 1,
      observation: 'Venda Rápida',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.value) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        value: parseFloat(newExpense.value),
        date: today
      });
      logActivity('CREATE_EXPENSE', `Gasto criado: ${newExpense.description}`);
      setNewExpense({ description: '', value: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;

    try {
      const docRef = await addDoc(collection(db, 'customers'), newCustomer);
      const customer = { id: docRef.id, ...newCustomer };
      setCustomers([...customers, customer]);
      setNewOrder({ ...newOrder, customer_id: docRef.id });
      setNewCustomer({ name: '', phone: '', observation: '' });
      setShowCustomerModal(false);
      logActivity('CREATE_CUSTOMER', `Cliente criado: ${newCustomer.name}`);
    } catch (error) {
      console.error('Error adding customer:', error);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;

    try {
      await addDoc(collection(db, 'products'), {
        ...newProduct,
        price: parseFloat(newProduct.price)
      });
      setNewProduct({ name: '', price: '', is_shortcut: true });
      fetchData();
      logActivity('CREATE_PRODUCT', `Produto criado: ${newProduct.name}`);
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmation) return;
    const { type, id } = deleteConfirmation;
    try {
      await deleteDoc(doc(db, type, id.toString()));
      logActivity('DELETE_' + type.toUpperCase(), `Item excluído: ${deleteConfirmation.label}`);
      setDeleteConfirmation(null);
      fetchData();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      showToast('Erro ao excluir do banco de dados.');
    }
  };

  const confirmDelete = (type: string, id: string, label: string) => {
    setDeleteConfirmation({ type, id, label });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const { type, data } = editingItem;
    try {
      const { id, ...updateData } = data;
      await updateDoc(doc(db, type, id.toString()), updateData);
      logActivity('UPDATE_' + type.toUpperCase(), `Item atualizado: ${id}`);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
      showToast('Erro ao atualizar na nuvem.');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Cliente', 'Produto', 'Qtd', 'Valor', 'Horário', 'Obs'];
    const rows = orders.map(o => [
      o.id,
      o.customer_name,
      o.product_name,
      o.quantity,
      o.total_value.toFixed(2),
      o.time,
      o.observation || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${today}.csv`;
    link.click();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Visão Geral</h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Backend Online
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <LogIn size={14} className="rotate-180" />
          Sair
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Vendas</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats?.totalSales || 0)}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <TrendingDown size={20} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gastos</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats?.totalExpenses || 0)}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <DollarSign size={20} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Lucro</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(stats?.profit || 0)}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Package size={20} />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Marmitas</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.totalMarmitas || 0}</div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trends Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-600" />
              Desempenho Semanal
            </h3>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-slate-500">Vendas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-500">Gastos</span>
              </div>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="vendas" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVendas)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="gastos" 
                  stroke="#f43f5e" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorGastos)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <PieChartIcon size={18} className="text-indigo-600" />
              Hoje
            </h3>
          </div>
          <div className="flex-1 min-h-[200px] w-full flex items-center justify-center">
            {(() => {
              const pieData = [
                { name: 'Vendas', value: stats?.totalSales || 0, color: '#6366f1' },
                { name: 'Gastos', value: stats?.totalExpenses || 0, color: '#f43f5e' }
              ].filter(d => d.value > 0);

              if (pieData.length === 0) {
                return <div className="text-sm text-slate-400">Nenhum dado hoje</div>;
              }

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '12px'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle" 
                      wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Quick Sales Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-amber-500" />
          <h3 className="font-semibold text-slate-800">Venda Rápida</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.filter(p => p.is_shortcut).map(product => (
            <button
              key={product.id}
              onClick={() => handleQuickSale(product)}
              className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 text-center">{product.name}</span>
              <span className="text-xs text-slate-500 font-medium">{formatCurrency(product.price)}</span>
            </button>
          ))}
          <button
            onClick={() => setActiveTab('products')}
            className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all"
          >
            <PlusCircle size={20} className="mb-1" />
            <span className="text-xs font-medium">Configurar</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Últimos Pedidos</h3>
          <button onClick={() => setActiveTab('orders')} className="text-sm text-indigo-600 font-medium">Ver todos</button>
        </div>
        <div className="divide-y divide-slate-50">
          {orders.slice(0, 5).map(order => (
            <div key={order.id} className="p-4 flex justify-between items-center group">
              <div>
                <div className="font-medium text-slate-900">{order.customer_name}</div>
                <div className="text-sm text-slate-500">{order.product_name} • {order.quantity}x</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-slate-900">{formatCurrency(order.total_value)}</div>
                  <div className="text-xs text-slate-400">{order.time}</div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEditingItem({ type: 'orders', data: order })}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => confirmDelete('orders', order.id, `${order.customer_name} - ${order.product_name}`)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="p-8 text-center text-slate-400">Nenhum pedido hoje</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderNewOrder = () => (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Novo Pedido</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
            <div className="flex gap-2">
              <select 
                className="flex-1 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                value={newOrder.customer_id}
                onChange={e => setNewOrder({ ...newOrder, customer_id: e.target.value })}
                required
              >
                <option value="">Selecionar Cliente</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button 
                type="button"
                onClick={() => setShowCustomerModal(true)}
                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
              >
                <UserPlus size={24} />
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Adicionar Itens</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Produto / Bebida</label>
              <select 
                className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                value={newOrder.product_id}
                onChange={e => setNewOrder({ ...newOrder, product_id: e.target.value })}
              >
                <option value="">Selecionar Item</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                <input 
                  type="number" 
                  min="1"
                  className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  value={Number.isNaN(newOrder.quantity) ? "" : newOrder.quantity}
                  onChange={e => {
                    const val = e.target.value;
                    setNewOrder({ ...newOrder, quantity: val === "" ? NaN : parseInt(val) });
                  }}
                />
              </div>
              <button 
                type="button"
                onClick={addToCart}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 flex items-center gap-2"
              >
                <PlusCircle size={20} /> Adicionar
              </button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Itens no Pedido</h3>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {cart.map((item, index) => {
                  const product = products.find(p => p.id === parseInt(item.product_id));
                  return (
                    <div key={index} className="p-3 bg-white flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900">{product?.name}</div>
                        <div className="text-xs text-slate-500">{item.quantity}x {formatCurrency(product?.price || 0)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{formatCurrency((product?.price || 0) * item.quantity)}</span>
                        <button 
                          onClick={() => removeFromCart(index)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="p-3 bg-slate-50 flex justify-between items-center font-bold">
                  <span className="text-slate-700">Total</span>
                  <span className="text-indigo-600 text-lg">
                    {formatCurrency(cart.reduce((acc, item) => {
                      const product = products.find(p => p.id === parseInt(item.product_id));
                      return acc + (product?.price || 0) * item.quantity;
                    }, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
              <input 
                type="time" 
                className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                value={newOrder.time}
                onChange={e => setNewOrder({ ...newOrder, time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <textarea 
              className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              rows={2}
              placeholder="Ex: Sem salada, entregar 11:30"
              value={newOrder.observation}
              onChange={e => setNewOrder({ ...newOrder, observation: e.target.value })}
            />
          </div>

          <button 
            type="button"
            onClick={() => handleAddOrder()}
            disabled={(!newOrder.product_id && cart.length === 0) || !newOrder.customer_id}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {cart.length > 0 
              ? `Finalizar Pedido (${cart.length + (newOrder.product_id ? 1 : 0)} itens)` 
              : 'Finalizar Pedido'
            }
          </button>
        </div>
      </div>
    </div>
  );

  const printReceipt = (group: any) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      showToast('Por favor, permita pop-ups para imprimir o recibo.');
      return;
    }

    const itemsHtml = group.items.map((item: any) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>${item.quantity}x ${item.product_name}</span>
        <span>${formatCurrency(item.total_value)}</span>
      </div>
      ${item.observation ? `<div style="font-size: 12px; color: #555; margin-bottom: 4px; padding-left: 16px;">Obs: ${item.observation}</div>` : ''}
    `).join('');

    const html = `
      <html>
        <head>
          <title>Recibo - ${group.customer_name}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 14px;
              width: 300px;
              margin: 0;
              padding: 10px;
              color: #000;
            }
            .header { text-align: center; margin-bottom: 10px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .bold { font-weight: bold; }
            .flex-between { display: flex; justify-content: space-between; }
            @media print {
              @page { margin: 0; }
              body { margin: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0;">PEDIDO</h2>
            <div>${new Date().toLocaleDateString('pt-BR')} - ${group.time}</div>
          </div>
          <div class="divider"></div>
          <div><span class="bold">Cliente:</span> ${group.customer_name}</div>
          ${group.customer_phone ? `<div><span class="bold">Tel:</span> ${group.customer_phone}</div>` : ''}
          ${group.customer_observation ? `<div><span class="bold">Obs Cliente:</span> ${group.customer_observation}</div>` : ''}
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          <div class="flex-between bold" style="font-size: 16px;">
            <span>TOTAL:</span>
            <span>${formatCurrency(group.total_value)}</span>
          </div>
          <div class="divider"></div>
          <div class="header" style="font-size: 12px; margin-top: 20px;">
            Obrigado pela preferência!
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const toggleOrderStatus = async (orderId: string | number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'delivered' ? 'pending' : 'delivered';
      await updateDoc(doc(db, 'orders', orderId.toString()), {
        status: newStatus
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling order status:', error);
      showToast('Erro ao atualizar status.');
    }
  };

  const toggleOrderExpand = (groupId: string) => {
    setExpandedOrders(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId) 
        : [...prev, groupId]
    );
  };

  const renderOrders = () => {
    // Group orders by customer and time
    const groupedOrders = orders.reduce((acc, order) => {
      const key = `${order.customer_id}-${order.time}`;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          customer_name: order.customer_name,
          customer_observation: order.customer_observation,
          customer_phone: order.customer_phone,
          time: order.time,
          items: [],
          total_value: 0,
          all_delivered: true
        };
      }
      acc[key].items.push(order);
      acc[key].total_value += order.total_value;
      if (order.status !== 'delivered') {
        acc[key].all_delivered = false;
      }
      return acc;
    }, {} as Record<string, any>);

    const groupedOrdersArray = Object.values(groupedOrders).sort((a: any, b: any) => b.time.localeCompare(a.time));

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Pedidos de Hoje</h2>
          <div className="text-sm text-slate-500">{groupedOrdersArray.length} pedidos ({orders.length} itens)</div>
        </div>
        
        <div className="grid gap-4">
          {groupedOrdersArray.map((group: any) => {
            const isExpanded = expandedOrders.includes(group.id);
            return (
            <motion.div 
              layout
              key={group.id}
              className={`bg-white p-5 rounded-2xl shadow-sm border flex flex-col transition-colors ${group.all_delivered ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'}`}
            >
              <div 
                className={`flex justify-between items-start cursor-pointer select-none ${isExpanded ? 'border-b pb-4 mb-4' : ''} ${group.all_delivered ? 'border-emerald-100' : 'border-slate-50'}`}
                onClick={() => toggleOrderExpand(group.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                    <span className="font-bold text-slate-900 text-lg">{group.customer_name}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${group.all_delivered ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{group.time}</span>
                    {group.all_delivered && (
                      <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 size={12} /> Entregue
                      </span>
                    )}
                  </div>
                  {group.customer_observation && isExpanded && (
                    <div className="text-sm text-slate-500 italic ml-8">
                      {group.customer_observation}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <div className="font-bold text-indigo-600 text-lg">{formatCurrency(group.total_value)}</div>
                  {isExpanded && (
                    <button 
                      onClick={() => printReceipt(group)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors text-sm font-medium"
                      title="Imprimir Pedido"
                    >
                      <Printer size={16} /> Imprimir
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-3">
                  {group.items.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleOrderStatus(order.id, order.status || 'pending')}
                          className={`mt-0.5 transition-colors ${order.status === 'delivered' ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-emerald-500'}`}
                          title={order.status === 'delivered' ? 'Marcar como pendente' : 'Marcar como entregue'}
                        >
                          {order.status === 'delivered' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div className="space-y-1">
                          <div className={`text-sm font-medium ${order.status === 'delivered' ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{order.quantity}x {order.product_name}</div>
                          {order.observation && (
                            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md inline-block">
                              {order.observation}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`font-semibold text-sm ${order.status === 'delivered' ? 'text-slate-400' : 'text-slate-900'}`}>{formatCurrency(order.total_value)}</div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => setEditingItem({ type: 'orders', data: order })}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => confirmDelete('orders', order.id, `${order.customer_name} - ${order.product_name}`)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )})}
          {groupedOrdersArray.length === 0 && (
            <div className="py-20 text-center">
              <div className="text-slate-300 mb-2"><ClipboardList size={48} className="mx-auto" /></div>
              <p className="text-slate-500">Nenhum pedido registrado hoje.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExpenses = () => (
    <div className="max-w-md mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Registrar Gasto</h2>
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input 
              type="text" 
              className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Ex: Arroz, Feijão, Carne..."
              value={newExpense.description}
              onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="0,00"
              value={newExpense.value}
              onChange={e => setNewExpense({ ...newExpense, value: e.target.value })}
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-rose-600 text-white py-3 rounded-xl font-semibold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
          >
            Registrar Gasto
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-50">
          <h3 className="font-semibold text-slate-800">Gastos de Hoje</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {expenses.map(expense => (
            <div key={expense.id} className="p-4 flex justify-between items-center gap-4">
              <span className="text-slate-700 min-w-0 flex-1 truncate">{expense.description}</span>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="font-semibold text-rose-600 whitespace-nowrap">{formatCurrency(expense.value)}</span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setEditingItem({ type: 'expenses', data: expense })}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => confirmDelete('expenses', expense.id, expense.description)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="p-8 text-center text-slate-400">Nenhum gasto hoje</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderReport = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Relatório do Dia</h2>
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between py-2 border-b border-slate-50">
          <span className="text-slate-600">Total de Vendas</span>
          <span className="font-bold text-slate-900">{formatCurrency(stats?.totalSales || 0)}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-slate-50">
          <span className="text-slate-600">Total de Gastos</span>
          <span className="font-bold text-rose-600">-{formatCurrency(stats?.totalExpenses || 0)}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-lg font-bold text-slate-900">Lucro Líquido</span>
          <span className={`text-lg font-bold ${stats?.profit && stats.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(stats?.profit || 0)}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Detalhamento de Pedidos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider">
                <th className="px-4 py-3 font-medium whitespace-nowrap">Cliente</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Marmita</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Qtd</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Valor</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map(order => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{order.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{order.product_name}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{order.quantity}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(order.total_value)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setEditingItem({ type: 'orders', data: order })}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => confirmDelete('orders', order.id, `${order.customer_name} - ${order.product_name}`)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Customers Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Maiores Clientes do Dia</h3>
        </div>
        <div className="p-4">
          {(() => {
            const customerStats = orders.reduce((acc: any, order) => {
              const name = order.customer_name || 'Desconhecido';
              if (!acc[name]) acc[name] = { total: 0, count: 0 };
              acc[name].total += order.total_value;
              acc[name].count += order.quantity;
              return acc;
            }, {});

            const sortedCustomers = Object.entries(customerStats)
              .sort(([, a]: any, [, b]: any) => b.total - a.total)
              .slice(0, 5);

            return sortedCustomers.length > 0 ? (
              <div className="space-y-3">
                {sortedCustomers.map(([name, stats]: any, index) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(stats.total)}</div>
                      <div className="text-[10px] text-slate-400">{stats.count} marmitas</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-sm">Nenhum dado disponível</div>
            );
          })()}
        </div>
      </div>

      {/* Top Products Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Produtos Mais Vendidos</h3>
        </div>
        <div className="p-4">
          {(() => {
            const productStats = orders.reduce((acc: any, order) => {
              const name = order.product_name || 'Desconhecido';
              if (!acc[name]) acc[name] = { total: 0, count: 0 };
              acc[name].total += order.total_value;
              acc[name].count += order.quantity;
              return acc;
            }, {});

            const sortedProducts = Object.entries(productStats)
              .sort(([, a]: any, [, b]: any) => b.count - a.count)
              .slice(0, 5);

            return sortedProducts.length > 0 ? (
              <div className="space-y-3">
                {sortedProducts.map(([name, stats]: any, index) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-500">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{stats.count} unidades</div>
                      <div className="text-[10px] text-slate-400">{formatCurrency(stats.total)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-sm">Nenhum dado disponível</div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Gerenciar Produtos</h2>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-4">Cadastrar Novo Produto</h3>
        <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
            <input 
              type="text" 
              className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Ex: Coca-Cola, Água, Cerveja..."
              value={newProduct.name}
              onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$)</label>
            <input 
              type="number" 
              step="0.01"
              className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="0,00"
              value={newProduct.price}
              onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
              required
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="rounded text-indigo-600 focus:ring-indigo-500"
                checked={newProduct.is_shortcut}
                onChange={e => setNewProduct({ ...newProduct, is_shortcut: e.target.checked })}
              />
              <span className="text-sm text-slate-600">Atalho na Dashboard</span>
            </label>
            <button 
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-sm text-slate-500">Lista de produtos cadastrados. Use a estrela para gerenciar os atalhos rápidos.</p>
          <div className="relative">
            <input 
              type="text"
              placeholder="Buscar produto..."
              className="pl-9 pr-4 py-2 rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 w-full md:w-64"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <PlusCircle size={16} />
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {products
            .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
            .map(product => (
            <div key={product.id} className="p-4 flex justify-between items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{product.name}</div>
                <div className="text-sm text-slate-500">{formatCurrency(product.price)}</div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button 
                  onClick={() => toggleShortcut(product.id)}
                  className={`p-2 rounded-xl transition-colors ${
                    product.is_shortcut 
                      ? 'bg-amber-50 text-amber-500' 
                      : 'bg-slate-50 text-slate-300 hover:text-slate-400'
                  }`}
                  title="Atalho rápido"
                >
                  {product.is_shortcut ? <Star size={18} fill="currentColor" className="sm:w-5 sm:h-5" /> : <StarOff size={18} className="sm:w-5 sm:h-5" />}
                </button>
                <button 
                  onClick={() => setEditingItem({ type: 'products', data: product })}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                  title="Editar"
                >
                  <Edit2 size={18} className="sm:w-5 sm:h-5" />
                </button>
                <button 
                  onClick={() => confirmDelete('products', product.id, product.name)}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="p-8 text-center text-slate-400">Nenhum produto cadastrado</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-8">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-slate-800">Gerenciar Clientes</h3>
            <button 
              onClick={() => setShowCustomerModal(true)}
              className="text-sm text-indigo-600 font-medium flex items-center gap-1"
            >
              <UserPlus size={16} /> Novo Cliente
            </button>
          </div>
          <div className="relative">
            <input 
              type="text"
              placeholder="Buscar cliente..."
              className="pl-9 pr-4 py-2 rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500 w-full md:w-64"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <UserPlus size={16} />
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {customers
            .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
            .map(customer => (
            <div key={customer.id} className="p-4 flex justify-between items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{customer.name}</div>
                <div className="text-sm text-slate-500 truncate">{customer.phone || 'Sem telefone'}</div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button 
                  onClick={() => setEditingItem({ type: 'customers', data: customer })}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                  title="Editar"
                >
                  <Edit2 size={18} className="sm:w-5 sm:h-5" />
                </button>
                <button 
                  onClick={() => confirmDelete('customers', customer.id, customer.name)}
                  className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          ))}
          {customers.length === 0 && (
            <div className="p-8 text-center text-slate-400">Nenhum cliente cadastrado</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCustomersList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Clientes Cadastrados</h2>
        <button 
          onClick={() => setShowCustomerModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <UserPlus size={16} /> Novo Cliente
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-50">
          {customers.map(customer => (
            <div key={customer.id} className="p-4 flex justify-between items-center gap-4 hover:bg-slate-50 transition-colors">
              <div>
                <div className="font-bold text-slate-900">{customer.name}</div>
                {customer.phone && <div className="text-sm text-slate-500">{customer.phone}</div>}
                {customer.observation && <div className="text-xs text-slate-400 mt-1">{customer.observation}</div>}
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setEditingItem({ type: 'customers', data: customer })}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => confirmDelete('customers', customer.id, customer.name)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {customers.length === 0 && (
            <div className="p-8 text-center text-slate-400">Nenhum cliente cadastrado</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMonthlyReport = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Fechamento Mensal</h2>
        <input 
          type="month" 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
        />
      </div>

      {monthlyStats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-sm font-medium text-slate-500 mb-1">Receita Total</div>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(monthlyStats.revenue)}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-sm font-medium text-slate-500 mb-1">Despesas</div>
              <div className="text-2xl font-bold text-rose-600">{formatCurrency(monthlyStats.expenses)}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="text-sm font-medium text-slate-500 mb-1">Lucro Líquido</div>
              <div className={`text-2xl font-bold ${monthlyStats.profit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {formatCurrency(monthlyStats.profit)}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Produtos Mais Vendidos</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {monthlyStats.topProducts.map((p: any, i: number) => (
                  <div key={i} className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <span className="font-medium text-slate-700">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{p.total_quantity} un</div>
                      <div className="text-xs text-slate-500">{formatCurrency(p.total_value)}</div>
                    </div>
                  </div>
                ))}
                {monthlyStats.topProducts.length === 0 && (
                  <div className="p-6 text-center text-slate-400">Nenhuma venda neste mês</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Melhores Clientes</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {monthlyStats.topCustomers.map((c: any, i: number) => (
                  <div key={i} className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <span className="font-medium text-slate-700">{c.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(c.total_value)}</div>
                      <div className="text-xs text-slate-500">{c.total_quantity} itens</div>
                    </div>
                  </div>
                ))}
                {monthlyStats.topCustomers.length === 0 && (
                  <div className="p-6 text-center text-slate-400">Nenhuma venda neste mês</div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-slate-400">Carregando dados do mês...</div>
      )}
    </div>
  );

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-0 lg:pl-64">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full left-0 top-0 z-20">
        <div className="p-8 flex flex-col items-center">
          <img 
            src="https://i.postimg.cc/HWtzDHC3/comidacaseiradalu.png" 
            alt="Logo" 
            className="w-40 h-40 object-contain mb-4 drop-shadow-lg"
          />
          <h1 className="text-xl font-black text-slate-800 tracking-tight leading-tight text-center">COMIDA CASEIRA<br/>DA LU</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavItem active={activeTab === 'new-order'} onClick={() => setActiveTab('new-order')} icon={<PlusCircle size={20}/>} label="Novo Pedido" />
          <NavItem active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={20}/>} label="Pedidos" />
          <NavItem active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt size={20}/>} label="Gastos" />
          <NavItem active={activeTab === 'report'} onClick={() => setActiveTab('report')} icon={<FileText size={20}/>} label="Diário" />
          <NavItem active={activeTab === 'monthly-report'} onClick={() => setActiveTab('monthly-report')} icon={<CalendarDays size={20}/>} label="Mensal" />
          <NavItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={20}/>} label="Clientes" />
          <NavItem active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<Settings size={20}/>} label="Produtos" />
        </nav>
        <div className="p-6 border-t border-slate-100">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-widest mb-1">Hoje</div>
          <div className="text-sm font-bold text-slate-600">{new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </aside>

      {/* Header Mobile */}
      <header className="lg:hidden bg-white border-b border-slate-200 p-2 sticky top-0 z-20 flex justify-between items-center px-4">
        <div className="flex items-center gap-2">
          <img 
            src="https://i.postimg.cc/HWtzDHC3/comidacaseiradalu.png" 
            alt="Logo" 
            className="w-14 h-14 object-contain"
          />
          <h1 className="text-base font-black text-slate-800 tracking-tight uppercase">Comida Caseira da Lu</h1>
        </div>
        <div className="text-[10px] font-bold text-slate-400">{new Date().toLocaleDateString('pt-BR')}</div>
      </header>

      {/* Main Content */}
      <main className="p-4 lg:p-8 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'new-order' && renderNewOrder()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'expenses' && renderExpenses()}
            {activeTab === 'report' && renderReport()}
            {activeTab === 'monthly-report' && renderMonthlyReport()}
            {activeTab === 'customers' && renderCustomersList()}
            {activeTab === 'products' && renderProducts()}
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Developer Footer Main */}
      <footer className="pb-28 lg:pb-8 pt-4 px-4 text-center flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity">
        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Sistema desenvolvido por</span>
        <img 
          src="https://i.postimg.cc/5N7ptFSk/logo-dev.png" 
          alt="Developer Logo" 
          className="h-5 object-contain grayscale hover:grayscale-0 transition-all"
        />
      </footer>

      {/* Bottom Nav Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-start sm:justify-around p-2 z-20 overflow-x-auto scrollbar-hide">
        <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={24}/>} label="Início" />
        <MobileNavItem active={activeTab === 'new-order'} onClick={() => setActiveTab('new-order')} icon={<PlusCircle size={24}/>} label="Novo" />
        <MobileNavItem active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ClipboardList size={24}/>} label="Pedidos" />
        <MobileNavItem active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt size={24}/>} label="Gastos" />
        <MobileNavItem active={activeTab === 'report'} onClick={() => setActiveTab('report')} icon={<FileText size={24}/>} label="Diário" />
        <MobileNavItem active={activeTab === 'monthly-report'} onClick={() => setActiveTab('monthly-report')} icon={<CalendarDays size={24}/>} label="Mensal" />
        <MobileNavItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={24}/>} label="Clientes" />
        <MobileNavItem active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<Settings size={24}/>} label="Prod." />
      </nav>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Novo Cliente</h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input 
                  type="text" 
                  className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                <input 
                  type="tel" 
                  className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
                <textarea 
                  className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  rows={2}
                  value={newCustomer.observation}
                  onChange={e => setNewCustomer({ ...newCustomer, observation: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200"
                >
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Editar {
                editingItem.type === 'products' ? 'Produto' :
                editingItem.type === 'orders' ? 'Pedido' :
                editingItem.type === 'expenses' ? 'Gasto' : 'Item'
              }</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {editingItem.type === 'products' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                    <input 
                      type="text" 
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={editingItem.data.name}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={Number.isNaN(editingItem.data.price) ? "" : editingItem.data.price}
                      onChange={e => {
                        const val = e.target.value;
                        setEditingItem({ ...editingItem, data: { ...editingItem.data, price: val === "" ? NaN : parseFloat(val) } });
                      }}
                      required
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'orders' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={Number.isNaN(editingItem.data.quantity) ? "" : editingItem.data.quantity}
                      onChange={e => {
                        const val = e.target.value;
                        const quantity = val === "" ? NaN : parseInt(val);
                        const product = products.find(p => p.id === editingItem.data.product_id);
                        const total_value = (product && !Number.isNaN(quantity)) ? product.price * quantity : editingItem.data.total_value;
                        setEditingItem({ ...editingItem, data: { ...editingItem.data, quantity, total_value } });
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
                    <input 
                      type="time" 
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={editingItem.data.time}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, time: e.target.value } })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
                    <textarea 
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      rows={2}
                      value={editingItem.data.observation || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, observation: e.target.value } })}
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'expenses' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                    <input 
                      type="text" 
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={editingItem.data.description}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, description: e.target.value } })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={Number.isNaN(editingItem.data.value) ? "" : editingItem.data.value}
                      onChange={e => {
                        const val = e.target.value;
                        setEditingItem({ ...editingItem, data: { ...editingItem.data, value: val === "" ? NaN : parseFloat(val) } });
                      }}
                      required
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'customers' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                    <input 
                      type="text" 
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={editingItem.data.name}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                    <input 
                      type="tel" 
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      value={editingItem.data.phone || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, phone: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
                    <textarea 
                      className="w-full rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                      rows={2}
                      value={editingItem.data.observation || ''}
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, observation: e.target.value } })}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200"
                >
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center"
          >
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirmar Exclusão</h3>
            <p className="text-slate-500 mb-6">
              Tem certeza que deseja excluir <strong>{deleteConfirmation.label}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl z-[70] font-medium text-sm whitespace-nowrap"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={16} className="ml-auto" />}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 flex-1 min-w-[64px] py-1 transition-colors ${
        active ? 'text-indigo-600' : 'text-slate-400'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-tighter">{label}</span>
    </button>
  );
}
