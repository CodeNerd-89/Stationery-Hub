import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { productsAPI, wishlistAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  HiOutlineShoppingCart,
  HiOutlinePlus,
  HiOutlineMinus,
  HiOutlineCheck,
  HiOutlineDocumentText,
  HiOutlineTruck,
  HiOutlineShieldCheck,
  HiOutlineBadgeCheck,
  HiOutlineLightningBolt,
  HiOutlineRefresh,
  HiOutlineClock,
  HiOutlineArrowRight,
  HiOutlineStar,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineChevronRight,
  HiOutlineHeart,
  HiHeart,
} from 'react-icons/hi';
import './ProductDetail.css';

// ─── Helpers ────────────────────────────────────────────
const getDeliveryDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getStockInfo = (stock) => {
  if (stock === 0) return { label: 'Out of Stock', className: 'out-of-stock' };
  if (stock <= 10) return { label: `Only ${stock} left`, className: 'low-stock' };
  return { label: 'In Stock', className: 'in-stock' };
};

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, isInCart, getItemQuantity, updateQuantity } = useCart();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const deliveryDate = getDeliveryDate();

  // Fetch product by slug
  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await productsAPI.getById(slug);
        setProduct(data.product);

        // Fetch related products from same category
        if (data.product.category?.id) {
          try {
            const { data: catData } = await productsAPI.getAll({
              category: data.product.category.id,
              limit: 5,
            });
            setRelatedProducts(
              catData.products.filter((p) => p.id !== data.product.id).slice(0, 4)
            );
          } catch {
            // Silently fail on related products
          }
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Product not found');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    window.scrollTo(0, 0);
  }, [slug]);

  // Sync qty with cart if already in cart
  useEffect(() => {
    if (product && isInCart(product.id)) {
      setQty(getItemQuantity(product.id));
    }
  }, [product]);

  // Check wishlist status
  useEffect(() => {
    if (product && isAuthenticated) {
      const checkWishlist = async () => {
        try {
          const { data } = await wishlistAPI.getAll();
          const isInWishlist = data.wishlist.some(item => item.productId === product.id);
          setWishlisted(isInWishlist);
        } catch {
          // Silently fail
        }
      };
      checkWishlist();
    }
  }, [product, isAuthenticated]);

  // ─── Handlers ────────────────────────────────────
  const handleAddToCart = () => {
    if (!product) return;
    if (isInCart(product.id)) {
      // Update quantity
      updateQuantity(product.id, qty);
    } else {
      addToCart(product, qty);
    }
  };

  const handleQtyChange = (delta) => {
    const newQty = qty + delta;
    if (newQty < 1 || (product && newQty > product.stock)) return;
    setQty(newQty);
    // If already in cart, update live
    if (product && isInCart(product.id)) {
      updateQuantity(product.id, newQty);
    }
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to save items');
      navigate('/login');
      return;
    }
    if (wishlistLoading) return;
    setWishlistLoading(true);
    try {
      const { data } = await wishlistAPI.toggle(product.id);
      setWishlisted(data.wishlisted);
      toast.success(data.wishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
    } catch {
      toast.error('Failed to update wishlist');
    } finally {
      setWishlistLoading(false);
    }
  };

  // ─── Loading State ───────────────────────────────
  if (loading) {
    return (
      <div className="product-detail-page">
        <div className="pd-loading">
          <div className="spinner" />
          <p>Loading product details...</p>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────
  if (error || !product) {
    return (
      <div className="product-detail-page">
        <div className="pd-error">
          <div className="pd-error-icon">🔍</div>
          <h2>Product Not Found</h2>
          <p>{error || 'The product you\'re looking for doesn\'t exist or has been removed.'}</p>
          <Link to="/catalog" className="btn btn-primary">
            <HiOutlineShoppingCart /> Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const stockInfo = getStockInfo(product.stock);
  const inCart = isInCart(product.id);
  const lineTotal = Number(product.price) * qty;

  return (
    <div className="product-detail-page">
      {/* ─── Breadcrumb ─────────────────────────────── */}
      <nav className="pd-breadcrumb" aria-label="Breadcrumb">
        <Link to="/catalog">Products</Link>
        <span className="separator"><HiOutlineChevronRight /></span>
        {product.category && (
          <>
            <Link to={`/catalog?category=${product.category.id}`}>
              {product.category.name}
            </Link>
            <span className="separator"><HiOutlineChevronRight /></span>
          </>
        )}
        <span className="current">{product.name}</span>
      </nav>

      {/* ─── Main Content ───────────────────────────── */}
      <div className="pd-main">
        {/* ────── LEFT: Product Image ────── */}
        <div className="pd-image-section">
          <div className="pd-image-card">
            <div className="pd-image-container">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="pd-image-placeholder">📦</div>';
                  }}
                />
              ) : (
                <div className="pd-image-placeholder">📦</div>
              )}

              {/* Stock Badge */}
              <div className={`pd-badge-stock ${stockInfo.className}`}>
                <span className="pd-badge-dot" />
                {stockInfo.label}
              </div>

              {/* Wishlist Heart Button */}
              <button
                className={`pd-wishlist-btn ${wishlisted ? 'wishlisted' : ''}`}
                onClick={handleWishlistToggle}
                disabled={wishlistLoading}
                title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                {wishlisted ? <HiHeart /> : <HiOutlineHeart />}
              </button>
            </div>

            {/* Features bar below image */}
            <div className="pd-image-features">
              <div className="pd-image-feature">
                <span className="pd-image-feature-icon">🛡️</span>
                <span>Quality Assured</span>
              </div>
              <div className="pd-image-feature">
                <span className="pd-image-feature-icon">🚚</span>
                <span>Fast Delivery</span>
              </div>
              <div className="pd-image-feature">
                <span className="pd-image-feature-icon">📦</span>
                <span>Bulk Available</span>
              </div>
            </div>
          </div>
        </div>

        {/* ────── RIGHT: Product Info ────── */}
        <div className="pd-info">
          {/* Category & SKU */}
          <div className="pd-meta-row">
            {product.category && (
              <span className="pd-category-badge">
                <HiOutlineTag /> {product.category.name}
              </span>
            )}
            <span className="pd-sku-badge">{product.sku}</span>
          </div>

          {/* Title */}
          <h1 className="pd-title">{product.name}</h1>

          {/* Price */}
          <div className="pd-price-section">
            <span className="pd-price">৳{Number(product.price).toLocaleString()}</span>
            <span className="pd-price-unit">/ {product.unit}</span>
            <span className="pd-price-note">Excl. Tax</span>
          </div>

          {/* Description */}
          {product.description && (
            <p className="pd-description">{product.description}</p>
          )}

          {/* Details Grid */}
          <div className="pd-details-grid">
            <div className="pd-detail-item">
              <div className="pd-detail-icon stock-icon">
                <HiOutlineCube />
              </div>
              <div className="pd-detail-text">
                <span className="detail-label">Stock</span>
                <span className="detail-value">{product.stock > 0 ? `${product.stock} ${product.unit}s available` : 'Out of stock'}</span>
              </div>
            </div>

            <div className="pd-detail-item">
              <div className="pd-detail-icon delivery-icon">
                <HiOutlineTruck />
              </div>
              <div className="pd-detail-text">
                <span className="detail-label">Est. Delivery</span>
                <span className="detail-value">{deliveryDate}</span>
              </div>
            </div>

            <div className="pd-detail-item">
              <div className="pd-detail-icon unit-icon">
                <HiOutlineStar />
              </div>
              <div className="pd-detail-text">
                <span className="detail-label">Sold By</span>
                <span className="detail-value">{product.unit}</span>
              </div>
            </div>

            <div className="pd-detail-item">
              <div className="pd-detail-icon category-icon">
                <HiOutlineTag />
              </div>
              <div className="pd-detail-text">
                <span className="detail-label">Category</span>
                <span className="detail-value">{product.category?.name || '—'}</span>
              </div>
            </div>
          </div>

          {/* ─── Add to Cart Section ────────────────── */}
          <div className="pd-cart-section">
            <div className="pd-qty-row">
              <span className="pd-qty-label">Quantity</span>
              <div className="pd-qty-selector">
                <button
                  className="pd-qty-btn"
                  onClick={() => handleQtyChange(-1)}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                >
                  <HiOutlineMinus />
                </button>
                <span className="pd-qty-display">{qty}</span>
                <button
                  className="pd-qty-btn"
                  onClick={() => handleQtyChange(1)}
                  disabled={qty >= product.stock}
                  aria-label="Increase quantity"
                >
                  <HiOutlinePlus />
                </button>
              </div>
              <span className="pd-qty-stock-info">{product.stock} available</span>
            </div>

            <div className="pd-line-total">
              <span className="pd-line-total-label">Subtotal</span>
              <span className="pd-line-total-value">৳{lineTotal.toLocaleString()}</span>
            </div>

            <div className="pd-cart-actions">
              <button
                className={`pd-add-btn ${inCart ? 'in-cart' : ''}`}
                onClick={handleAddToCart}
                disabled={product.stock === 0}
              >
                {product.stock === 0 ? (
                  'Out of Stock'
                ) : inCart ? (
                  <>
                    <HiOutlineCheck /> Update Cart
                  </>
                ) : (
                  <>
                    <HiOutlineShoppingCart /> Add to Cart
                  </>
                )}
              </button>

              <Link to="/cart" className="pd-quote-btn">
                <HiOutlineDocumentText /> Request Quote
              </Link>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="pd-trust-row">
            <div className="pd-trust-item">
              <HiOutlineShieldCheck /> Secure Checkout
            </div>
            <div className="pd-trust-item">
              <HiOutlineBadgeCheck /> Verified Supplier
            </div>
            <div className="pd-trust-item">
              <HiOutlineLightningBolt /> Fast Delivery
            </div>
          </div>
        </div>
      </div>

      {/* ─── Related Products ───────────────────────── */}
      {relatedProducts.length > 0 && (
        <div className="pd-related-section">
          <div className="pd-related-header">
            <h2><HiOutlineStar /> Related Products</h2>
            <Link to="/catalog">
              View All <HiOutlineArrowRight />
            </Link>
          </div>
          <div className="pd-related-grid">
            {relatedProducts.map((rp) => (
              <Link
                key={rp.id}
                to={`/product/${rp.slug}`}
                className="pd-related-card"
              >
                <div className="pd-related-image">
                  {rp.imageUrl ? (
                    <img src={rp.imageUrl} alt={rp.name} />
                  ) : (
                    '📦'
                  )}
                </div>
                <div className="pd-related-body">
                  <div className="pd-related-category">{rp.category?.name}</div>
                  <div className="pd-related-name">{rp.name}</div>
                  <div className="pd-related-price">
                    ৳{Number(rp.price).toLocaleString()} <span>/ {rp.unit}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ─── Mobile Sticky Add-to-Cart Bar ──────────── */}
      <div className="pd-mobile-bar">
        <div className="pd-mobile-bar-price">
          <span className="mobile-price-label">Price</span>
          <span className="mobile-price-value">৳{Number(product.price).toLocaleString()}</span>
        </div>

        <div className="pd-mobile-bar-qty">
          <button onClick={() => handleQtyChange(-1)} disabled={qty <= 1}>
            <HiOutlineMinus />
          </button>
          <span>{qty}</span>
          <button onClick={() => handleQtyChange(1)} disabled={qty >= product.stock}>
            <HiOutlinePlus />
          </button>
        </div>

        <button
          className={`pd-mobile-add-btn ${inCart ? 'in-cart' : ''}`}
          onClick={handleAddToCart}
          disabled={product.stock === 0}
        >
          {product.stock === 0 ? 'Sold Out' : inCart ? (
            <><HiOutlineCheck /> Update</>
          ) : (
            <><HiOutlineShoppingCart /> Add</>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;
