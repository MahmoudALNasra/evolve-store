# 🔧 Stripe CLI Setup - Complete Guide

## ✅ Step 1: Stripe CLI Installed
The Stripe CLI has been installed successfully!

---

## 📝 Step 2: Restart Your Terminal

**IMPORTANT:** You need to restart your PowerShell/terminal for the `stripe` command to work.

1. **Close this terminal window**
2. **Open a NEW PowerShell window**
3. **Navigate to your project:**
   ```powershell
   cd c:\Users\Ibra\Desktop\Projects\Ecommerce\estore
   ```

---

## 🔐 Step 3: Login to Stripe

Run this command in the NEW terminal:

```powershell
stripe login
```

**What happens:**
1. Your browser will open automatically
2. You'll see a Stripe login page
3. Click **"Allow access"**
4. Terminal will show: ✅ **"Done! The Stripe CLI is configured"**

---

## 🎧 Step 4: Start Webhook Forwarding

### **Option A: In a separate terminal (Recommended)**

1. **Keep your server running** in one terminal:
   ```powershell
   cd c:\Users\Ibra\Desktop\Projects\Ecommerce\estore\server
   npm run dev
   ```

2. **Open a NEW terminal** and run:
   ```powershell
   cd c:\Users\Ibra\Desktop\Projects\Ecommerce\estore
   stripe listen --forward-to localhost:5000/api/webhooks/stripe
   ```

3. **You'll see output like this:**
   ```
   > Ready! You are using Stripe API Version [2024-XX-XX].
   > Your webhook signing secret is whsec_1234567890abcdefghijklmnopqrstuvwxyz
   ```

4. **COPY the webhook secret** (starts with `whsec_`)

---

## 🔑 Step 5: Add Webhook Secret to .env

1. **Open:** `server\.env`

2. **Replace this line:**
   ```env
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
   ```

3. **With your actual secret:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
   ```

4. **Save the file**

5. **Restart your server** (Ctrl+C and `npm run dev` again)

---

## ✅ Step 6: Verify It's Working

### **Terminal 1 (Server):**
```powershell
cd c:\Users\Ibra\Desktop\Projects\Ecommerce\estore\server
npm run dev
```

Should show:
```
Server running on port 5000
MongoDB connected: localhost
```

### **Terminal 2 (Stripe CLI):**
```powershell
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Should show:
```
> Ready! Your webhook signing secret is whsec_...
```

### **Terminal 3 (Test):**
```powershell
stripe trigger checkout.session.completed
```

Should show:
```
✅ Triggering checkout.session.completed
```

**Check Terminal 2** - you should see the webhook event being forwarded!

---

## 🧪 Test the Full Flow

1. **Start both terminals:**
   - Terminal 1: Server running
   - Terminal 2: Stripe CLI listening

2. **Open your app:** http://localhost:5173

3. **Add item to cart**

4. **Click "Proceed to Checkout"**

5. **You'll be redirected to Stripe**

6. **Use test card:**
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

7. **Complete payment**

8. **Check Terminal 2 (Stripe CLI):**
   ```
   --> checkout.session.completed [evt_xxx]
   <-- [200] POST http://localhost:5000/api/webhooks/stripe
   ```

9. **Check Terminal 1 (Server):**
   - Should show webhook processing logs

10. **You'll be redirected to:** `/order-success`

11. **Cart should be cleared after 2 seconds**

---

## 🎯 Common Issues & Solutions

### **Issue 1: "stripe: command not found"**
**Solution:** Restart your terminal/PowerShell

### **Issue 2: "Webhook signature verification failed"**
**Solution:** 
- Make sure you copied the FULL `whsec_...` secret
- Restart your server after updating `.env`
- Make sure Stripe CLI is running

### **Issue 3: "Connection refused"**
**Solution:**
- Make sure your server is running on port 5000
- Check the forward URL: `localhost:5000/api/webhooks/stripe`

### **Issue 4: Webhook not receiving events**
**Solution:**
- Keep Stripe CLI terminal open
- Don't close the `stripe listen` command
- Check you're using the correct endpoint

---

## 📋 Quick Reference

### **Start Development:**
```powershell
# Terminal 1: Server
cd c:\Users\Ibra\Desktop\Projects\Ecommerce\estore\server
npm run dev

# Terminal 2: Stripe CLI
cd c:\Users\Ibra\Desktop\Projects\Ecommerce\estore
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# Terminal 3: Client
cd c:\Users\Ibra\Desktop\Projects\Ecommerce\estore\client
npm run dev
```

### **Test Stripe Events:**
```powershell
# Trigger test events
stripe trigger checkout.session.completed
stripe trigger checkout.session.expired
stripe trigger payment_intent.succeeded
```

### **View Stripe Logs:**
```powershell
stripe logs tail
```

### **Check Stripe CLI Version:**
```powershell
stripe version
```

---

## 🚀 For Production

When you deploy to production:

1. **Don't use Stripe CLI** - it's only for local development

2. **Add webhook in Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.expired`

3. **Update `.env` with production secret:**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_production_secret_here
   ```

---

## ✅ You're All Set!

Once you complete these steps, your Stripe webhooks will work locally! 🎉

**Next Steps:**
1. Restart your terminal
2. Run `stripe login`
3. Run `stripe listen --forward-to localhost:5000/api/webhooks/stripe`
4. Copy the webhook secret to `.env`
5. Test checkout!
