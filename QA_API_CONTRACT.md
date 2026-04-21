# Ridr QA API Contract

QA-ready API contract with required endpoints, required fields, and example payloads the app currently sends/expects.

## Global

- Base URL: `https://ridr-backend.vercel.app/api/v1`
- Auth header (protected routes): `Authorization: Bearer <accessToken>`
- JSON content type: `Content-Type: application/json`

---

## 1) Auth

### `POST /auth/register`

**Required body (app sends):**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "Melissa",
  "lastName": "Brown",
  "phone": "+18765550123"
}
```

**Response required by app:**

```json
{
  "user": {
    "id": "u_123",
    "email": "user@example.com",
    "username": "melissa.brown",
    "staffCode": "R001",
    "firstName": "Melissa",
    "lastName": "Brown",
    "phone": "+18765550123"
  },
  "accessToken": "jwt_access",
  "refreshToken": "jwt_refresh"
}
```

### `POST /auth/login`

App supports email login or staff/username login.

**Email-style request:**

```json
{
  "email": "user@example.com",
  "identifier": "user@example.com",
  "password": "password123"
}
```

**Staff-style request:**

```json
{
  "username": "R001",
  "staffCode": "R001",
  "identifier": "R001",
  "password": "password123"
}
```

**Response required by app:**

```json
{
  "user": {
    "id": "u_123",
    "email": "user@example.com",
    "username": "melissa.brown",
    "staffCode": "R001",
    "firstName": "Melissa",
    "lastName": "Brown",
    "phone": "+18765550123"
  },
  "accessToken": "jwt_access",
  "refreshToken": "jwt_refresh",
  "mustResetPassword": false,
  "passwordResetToken": "optional_temp_token"
}
```

### `POST /auth/refresh`

```json
{
  "refreshToken": "jwt_refresh"
}
```

**Response:**

```json
{
  "accessToken": "new_jwt_access",
  "refreshToken": "new_jwt_refresh"
}
```

### `POST /auth/forgot-password`

```json
{
  "email": "user@example.com"
}
```

### `POST /auth/reset-password`

```json
{
  "token": "reset_token",
  "password": "newPassword123"
}
```

---

## 2) User Profile + User Data

### `GET /users/me`

**Response fields app uses:**

```json
{
  "id": "u_123",
  "email": "user@example.com",
  "firstName": "Melissa",
  "lastName": "Brown",
  "phone": "+18765550123",
  "savedPlaces": [
    {
      "id": "sp_1",
      "type": "home",
      "label": "Home",
      "title": "Home",
      "address": "Kingston",
      "lat": 18.01,
      "lng": -76.79
    }
  ]
}
```

### `GET /users/me/activity?limit=50&cursor=&q=`

**Response:**

```json
{
  "items": [
    {
      "id": "act_1",
      "type": "ride",
      "title": "Trip completed",
      "subtitle": "Half Way Tree to Airport",
      "occurredAt": "2026-04-20T15:00:00.000Z",
      "time": "3:00 PM",
      "icon": "car",
      "emoji": null,
      "iconBg": null,
      "rideData": {
        "id": "ride_1",
        "serverRideRequestId": "ride_1",
        "from": "Half Way Tree",
        "to": "Airport",
        "date": "Apr 20",
        "price": "J$3,400",
        "driver": "Marcus W.",
        "rating": 5,
        "status": "completed"
      }
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

### `GET /users/me/favourites?routeLimit=10`

**Response:**

```json
{
  "savedPlaces": [
    {
      "id": "sp_1",
      "label": "home",
      "type": "home",
      "name": "Home",
      "title": "Home",
      "subtitle": "Apartment",
      "address": "Kingston",
      "lat": 18.01,
      "lng": -76.79,
      "placeId": "place_123",
      "isFavourite": true,
      "sortOrder": 1,
      "iconKey": "home"
    }
  ],
  "frequentRoutes": [
    {
      "id": "fr_1",
      "from": {
        "label": "Home",
        "address": "Kingston",
        "placeId": "place_home",
        "lat": 18.01,
        "lng": -76.79
      },
      "to": {
        "label": "Work",
        "address": "New Kingston",
        "placeId": "place_work",
        "lat": 18.02,
        "lng": -76.78
      },
      "rideCount": 12,
      "lastUsedAt": "2026-04-18T09:30:00.000Z"
    }
  ]
}
```

---

## 3) Payments

### `POST /payments/powertranz/tokenize`

```json
{
  "TransactionIdentifier": "txn-001",
  "TotalAmount": 100,
  "CurrencyCode": "388",
  "Tokenize": true,
  "ThreeDSecure": false,
  "OrderIdentifier": "order-001",
  "ExternalIdentifier": "ext-001",
  "Source": {
    "CardPan": "4242424242424242",
    "CardCvv": "123",
    "CardExpiration": "2512",
    "CardholderName": "Melissa Brown"
  }
}
```

### `GET /users/me/payment-methods`

**Response:**

```json
{
  "paymentMethods": [
    {
      "id": "pm_1",
      "provider": "powertranz",
      "last4": "4242",
      "brand": "Visa",
      "expiryMonth": "12",
      "expiryYear": "2028",
      "isDefault": true,
      "createdAt": "2026-04-20T12:00:00.000Z",
      "updatedAt": "2026-04-20T12:00:00.000Z"
    }
  ]
}
```

### `POST /users/me/payment-methods`

```json
{
  "provider": "powertranz",
  "token": "tok_abc123",
  "last4": "4242",
  "brand": "Visa",
  "expiryMonth": "12",
  "expiryYear": "2028",
  "isDefault": true
}
```

### `PATCH /users/me/payment-methods/:id`

```json
{
  "isDefault": true,
  "expiryMonth": "10",
  "expiryYear": "2029",
  "brand": "Visa"
}
```

### `DELETE /users/me/payment-methods/:id`

No body.

---

## 4) Rides

### `POST /rides/estimate`

```json
{
  "rideTypeSlug": "xlcab-go",
  "distanceKm": 12.3,
  "durationMinutes": 24,
  "insurance": false,
  "pickup": {
    "address": "Half Way Tree",
    "lat": 18.012,
    "lng": -76.793,
    "placeId": "optional_place_id"
  },
  "dropoff": {
    "address": "Norman Manley Airport",
    "lat": 17.935,
    "lng": -76.787,
    "placeId": "optional_place_id"
  }
}
```

### `POST /rides`

Important endpoint with metadata.

```json
{
  "rideTypeSlug": "xlcab-go",
  "serviceCategory": "ride",
  "serviceArea": "JM",
  "sessionId": "optional_session_id",
  "bookedFor": "self",
  "pickup": {
    "address": "Half Way Tree",
    "lat": 18.012,
    "lng": -76.793,
    "placeId": "optional_place_id"
  },
  "dropoff": {
    "address": "Airport",
    "lat": 17.935,
    "lng": -76.787,
    "placeId": "optional_place_id"
  },
  "route": {
    "encodedPolyline": "optional_polyline",
    "distanceMeters": 12340,
    "durationSeconds": 1440
  },
  "distanceKm": 12.3,
  "durationMinutes": 24,
  "immediate": true,
  "preferences": {
    "womanDriver": false,
    "wheelchair": false,
    "babySeat": false
  },
  "addons": {
    "rideInsurance": false
  },
  "payment": {
    "method": "card",
    "paymentMethodId": "pm_1",
    "label": "Visa •••• 4242"
  },
  "metadata": {
    "platform": "ios",
    "appVersion": "1.0.0"
  }
}
```

`metadata.platform` can be `ios`, `android`, or `webapp`.

### `GET /rides`

No body.

### `GET /rides/:id`

No body.

### `PATCH /rides/:id/cancel`

No body.

### `POST /rides/:id/rate`

```json
{
  "rating": 5,
  "review": "Great ride"
}
```

---

## 5) Driver Lookup

### `GET /drivers/nearby?lat=18.0179&lng=-76.8099&radiusKm=5`

No body; requires auth.

### `POST /drivers/application`

Submit driver onboarding documents as `multipart/form-data` with auth:

- `documents[0][category]`: `license | qualification | vehicle`
- `documents[0][file]`: binary file (`pdf`, `doc`, `docx`, `jpg`, `png`)
- Repeat indexes up to 4 docs total.

Expected success response:

```json
{
  "applicationId": "drv_app_67f6c5f8a7d21e4f0ad1b2c3",
  "status": "pending_review",
  "user": {
    "id": "usr_01J9X8A3T4GQ6M2ZP1V7B9C8D",
    "role": "user"
  },
  "message": "Application received and pending review."
}
```

If approved immediately (or after admin review), return:

```json
{
  "applicationId": "drv_app_67f6c5f8a7d21e4f0ad1b2c3",
  "status": "approved",
  "user": {
    "id": "usr_01J9X8A3T4GQ6M2ZP1V7B9C8D",
    "role": "driver"
  },
  "message": "Driver profile approved."
}
```

---

## Notes For QA / Backend

- `POST /auth/login` should handle both email and staff-code login payload variants.
- `POST /auth/login` should include `user.role` (`user` or `driver`) so client can gate Rider vs Driver mode.
- `POST /auth/refresh` must always return both new tokens.
- Protected routes must return `401` on expired access token so client refresh flow runs.
- `GET /users/me` is required for profile hydration in-app.
