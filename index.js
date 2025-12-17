const express = require("express");
var cors = require("cors");

const bcrypt = require("bcryptjs");

require("dotenv").config();
const app = express();
const port = process.env.PORT;
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_URI;
//middlewares
app.use(express.json());
app.use(cors());
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const myDB = client.db("LifeNotes");
    const userCollection = myDB.collection("userInfo");
    // Send a ping to confirm a successful connection
    //###############-------user api----###############

    app.get("/userInfo", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/userInfo", async (req, res) => {
      const { name, email, password } = req.body;
      const hashedPass = await bcrypt.hash(password, 10);
      const user = {
        name,
        email,
        password: hashedPass,
        role: "user",
        createdAt: new Date().toISOString(),
      };
      const result = await userCollection.insertOne(user);

      res.send({ success: true, result });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      `Pinged your deployment. You successfully connected to MongoDB! ${port}`
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
