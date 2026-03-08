export interface Contact {
  id?: number;
  type: 'customer' | 'supplier';
  name: string;
  tin?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at?: string;
}

export interface Transaction {
  id?: number;
  type: 'income' | 'expense';
  amount: number;
  category?: string;
  contact_id?: number;
  contact_name?: string;
  description: string;
  date: string;
  image_data?: string;
  metadata?: any;
  lhdn_status?: 'draft' | 'submitted' | 'failed';
  lhdn_uuid?: string;
  created_at?: string;
}

export interface EInvoiceData {
  invoiceNumber: string;
  issueDate: string;
  issuerName: string;
  issuerTin: string;
  receiverName: string;
  receiverTin: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    total: number;
  }[];
  totalAmount: number;
  taxTotal: number;
}
