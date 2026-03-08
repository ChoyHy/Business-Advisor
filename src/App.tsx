import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Plus, 
  Receipt, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  LayoutDashboard, 
  History, 
  MessageSquare, 
  X, 
  Check, 
  Loader2,
  Trash2,
  ChevronRight,
  Download,
  BrainCircuit,
  Users,
  BarChart3,
  Building2,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, EInvoiceData, Contact } from './types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'advisor' | 'contacts' | 'reports'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureType, setCaptureType] = useState<'income' | 'expense'>('income');
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<EInvoiceData | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isLhdnSubmitting, setIsLhdnSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchTransactions();
    fetchContacts();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
      } else {
        console.error("Transactions data is not an array:", data);
        setTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setTransactions([]);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      if (Array.isArray(data)) {
        setContacts(data);
      } else {
        console.error("Contacts data is not an array:", data);
        setContacts([]);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
      setContacts([]);
    }
  };

  const startCamera = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
        processImage(dataUrl);
      }
    }
  };

  const processImage = async (base64Image: string) => {
    setIsProcessing(true);
    const base64Data = base64Image.split(',')[1];

    try {
      const prompt = captureType === 'income' 
        ? "Analyze this handwritten note or receipt and extract data for a Malaysian LHDN E-Invoice. Return JSON format with invoiceNumber, issueDate (YYYY-MM-DD), issuerName, issuerTin, receiverName, receiverTin, items (array with description, quantity, unitPrice, taxAmount, total), totalAmount, and taxTotal. If data is missing, make reasonable estimates based on the context of a Malaysian SME."
        : "Analyze this receipt and extract the total amount, date (YYYY-MM-DD), and a brief description of the expense. Return JSON format with amount, date, and description.";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const result = JSON.parse(response.text || '{}');

      if (captureType === 'income') {
        setCurrentInvoice(result);
        setShowInvoiceModal(true);
      } else {
        await saveTransaction({
          type: 'expense',
          amount: result.amount || 0,
          description: result.description || 'Business Expense',
          date: result.date || new Date().toISOString().split('T')[0],
          image_data: base64Image,
          metadata: result
        });
      }
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const saveTransaction = async (transaction: Transaction) => {
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      });
      const data = await res.json();
      fetchTransactions();
      setCapturedImage(null);
      return data.id;
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  };

  const submitToLhdn = async (transactionId: number) => {
    setIsLhdnSubmitting(true);
    try {
      const res = await fetch('/api/lhdn/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message + "\nUUID: " + data.uuid);
      } else {
        alert(data.error);
      }
      fetchTransactions();
    } catch (error) {
      alert("Failed to connect to LHDN Sandbox API.");
    } finally {
      setIsLhdnSubmitting(false);
    }
  };

  const saveContact = async (contact: Contact) => {
    try {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact)
      });
      fetchContacts();
      setShowContactModal(false);
    } catch (error) {
      console.error("Error saving contact:", error);
    }
  };

  const handleConfirmInvoice = async () => {
    if (currentInvoice) {
      const transactionId = await saveTransaction({
        type: 'income',
        amount: currentInvoice.totalAmount,
        category: 'Sales',
        contact_id: selectedContactId || undefined,
        description: `E-Invoice ${currentInvoice.invoiceNumber} to ${currentInvoice.receiverName}`,
        date: currentInvoice.issueDate,
        image_data: capturedImage || undefined,
        metadata: currentInvoice
      });
      
      setShowInvoiceModal(false);
      setCurrentInvoice(null);
      
      if (transactionId && confirm("Transaction saved. Submit to LHDN Sandbox now?")) {
        await submitToLhdn(transactionId);
      }
    }
  };

  const deleteTransaction = async (id: number) => {
    if (confirm("Delete this transaction?")) {
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchTransactions();
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const newMessages = [...chatMessages, { role: 'user' as const, text }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      const summary = transactions.reduce((acc, t) => {
        if (t.type === 'income') acc.revenue += t.amount;
        else acc.expenses += t.amount;
        return acc;
      }, { revenue: 0, expenses: 0 });

      const context = `The business has RM${summary.revenue.toFixed(2)} in revenue and RM${summary.expenses.toFixed(2)} in expenses. Profit is RM${(summary.revenue - summary.expenses).toFixed(2)}. Recent transactions: ${transactions.slice(0, 5).map(t => `${t.type}: RM${t.amount} (${t.description})`).join(', ')}. As a business advisor for a Malaysian SME, discuss how to improve these numbers.`;

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: { systemInstruction: context }
      });

      const response = await chat.sendMessage({ message: text });
      setChatMessages([...newMessages, { role: 'model', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const totalRevenue = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const profit = totalRevenue - totalExpenses;

  const salesByCategory = transactions
    .filter(t => t.type === 'income')
    .reduce((acc: any[], t) => {
      const cat = t.category || 'Uncategorized';
      const existing = acc.find(i => i.name === cat);
      if (existing) existing.value += t.amount;
      else acc.push({ name: cat, value: t.amount });
      return acc;
    }, []);

  const expenseBySupplier = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      const supplier = t.contact_name || 'Unknown Supplier';
      const existing = acc.find(i => i.name === supplier);
      if (existing) existing.value += t.amount;
      else acc.push({ name: supplier, value: t.amount });
      return acc;
    }, []);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-stone-50 shadow-2xl overflow-hidden relative">
      {/* Header */}
      <header className="p-6 bg-white border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">SME Manager</h1>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Malaysian E-Invoice Ready</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <TrendingUp size={20} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass p-4 rounded-2xl"
              >
                <div className="flex items-center gap-2 text-stone-500 mb-1">
                  <TrendingUp size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Revenue</span>
                </div>
                <div className="text-lg font-bold text-emerald-600">RM {totalRevenue.toLocaleString()}</div>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass p-4 rounded-2xl"
              >
                <div className="flex items-center gap-2 text-stone-500 mb-1">
                  <TrendingDown size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Expenses</span>
                </div>
                <div className="text-lg font-bold text-rose-600">RM {totalExpenses.toLocaleString()}</div>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-stone-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden"
            >
              <div className="relative z-10">
                <span className="text-xs font-medium text-stone-400 uppercase tracking-[0.2em]">Net Profit</span>
                <div className="text-4xl font-bold mt-1">RM {profit.toLocaleString()}</div>
                <div className="mt-4 flex items-center gap-2 text-sm text-stone-400">
                  <div className={`w-2 h-2 rounded-full ${profit >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  {profit >= 0 ? 'Business is healthy' : 'Action required'}
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <LayoutDashboard size={120} />
              </div>
            </motion.div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest px-1">Quick Actions</h3>
              <button 
                onClick={() => { setCaptureType('income'); startCamera(); }}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 card-hover"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FileText size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-stone-900">Generate E-Invoice</div>
                    <div className="text-xs text-stone-500">Scan handwritten notes</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-stone-300" />
              </button>
              <button 
                onClick={() => { setCaptureType('expense'); startCamera(); }}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 card-hover"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                    <Receipt size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-stone-900">Record Expense</div>
                    <div className="text-xs text-stone-500">Scan business receipts</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-stone-300" />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <h2 className="text-xl font-bold text-stone-900 px-1">Financial Analytics</h2>
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Sales by Category</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={salesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {salesByCategory.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {salesByCategory.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-stone-600">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{item.name}: RM {item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Expense by Supplier</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseBySupplier}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xl font-bold text-stone-900">Contacts</h2>
              <button 
                onClick={() => setShowContactModal(true)}
                className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center shadow-lg"
              >
                <UserPlus size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="p-4 bg-white rounded-2xl border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${contact.type === 'customer' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {contact.type === 'customer' ? <Users size={20} /> : <Building2 size={20} />}
                    </div>
                    <div>
                      <div className="font-bold text-stone-900 text-sm">{contact.name}</div>
                      <div className="text-xs text-stone-400">{contact.tin || 'No TIN recorded'}</div>
                    </div>
                  </div>
                  <div className="text-xs font-bold uppercase tracking-widest text-stone-400">
                    {contact.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-stone-900 px-1">Transaction History</h2>
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <History size={48} className="mx-auto mb-4 opacity-20" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((t) => (
                  <motion.div 
                    layout
                    key={t.id}
                    className="p-4 bg-white rounded-2xl border border-stone-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      </div>
                      <div>
                        <div className="font-bold text-stone-900 text-sm">{t.description}</div>
                        <div className="text-xs text-stone-400">{t.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'income' ? '+' : '-'} RM {t.amount.toLocaleString()}
                      </div>
                      <button onClick={() => t.id && deleteTransaction(t.id)} className="text-stone-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'advisor' && (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                <BrainCircuit size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 leading-tight">AI Business Advisor</h2>
                <p className="text-xs text-stone-500">Based on your transactions</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto min-h-[400px] p-2">
              {chatMessages.length === 0 && (
                <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-700 text-sm leading-relaxed">
                  Hi! I've analyzed your business. You have RM {profit.toLocaleString()} in net profit. How can I help you improve your operations today?
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-800 shadow-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-200 p-4 rounded-2xl">
                    <Loader2 className="animate-spin text-stone-400" size={20} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 p-2 bg-white rounded-2xl border border-stone-200 shadow-lg">
              <input 
                type="text" 
                placeholder="Ask about your business..."
                className="flex-1 bg-transparent px-2 text-sm focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
              <button 
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  sendMessage(input.value);
                  input.value = '';
                }}
                className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-xl border-t border-stone-200 p-4 flex justify-around items-center z-40">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-stone-900' : 'text-stone-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>
        <button onClick={() => setActiveTab('reports')} className={`flex flex-col items-center gap-1 ${activeTab === 'reports' ? 'text-stone-900' : 'text-stone-400'}`}>
          <BarChart3 size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Reports</span>
        </button>
        <button onClick={() => setActiveTab('contacts')} className={`flex flex-col items-center gap-1 ${activeTab === 'contacts' ? 'text-stone-900' : 'text-stone-400'}`}>
          <Users size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Contacts</span>
        </button>
        <button onClick={() => setActiveTab('advisor')} className={`flex flex-col items-center gap-1 ${activeTab === 'advisor' ? 'text-stone-900' : 'text-stone-400'}`}>
          <MessageSquare size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Advisor</span>
        </button>
      </nav>

      {/* Camera Overlay */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="flex justify-between items-center p-6 text-white">
              <span className="text-sm font-bold uppercase tracking-widest">
                {captureType === 'income' ? 'Scan E-Invoice' : 'Scan Receipt'}
              </span>
              <button onClick={stopCamera} className="p-2 bg-white/10 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-[40px] border-black/40 flex items-center justify-center">
                <div className="w-full aspect-[3/4] border-2 border-white/50 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                </div>
              </div>
            </div>
            <div className="p-12 flex justify-center items-center bg-black">
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1"
              >
                <div className="w-full h-full rounded-full bg-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-stone-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center"
          >
            <Loader2 className="animate-spin mb-6 text-emerald-400" size={48} />
            <h2 className="text-2xl font-bold mb-2">AI Analyzing...</h2>
            <p className="text-stone-400 max-w-xs">Extracting data from your {captureType === 'income' ? 'handwritten note' : 'receipt'} for LHDN compatibility.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice Confirmation Modal */}
      <AnimatePresence>
        {showInvoiceModal && currentInvoice && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end"
          >
            <div className="w-full max-w-md mx-auto bg-white rounded-t-[32px] p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-stone-900">Review E-Invoice</h2>
                <button onClick={() => setShowInvoiceModal(false)} className="text-stone-400">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Select Customer</label>
                  <select 
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 text-sm focus:outline-none"
                    value={selectedContactId || ''}
                    onChange={(e) => setSelectedContactId(Number(e.target.value))}
                  >
                    <option value="">Select a customer...</option>
                    {contacts.filter(c => c.type === 'customer').map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.tin})</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-stone-400 uppercase font-bold tracking-wider">Invoice No</span>
                      <div className="font-bold text-stone-900 mt-1">{currentInvoice.invoiceNumber}</div>
                    </div>
                    <div>
                      <span className="text-stone-400 uppercase font-bold tracking-wider">Date</span>
                      <div className="font-bold text-stone-900 mt-1">{currentInvoice.issueDate}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-sm font-bold text-stone-400 uppercase tracking-widest">Items</span>
                  </div>
                  {currentInvoice.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start py-2 border-b border-stone-100">
                      <div>
                        <div className="font-bold text-stone-900 text-sm">{item.description}</div>
                        <div className="text-xs text-stone-400">{item.quantity} x RM {item.unitPrice}</div>
                      </div>
                      <div className="font-bold text-stone-900">RM {item.total}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Tax (SST/GST)</span>
                    <span className="font-bold">RM {currentInvoice.taxTotal}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2 border-t border-stone-200">
                    <span>Total Amount</span>
                    <span className="text-emerald-600">RM {currentInvoice.totalAmount}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowInvoiceModal(false)}
                    className="flex-1 py-4 rounded-2xl border border-stone-200 font-bold text-stone-600"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={handleConfirmInvoice}
                    className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    Submit LHDN
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {showContactModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-stone-900">New Contact</h2>
                <button onClick={() => setShowContactModal(false)} className="text-stone-400">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                saveContact({
                  type: formData.get('type') as 'customer' | 'supplier',
                  name: formData.get('name') as string,
                  tin: formData.get('tin') as string,
                  email: formData.get('email') as string,
                  phone: formData.get('phone') as string,
                  address: formData.get('address') as string,
                });
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Type</label>
                  <select name="type" className="w-full p-3 bg-stone-50 rounded-xl border border-stone-100 text-sm">
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Name</label>
                  <input name="name" required className="w-full p-3 bg-stone-50 rounded-xl border border-stone-100 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">TIN (LHDN)</label>
                  <input name="tin" className="w-full p-3 bg-stone-50 rounded-xl border border-stone-100 text-sm" placeholder="e.g. C1234567890" />
                </div>
                <button type="submit" className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold shadow-xl">
                  Save Contact
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
