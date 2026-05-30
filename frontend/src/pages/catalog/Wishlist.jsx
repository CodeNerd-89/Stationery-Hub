import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { wishlistAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';
import { 
  HiOutlineHeart, 
  HiOutlineTrash, 
  HiOutlineShoppingCart,
  HiOutlineArrowLeft,
} from 'react-icons/hi';
import './Wishlist.css';

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const { data } = await wishlistAPI.getAll();
      setWishlist(data.wishlist);
    } catch (err) {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const handleRemove = async (productId) => {
    try {
      await wishlistAPI.remove(productId);
      setWishlist(wishlist.filter(item => item.productId !== productId));
      toast.success('Removed from wishlist');
    } catch (err) {
      toast.error('Failed to remove item');
    }
  };

  const handleMoveToCart = (product) => {
    if (product.stock <= 0) {
      toast.error('Product is out of stock');
      return;
    }
    addToCart(product, 1);
    toast.success('Added to cart');
  };

  return (
    <div className="wishlist-page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-arrow-btn" onClick={() => navigate(-1)} title="Go back">
            <HiOutlineArrowLeft />
          </button>
          <div>
            <h1>My Wishlist</h1>
            <p className="subtitle">Saved items for later ({wishlist.length})</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your wishlist...</p>
        </div>
      ) : wishlist.length === 0 ? (
        <div className="empty-state">
          <HiOutlineHeart className="empty-icon" />
          <h2>Your wishlist is empty</h2>
          <p>Save items you like to your wishlist to easily find them later.</p>
          <Link to="/catalog" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map((item) => {
            const product = item.product;
            const isOutOfStock = product.stock <= 0;

            return (
              <div key={item.id} className="wishlist-card">
                <button 
                  className="remove-btn"
                  onClick={() => handleRemove(product.id)}
                  title="Remove from wishlist"
                >
                  <HiOutlineTrash />
                </button>
                
                <Link to={`/product/${product.slug}`} className="product-image-link">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="product-image" />
                  ) : (
                    <div className="product-placeholder">
                      <span>{product.name.charAt(0)}</span>
                    </div>
                  )}
                  {isOutOfStock && <div className="out-of-stock-badge">Out of Stock</div>}
                </Link>

                <div className="product-info">
                  <span className="product-category">{product.category?.name || 'Uncategorized'}</span>
                  <Link to={`/product/${product.slug}`} className="product-name">
                    {product.name}
                  </Link>
                  <div className="product-price">
                    ৳{Number(product.price).toLocaleString()}
                  </div>
                </div>

                <div className="product-actions">
                  <button 
                    className="btn btn-primary add-cart-btn"
                    onClick={() => handleMoveToCart(product)}
                    disabled={isOutOfStock}
                  >
                    <HiOutlineShoppingCart /> Add to Cart
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
