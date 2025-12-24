const express = require("express");
var cors = require("cors");

const bcrypt = require("bcryptjs");

require("dotenv").config();
const app = express();
const port = process.env.PORT;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGO_URI;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//middlewares
app.use(express.json());
app.use(cors());
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const myDB = client.db("LifeNotes");
    const userCollection = myDB.collection("userInfo");
    const paymentCollection = myDB.collection("payments");
    const publicLessonCollection = myDB.collection("publicLesson");
    const likesCollection = myDB.collection("lessonLikes");
    const favoritesCollection = myDB.collection("lessonFavorites");
    // Send a ping to confirm a successful connection
    //###############-------user api----###############

    app.get("/userInfo", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // single user ---------------------
    app.get("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    });

    app.post("/userInfo", async (req, res) => {
      // console.log("Incoming user:", req.body);
      const {
        name,
        email,
        password,
        image = "https",
        provider = "user",
      } = req.body;
      const existingUser = await userCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      let user;

      if (provider === "google") {
        user = {
          name,
          email,
          image: image || null,
          provider: "google",
          role: "user",
          isPremium: false,
          createdAt: new Date().toISOString(),
        };
      } else {
        if (!password) {
          return res.status(400).json({
            success: false,
            message: "Password is required",
          });
        }

        const hashedPass = await bcrypt.hash(password, 10);
        user = {
          name,
          email,
          password: hashedPass,
          provider: "credentials",
          role: "user",
          isPremium: false,
          createdAt: new Date().toISOString(),
        };
      }

      const result = await userCollection.insertOne(user);
      res.send({ success: true, result });
    });

    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await userCollection.findOne({ email });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        user: userWithoutPassword,
      });
    });

    //lesson
    app.get("/publicLesson", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9;
      const skip = (page - 1) * limit;

      const { category, emotionalTone, sortBy, search } = req.query;

      let query = {};
      if (category && category !== "All") query.category = category;
      if (emotionalTone && emotionalTone !== "All")
        query.emotionalTone = emotionalTone;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      let sort = {};
      if (sortBy === "newest") sort = { createdAt: -1 };
      if (sortBy === "oldest") sort = { createdAt: 1 };
      if (sortBy === "mostSaved") sort = { favoritesCount: -1 };

      const total = await publicLessonCollection.countDocuments(query);
      const lessons = await publicLessonCollection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      res.json({
        lessons,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    });

    // Get single lesson by ID
    app.get("/publicLesson/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            error: "Invalid lesson ID",
          });
        }

        // Find the lesson
        const lesson = await publicLessonCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!lesson) {
          return res.status(404).json({
            success: false,
            error: "Lesson not found",
          });
        }
        //view count increase
        await publicLessonCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { viewsCount: 1 } }
        );

        res.json({
          success: true,
          lesson,
        });
      } catch (error) {
        console.error("Error fetching lesson:", error);
        res.status(500).json({
          success: false,
          error: "Failed to fetch lesson",
        });
      }
    });

    // check likes
    app.get("/publicLesson/:id/checkLike", async (req, res) => {
      const { id } = req.params;
      const { userId } = req.query;
      const existingLike = await likesCollection.findOne({
        lessonId: id,
        userId: userId,
      });

      res.json({
        success: true,
        isLiked: Boolean(existingLike),
      });
    });

    //addlikes

    app.post("/publicLesson/:id/like", async (req, res) => {
      const { id } = req.params;
      const { email, userId } = req.body;

      const existingLike = await likesCollection.findOne({
        lessonId: id,
        userId: userId,
      });
      if (existingLike) {
        // Unlike - Remove the like document
        await likesCollection.deleteOne({
          lessonId: id,
          userId: userId,
        });

        // Decrement like count
        await publicLessonCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { likesCount: -1 } }
        );

        return res.json({
          success: true,
          message: "Lesson unliked",
          action: "unliked",
        });
      } else {
        // Like - Add new like document
        await likesCollection.insertOne({
          lessonId: id,
          userId: userId,
          email: email,
          likedAt: new Date(),
        });

        // Increment like count
        await publicLessonCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { likesCount: 1 } }
        );

        return res.json({
          success: true,
          message: "Lesson liked",
          action: "liked",
        });
      }
    });

    // cjheck favooutirte
    app.get("/publicLesson/:id/checkFavorite", async (req, res) => {
      const { id } = req.params;
      const { userId } = req.query;
      const existingFavorite = await favoritesCollection.findOne({
        lessonId: id,
        userId: userId,
      });

      res.json({
        success: true,
        isFavorited: Boolean(existingFavorite),
      });
    });
    //add favcooutiee

    app.post("/publicLesson/:id/favorite", async (req, res) => {
      const { id } = req.params;
      const { email, userId } = req.body;
      const favoritesCollection = myDB.collection("lessonFavorites");
      const existingFavorite = await favoritesCollection.findOne({
        lessonId: id,
        userId: userId,
      });

      if (existingFavorite) {
        // Unfavorite - Remove the favorite document
        await favoritesCollection.deleteOne({
          lessonId: id,
          userId: userId,
        });

        // Decrement favorite count
        await publicLessonCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { favoritesCount: -1 } }
        );

        return res.json({
          success: true,
          message: "Removed from favorites",
          action: "unfavorited",
        });
      } else {
        // Favorite - Add new favorite document
        await favoritesCollection.insertOne({
          lessonId: id,
          userId: userId,
          email: email,
          favoritedAt: new Date(),
        });

        // Increment favorite count
        await publicLessonCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { favoritesCount: 1 } }
        );

        return res.json({
          success: true,
          message: "Added to favorites",
          action: "favorited",
        });
      }
    });

    //payment

    app.get("/users", async (req, res) => {
      try {
        const { email } = req.query;

        if (!email) {
          return res.status(400).json({ error: "Email is required" });
        }

        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    });

    app.post("/create-checkout-session", async (req, res) => {
      try {
        const { email, userId } = req.body;

        if (!email || !userId) {
          return res
            .status(400)
            .json({ error: "Email and userId are required" });
        }

        // Verify user exists
        const user = await userCollection.findOne({
          _id: new ObjectId(userId),
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Check if already premium
        if (user.isPremium) {
          return res.status(400).json({ error: "User is already premium" });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "Premium Lifetime Access",
                  description: "Unlock all premium features forever",
                },
                unit_amount: 1500, // $15.00 in cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}`,
          cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
          customer_email: email,
          metadata: {
            userId: userId,
            email: email,
            planType: "premium",
          },
        });

        res.json({ url: session.url });
      } catch (error) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({ error: "Failed to create checkout session" });
      }
    });

    // Verify Payment - This replaces the webhook
    app.post("/verify-payment", async (req, res) => {
      try {
        const { sessionId, userId } = req.body;

        if (!sessionId || !userId) {
          return res.status(400).json({
            success: false,
            message: "Session ID and User ID are required",
          });
        }

        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === "paid") {
          // Get user details
          const user = await userCollection.findOne({
            _id: new ObjectId(userId),
          });

          if (!user) {
            return res.status(404).json({
              success: false,
              message: "User not found",
            });
          }

          // Update user to premium
          await userCollection.updateOne(
            { _id: new ObjectId(userId) },
            {
              $set: {
                isPremium: true,
                premiumActivatedAt: new Date(),
                stripeSessionId: session.id,
              },
            }
          );

          // Store payment record
          const paymentHistory = {
            userId: userId,
            email: user.email,
            amount: session.amount_total / 100,
            currency: session.currency,
            paymentStatus: session.payment_status,
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            planType: "premium",
            paymentDate: new Date(),
            createdAt: new Date(),
          };

          await paymentCollection.insertOne(paymentHistory);

          console.log(`User ${user.email} upgraded to premium successfully`);

          res.json({
            success: true,
            message: "Payment verified and user upgraded to premium",
            payment: paymentHistory,
          });
        } else {
          res.status(400).json({
            success: false,
            message: "Payment not completed",
          });
        }
      } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({
          success: false,
          message: "Failed to verify payment",
        });
      }
    });

    // Verify premium status
    app.get("/verify-premium/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const user = await userCollection.findOne({
          _id: new ObjectId(userId),
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json({
          isPremium: user.isPremium || false,
          premiumActivatedAt: user.premiumActivatedAt || null,
        });
      } catch (error) {
        console.error("Error verifying premium status:", error);
        res.status(500).json({ error: "Failed to verify premium status" });
      }
    });

    // Get payment history
    app.get("/payment-history/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const payments = await paymentCollection
          .find({ email })
          .sort({ createdAt: -1 })
          .toArray();

        res.json(payments);
      } catch (error) {
        console.error("Error fetching payment history:", error);
        res.status(500).json({ error: "Failed to fetch payment history" });
      }
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
