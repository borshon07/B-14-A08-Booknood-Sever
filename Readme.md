# BookNook Server

Express.js and MongoDB REST API for **BookNook**, a small online library where users add a book, borrow a book and return a book.

## Live API

https://b-14-a08-booknood-sever.vercel.app

## Client Repository

Add your client GitHub link here.

**Live client:** https://a08-booknood-client.vercel.app

## API Routes

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/books` | Public | Get all books. Supports `sort=newest`, `limit` and `email` query |
| GET | `/books/:id` | Public | Get one book |
| POST | `/books` | JWT | Add a book |
| PATCH | `/books/:id` | JWT, owner only | Update a book |
| DELETE | `/books/:id` | JWT, owner only | Delete a book |
| POST | `/borrows` | JWT | Borrow a book |
| GET | `/borrows` | JWT | Get the borrows of the logged in user |
| DELETE | `/borrows/:id` | JWT, owner only | Return a book |

## Key Features

- **JWT protected routes:** Every write route and the borrow routes need a valid token.
- **Owner checks:** Only the user who added a book can edit or delete it. Only the user who borrowed a book can return it.
- **Available copies:** Borrowing decreases `totalCopies` by 1 and returning increases it by 1 using `$inc`.
- **Not Available:** A book with 0 copies cannot be borrowed.
- **No double borrow:** The same user cannot borrow the same book twice at the same time.
- **Identity from the token:** The user name and email are read from the JWT, so the client cannot fake them.
- **Strict CORS:** Only the BookNook client origin is allowed.

## Authentication Flow

1. The user logs in on the Next.js client with BetterAuth.
2. The client asks BetterAuth for a short-lived JWT.
3. The client sends it in the header: `Authorization: Bearer <token>`.
4. The server downloads the public keys from the client's `/api/auth/jwks` endpoint.
5. The server verifies the token signature, issuer and audience with `jose`.
6. On success, the user data is attached to `req.user` and the route continues. Otherwise the server returns `401`.

## Data Collections

- **books:** title, author, category, image, description, totalCopies, addedBy (name, email), createdAt
- **borrows:** bookId, bookTitle, bookImage, userName, userEmail, borrowDate, returnDate

## Tech Stack

- Node.js and Express.js
- MongoDB (official driver)
- jose (JWT verification)
- cors and dotenv
- Deployed on Vercel

## Environment Variables

Create a `.env` file in the project root:

```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:3000
```

`CLIENT_URL` must match the client's `BETTER_AUTH_URL` exactly, without a trailing slash.

## Run Locally

```bash
npm install
npm run dev
```

The server starts on http://localhost:5000

## Deployment

The server is deployed on Vercel. Set `MONGODB_URI` and `CLIENT_URL` (the live client URL) in the Vercel environment variables, and allow your IP (or `0.0.0.0/0`) in MongoDB Atlas Network Access.