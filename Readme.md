# BookNook Server

Express.js and MongoDB API for BookNook.

Live API: https://b-14-a08-booknood-sever.vercel.app

## Routes

- `GET /books` get all books (public, supports sort, limit and email)
- `GET /books/:id` get one book
- `POST /books` add a book (JWT)
- `PATCH /books/:id` update a book (JWT, owner only)
- `DELETE /books/:id` delete a book (JWT, owner only)
- `POST /borrows` borrow a book (JWT)
- `GET /borrows` get the borrows of the logged in user (JWT)
- `DELETE /borrows/:id` return a book (JWT)