package models

import (
	"encoding/json"
	"time"
)

// ─── Context Key ────────────────────────────────────

type ContextKey string

const UserContextKey ContextKey = "user"

// ─── Pagination ─────────────────────────────────────

type Pagination struct {
	Page  int `json:"page"`
	Limit int `json:"limit"`
	Total int `json:"total"`
	Pages int `json:"pages"`
}

// ─── Count (Prisma _count compatibility) ────────────

type Count struct {
	Products   *int `json:"products,omitempty"`
	Quotations *int `json:"quotations,omitempty"`
	Orders     *int `json:"orders,omitempty"`
	Items      *int `json:"items,omitempty"`
}

// ─── User ───────────────────────────────────────────

type User struct {
	ID            string     `json:"id"`
	Email         string     `json:"email"`
	PasswordHash  string     `json:"-"`
	Name          string     `json:"name"`
	Role          string     `json:"role"`
	EmailVerified bool       `json:"emailVerified"`
	VerifyToken   *string    `json:"-"`
	ResetToken    *string    `json:"-"`
	ResetExpires  *time.Time `json:"-"`
	Phone         *string    `json:"phone,omitempty"`
	OTPCode       *string    `json:"-"`
	OTPExpiresAt  *time.Time `json:"-"`
	OTPAttempts   int        `json:"-"`
	ReferralCode  *string    `json:"referralCode,omitempty"`
	ReferredByID  *string    `json:"-"`
	CreatedAt     *time.Time `json:"createdAt,omitempty"`
	UpdatedAt     *time.Time `json:"updatedAt,omitempty"`
}

// UserBrief is used in relation fields (e.g., quotation.createdBy)
type UserBrief struct {
	Name  string  `json:"name"`
	Email *string `json:"email,omitempty"`
}

// ─── Category ───────────────────────────────────────

type Category struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Slug        string     `json:"slug"`
	Description *string    `json:"description"`
	ImageURL    *string    `json:"imageUrl"`
	SortOrder   int        `json:"sortOrder"`
	CreatedAt   *time.Time `json:"createdAt,omitempty"`
	// Relations
	Products []Product `json:"products,omitempty"`
	Count    *Count    `json:"_count,omitempty"`
}

// CategoryBrief for product.category relation
type CategoryBrief struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	Slug *string `json:"slug,omitempty"`
}

// ─── Product ────────────────────────────────────────

type Product struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Slug          string         `json:"slug"`
	SKU           string         `json:"sku"`
	CategoryID    string         `json:"categoryId"`
	Description   *string        `json:"description"`
	Price         float64        `json:"price"`
	Stock         int            `json:"stock"`
	Unit          string         `json:"unit"`
	ImageURL      *string        `json:"imageUrl"`
	IsActive      bool           `json:"isActive"`
	AverageRating float64        `json:"averageRating"`
	ReviewCount   int            `json:"reviewCount"`
	CreatedAt     *time.Time     `json:"createdAt,omitempty"`
	UpdatedAt     *time.Time     `json:"updatedAt,omitempty"`
	// Relations
	Category *CategoryBrief `json:"category,omitempty"`
}

// ProductBrief for order/quotation item relations
type ProductBrief struct {
	ID       *string  `json:"id,omitempty"`
	Name     *string  `json:"name,omitempty"`
	SKU      *string  `json:"sku,omitempty"`
	ImageURL *string  `json:"imageUrl,omitempty"`
	Slug     *string  `json:"slug,omitempty"`
	Price    *float64 `json:"price,omitempty"`
}

// ─── Customer ───────────────────────────────────────

type Customer struct {
	ID            string     `json:"id"`
	UserID        *string    `json:"userId,omitempty"`
	CompanyName   *string    `json:"companyName"`
	ContactPerson string     `json:"contactPerson"`
	Phone         *string    `json:"phone"`
	Email         *string    `json:"email"`
	Address       *string    `json:"address"`
	Notes         *string    `json:"notes,omitempty"`
	CreatedAt     *time.Time `json:"createdAt,omitempty"`
	UpdatedAt     *time.Time `json:"updatedAt,omitempty"`
	// Relations
	User       *UserBrief  `json:"user,omitempty"`
	Quotations []Quotation `json:"quotations,omitempty"`
	Orders     []Order     `json:"orders,omitempty"`
	Count      *Count      `json:"_count,omitempty"`
}

// CustomerBrief for order/quotation relations
type CustomerBrief struct {
	ID            string  `json:"id"`
	ContactPerson string  `json:"contactPerson"`
	CompanyName   *string `json:"companyName"`
	Email         *string `json:"email,omitempty"`
	UserID        *string `json:"userId,omitempty"`
}

// ─── Quotation ──────────────────────────────────────

type Quotation struct {
	ID              string          `json:"id"`
	QuotationNumber string          `json:"quotationNumber"`
	CustomerID      *string         `json:"customerId"`
	CreatedByID     string          `json:"createdById"`
	Status          string          `json:"status"`
	Subtotal        float64         `json:"subtotal"`
	DiscountAmount  float64         `json:"discountAmount"`
	Total           float64         `json:"total"`
	Notes           *string         `json:"notes"`
	ValidUntil      *time.Time      `json:"validUntil"`
	CreatedAt       *time.Time      `json:"createdAt,omitempty"`
	UpdatedAt       *time.Time      `json:"updatedAt,omitempty"`
	// Relations
	Customer  interface{}     `json:"customer,omitempty"`
	CreatedBy *UserBrief      `json:"createdBy,omitempty"`
	Items     []QuotationItem `json:"items,omitempty"`
	ScanJob   *ScanJobBrief   `json:"scanJob,omitempty"`
	Order     *Order          `json:"order,omitempty"`
	Count     *Count          `json:"_count,omitempty"`
}

// ─── QuotationItem ──────────────────────────────────

type QuotationItem struct {
	ID              string       `json:"id"`
	QuotationID     string       `json:"quotationId"`
	ProductID       *string      `json:"productId"`
	ProductName     string       `json:"productName"`
	Quantity        int          `json:"quantity"`
	UnitPrice       float64      `json:"unitPrice"`
	DiscountPercent float64      `json:"discountPercent"`
	LineTotal       float64      `json:"lineTotal"`
	Notes           *string      `json:"notes"`
	Product         *ProductBrief `json:"product,omitempty"`
}

// ─── Order ──────────────────────────────────────────

type Order struct {
	ID              string          `json:"id"`
	OrderNumber     string          `json:"orderNumber"`
	QuotationID     *string         `json:"quotationId"`
	CustomerID      string          `json:"customerId"`
	ShippingAddress *string         `json:"shippingAddress"`
	ShippingCity    *string         `json:"shippingCity"`
	ShippingPhone   *string         `json:"shippingPhone"`
	PromoCode       *string         `json:"promoCode"`
	Subtotal        float64         `json:"subtotal"`
	Discount        float64         `json:"discount"`
	ShippingFee     float64         `json:"shippingFee"`
	PaymentMethod   string          `json:"paymentMethod"`
	OrderType       string          `json:"orderType"`
	Status          string          `json:"status"`
	Total           float64         `json:"total"`
	Notes           *string         `json:"notes"`
	CreatedAt       *time.Time      `json:"createdAt,omitempty"`
	UpdatedAt       *time.Time      `json:"updatedAt,omitempty"`
	// Relations
	Customer  interface{}     `json:"customer,omitempty"`
	Quotation interface{}     `json:"quotation,omitempty"`
	Items     []OrderItem     `json:"items,omitempty"`
	Timeline  []OrderTimeline `json:"timeline,omitempty"`
}

// ─── OrderItem ──────────────────────────────────────

type OrderItem struct {
	ID          string       `json:"id"`
	OrderID     string       `json:"orderId"`
	ProductID   string       `json:"productId"`
	ProductName string       `json:"productName"`
	Quantity    int          `json:"quantity"`
	UnitPrice   float64      `json:"unitPrice"`
	LineTotal   float64      `json:"lineTotal"`
	Product     *ProductBrief `json:"product,omitempty"`
}

// ─── OrderTimeline ──────────────────────────────────

type OrderTimeline struct {
	ID        string     `json:"id"`
	OrderID   string     `json:"orderId"`
	Status    string     `json:"status"`
	Note      *string    `json:"note"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
}

// ─── ScanJob ────────────────────────────────────────

type ScanJob struct {
	ID             string          `json:"id"`
	UploadedByID   string          `json:"uploadedById"`
	FileURL        string          `json:"fileUrl"`
	FileType       string          `json:"fileType"`
	RawText        *string         `json:"rawText"`
	ExtractedItems json.RawMessage `json:"extractedItems"`
	Status         string          `json:"status"`
	QuotationID    *string         `json:"quotationId"`
	CreatedAt      *time.Time      `json:"createdAt,omitempty"`
}

// ScanJobBrief for quotation.scanJob relation
type ScanJobBrief struct {
	ID      string `json:"id"`
	FileURL string `json:"fileUrl"`
	Status  string `json:"status"`
}

// ─── PromoCode ──────────────────────────────────────

type PromoCode struct {
	ID             string     `json:"id"`
	Code           string     `json:"code"`
	DiscountType   string     `json:"discountType"`
	DiscountValue  float64    `json:"discountValue"`
	MinOrderAmount *float64   `json:"minOrderAmount"`
	ValidFrom      time.Time  `json:"validFrom"`
	ValidUntil     time.Time  `json:"validUntil"`
	UsageLimit     *int       `json:"usageLimit"`
	UsedCount      int        `json:"usedCount"`
	IsActive       bool       `json:"isActive"`
	CreatedAt      *time.Time `json:"createdAt,omitempty"`
}

// ─── Review ─────────────────────────────────────────

type Review struct {
	ID        string     `json:"id"`
	UserID    string     `json:"userId"`
	ProductID string     `json:"productId"`
	Rating    int        `json:"rating"`
	Title     *string    `json:"title"`
	Comment   *string    `json:"comment"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
	UpdatedAt *time.Time `json:"updatedAt,omitempty"`
	// Relations
	User *UserBrief `json:"user,omitempty"`
}

// ─── Wishlist ───────────────────────────────────────

type Wishlist struct {
	ID        string     `json:"id"`
	UserID    string     `json:"userId"`
	ProductID string     `json:"productId"`
	CreatedAt *time.Time `json:"createdAt,omitempty"`
	Product   *Product   `json:"product,omitempty"`
}

// ─── Referral ───────────────────────────────────────

type Referral struct {
	ID             string     `json:"id"`
	ReferrerID     string     `json:"referrerId"`
	ReferredUserID string     `json:"referredUserId"`
	RewardGiven    bool       `json:"rewardGiven"`
	CreatedAt      *time.Time `json:"createdAt,omitempty"`
}

// ─── Helper functions ───────────────────────────────

func IntPtr(i int) *int          { return &i }
func StrPtr(s string) *string    { return &s }
func Float64Ptr(f float64) *float64 { return &f }
func TimePtr(t time.Time) *time.Time { return &t }
