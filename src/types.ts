export interface Customer {
  id: string | number;
  name: string;
  phone?: string;
  observation?: string;
}

export interface Product {
  id: string | number;
  name: string;
  price: number;
  is_shortcut?: number;
}

export interface Order {
  id: string | number;
  customer_id: string | number;
  customer_name?: string;
  product_id: string | number;
  product_name?: string;
  quantity: number;
  total_value: number;
  date: string;
  time: string;
  observation?: string;
  status?: string;
}

export interface Expense {
  id: string | number;
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
  id: string | number;
  action: string;
  details: string;
  timestamp: string;
}
