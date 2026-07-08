package services

import (
	"fmt"
	"log"
	"strings"

	"gopkg.in/gomail.v2"
	"stationery-hub-backend/internal/config"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

func (e *EmailService) send(to, subject, htmlBody string) {
	if e.cfg.SMTPHost == "" || e.cfg.SMTPUser == "" || e.cfg.SMTPPass == "" {
		log.Printf("SMTP not fully configured (host=%q, user=%q, pass_set=%v) – skipping email to %s: %s",
			e.cfg.SMTPHost, e.cfg.SMTPUser, e.cfg.SMTPPass != "", to, subject)
		return
	}

	m := gomail.NewMessage()
	m.SetHeader("From", e.cfg.SMTPFrom)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", htmlBody)

	d := gomail.NewDialer(e.cfg.SMTPHost, e.cfg.SMTPPort, e.cfg.SMTPUser, e.cfg.SMTPPass)
	d.SSL = false // Use STARTTLS on port 587, not implicit SSL

	if err := d.DialAndSend(m); err != nil {
		log.Printf("Email send error to %s: %v (host=%s, port=%d, user=%s)", to, err, e.cfg.SMTPHost, e.cfg.SMTPPort, e.cfg.SMTPUser)
	} else {
		log.Printf("Email sent successfully to %s: %s", to, subject)
	}
}

func formatCurrencyEmail(value float64) string {
	s := fmt.Sprintf("%.0f", value)
	// Add commas Indian style
	if len(s) <= 3 {
		return "৳" + s
	}
	result := s[len(s)-3:]
	s = s[:len(s)-3]
	for len(s) > 2 {
		result = s[len(s)-2:] + "," + result
		s = s[:len(s)-2]
	}
	if len(s) > 0 {
		result = s + "," + result
	}
	return "৳" + result
}

// ─── SendOTPEmail ───────────────────────────────────

func (e *EmailService) SendOTPEmail(email, name, otp string) {
	subject := "Verify Your Email - Stationery Hub"
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#667eea 0%%,#764ba2 100%%);padding:30px;text-align:center">
  <h1 style="color:white;margin:0;font-size:28px">📧 Email Verification</h1>
</div>
<div style="padding:30px;background:#f8f9fa">
  <h2 style="color:#333">Hello %s! 👋</h2>
  <p>Welcome to Stationery Hub! Please verify your email address using this OTP code:</p>
  <div style="background:white;border-radius:10px;padding:20px;text-align:center;margin:20px 0;border:2px dashed #667eea">
    <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#667eea">%s</span>
  </div>
  <p style="color:#666;font-size:14px">⏰ This code expires in <strong>10 minutes</strong>.</p>
  <p style="color:#999;font-size:12px">If you didn't create an account, please ignore this email.</p>
</div>
<div style="background:#333;color:white;padding:20px;text-align:center;font-size:12px">
  <p style="margin:0">© 2025 Stationery Hub. All rights reserved.</p>
</div>
</body></html>`, name, otp)
	e.send(email, subject, html)
}

// ─── SendPasswordResetEmail ─────────────────────────

func (e *EmailService) SendPasswordResetEmail(email, name, otp string) {
	subject := "Password Reset - Stationery Hub"
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#f093fb 0%%,#f5576c 100%%);padding:30px;text-align:center">
  <h1 style="color:white;margin:0;font-size:28px">🔒 Password Reset</h1>
</div>
<div style="padding:30px;background:#f8f9fa">
  <h2 style="color:#333">Hello %s,</h2>
  <p>We received a request to reset your password. Use this OTP code:</p>
  <div style="background:white;border-radius:10px;padding:20px;text-align:center;margin:20px 0;border:2px dashed #f5576c">
    <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#f5576c">%s</span>
  </div>
  <p style="color:#666;font-size:14px">⏰ This code expires in <strong>10 minutes</strong>.</p>
  <p style="color:#999;font-size:12px">If you didn't request this, please ignore this email.</p>
</div>
<div style="background:#333;color:white;padding:20px;text-align:center;font-size:12px">
  <p style="margin:0">© 2025 Stationery Hub. All rights reserved.</p>
</div>
</body></html>`, name, otp)
	e.send(email, subject, html)
}

// ─── SendOrderConfirmationEmail ─────────────────────

func (e *EmailService) SendOrderConfirmationEmail(email, name string, order map[string]interface{}) {
	orderNumber, _ := order["orderNumber"].(string)
	total, _ := order["total"].(float64)
	items, _ := order["items"].([]map[string]interface{})
	paymentMethod, _ := order["paymentMethod"].(string)

	var itemsHTML strings.Builder
	for _, item := range items {
		pn, _ := item["productName"].(string)
		qty, _ := item["quantity"].(int)
		lt, _ := item["lineTotal"].(float64)
		itemsHTML.WriteString(fmt.Sprintf(
			`<tr><td style="padding:8px;border-bottom:1px solid #eee">%s</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">%d</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">%s</td></tr>`,
			pn, qty, formatCurrencyEmail(lt),
		))
	}

	subject := fmt.Sprintf("Order Confirmed #%s - Stationery Hub", orderNumber)
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#11998e 0%%,#38ef7d 100%%);padding:30px;text-align:center">
  <h1 style="color:white;margin:0;font-size:28px">✅ Order Confirmed!</h1>
</div>
<div style="padding:30px;background:#f8f9fa">
  <h2 style="color:#333">Thank you, %s! 🎉</h2>
  <p>Your order <strong>#%s</strong> has been placed successfully.</p>
  <table style="width:100%%;border-collapse:collapse;margin:20px 0">
    <thead><tr style="background:#e2e8f0">
      <th style="padding:10px;text-align:left">Product</th>
      <th style="padding:10px;text-align:center">Qty</th>
      <th style="padding:10px;text-align:right">Total</th>
    </tr></thead>
    <tbody>%s</tbody>
  </table>
  <div style="background:white;border-radius:10px;padding:15px;margin-top:15px">
    <p style="margin:5px 0"><strong>Total:</strong> %s</p>
    <p style="margin:5px 0"><strong>Payment:</strong> %s</p>
  </div>
  <p style="margin-top:20px">We'll notify you when your order status updates.</p>
</div>
<div style="background:#333;color:white;padding:20px;text-align:center;font-size:12px">
  <p style="margin:0">© 2025 Stationery Hub. All rights reserved.</p>
</div>
</body></html>`, name, orderNumber, itemsHTML.String(), formatCurrencyEmail(total), paymentMethod)
	e.send(email, subject, html)
}

// ─── SendAdminNewOrderEmail ─────────────────────────

func (e *EmailService) SendAdminNewOrderEmail(order map[string]interface{}) {
	orderNumber, _ := order["orderNumber"].(string)
	total, _ := order["total"].(float64)
	customerName, _ := order["customerName"].(string)
	itemCount, _ := order["itemCount"].(int)

	subject := fmt.Sprintf("🆕 New Order #%s - Stationery Hub", orderNumber)
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#667eea 0%%,#764ba2 100%%);padding:30px;text-align:center">
  <h1 style="color:white;margin:0;font-size:28px">🆕 New Order Received!</h1>
</div>
<div style="padding:30px;background:#f8f9fa">
  <h2 style="color:#333">Order #%s</h2>
  <div style="background:white;border-radius:10px;padding:20px;margin:15px 0">
    <p style="margin:5px 0"><strong>Customer:</strong> %s</p>
    <p style="margin:5px 0"><strong>Items:</strong> %d</p>
    <p style="margin:5px 0"><strong>Total:</strong> %s</p>
  </div>
  <p><a href="%s" style="display:inline-block;padding:12px 24px;background:#667eea;color:white;text-decoration:none;border-radius:6px">View Order</a></p>
</div>
</body></html>`, orderNumber, customerName, itemCount, formatCurrencyEmail(total), e.cfg.FrontendURL+"/admin/orders")
	// Send to admin email
	e.send(e.cfg.SMTPUser, subject, html)
}

// ─── SendOrderStatusUpdateEmail ─────────────────────

func (e *EmailService) SendOrderStatusUpdateEmail(email, name, orderNumber, status string) {
	statusEmoji := map[string]string{
		"PENDING":    "⏳",
		"CONFIRMED":  "✅",
		"PROCESSING": "🔄",
		"SHIPPED":    "🚚",
		"DELIVERED":  "📦",
		"COMPLETED":  "🎉",
		"CANCELLED":  "❌",
	}
	emoji := statusEmoji[status]
	if emoji == "" {
		emoji = "📋"
	}

	subject := fmt.Sprintf("Order #%s Status Update - Stationery Hub", orderNumber)
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#667eea 0%%,#764ba2 100%%);padding:30px;text-align:center">
  <h1 style="color:white;margin:0;font-size:28px">%s Order Update</h1>
</div>
<div style="padding:30px;background:#f8f9fa">
  <h2 style="color:#333">Hello %s,</h2>
  <p>Your order <strong>#%s</strong> has been updated:</p>
  <div style="background:white;border-radius:10px;padding:20px;text-align:center;margin:20px 0">
    <span style="font-size:48px">%s</span>
    <p style="font-size:20px;font-weight:bold;color:#667eea;margin:10px 0">%s</p>
  </div>
  <p><a href="%s" style="display:inline-block;padding:12px 24px;background:#667eea;color:white;text-decoration:none;border-radius:6px">View Order Details</a></p>
</div>
<div style="background:#333;color:white;padding:20px;text-align:center;font-size:12px">
  <p style="margin:0">© 2025 Stationery Hub. All rights reserved.</p>
</div>
</body></html>`, emoji, name, orderNumber, emoji, status, e.cfg.FrontendURL+"/orders")
	e.send(email, subject, html)
}
