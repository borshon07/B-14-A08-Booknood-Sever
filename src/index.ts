import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// mongodb connection
const client = new MongoClient(process.env.MONGODB_URI as string);

async function run() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");

    const db = client.db("booknook");
    const booksCollection = db.collection("books");
    const borrowsCollection = db.collection("borrows");

    // get all books (sort and limit support)
    app.get("/books", async (req, res) => {
      const { sort, limit } = req.query;

      let cursor = booksCollection.find();

      if (sort === "newest") {
        cursor = cursor.sort({ createdAt: -1 });
      }
      if (limit) {
        cursor = cursor.limit(Number(limit));
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    // get one book
    app.get("/books/:id", async (req, res) => {
      const id = req.params.id as string;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid book id" });
      }

      const result = await booksCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // add a book
    app.post("/books", async (req, res) => {
      const book = req.body;
      book.createdAt = new Date();
      const result = await booksCollection.insertOne(book);
      res.send(result);
    });

    // update a book
    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id as string;
      const updatedData = req.body;
      const result = await booksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.send(result);
    });

    // delete a book
    app.delete("/books/:id", async (req, res) => {
      const id = req.params.id as string;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid book id" });
      }

      const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
        // borrow a book
    app.post("/borrows", async (req, res) => {
      const { bookId, userName, userEmail } = req.body;

      if (!ObjectId.isValid(bookId)) {
        return res.status(400).send({ message: "Invalid book id" });
      }

      // find the book
      const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
      if (!book) {
        return res.status(404).send({ message: "Book not found" });
      }

      // no copies left
      if (book.totalCopies <= 0) {
        return res.status(400).send({ message: "Not Available" });
      }

      // no double borrow
      const alreadyBorrowed = await borrowsCollection.findOne({
        bookId: bookId,
        userEmail: userEmail,
      });
      if (alreadyBorrowed) {
        return res.status(400).send({ message: "You already borrowed this book" });
      }

      // return date = 7 days after borrow date
      const borrowDate = new Date();
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + 7);

      const borrow = {
        bookId: bookId,
        bookTitle: book.title,
        bookImage: book.image,
        userName: userName,
        userEmail: userEmail,
        borrowDate: borrowDate,
        returnDate: returnDate,
      };

      const result = await borrowsCollection.insertOne(borrow);

      // decrease copies by 1
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { totalCopies: -1 } }
      );

      res.send(result);
    });

    // get borrows of a user (temporary: email from query)
    app.get("/borrows", async (req, res) => {
      const email = req.query.email;
      const result = await borrowsCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    // return a book
    app.delete("/borrows/:id", async (req, res) => {
      const id = req.params.id as string;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid borrow id" });
      }

      const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
      if (!borrow) {
        return res.status(404).send({ message: "Borrow not found" });
      }

      const result = await borrowsCollection.deleteOne({ _id: new ObjectId(id) });

          // index for faster borrow check
    await borrowsCollection.createIndex({ bookId: 1, userEmail: 1 });
    await borrowsCollection.createIndex({ userEmail: 1 });

      // increase copies by 1
      await booksCollection.updateOne(
        { _id: new ObjectId(borrow.bookId) },
        { $inc: { totalCopies: 1 } }
      );

      res.send(result);
    });

  } catch (error) {
    console.dir(error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("BookNook server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
