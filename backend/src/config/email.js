const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Email send error:', error.message);
    throw new Error('Failed to send email');
  }
};

const sendOTPEmail = async (email, name, otpCode) => {
  const digits = otpCode.toString().split('');
  const otpBoxes = digits.map(d => 
    `<td style="width:48px;height:56px;text-align:center;font-size:28px;font-weight:700;color:#6366f1;background:#eef2ff;border:2px solid #c7d2fe;border-radius:10px;font-family:'Segoe UI',Arial,sans-serif;">${d}</td>`
  ).join('<td style="width:8px;"></td>');

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%);padding:40px 32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:-0.5px;">📦 Stationery Hub</h1>
        <p style="color:#e0e7ff;margin:8px 0 0;font-size:14px;">Email Verification</p>
      </div>
      <div style="padding:40px 32px;">
        <h2 style="color:#1e293b;margin:0 0 8px;font-size:22px;">Hello, ${name}! 👋</h2>
        <p style="color:#64748b;line-height:1.6;margin:0 0 32px;font-size:15px;">
          Thank you for signing up. Use the verification code below to confirm your email address. This code expires in <strong>5 minutes</strong>.
        </p>
        <div style="text-align:center;margin:0 0 32px;">
          <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Your Verification Code</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${otpBoxes}</tr></table>
        </div>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
          <p style="color:#92400e;font-size:13px;margin:0;">⚠️ Never share this code with anyone. Stationery Hub will never ask for your code via phone or chat.</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
      <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Stationery Hub • Basundhara, Dhaka • © ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;
  await sendEmail(email, `${otpCode} is your Stationery Hub verification code`, html);
};

const sendOrderConfirmationEmail = async (email, order) => {
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);padding:40px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">✅</div>
        <h1 style="color:#fff;margin:0;font-size:24px;">Order Confirmed!</h1>
        <p style="color:#dcfce7;margin:8px 0 0;font-size:14px;">Order #${order.orderNumber}</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">Thank you for your order! 🎉</h2>
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#64748b;padding:6px 0;">Order Number</td><td style="text-align:right;font-weight:600;color:#1e293b;">#${order.orderNumber}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Total Amount</td><td style="text-align:right;font-weight:600;color:#6366f1;">৳${Number(order.total).toLocaleString()}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Payment</td><td style="text-align:right;font-weight:600;color:#1e293b;">${order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Status</td><td style="text-align:right;"><span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">PENDING</span></td></tr>
          </table>
        </div>
        <p style="color:#64748b;font-size:14px;line-height:1.6;">We'll notify you when your order is confirmed and shipped. You can track your order anytime from your account.</p>
      </div>
      <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Stationery Hub • Basundhara, Dhaka</p>
      </div>
    </div>
  `;
  await sendEmail(email, `Order Confirmed — #${order.orderNumber} | Stationery Hub`, html);
};

const sendAdminNewOrderEmail = async (order) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
  const itemRows = (order.items || []).map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:14px;">${item.productName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:14px;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:14px;text-align:right;">৳${Number(item.unitPrice).toLocaleString()}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:14px;text-align:right;font-weight:600;">৳${Number(item.lineTotal).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:40px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">🔔</div>
        <h1 style="color:#fff;margin:0;font-size:24px;">New Order Received!</h1>
        <p style="color:#fef3c7;margin:8px 0 0;font-size:14px;">Order #${order.orderNumber}</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">Order Details</h2>
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#64748b;padding:6px 0;">Order Number</td><td style="text-align:right;font-weight:600;color:#1e293b;">#${order.orderNumber}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Customer</td><td style="text-align:right;font-weight:600;color:#1e293b;">${order.customer?.contactPerson || 'N/A'}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Total Amount</td><td style="text-align:right;font-weight:600;color:#d97706;">৳${Number(order.total).toLocaleString()}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Payment Method</td><td style="text-align:right;font-weight:600;color:#1e293b;">${order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Items</td><td style="text-align:right;font-weight:600;color:#1e293b;">${order.items?.length || 0} item(s)</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Shipping Address</td><td style="text-align:right;font-weight:600;color:#1e293b;">${order.shippingAddress || 'N/A'}</td></tr>
          </table>
        </div>
        <h3 style="color:#1e293b;margin:0 0 12px;font-size:16px;">Order Items</h3>
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b;font-weight:600;">Product</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#64748b;font-weight:600;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#64748b;font-weight:600;">Price</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#64748b;font-weight:600;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
      <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Stationery Hub • Admin Notification</p>
      </div>
    </div>
  `;
  await sendEmail(adminEmail, `🔔 New Order #${order.orderNumber} — ৳${Number(order.total).toLocaleString()} | Stationery Hub`, html);
};

const sendOrderStatusUpdateEmail = async (email, order, newStatus) => {
  const statusConfig = {
    CONFIRMED:  { color: '#3b82f6', bg: '#eff6ff',  border: '#bfdbfe', label: 'Confirmed',     title: 'Order Confirmed!',            icon: '✅', message: 'Your order has been confirmed and is being prepared.' },
    PROCESSING: { color: '#6366f1', bg: '#eef2ff',  border: '#c7d2fe', label: 'Processing',    title: 'Order is Being Processed',    icon: '⚙️', message: 'We are currently processing your order.' },
    SHIPPED:    { color: '#8b5cf6', bg: '#f5f3ff',  border: '#ddd6fe', label: 'Shipped',       title: 'Order Shipped!',              icon: '🚚', message: 'Your order is on its way!' },
    DELIVERED:  { color: '#22c55e', bg: '#f0fdf4',  border: '#bbf7d0', label: 'Delivered',     title: 'Order Delivered!',            icon: '📦', message: 'Your order has been delivered successfully.' },
    COMPLETED:  { color: '#16a34a', bg: '#f0fdf4',  border: '#bbf7d0', label: 'Completed',    title: 'Order Completed!',            icon: '🎉', message: 'Your order is complete. Thank you for shopping with us!' },
    CANCELLED:  { color: '#ef4444', bg: '#fef2f2',  border: '#fecaca', label: 'Cancelled',    title: 'Order Cancelled',             icon: '❌', message: 'Your order has been cancelled.' },
  };

  const config = statusConfig[newStatus] || { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: newStatus, title: 'Order Updated', icon: '📋', message: 'Your order status has been updated.' };

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,${config.color} 0%,${config.color}cc 100%);padding:40px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">${config.icon}</div>
        <h1 style="color:#fff;margin:0;font-size:24px;">${config.title}</h1>
        <p style="color:#ffffffcc;margin:8px 0 0;font-size:14px;">Order #${order.orderNumber}</p>
      </div>
      <div style="padding:32px;">
        <div style="text-align:center;margin:0 0 24px;">
          <span style="background:${config.bg};color:${config.color};padding:8px 20px;border-radius:20px;font-size:14px;font-weight:700;border:1px solid ${config.border};">${config.label}</span>
        </div>
        <p style="color:#475569;font-size:15px;line-height:1.6;text-align:center;margin:0 0 24px;">${config.message}</p>
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#64748b;padding:6px 0;">Order Number</td><td style="text-align:right;font-weight:600;color:#1e293b;">#${order.orderNumber}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Status</td><td style="text-align:right;"><span style="background:${config.bg};color:${config.color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${config.label}</span></td></tr>
            <tr><td style="color:#64748b;padding:6px 0;">Total Amount</td><td style="text-align:right;font-weight:600;color:#6366f1;">৳${Number(order.total).toLocaleString()}</td></tr>
          </table>
        </div>
        <p style="color:#64748b;font-size:14px;line-height:1.6;">You can track your order anytime from your account.</p>
      </div>
      <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Stationery Hub • Basundhara, Dhaka</p>
      </div>
    </div>
  `;
  await sendEmail(email, `Order ${order.orderNumber} — ${config.label} | Stationery Hub`, html);
};

module.exports = { sendEmail, sendOTPEmail, sendOrderConfirmationEmail, sendAdminNewOrderEmail, sendOrderStatusUpdateEmail };
