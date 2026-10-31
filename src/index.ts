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
