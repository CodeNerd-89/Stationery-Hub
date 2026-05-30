import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

export const CartProvider = ({ children }) => {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from local storage when user auth state resolves
  useEffect(() => {
    if (loading) return;
    const key = user ? `cart_${user.id}` : 'cart_guest';
    try {
      const saved = localStorage.getItem(key);
      setItems(saved ? JSON.parse(saved) : []);
    } catch {
      setItems([]);
    }
    setIsInitialized(true);
  }, [user, loading]);

  // Persist to localStorage on every change
  useEffect(() => {
    if (!isInitialized) return;
    const key = user ? `cart_${user.id}` : 'cart_guest';
    localStorage.setItem(key, JSON.stringify(items));
  }, [items, user, isInitialized]);

  const addToCart = (product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        toast.success(`Updated ${product.name} quantity`);
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      toast.success(`${product.name} added to cart`);
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          price: Number(product.price),
          unit: product.unit,
          stock: product.stock,
          categoryName: product.category?.name || '',
          quantity,
        },
      ];
    });
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (item) toast.success(`${item.productName} removed from cart`);
      return prev.filter((i) => i.productId !== productId);
    });
  };

  const clearCart = (silent = false) => {
    setItems([]);
    if (!silent) toast.success('Cart cleared');
  };

  const isInCart = (productId) => items.some((item) => item.productId === productId);
  const getItemQuantity = (productId) => items.find((item) => item.productId === productId)?.quantity || 0;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        isInCart,
        getItemQuantity,
        totalItems,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
