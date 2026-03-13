export interface Customer {
  id: number;
  name: string;
  phone?: string;
  observation?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  is_shortcut?: number;
}

export interface Order {
  id: number;
  customer_id: number;
  customer_name?: string;
  product_id: number;
  product_name?: string;
  quantity: number;
  total_value: number;
  date: string;
  time: string;
  observation?: string;
  status?: string;
}

export interface Expense {
  id: number;
  description: string;
  value: number;
  date: string;
}

export interface Stats {
  totalSales: number;
  totalOrders: number;
  totalMarmitas: number;
  totalExpenses: number;
  profit: number;
}

export interface ActivityLog {
  id: number;
  action: string;
  details: string;
  timestamp: string;
}
