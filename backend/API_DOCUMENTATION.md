# KartMitra REST API Documentation

Base URL for all APIs: `http://localhost:5000/api/v1`

---

## Response Formats

### Standard Success Response (200 / 201)
```json
{
  "success": true,
  "message": "Request successful",
  "data": {}
}
```

### Standard Error Response (400 / 401 / 403 / 404 / 429 / 500)
```json
{
  "success": false,
  "message": "Something went wrong",
  "error": {
    "details": {},
    "stack": "Stack trace (Only in development environment)"
  }
}
```

---

## 1. Health Check Module

### Get Server Health status
- **Method**: `GET`
- **Endpoint**: `/health`
- **Purpose**: Verifies that the server is online and displays database connection placeholder.
- **Headers**: None
- **Request Body**: None
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "KartMitra backend is running",
    "data": {
      "server": "ok",
      "database": "not_connected"
    }
  }
  ```

---

## 2. Authentication Module (Mock)

### Register User
- **Method**: `POST`
- **Endpoint**: `/auth/register`
- **Purpose**: Simulates registering a new user and issues a JWT token.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "Jane Doe"
  }
  ```
- **Response (201)**:
  ```json
  {
    "success": true,
    "message": "Registration successful (Mock)",
    "data": {
      "user": {
        "id": "mock-user-xyz789",
        "name": "Jane Doe",
        "email": "user@example.com",
        "role": "user"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### User Login
- **Method**: `POST`
- **Endpoint**: `/auth/login`
- **Purpose**: Authenticates a user and generates a JWT. (Use email `admin@kartmitra.com` to sign in as an admin).
- **Request Body**:
  ```json
  {
    "email": "admin@kartmitra.com",
    "password": "password123"
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "Login successful (Mock)",
    "data": {
      "user": {
        "id": "mock-user-id-123",
        "name": "Admin User",
        "email": "admin@kartmitra.com",
        "role": "admin"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

### User Logout
- **Method**: `POST`
- **Endpoint**: `/auth/logout`
- **Purpose**: Logs out the current session (invalidates token client-side).
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "Logout successful (Mock)",
    "data": {}
  }
  ```

### Get Authenticated User Details
- **Method**: `GET`
- **Endpoint**: `/auth/me`
- **Purpose**: Fetches details of the authenticated user based on JWT.
- **Headers**: `Authorization: Bearer <JWT_TOKEN>` or `Authorization: Bearer mock-jwt-token-for-testing`
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "User profile retrieved (Mock)",
    "data": {
      "user": {
        "id": "mock-user-id-123",
        "email": "admin@kartmitra.com",
        "role": "admin",
        "name": "Admin User"
      }
    }
  }
  ```

---

## 3. Products Module (Mock)

### Get All Products
- **Method**: `GET`
- **Endpoint**: `/products`
- **Purpose**: Fetches all available products.
- **Response (200)**: Returns list of products.

### Get Product by ID
- **Method**: `GET`
- **Endpoint**: `/products/:id`
- **Purpose**: Fetches a single product details.
- **Parameters**: `id` (e.g., `prod-1`)
- **Response (200)** / **Error (404)**

### Create Product
- **Method**: `POST`
- **Endpoint**: `/products`
- **Purpose**: Creates a new product catalog record.
- **Request Body**:
  ```json
  {
    "name": "Gaming Mouse",
    "sku": "GM-900",
    "barcode": "6901234567899",
    "price": 49.99,
    "cost": 20.00,
    "stock": 50,
    "category": "Electronics",
    "supplierId": "sup-1"
  }
  ```
- **Response (201)**

### Update Product
- **Method**: `PUT`
- **Endpoint**: `/products/:id`
- **Parameters**: `id`
- **Request Body**: Partials of creation body.
- **Response (200)**

### Delete Product
- **Method**: `DELETE`
- **Endpoint**: `/products/:id`
- **Parameters**: `id`
- **Response (200)**

### Scan Barcode
- **Method**: `POST`
- **Endpoint**: `/products/scan`
- **Purpose**: Looks up a product by scanning its barcode.
- **Request Body**:
  ```json
  {
    "barcode": "6901234567890"
  }
  ```
- **Response (200)**: Returns product details for barcode.

---

## 4. Inventory Module (Mock)

### Get All Inventory Items
- **Method**: `GET`
- **Endpoint**: `/inventory`
- **Response (200)**

### Get Inventory details by Product ID
- **Method**: `GET`
- **Endpoint**: `/inventory/:productId`
- **Parameters**: `productId`
- **Response (200)**

### Get Low Stock Items
- **Method**: `GET`
- **Endpoint**: `/inventory/low-stock`
- **Purpose**: Fetches items whose stock falls below their lowStockThreshold.
- **Response (200)**

### Adjust Stock Level
- **Method**: `POST`
- **Endpoint**: `/inventory/adjust`
- **Purpose**: Increments or decrements stock levels.
- **Request Body**:
  ```json
  {
    "productId": "prod-1",
    "adjustment": -5
  }
  ```
- **Response (200)**

---

## 5. Orders Module (Mock)

### Get All Orders
- **Method**: `GET`
- **Endpoint**: `/orders`
- **Response (200)**

### Get Order by ID
- **Method**: `GET`
- **Endpoint**: `/orders/:id`
- **Parameters**: `id`
- **Response (200)**

### Create Order
- **Method**: `POST`
- **Endpoint**: `/orders`
- **Purpose**: Submits a new customer purchase order.
- **Request Body**:
  ```json
  {
    "items": [
      { "productId": "prod-1", "quantity": 3 },
      { "productId": "prod-2", "quantity": 1 }
    ]
  }
  ```
- **Response (201)**

### Update Order Status
- **Method**: `PUT`
- **Endpoint**: `/orders/:id/status`
- **Parameters**: `id`
- **Request Body**:
  ```json
  {
    "status": "completed"
  }
  ```
- **Response (200)**

---

## 6. Suppliers Module (Mock)

### Get All Suppliers
- **Method**: `GET`
- **Endpoint**: `/suppliers`
- **Response (200)**

### Get Supplier by ID
- **Method**: `GET`
- **Endpoint**: `/suppliers/:id`
- **Parameters**: `id`
- **Response (200)**

### Create Supplier
- **Method**: `POST`
- **Endpoint**: `/suppliers`
- **Request Body**:
  ```json
  {
    "name": "Super Tech Distributors",
    "contactName": "Frank Miller",
    "email": "frank@supertech.com",
    "phone": "+1-555-9999",
    "address": "404 Main Street, Seattle, WA"
  }
  ```
- **Response (201)**

### Update Supplier
- **Method**: `PUT`
- **Endpoint**: `/suppliers/:id`
- **Parameters**: `id`
- **Request Body**: Partials of creation body.
- **Response (200)**

### Delete Supplier
- **Method**: `DELETE`
- **Endpoint**: `/suppliers/:id`
- **Parameters**: `id`
- **Response (200)**

---

## 7. Dashboard Module (Mock)

### Get Main Summary metrics
- **Method**: `GET`
- **Endpoint**: `/dashboard/summary`
- **Response (200)**

### Get Sales Revenue charts metrics
- **Method**: `GET`
- **Endpoint**: `/dashboard/sales`
- **Response (200)**

### Get Inventory stock health metrics
- **Method**: `GET`
- **Endpoint**: `/dashboard/inventory`
- **Response (200)**

---

## 8. AI Module (Mock)

### Get AI Product pricing and inventory Insights
- **Method**: `POST`
- **Endpoint**: `/ai/product-analysis`
- **Request Body**:
  ```json
  {
    "productId": "prod-1",
    "name": "Wireless Mouse",
    "category": "Electronics",
    "stock": 12,
    "price": 15.00
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "AI product analysis complete (Mock)",
    "data": {
      "productId": "prod-1",
      "pricingStrategy": "Aggressive growth pricing",
      "suggestedRetailPrice": 18.75,
      "stockLevelRecommendation": "low",
      "insights": [
        "Stock level is currently low. Recommend checking restock thresholds.",
        "Suggested adjustment of price to $18.75 to optimize gross margins.",
        "Category demand for Electronics is showing positive upward growth trends."
      ]
    }
  }
  ```

### Get AI Product recommendations
- **Method**: `POST`
- **Endpoint**: `/ai/product-recommendation`
- **Request Body**:
  ```json
  {
    "productId": "prod-1"
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "AI recommendations generated (Mock)",
    "data": {
      "productId": "prod-1",
      "recommendations": [
        "Bundle with complementary items to increase basket size.",
        "Promote as a popular product on dashboard recommendations.",
        "Review supplier cost structures to identify potential procurement savings."
      ]
    }
  }
  ```

### Get AI Demand forecasting
- **Method**: `POST`
- **Endpoint**: `/ai/demand-prediction`
- **Request Body**:
  ```json
  {
    "productId": "prod-1",
    "historicalSales": [
      { "date": "2026-08-01", "quantity": 10 },
      { "date": "2026-08-10", "quantity": 15 },
      { "date": "2026-08-20", "quantity": 12 }
    ]
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "message": "AI demand forecasting complete (Mock)",
    "data": {
      "productId": "prod-1",
      "forecastPeriod": "Next 30 Days",
      "predictedDemand": 17,
      "confidenceScore": 0.85,
      "recommendation": "Plan a restock replenishment order of 50 units ahead of the peak mid-month sales cycle."
    }
  }
  ```
