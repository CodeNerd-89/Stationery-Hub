package router

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"stationery-hub-backend/internal/config"
	"stationery-hub-backend/internal/handlers"
	mw "stationery-hub-backend/internal/middleware"
	"stationery-hub-backend/internal/services"
)

func Setup(db *pgxpool.Pool, cfg *config.Config) chi.Router {
	r := chi.NewRouter()

	// ─── Global Middleware ────────────────────────────
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.RealIP)
	r.Use(mw.Recoverer)
	r.Use(mw.CORSMiddleware(cfg.FrontendURL))

	// ─── Static Files ────────────────────────────────
	fileServer := http.FileServer(http.Dir("./uploads"))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", fileServer))

	// ─── Dependencies ────────────────────────────────
	emailSvc := services.NewEmailService(cfg)
	h := &handlers.Handler{DB: db, Cfg: cfg, Email: emailSvc}

	auth := mw.Authenticate(db, cfg.JWTSecret)
	admin := mw.Authorize("ADMIN")
	adminOrStaff := mw.Authorize("ADMIN", "STAFF")

	// ─── API Routes ──────────────────────────────────
	r.Route("/api", func(r chi.Router) {

		// Health check
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			handlers.RespondJSON(w, 200, map[string]interface{}{
				"status":    "ok",
				"service":   "Stationery Hub API",
				"timestamp": time.Now().Format(time.RFC3339),
			})
		})

		// ── Auth ──────────────────────────────────────
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Register)
			r.Post("/verify-otp", h.VerifyOTP)
			r.Post("/resend-otp", h.ResendOTP)
			r.Post("/login", h.Login)
			r.Post("/forgot-password", h.ForgotPassword)
			r.Post("/verify-reset-otp", h.VerifyResetOTP)
			r.Post("/reset-password", h.ResetPassword)
			r.With(auth).Get("/me", h.GetMe)
		})

		// ── Categories ───────────────────────────────
		r.Route("/categories", func(r chi.Router) {
			r.Get("/", h.ListCategories)
			r.Get("/{id}", h.GetCategory)
			r.With(auth, admin).Post("/", h.CreateCategory)
			r.With(auth, admin).Put("/{id}", h.UpdateCategory)
			r.With(auth, admin).Delete("/{id}", h.DeleteCategory)
		})

		// ── Products ─────────────────────────────────
		r.Route("/products", func(r chi.Router) {
			r.Get("/", h.ListProducts)
			r.With(auth, adminOrStaff).Get("/admin/all", h.AdminListProducts)
			r.Get("/{idOrSlug}", h.GetProduct)
			r.With(auth, admin).Post("/", h.CreateProduct)
			r.With(auth, admin).Put("/{id}", h.UpdateProduct)
			r.With(auth, admin).Delete("/{id}", h.DeleteProduct)
			r.With(auth, admin).Delete("/{id}/permanent", h.PermanentDeleteProduct)
		})

		// ── Customers ────────────────────────────────
		r.Route("/customers", func(r chi.Router) {
			r.Use(auth)
			r.With(adminOrStaff).Get("/", h.ListCustomers)
			r.With(adminOrStaff).Get("/{id}", h.GetCustomer)
			r.With(adminOrStaff).Post("/", h.CreateCustomer)
			r.With(adminOrStaff).Put("/{id}", h.UpdateCustomer)
			r.With(admin).Delete("/{id}", h.DeleteCustomer)
		})

		// ── Quotations ───────────────────────────────
		r.Route("/quotations", func(r chi.Router) {
			r.Use(auth)
			r.With(adminOrStaff).Get("/", h.ListQuotations)
			r.Get("/{id}", h.GetQuotation)
			r.Post("/", h.CreateQuotation)
			r.With(adminOrStaff).Put("/{id}", h.UpdateQuotation)
			r.With(adminOrStaff).Post("/{id}/convert", h.ConvertQuotationToOrder)
			r.Get("/{id}/pdf", h.DownloadQuotationPDF)
			r.With(admin).Delete("/{id}", h.DeleteQuotation)
		})

		// ── Orders ───────────────────────────────────
		r.Route("/orders", func(r chi.Router) {
			r.Use(auth)
			r.Get("/my", h.GetMyOrders)
			r.With(adminOrStaff).Get("/", h.ListOrders)
			r.With(adminOrStaff).Get("/new-count", h.GetNewOrderCount)
			r.Get("/{id}", h.GetOrder)
			r.Get("/{id}/timeline", h.GetOrderTimeline)
			r.With(adminOrStaff).Put("/{id}/status", h.UpdateOrderStatus)
			r.Put("/{id}/cancel", h.CancelOrder)
		})

		// ── Dashboard ────────────────────────────────
		r.Route("/dashboard", func(r chi.Router) {
			r.Use(auth, admin)
			r.Get("/stats", h.GetDashboardStats)
			r.Get("/users", h.ListUsers)
			r.Put("/users/{id}/role", h.UpdateUserRole)
			r.Delete("/users/{id}", h.DeleteDashboardUser)
			r.Get("/analytics", h.GetAnalytics)
			r.Delete("/analytics/top-product", h.DeleteTopProduct)
		})

		// ── Scan ─────────────────────────────────────
		r.Route("/scan", func(r chi.Router) {
			r.Use(auth, adminOrStaff)
			r.Post("/upload", h.UploadScan)
			r.Post("/{scanJobId}/create-quotation", h.CreateQuotationFromScan)
		})

		// ── Checkout ─────────────────────────────────
		r.Route("/checkout", func(r chi.Router) {
			r.Use(auth)
			r.Post("/", h.PlaceOrder)
			r.Post("/validate-promo", h.ValidatePromo)
			r.Post("/bkash/create", h.BkashCreatePayment)
			r.Post("/bkash/execute", h.BkashExecutePayment)
		})

		// ── Reviews ──────────────────────────────────
		r.Route("/reviews", func(r chi.Router) {
			r.Get("/product/{productId}", h.GetProductReviews)
			r.With(auth).Post("/product/{productId}", h.CreateReview)
			r.With(auth).Delete("/{reviewId}", h.DeleteReview)
		})

		// ── Wishlist ─────────────────────────────────
		r.Route("/wishlist", func(r chi.Router) {
			r.Use(auth)
			r.Get("/", h.GetWishlist)
			r.Post("/{productId}", h.ToggleWishlist)
			r.Delete("/{productId}", h.RemoveFromWishlist)
		})

		// ── Promos ───────────────────────────────────
		r.Route("/promos", func(r chi.Router) {
			r.Use(auth, admin)
			r.Get("/", h.ListPromos)
			r.Post("/", h.CreatePromo)
			r.Put("/{id}", h.UpdatePromo)
			r.Delete("/{id}", h.DeletePromo)
		})

		// ── Referrals ────────────────────────────────
		r.Route("/referrals", func(r chi.Router) {
			r.Use(auth)
			r.Get("/my-code", h.GetMyReferralCode)
		})
	})

	// ─── 404 Handler ─────────────────────────────────
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		handlers.RespondError(w, 404, fmt.Sprintf("Route %s %s not found.", r.Method, r.URL.Path))
	})

	return r
}
