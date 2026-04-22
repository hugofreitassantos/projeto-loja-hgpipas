/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { 
  Wind, 
  ShoppingBag, 
  Info, 
  Mail, 
  Menu, 
  X, 
  ChevronRight, 
  Instagram, 
  Facebook, 
  Twitter,
  ArrowRight,
  Star,
  MapPin,
  Phone,
  Clock,
  LogIn,
  LogOut,
  Settings,
  Plus,
  Trash2,
  Edit2,
  ChevronLeft,
  Loader2,
  MessageCircle
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Constants
const ADMIN_EMAIL = 'email.site@teste.com';

// Types
type Tab = 'inicio' | 'produtos' | 'categoria' | 'sobre';
type View = 'main' | 'category' | 'admin' | 'cart';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  rating: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

const NavItem = ({ tab, label, activeTab, currentView, scrollToSection }: { 
  tab: Tab, 
  label: string, 
  activeTab: Tab, 
  currentView: View, 
  scrollToSection: (id: string) => void 
}) => (
  <button
    onClick={() => scrollToSection(tab)}
    className={`relative px-4 py-2 text-sm font-medium transition-colors hover:text-sky-500 ${
      activeTab === tab && currentView === 'main' ? 'text-sky-600' : 'text-slate-600'
    }`}
  >
    {label}
    {activeTab === tab && currentView === 'main' && (
      <motion.div
        layoutId="activeTab"
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    )}
  </button>
);

const ProductCard = ({ product, onAddToCart }: { product: Product, onAddToCart?: (p: Product) => void, key?: React.Key }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    whileHover={{ y: -10 }}
    className="group relative rounded-3xl bg-white p-4 shadow-sm border border-slate-100 transition-all hover:shadow-xl"
  >
    <div className="relative overflow-hidden rounded-2xl aspect-square mb-4">
      <img 
        src={product.image || "https://picsum.photos/seed/kite/400/400"} 
        alt={product.name} 
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      <div className="absolute top-4 right-4 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-bold text-sky-600 shadow-sm">
        {product.category}
      </div>
    </div>
    <div className="px-2 pb-2">
      <div className="flex items-center gap-1 text-yellow-400 mb-2">
        {Array.from({ length: product.rating }).map((_, i) => (
          <Star key={i} size={14} fill="currentColor" />
        ))}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">{product.name}</h3>
      <div className="flex items-center justify-between mt-4">
        <span className="text-2xl font-black text-sky-600">R$ {product.price.toFixed(2)}</span>
        <button 
          onClick={() => onAddToCart?.(product)}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-sky-600 active:scale-90"
        >
          <ShoppingBag size={18} />
          Adicionar
        </button>
      </div>
    </div>
  </motion.div>
);

function useScrollProgress() {
  const { scrollYProgress } = useScroll();
  return useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [currentView, setCurrentView] = useState<View>('main');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollProgress = useScrollProgress();

  // Firebase State
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Admin Form State
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
    name: '',
    price: 0,
    category: '',
    image: '',
    rating: 5
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    // Products Listener
    const qProducts = query(collection(db, 'products'), orderBy('name'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
    });

    // Categories Listener
    const qCategories = query(collection(db, 'categories'), orderBy('name'));
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoriesData);
    }, (error) => {
      console.error("Error fetching categories:", error);
    });

    // Test Connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => {
      unsubscribeAuth();
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (currentView !== 'main') return;

      setScrolled(window.scrollY > 20);
      
      const sections: Tab[] = ['inicio', 'produtos', 'categoria', 'sobre'];
      
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100) {
        setActiveTab('sobre');
        return;
      }

      const scrollPosition = window.scrollY + 120;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveTab(section);
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentView]);

  const scrollToSection = (id: string) => {
    if (currentView !== 'main') {
      setCurrentView('main');
      // Wait for view transition before scrolling
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          const offset = 80;
          const bodyRect = document.body.getBoundingClientRect().top;
          const elementRect = element.getBoundingClientRect().top;
          const elementPosition = elementRect - bodyRect;
          const offsetPosition = elementPosition - offset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) {
        const offset = 80;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = element.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    }
    setIsMenuOpen(false);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentView('main');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const CategoryView = () => {
    const filteredProducts = products.filter(p => p.category === selectedCategory);

    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <button 
          onClick={() => setCurrentView('main')}
          className="mb-8 flex items-center gap-2 text-slate-600 hover:text-sky-600 font-bold transition-colors"
        >
          <ChevronLeft size={20} />
          Voltar para o Início
        </button>

        <div className="mb-12">
          <h2 className="text-4xl font-black tracking-tight">
            Categoria: <span className="text-sky-600">{selectedCategory}</span>
          </h2>
          <p className="text-slate-500 mt-2">
            {filteredProducts.length} produtos encontrados nesta categoria.
          </p>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Nenhum produto cadastrado nesta categoria ainda.</p>
          </div>
        )}
      </div>
    );
  };

  const CartView = () => {
    const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const sendWhatsApp = () => {
      const message = `Olá! Gostaria de fazer um pedido:\n\n${cart.map(item => `- ${item.name} (x${item.quantity}): R$ ${(item.price * item.quantity).toFixed(2)}`).join('\n')}\n\n*Total: R$ ${total.toFixed(2)}*`;
      const encoded = encodeURIComponent(message);
      window.open(`https://wa.me/5511999999999?text=${encoded}`, '_blank');
    };

    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <button 
          onClick={() => setCurrentView('main')}
          className="flex items-center gap-2 text-slate-500 hover:text-sky-600 transition-colors mb-8 font-bold"
        >
          <ChevronLeft size={20} />
          Continuar Comprando
        </button>

        <div className="mb-12">
          <h2 className="text-4xl font-black tracking-tight">Meu <span className="text-sky-600">Pedido</span></h2>
          <p className="text-slate-500 mt-2">Revise seus itens antes de finalizar pelo WhatsApp.</p>
        </div>

        {cart.length > 0 ? (
          <div className="space-y-8">
            <div className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-slate-100 overflow-hidden">
              <div className="space-y-6">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-6 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                    <img src={item.image || "https://picsum.photos/seed/kite/200/200"} alt={item.name} className="h-24 w-24 rounded-2xl object-cover" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-900">{item.name}</h3>
                      <p className="text-sky-600 font-bold">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-2"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <span className="text-slate-400 font-medium">Total do Pedido</span>
                <span className="text-3xl font-black text-sky-400">R$ {total.toFixed(2)}</span>
              </div>
              <button 
                onClick={sendWhatsApp}
                className="w-full rounded-2xl bg-sky-600 py-4 font-bold text-white shadow-lg shadow-sky-900/20 transition-all hover:bg-sky-700 active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Phone size={20} />
                Finalizar Pedido via WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Seu carrinho está vazio.</p>
            <button 
              onClick={() => setCurrentView('main')}
              className="mt-6 rounded-full bg-sky-600 px-8 py-3 font-bold text-white shadow-lg shadow-sky-100"
            >
              Ver Produtos
            </button>
          </div>
        )}
      </div>
    );
  };

  const AdminView = () => {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isAdmin) return;

      try {
        if (editingId) {
          await updateDoc(doc(db, 'products', editingId), newProduct);
          setEditingId(null);
        } else {
          await addDoc(collection(db, 'products'), newProduct);
        }
        setNewProduct({ name: '', price: 0, category: '', image: '', rating: 5 });
      } catch (error) {
        console.error("Error saving product:", error);
      }
    };

    const handleDelete = async (id: string) => {
      if (!isAdmin || !window.confirm("Tem certeza que deseja excluir este produto?")) return;
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    };

    const handleEdit = (product: Product) => {
      setNewProduct({
        name: product.name,
        price: product.price,
        category: product.category,
        image: product.image,
        rating: product.rating
      });
      setEditingId(product.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tight">Painel do <span className="text-sky-600">Administrador</span></h2>
            <p className="text-slate-500 mt-2">Gerencie seus produtos e categorias de forma rápida e fácil.</p>
          </div>
          <button 
            onClick={() => setCurrentView('main')}
            className="rounded-xl bg-slate-100 px-6 py-3 font-bold text-slate-600 hover:bg-slate-200 transition-all"
          >
            Sair do Painel
          </button>
        </div>

        <div className="space-y-12">
          {/* Categories Management */}
          <section>
            <h3 className="text-2xl font-bold mb-6">Gerenciar Categorias</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const name = (form.elements.namedItem('catName') as HTMLInputElement).value;
                    const icon = (form.elements.namedItem('catIcon') as HTMLInputElement).value;
                    try {
                      await addDoc(collection(db, 'categories'), { name, icon });
                      form.reset();
                    } catch (err) {
                      console.error("Error adding category:", err);
                    }
                  }}
                  className="flex flex-col md:flex-row gap-4"
                >
                  <input 
                    name="catName"
                    placeholder="Nome da Categoria"
                    required
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                  <input 
                    name="catIcon"
                    placeholder="Ícone (Emoji)"
                    required
                    className="w-full md:w-32 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                  <button 
                    type="submit"
                    className="rounded-2xl bg-sky-600 px-8 py-3 font-bold text-white shadow-lg shadow-sky-200 hover:bg-sky-700 transition-all"
                  >
                    Adicionar
                  </button>
                </form>
              </div>
              <div className="flex flex-wrap gap-3">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm border border-slate-100">
                    <span>{cat.icon}</span>
                    <span className="font-bold text-slate-700">{cat.name}</span>
                    <button 
                      onClick={async () => {
                        if (window.confirm(`Excluir categoria "${cat.name}"?`)) {
                          await deleteDoc(doc(db, 'categories', cat.id));
                        }
                      }}
                      className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Products Management */}
          <section>
            <h3 className="text-2xl font-bold mb-6">Gerenciar Produtos</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-[2.5rem] bg-white p-8 shadow-xl border border-slate-100">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                {editingId ? <Edit2 size={20} className="text-sky-600" /> : <Plus size={20} className="text-sky-600" />}
                {editingId ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 ml-1">Nome do Produto</label>
                  <input 
                    type="text" 
                    required
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 ml-1">Preço (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 ml-1">Categoria</label>
                  <select 
                    required
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  >
                    <option value="">Selecione...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 ml-1">URL da Imagem</label>
                  <input 
                    type="url" 
                    required
                    value={newProduct.image}
                    onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 ml-1">Avaliação (1-5)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="5"
                    required
                    value={newProduct.rating}
                    onChange={e => setNewProduct({...newProduct, rating: parseInt(e.target.value)})}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 rounded-2xl bg-sky-600 py-4 font-bold text-white shadow-lg shadow-sky-200 hover:bg-sky-700 transition-all"
                  >
                    {editingId ? 'Salvar Alterações' : 'Adicionar Produto'}
                  </button>
                  {editingId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setNewProduct({ name: '', price: 0, category: '', image: '', rating: 5 });
                      }}
                      className="rounded-2xl bg-slate-100 px-4 py-4 font-bold text-slate-600 hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
            <div className="rounded-[2.5rem] bg-white shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-900">Lista de Produtos ({products.length})</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {products.map(product => (
                  <div key={product.id} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition-colors">
                    <img src={product.image} alt={product.name} className="h-16 w-16 rounded-xl object-cover" />
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900">{product.name}</h4>
                      <p className="text-sm text-slate-500">{product.category} • R$ {product.price.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(product)}
                        className="p-2 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="p-12 text-center text-slate-500">
                    Nenhum produto encontrado.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
);
};

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 z-[60] h-1 bg-sky-600 origin-left"
        style={{ scaleX: scrollProgress }}
      />

      {/* Navigation */}
      <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? 'bg-white/80 py-3 shadow-sm backdrop-blur-md' : 'bg-transparent py-6'
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('inicio')}>
            <img 
              src="https://lh3.googleusercontent.com/p/AF1QipOwrH9dAzgZ9GP52L_PnrYaAqbp1lPYE3FfTMVL=w243-h244-n-k-no-nu" 
              alt="HG Pipas Logo" 
              className="h-10 w-10 rounded-xl object-cover shadow-lg shadow-sky-200"
              referrerPolicy="no-referrer"
            />
            <span className="text-xl font-bold tracking-tight text-slate-900">HG <span className="text-sky-600">Pipas</span></span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            <NavItem tab="inicio" label="Início" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
            <NavItem tab="produtos" label="Produtos" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
            <NavItem tab="categoria" label="Categorias" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
            <NavItem tab="sobre" label="Sobre" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
            {isAdmin && (
              <button 
                onClick={() => setCurrentView('admin')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover:text-sky-500 ${
                  currentView === 'admin' ? 'text-sky-600' : 'text-slate-600'
                }`}
              >
                <Settings size={18} />
                Painel Admin
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => setCurrentView('cart')}
              className="flex items-center gap-2 rounded-full bg-sky-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:bg-sky-700 active:scale-95"
            >
              <ShoppingBag size={18} />
              Fazer Pedido
              {cart.length > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-sky-600">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </button>
            
            {user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <img src={user.photoURL || ""} alt={user.displayName || ""} className="h-8 w-8 rounded-full border border-slate-200" />
                <button 
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-red-500 transition-colors"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-slate-200"
                title="Entrar"
              >
                <LogIn size={20} />
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-slate-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-full left-0 w-full bg-white border-t border-slate-100 p-6 shadow-xl md:hidden"
            >
              <div className="flex flex-col gap-4">
                <NavItem tab="inicio" label="Início" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
                <NavItem tab="produtos" label="Produtos" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
                <NavItem tab="categoria" label="Categorias" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
                <NavItem tab="sobre" label="Sobre" activeTab={activeTab} currentView={currentView} scrollToSection={scrollToSection} />
                {isAdmin && (
                  <button 
                    onClick={() => { setCurrentView('admin'); setIsMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600"
                  >
                    <Settings size={18} />
                    Painel Admin
                  </button>
                )}
                {user ? (
                  <button 
                    onClick={handleLogout}
                    className="mt-4 w-full rounded-xl bg-slate-100 py-4 font-bold text-slate-600"
                  >
                    Sair da Conta
                  </button>
                ) : (
                  <button 
                    onClick={handleLogin}
                    className="mt-4 w-full rounded-xl bg-sky-600 py-4 font-bold text-white shadow-lg shadow-sky-200"
                  >
                    Entrar com Google
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Content */}
      <main className="pt-24 space-y-24">
        <AnimatePresence mode="wait">
          {currentView === 'category' ? (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <CategoryView />
            </motion.div>
          ) : currentView === 'admin' ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <AdminView />
            </motion.div>
          ) : currentView === 'cart' ? (
            <motion.div
              key="cart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <CartView />
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-24"
            >
              {/* Início Section */}
        <section id="inicio" className="px-6 scroll-mt-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-12 lg:py-24">
              <div className="space-y-8">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-600"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500"></span>
                  </span>
                  Novidades de Verão 2026
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]"
                >
                  Domine os Céus com a <span className="text-sky-600">Arte</span> das Pipas.
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-lg text-slate-600 max-w-lg leading-relaxed"
                >
                  Desde 1998, fabricando as melhores pipas artesanais do Brasil. Qualidade, tradição e inovação para quem leva o céu a sério.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="flex flex-wrap gap-4"
                >
                  <button 
                    onClick={() => setCurrentView('cart')}
                    className="group flex items-center gap-2 rounded-full bg-sky-600 px-8 py-4 font-bold text-white transition-all hover:bg-sky-700 hover:shadow-xl active:scale-95"
                  >
                    Fazer Pedido
                    <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                  </button>
                  <button 
                    onClick={() => scrollToSection('produtos')}
                    className="rounded-full border-2 border-slate-200 bg-white px-8 py-4 font-bold text-slate-900 transition-all hover:border-sky-600 hover:text-sky-600 active:scale-95"
                  >
                    Ver Coleção
                  </button>
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 100 }}
                className="relative"
              >
                <div className="absolute -inset-4 rounded-[3rem] bg-sky-200/50 blur-3xl"></div>
                <img 
                  src="https://lh3.googleusercontent.com/p/AF1QipOwrH9dAzgZ9GP52L_PnrYaAqbp1lPYE3FfTMVL=w243-h244-n-k-no-nu" 
                  alt="HG Pipas Hero" 
                  className="relative rounded-[2.5rem] shadow-2xl shadow-sky-200/50 object-cover aspect-square w-full"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-6 -left-6 rounded-3xl bg-white p-6 shadow-xl border border-slate-100 hidden md:block">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                      {[1,2,3].map(i => (
                        <img key={i} src={`https://i.pravatar.cc/100?u=${i}`} className="h-10 w-10 rounded-full border-2 border-white" alt="user" />
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-bold">+2.5k Clientes</p>
                      <div className="flex gap-0.5 text-yellow-400">
                        {[1,2,3,4,5].map(i => <Star key={i} size={12} fill="currentColor" />)}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto max-w-7xl py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 rounded-[2.5rem] bg-white p-12 shadow-sm border border-slate-100">
              {[
                { label: "Anos de Tradição", val: "25+" },
                { label: "Modelos Exclusivos", val: "150+" },
                { label: "Pedidos Entregues", val: "10k+" },
                { label: "Lojas Físicas", val: "03" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl font-black text-sky-600">{stat.val}</p>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Produtos Section */}
        <section id="produtos" className="mx-auto max-w-7xl px-6 py-12 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-black tracking-tight">Nossos <span className="text-sky-600">Produtos</span></h2>
              <p className="text-slate-500 mt-2">Qualidade artesanal em cada detalhe.</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button 
                onClick={() => scrollToSection('categoria')}
                className="whitespace-nowrap rounded-full px-6 py-2 text-sm font-bold bg-sky-600 text-white shadow-lg shadow-sky-100"
              >
                Ver todas as categorias
              </button>
              {categories.map((cat) => (
                <button 
                  key={cat.id} 
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setCurrentView('category');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="whitespace-nowrap rounded-full px-6 py-2 text-sm font-bold bg-white text-slate-600 border border-slate-100 hover:bg-slate-50 transition-all"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-400">
                <Loader2 size={48} className="animate-spin mb-4" />
                <p className="font-medium">Carregando produtos...</p>
              </div>
            ) : products.slice(0, 6).map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
            {!loading && products.length === 0 && (
              <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">Nenhum produto disponível no momento.</p>
              </div>
            )}
          </div>
          {!loading && products.length > 6 && (
            <div className="mt-12 text-center">
              <button 
                onClick={() => scrollToSection('categoria')}
                className="rounded-full border-2 border-slate-200 bg-white px-8 py-4 font-bold text-slate-900 transition-all hover:border-sky-600 hover:text-sky-600"
              >
                Ver todos os produtos
              </button>
            </div>
          )}
        </section>

        {/* Categoria Section */}
        <section id="categoria" className="mx-auto max-w-7xl px-6 py-12 scroll-mt-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight">Explore por <span className="text-sky-600">Categoria</span></h2>
            <p className="text-slate-500 mt-2 max-w-lg mx-auto">Encontre o modelo perfeito para o seu estilo de voo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  setSelectedCategory(cat.name);
                  setCurrentView('category');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group relative h-64 overflow-hidden rounded-[2rem] bg-white shadow-sm border border-slate-100 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-transparent transition-opacity group-hover:opacity-100 opacity-0"></div>
                <div className="relative h-full p-8 flex flex-col justify-between">
                  <div className="text-5xl">{cat.icon}</div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{cat.name}</h3>
                    <p className="text-slate-500 font-medium">
                      {products.filter(p => p.category === cat.name).length} modelos disponíveis
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sky-600 font-bold opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-2">
                      Ver agora <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Sobre Section */}
        <section id="sobre" className="mx-auto max-w-7xl px-6 py-12 scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[3rem] bg-sky-100 blur-2xl"></div>
              <motion.img 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                src="https://picsum.photos/seed/workshop/800/1000" 
                alt="Our workshop" 
                className="relative rounded-[2.5rem] shadow-xl object-cover aspect-[4/5] w-full"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-12 -right-8 rounded-3xl bg-slate-900 p-8 text-white shadow-2xl hidden md:block">
                <p className="text-4xl font-black">25</p>
                <p className="text-sm font-bold text-sky-400 uppercase tracking-widest">Anos de História</p>
              </div>
            </div>
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-bold text-sky-600">
                <Info size={16} />
                Nossa Essência
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                Mais que uma loja, uma <span className="text-sky-600">paixão</span> que atravessa gerações.
              </h2>
              <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
                <p>
                  A HG Pipas nasceu no quintal de casa, fruto de um sonho de infância. O que começou como um hobby de fabricar pipas para os amigos do bairro, transformou-se na maior referência de pipas artesanais da região.
                </p>
                <p>
                  Nossa missão é preservar a cultura da pipa, unindo a tradição do papel de seda com técnicas modernas de aerodinâmica. Cada peça que sai de nossa oficina é testada e aprovada por pipeiros experientes.
                </p>
              </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                  <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-2">Sustentabilidade</h4>
                    <p className="text-sm text-slate-500">Usamos bambu de reflorestamento e papéis biodegradáveis.</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                    <h4 className="font-bold text-slate-900 mb-2">Comunidade</h4>
                    <p className="text-sm text-slate-500">Apoiamos festivais e projetos sociais para jovens.</p>
                  </div>
                </div>

                {/* Informações de Contato Integradas */}
                <div className="pt-8 border-t border-slate-100 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Endereço</h4>
                        <p className="text-slate-500 text-xs">Rua dos Pipeiros, 123 - Vila do Céu<br />São Paulo, SP</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                        <Phone size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Telefone</h4>
                        <p className="text-slate-500 text-xs">(11) 98765-4321<br />(11) 3344-5566</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                        <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Horário</h4>
                        <p className="text-slate-500 text-xs">Seg - Sex: 09h às 18h<br />Sáb: 09h às 14h</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                        <Instagram size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Redes Sociais</h4>
                        <div className="flex gap-3 mt-1">
                          <Instagram size={16} className="text-slate-400 hover:text-sky-600 cursor-pointer" />
                          <Facebook size={16} className="text-slate-400 hover:text-sky-600 cursor-pointer" />
                          <Twitter size={16} className="text-slate-400 hover:text-sky-600 cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
      </motion.div>
    )}
  </AnimatePresence>
</main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white pt-24 pb-12 mt-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-16 border-b border-slate-800">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <img 
                  src="https://lh3.googleusercontent.com/p/AF1QipOwrH9dAzgZ9GP52L_PnrYaAqbp1lPYE3FfTMVL=w243-h244-n-k-no-nu" 
                  alt="HG Pipas Logo" 
                  className="h-10 w-10 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xl font-bold tracking-tight">HG <span className="text-sky-500">Pipas</span></span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Elevando a diversão a novos patamares. Qualidade artesanal e tradição desde 2013.
              </p>
              <div className="flex gap-4">
                {[Instagram, Facebook, Twitter].map((Icon, i) => (
                  <button key={i} className="text-slate-400 hover:text-sky-500 transition-colors">
                    <Icon size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-6">Links Rápidos</h4>
              <ul className="space-y-4 text-slate-400">
                {[
                  { id: 'inicio', label: 'Início' },
                  { id: 'produtos', label: 'Produtos' },
                  { id: 'categoria', label: 'Categorias' },
                  { id: 'sobre', label: 'Sobre Nós' }
                ].map((link, i) => (
                  <li 
                    key={i} 
                    onClick={() => scrollToSection(link.id)}
                    className="hover:text-sky-500 transition-colors cursor-pointer"
                  >
                    {link.label}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-6">Categorias</h4>
              <ul className="space-y-4 text-slate-400">
                {categories.map((cat) => (
                  <li 
                    key={cat.id} 
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      setCurrentView('category');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-sky-500 transition-colors cursor-pointer"
                  >
                    {cat.name}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-6">Newsletter</h4>
              <p className="text-slate-400 mb-6">Receba novidades e promoções exclusivas.</p>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Seu e-mail" 
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm outline-none focus:border-sky-500"
                />
                <button className="rounded-xl bg-sky-600 px-4 py-3 text-white hover:bg-sky-700 transition-colors">
                  <Mail size={20} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
            <p>© 2026 HG Pipas. Todos os direitos reservados.</p>
            <div className="flex gap-8">
              <span 
                onClick={() => setCurrentView('admin')}
                className="hover:text-white cursor-pointer transition-colors"
              >
                Admin
              </span>
              <span className="hover:text-white cursor-pointer transition-colors">Privacidade</span>
              <span className="hover:text-white cursor-pointer transition-colors">Termos de Uso</span>
              <span className="hover:text-white cursor-pointer transition-colors">Cookies</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Buttons */}
      <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-4 md:bottom-8 md:right-8">
        {/* WhatsApp Button */}
        <motion.a
          initial={{ opacity: 0, scale: 0.5, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          href="https://wa.me/5511987654321?text=Olá! Gostaria de tirar algumas dúvidas."
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-200 transition-all hover:bg-green-600 hover:shadow-green-300 active:scale-95"
        >
          <MessageCircle size={24} />
        </motion.a>

        {/* Back to Top Button */}
        <AnimatePresence>
          {scrolled && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              onClick={() => scrollToSection('inicio')}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-200 transition-all hover:bg-sky-700 hover:shadow-sky-300 active:scale-95"
            >
              <Wind size={20} className="rotate-180" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-3rem)] -translate-x-1/2 md:hidden">
        <div className="flex items-center justify-around rounded-2xl bg-white/80 p-2 shadow-2xl backdrop-blur-lg border border-slate-100">
            {[
              { id: 'inicio', icon: Wind, label: 'Início' },
              { id: 'produtos', icon: ShoppingBag, label: 'Loja' },
              { id: 'cart', icon: ShoppingBag, label: 'Pedido', badge: cart.length > 0 ? cart.reduce((acc, item) => acc + item.quantity, 0) : null },
              { id: 'admin', icon: Settings, label: 'Admin', show: isAdmin },
              { id: 'sobre', icon: Info, label: 'Sobre' }
            ].filter(item => item.show !== false).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'admin' || item.id === 'cart') {
                  setCurrentView(item.id as View);
                } else {
                  scrollToSection(item.id as Tab);
                }
              }}
              className={`relative flex flex-col items-center gap-1 p-2 transition-colors ${
                (activeTab === item.id && currentView === 'main') || (currentView === item.id) ? 'text-sky-600' : 'text-slate-400'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              {item.badge && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[8px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
