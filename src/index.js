import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const port = process.env.PORT || 5000;

const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");

const corsOptions = {
  origin: clientUrl,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions));
app.use(express.json());

const jwks = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: clientUrl,
      audience: clientUrl,
    });
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Invalid token" });
  }
}

const client = new MongoClient(process.env.MONGODB_URI);
let booksCollection;
let borrowsCollection;

async function connectDB() {
  if (booksCollection) return;
  await client.connect();
  const db = client.db("booknook");
  booksCollection = db.collection("books");
  borrowsCollection = db.collection("borrows");
  console.log("MongoDB connected");
}

app.use(async (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  try {
    await connectDB();
    next();
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Database connection failed" });
  }
});

app.get("/", (req, res) => {
  res.send({ message: "BookNook server is running" });
});

app.get("/books", async (req, res) => {
  const { sort, limit, email } = req.query;

  let query = {};
  if (email) {
    query = { "addedBy.email": email };
  }

  let cursor = booksCollection.find(query);
  if (sort === "newest") {
    cursor = cursor.sort({ createdAt: -1 });
  }
  if (limit) {
    cursor = cursor.limit(Number(limit));
  }

  const books = await cursor.toArray();
  res.send(books);
});

app.get("/books/:id", async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book id" });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) {
    return res.status(404).send({ message: "Book not found" });
  }
  res.send(book);
});

app.post("/books", verifyJWT, async (req, res) => {
  const book = req.body;
  if (!book.title || !book.author || !book.category) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  book.addedBy = { name: req.user.name, email: req.user.email };
  book.totalCopies = Number(book.totalCopies);
  book.createdAt = new Date();

  const result = await booksCollection.insertOne(book);
  res.send(result);
});

app.patch("/books/:id", verifyJWT, async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book id" });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) {
    return res.status(404).send({ message: "Book not found" });
  }
  if (book.addedBy.email !== req.user.email) {
    return res.status(403).send({ message: "Forbidden" });
  }

  const data = req.body;
  delete data.addedBy;
  delete data._id;
  if (data.totalCopies !== undefined) {
    data.totalCopies = Number(data.totalCopies);
  }

  const result = await booksCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: data },
  );
  res.send(result);
});

app.delete("/books/:id", verifyJWT, async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book id" });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) {
    return res.status(404).send({ message: "Book not found" });
  }
  if (book.addedBy.email !== req.user.email) {
    return res.status(403).send({ message: "Forbidden" });
  }

  const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post("/borrows", verifyJWT, async (req, res) => {
  const { bookId } = req.body;
  const userName = req.user.name;
  const userEmail = req.user.email;

  if (!ObjectId.isValid(bookId)) {
    return res.status(400).send({ message: "Invalid book id" });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
  if (!book) {
    return res.status(404).send({ message: "Book not found" });
  }

  if (book.totalCopies <= 0) {
    return res.status(400).send({ message: "Not Available" });
  }

  const alreadyBorrowed = await borrowsCollection.findOne({
    bookId: bookId,
    userEmail: userEmail,
  });
  if (alreadyBorrowed) {
    return res.status(400).send({ message: "You already borrowed this book" });
  }

  const borrowDate = new Date();
  const returnDate = new Date();
  returnDate.setDate(returnDate.getDate() + 7);

  const borrow = {
    bookId,
    bookTitle: book.title,
    bookImage: book.image,
    userName,
    userEmail,
    borrowDate,
    returnDate,
  };

  const result = await borrowsCollection.insertOne(borrow);

  await booksCollection.updateOne(
    { _id: new ObjectId(bookId) },
    { $inc: { totalCopies: -1 } },
  );

  res.send(result);
});

app.get("/borrows", verifyJWT, async (req, res) => {
  const borrows = await borrowsCollection
    .find({ userEmail: req.user.email })
    .toArray();
  res.send(borrows);
});

app.delete("/borrows/:id", verifyJWT, async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid borrow id" });
  }

  const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
  if (!borrow) {
    return res.status(404).send({ message: "Borrow not found" });
  }
  if (borrow.userEmail !== req.user.email) {
    return res.status(403).send({ message: "Forbidden" });
  }

  const result = await borrowsCollection.deleteOne({
    _id: new ObjectId(id),
  });

  await booksCollection.updateOne(
    { _id: new ObjectId(borrow.bookId) },
    { $inc: { totalCopies: 1 } },
  );

  res.send(result);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
