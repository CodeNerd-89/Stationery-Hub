import { useState, useEffect } from 'react';
import { productsAPI, categoriesAPI, wishlistAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlineShoppingCart, HiOutlinePlus, HiOutlineMinus, HiOutlineCheck, HiOutlineHeart, HiHeart } from 'react-icons/hi';
import './Catalog.css';

const Catalog = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const { addToCart, isInCart, getItemQuantity, updateQuantity, totalItems } = useCart();
  const { isAuthenticated } = useAuth();
  const [wishlistedIds, setWishlistedIds] = useState(new Set());
  const [wishlistLoading, setWishlistLoading] = useState(new Set());

  useEffect(() => {
    fetchCategories();
    if (isAuthenticated) fetchWishlistIds();
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProducts();
  }, [search, selectedCategory, page]);

  const fetchWishlistIds = async () => {
    try {
      const { data } = await wishlistAPI.getAll();
      setWishlistedIds(new Set(data.wishlist.map(item => item.productId)));
    } catch {
      // Silently fail
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await categoriesAPI.getAll();
      setCategories(data.categories);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await productsAPI.getAll({
        search: search || undefined,
        category: selectedCategory || undefined,
        page,
        limit: 24,
      });
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="catalog-page">
      {/* Hero Section */}
      <div className="catalog-hero">
        <div className="catalog-hero-content">
          <h1>Browse Our Products</h1>
          <p>Find the best stationery and office supplies for your needs</p>
          <div className="catalog-search">
            <HiOutlineSearch className="catalog-search-icon" />
            <input
              type="text"
              placeholder="Search products by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              id="catalog-search"
            />
          </div>
        </div>
      </div>

      {/* Floating cart button */}
      {totalItems > 0 && (
        <Link to="/cart" className="catalog-cart-fab">
          <HiOutlineShoppingCart />
          <span className="fab-count">{totalItems}</span>
          <span className="fab-label">View Cart</span>
        </Link>
      )}

      <div className="catalog-body">
        {/* Category filter chips */}
        <div className="category-chips">
          <button
            className={`chip ${selectedCategory === '' ? 'chip-active' : ''}`}
            onClick={() => { setSelectedCategory(''); setPage(1); }}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`chip ${selectedCategory === cat.id ? 'chip-active' : ''}`}
              onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
            >
              {cat.name}
              <span className="chip-count">{cat._count?.products || 0}</span>
            </button>
          ))}
        </div>

        {/* Results info */}
        <div className="catalog-info">
          <p>
            Showing {products.length} of {pagination.total || 0} products
            {selectedCategory && categories.find(c => c.id === selectedCategory) &&
              ` in ${categories.find(c => c.id === selectedCategory).name}`
            }
          </p>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p>Loading products...</p>
          </div>
        ) : products.length > 0 ? (
          <div className="product-grid">
            {products.map((product) => {
              const inCart = isInCart(product.id);
              const qty = getItemQuantity(product.id);

              return (
                <div key={product.id} className={`product-card ${inCart ? 'product-card-in-cart' : ''}`} id={`product-${product.slug}`}>
                  <Link to={`/product/${product.slug}`} className="product-card-link">
                    <div className="product-card-image">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          onError={(e) => { e.target.onerror = null; e.target.replaceWith(Object.assign(document.createElement('div'), { className: 'product-placeholder', textContent: '📦' })); }}
                        />
                      ) : (
                        <div className="product-placeholder">📦</div>
                      )}
                      {product.stock <= 10 && product.stock > 0 && (
                        <span className="product-badge-stock">Low Stock</span>
                      )}
                      {product.stock === 0 && (
                        <span className="product-badge-stock product-badge-out">Out of Stock</span>
                      )}
                      {inCart && (
                        <span className="product-badge-cart"><HiOutlineCheck /> In Cart</span>
                      )}
                      {/* Wishlist heart */}
                      <button
                        className={`catalog-wishlist-btn ${wishlistedIds.has(product.id) ? 'wishlisted' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isAuthenticated) {
                            toast.error('Please log in to save items');
                            return;
                          }
                          if (wishlistLoading.has(product.id)) return;
                          setWishlistLoading(prev => new Set(prev).add(product.id));
                          wishlistAPI.toggle(product.id).then(({ data }) => {
                            setWishlistedIds(prev => {
                              const next = new Set(prev);
                              if (data.wishlisted) next.add(product.id);
                              else next.delete(product.id);
                              return next;
                            });
                            toast.success(data.wishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
                          }).catch(() => {
                            toast.error('Failed to update wishlist');
                          }).finally(() => {
                            setWishlistLoading(prev => {
                              const next = new Set(prev);
                              next.delete(product.id);
                              return next;
                            });
                          });
                        }}
                        title={wishlistedIds.has(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
                      >
                        {wishlistedIds.has(product.id) ? <HiHeart /> : <HiOutlineHeart />}
                      </button>
                    </div>
                    <div className="product-card-body">
                      <span className="product-category">{product.category?.name}</span>
                      <h3 className="product-title">{product.name}</h3>
                      {product.description && (
                        <p className="product-description">{product.description.substring(0, 80)}{product.description.length > 80 ? '...' : ''}</p>
                      )}
                      <div className="product-card-footer">
                        <div className="product-price">
                          <span className="price-amount">৳{Number(product.price).toLocaleString()}</span>
                          <span className="price-unit">/{product.unit}</span>
                        </div>
                        <span className="product-sku">{product.sku}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Add to Cart section — outside link to prevent nav on click */}
                  <div className="product-cart-actions">
                    {!inCart ? (
                      <button
                        className="btn btn-primary btn-sm product-add-btn"
                        onClick={() => addToCart(product)}
                        disabled={product.stock === 0}
                      >
                        <HiOutlineShoppingCart /> {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    ) : (
                      <div className="product-qty-control">
                        <button className="qty-btn" onClick={() => updateQuantity(product.id, qty - 1)}>
                          <HiOutlineMinus />
                        </button>
                        <span className="qty-value">{qty}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(product.id, qty + 1)} disabled={qty >= product.stock}>
                          <HiOutlinePlus />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No products found</h3>
              <p>Try a different search term or category.</p>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
            <button disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Catalog;
