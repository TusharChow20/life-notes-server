# 🔧 Life Notes Backend API

<div align="center">

![Life Notes API](https://img.shields.io/badge/Life%20Notes-Backend%20API-blueviolet?style=for-the-badge&logo=node.js&logoColor=white)

**Robust REST API powering the Life Notes platform with secure authentication, payment processing, and real-time data management.**

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-008CDD?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)

</div>

---

## 🎯 API Overview

This is the backend service for **Life Notes** - a platform for sharing life lessons and wisdom. The API handles:

- 🔐 **Authentication** - Secure user registration and login
- 📝 **Lesson Management** - CRUD operations for life lessons
- 💳 **Payment Processing** - Stripe integration for premium subscriptions
- 🖼️ **Image Upload** - Cloudinary integration for media management
- 👥 **User Management** - Profile updates and role-based access
- 🛡️ **Content Moderation** - Report handling and admin controls
- 📊 **Analytics** - Track engagement metrics and statistics

---

## 🚀 Tech Stack

<div align="center">

### **Backend Technologies**

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)

### **Authentication & Security**

![bcrypt](https://img.shields.io/badge/bcrypt-003A70?style=flat&logo=letsencrypt&logoColor=white)
![CORS](https://img.shields.io/badge/CORS-000000?style=flat&logo=cors&logoColor=white)
![dotenv](https://img.shields.io/badge/dotenv-ECD53F?style=flat&logo=.env&logoColor=black)

### **Payment & Cloud Services**

![Stripe](https://img.shields.io/badge/Stripe-008CDD?style=flat&logo=stripe&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=flat&logo=cloudinary&logoColor=white)
![Multer](https://img.shields.io/badge/Multer-FF6C37?style=flat&logo=multer&logoColor=white)

</div>

---

## 📦 Installation & Setup

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
MongoDB >= 6.0
```

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/TusharChow20/life-notes-server.git
cd life-notes-backend
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRICE_ID=price_your_price_id

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 4️⃣ Run Development Server

```bash
nodemon index.js
```

Server will start on `http://localhost:5000`

---

---

## 🛣️ API Endpoints

### 🔐 Authentication

```http
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login user
POST   /api/auth/google            # Google OAuth
GET    /api/auth/me                # Get current user
```

### 📝 Lessons

```http
GET    /api/lessons                # Get all public lessons
GET    /api/lessons/:id            # Get lesson by ID
POST   /api/lessons                # Create new lesson (Auth)
PUT    /api/lessons/:id            # Update lesson (Auth)
DELETE /api/lessons/:id            # Delete lesson (Auth)
POST   /api/lessons/:id/like       # Like/Unlike lesson (Auth)
POST   /api/lessons/:id/favorite   # Add/Remove favorite (Auth)
POST   /api/lessons/:id/comment    # Add comment (Auth)
POST   /api/lessons/:id/report     # Report lesson (Auth)
```

### 👤 Users

```http
GET    /api/users/:id              # Get user profile
GET    /api/users/:id/lessons      # Get user's lessons
PUT    /api/users/profile          # Update profile (Auth)
GET    /api/users/favorites        # Get user favorites (Auth)
```

### 💳 Payments

```http
POST   /api/payments/create-checkout-session   # Create Stripe session (Auth)
POST   /api/payments/webhook                    # Stripe webhook
GET    /api/payments/verify-premium             # Verify premium status (Auth)
```

### 🛡️ Admin Routes

```http
GET    /api/admin/users            # Get all users (Admin)
PUT    /api/admin/users/:id/role   # Update user role (Admin)
GET    /api/admin/lessons          # Get all lessons (Admin)
DELETE /api/admin/lessons/:id      # Delete any lesson (Admin)
PUT    /api/admin/lessons/:id/feature  # Feature lesson (Admin)
GET    /api/admin/reports          # Get all reports (Admin)
DELETE /api/admin/reports/:id      # Handle report (Admin)
GET    /api/admin/stats            # Get platform statistics (Admin)
```

### 🖼️ File Upload

```http
POST   /api/upload/image           # Upload image to Cloudinary (Auth)
```

---

## 📊 Database Schema

### 👤 User Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  photoURL: String,
  role: String (enum: ['user', 'admin']),
  isPremium: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 📝 Lesson Collection

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  category: String,
  emotionalTone: String,
  imageURL: String,
  visibility: String (enum: ['public', 'private']),
  accessLevel: String (enum: ['free', 'premium']),
  userId: ObjectId (ref: 'User'),
  likes: [ObjectId] (ref: 'User'),
  likesCount: Number,
  favoritesCount: Number,
  isFeatured: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 🚩 Report Collection

```javascript
{
  _id: ObjectId,
  lessonId: ObjectId (ref: 'Lesson'),
  reporterUserId: ObjectId (ref: 'User'),
  reportedUserEmail: String,
  reason: String,
  timestamp: Date
}
```

### 💬 Comment Collection

```javascript
{
  _id: ObjectId,
  lessonId: ObjectId (ref: 'Lesson'),
  userId: ObjectId (ref: 'User'),
  text: String,
  createdAt: Date
}
```

### ⭐ Favorite Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User'),
  lessonId: ObjectId (ref: 'Lesson'),
  createdAt: Date
}
```

---

## 🔒 Security Features

- ✅ **Password Hashing** - bcrypt with salt rounds
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **CORS Protection** - Configured for frontend domain
- ✅ **Input Validation** - Sanitize user inputs
- ✅ **Role-Based Access** - Admin and user permissions
- ✅ **Rate Limiting** - Prevent API abuse (optional)
- ✅ **Environment Variables** - Sensitive data protection

---

## 💳 Stripe Integration

### Payment Flow

1. User clicks "Upgrade to Premium" on frontend
2. Frontend calls `/api/payments/create-checkout-session`
3. Backend creates Stripe checkout session
4. User redirected to Stripe payment page
5. After payment, Stripe sends webhook to `/api/payments/webhook`
6. Backend updates user's `isPremium` field to `true`
7. User redirected to success page

### Webhook Events Handled

```javascript
checkout.session.completed;
payment_intent.succeeded;
payment_intent.failed;
```

---

## 🖼️ Cloudinary Integration

### Image Upload Process

1. Frontend uploads image via `/api/upload/image`
2. Multer handles multipart/form-data
3. Image sent to Cloudinary
4. Cloudinary returns secure URL
5. URL stored in MongoDB

### Supported Formats

- JPEG, PNG, WebP
- Max size: 5MB
- Auto-optimization enabled

---

## 📈 API Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description"
}
```

---

## 🧪 Testing

### Test with Postman/Thunder Client

Import the API collection and test endpoints:

1. **Register a new user**

```json
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "photoURL": "https://example.com/photo.jpg"
}
```

2. **Login**

```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

3. **Create a lesson** (requires auth token)

```json
POST /api/lessons
Authorization: Bearer <your_jwt_token>
{
  "title": "My Life Lesson",
  "description": "This is what I learned...",
  "category": "Personal Growth",
  "emotionalTone": "Motivational",
  "visibility": "public",
  "accessLevel": "free"
}
```

---

## 🔧 Environment Setup

### Development

```bash
NODE_ENV=development
PORT=5000
```

### Production

```bash
NODE_ENV=production
PORT=80 or from hosting provider
```

---

## 🚀 Deployment

### Deploy to Render/Railway/Heroku

1. **Connect GitHub Repository**
2. **Set Environment Variables** (all from `.env`)
3. **Set Build Command**: `npm install`
4. **Set Start Command**: `node index.js`
5. **Deploy** 🎉

### Important: Set Stripe Webhook Endpoint

After deployment, configure Stripe webhook:

```
https://your-api-domain.com/api/payments/webhook
```

---

## 🐛 Common Issues & Solutions

### Issue: MongoDB Connection Failed

**Solution:** Check `MONGODB_URI` in `.env` file and ensure IP whitelist in MongoDB Atlas

### Issue: Stripe Webhook Not Working

**Solution:** Use Stripe CLI for local testing:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

### Issue: CORS Error

**Solution:** Verify `FRONTEND_URL` in `.env` matches your frontend domain

### Issue: File Upload Failed

**Solution:** Check Cloudinary credentials and network connection

---

## 👨‍💻 Developer

<div align="center">

### **Tushar Chowdhury**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/tusharchowdhury20211)
[![Email](https://img.shields.io/badge/Email-Contact-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:tusharchowdhury20211@gmail.com)
[![Live Demo](https://img.shields.io/badge/Live_Site-Visit-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://life-notes-nu.vercel.app)

</div>

---

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Fast, minimalist web framework
- [MongoDB](https://www.mongodb.com/) - NoSQL database
- [Stripe](https://stripe.com/) - Payment processing platform
- [Cloudinary](https://cloudinary.com/) - Cloud-based image management
- All open-source contributors

---

<div align="center">

### ⭐ Star this repo if you find it helpful!

**Made with ❤️ by [Tushar Chowdhury](https://www.linkedin.com/in/tusharchowdhury20211)**

[![Live Status](https://img.shields.io/badge/API-Live-success?style=for-the-badge)](https://life-notes-nu.vercel.app)

</div>
