const express = require("express");
var cors = require("cors");

const bcrypt = require("bcryptjs");

require("dotenv").config();
const cloudinary = require("./config/cloudinary");
const multer = require("multer");
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

//multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
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
    const reportsCollection = myDB.collection("reports");
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

    //author lesson count
    app.get("/publicLesson/count", async (req, res) => {
      const { creatorEmail } = req.query;

      const count = await publicLessonCollection.countDocuments({
        creatorEmail,
      });
      res.json({ count });
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

    //get authoors lesson
    app.get("/publicLesson/user/:email", async (req, res) => {
      const { email } = req.params;

      const lessons = await publicLessonCollection
        .find({ creatorEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(lessons);
    });

    //overall performance statss
    app.get("/admin/dashboard/stats", async (req, res) => {
      const totalUsers = await userCollection.countDocuments();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const newUsersToday = await userCollection.countDocuments({
        createdAt: { $gte: todayStart },
      });
      const totalLessons = await publicLessonCollection.countDocuments();

      const newLessonsToday = await publicLessonCollection.countDocuments({
        createdAt: { $gte: todayStart },
      });

      const reportedLessons = await reportsCollection.distinct("lessonId", {
        status: "pending",
      });

      const engagement = await publicLessonCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalLikes: { $sum: "$likesCount" },
              totalFavorites: { $sum: "$favoritesCount" },
            },
          },
        ])
        .toArray();

      const topContributors = await publicLessonCollection
        .aggregate([
          {
            $group: {
              _id: "$creatorEmail",
              name: { $first: "$creatorName" },
              email: { $first: "$creatorEmail" },
              totalLessons: { $sum: 1 },
              totalLikes: { $sum: "$likesCount" },
              totalFavorites: { $sum: "$favoritesCount" },
            },
          },
          { $sort: { totalLessons: -1, totalLikes: -1 } },
          { $limit: 5 },
        ])
        .toArray();
      const todayLessons = await publicLessonCollection
        .find({ createdAt: { $gte: todayStart } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      res.json({
        success: true,
        totalUsers,
        newUsersToday,
        totalLessons,
        newLessonsToday,
        reportedLessons: reportedLessons.length,
        totalEngagement:
          (engagement[0]?.totalLikes || 0) +
          (engagement[0]?.totalFavorites || 0),
        topContributors,
        todayLessons,
      });
    });

    //growth data
    app.get("/admin/dashboard/growth", async (req, res) => {
      const days = parseInt(req.query.days) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const userGrowth = await userCollection
        .aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
          {
            $project: {
              _id: 0,
              date: "$_id",
              count: 1,
            },
          },
        ])
        .toArray();

      const lessonGrowth = await publicLessonCollection
        .aggregate([
          {
            $match: {
              createdAt: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
          {
            $project: {
              _id: 0,
              date: "$_id",
              count: 1,
            },
          },
        ])
        .toArray();

      const fillDates = (data) => {
        const filled = [];
        const currentDate = new Date(startDate);
        const endDate = new Date();

        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split("T")[0];
          const existing = data.find((d) => d.date === dateStr);
          filled.push({
            date: dateStr,
            count: existing ? existing.count : 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
        return filled;
      };

      res.json({
        success: true,
        userGrowth: fillDates(userGrowth),
        lessonGrowth: fillDates(lessonGrowth),
      });
    });

    //admin activity track
    app.get("/admin/activity/:email", async (req, res) => {
      const { email } = req.params;
      const stats = await adminActivityCollection
        .aggregate([
          { $match: { adminEmail: email } },
          {
            $group: {
              _id: null,
              totalActions: { $sum: 1 },
              lessonsModerated: {
                $sum: { $cond: [{ $eq: ["$actionType", "moderated"] }, 1, 0] },
              },
              reportsReviewed: {
                $sum: {
                  $cond: [{ $eq: ["$actionType", "report_reviewed"] }, 1, 0],
                },
              },
              contentDeleted: {
                $sum: { $cond: [{ $eq: ["$actionType", "deleted"] }, 1, 0] },
              },
            },
          },
        ])
        .toArray();

      const recentActivity = await adminActivityCollection
        .find({ adminEmail: email })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      res.json({
        success: true,
        totalActions: stats[0]?.totalActions || 0,
        lessonsModerated: stats[0]?.lessonsModerated || 0,
        reportsReviewed: stats[0]?.reportsReviewed || 0,
        contentDeleted: stats[0]?.contentDeleted || 0,
        recentActivity: recentActivity.map((a) => ({
          type: a.actionType,
          description: a.description,
          timestamp: a.createdAt,
        })),
      });
    });

    //get user for adminn manage
    app.get("/admin/users", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";
      const sortBy = req.query.sortBy || "createdAt";
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

      // Build search filter
      const searchFilter = search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      const total = await userCollection.countDocuments(searchFilter);

      const users = await userCollection
        .find(searchFilter)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      // Get lesson counts for each user
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const lessonCount = await publicLessonCollection.countDocuments({
            creatorEmail: user.email,
          });
          return {
            ...user,
            totalLessons: lessonCount,
          };
        })
      );

      res.json({
        success: true,
        users: usersWithStats,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    });

    //update user role
    app.put("/admin/users/:id/role", async (req, res) => {
      const { id } = req.params;
      const { role, adminEmail } = req.body;

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }

      const result = await userCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            role,
            updatedAt: new Date().toISOString(),
          },
        },
        { returnDocument: "after" }
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        message: `User role updated to ${role}`,
        user: result,
      });
    });

    //favorite count
    app.get("/publicLesson/favorites/count", async (req, res) => {
      const { userId } = req.query;
      const count = await favoritesCollection.countDocuments({ userId });
      res.json({ success: true, count });
    });

    //update profile
    app.put("/user/profile", async (req, res) => {
      const { email, name, image } = req.body;
      const updatedUser = await userCollection.findOneAndUpdate(
        { email },
        {
          $set: {
            name: name.trim(),
            image,
            updatedAt: new Date().toISOString(),
          },
        },
        { returnDocument: "after" }
      );

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await publicLessonCollection.updateMany(
        { creatorEmail: email },
        {
          $set: {
            creatorName: name.trim(),
            creatorPhoto: image,
          },
        }
      );

      res.json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      });
    });

    //update lesson by author
    app.put("/publicLesson/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      updateData.updatedAt = new Date().toISOString();

      const result = await publicLessonCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      res.json({ success: true, message: "Lesson updated successfully" });
    });

    //toggle visibilaty
    app.patch("/publicLesson/:id/visibility", async (req, res) => {
      const { id } = req.params;
      const { visibility } = req.body;

      const result = await publicLessonCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            visibility,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      res.json({ success: true, message: "Visibility updated successfully" });
    });

    //access level
    app.patch("/publicLesson/:id/accessLevel", async (req, res) => {
      const { id } = req.params;
      const { accessLevel } = req.body;
      const result = await publicLessonCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            accessLevel,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      res.json({ success: true, message: "Access level updated successfully" });
    });

    //image setup
    app.post("/upload-image", upload.single("image"), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "No image file provided",
          });
        }

        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataURI, {
          folder: "life-notes/lessons",
          resource_type: "auto",
          transformation: [
            { width: 1200, height: 800, crop: "limit" },
            { quality: "auto" },
            { fetch_format: "auto" },
          ],
        });

        res.json({
          success: true,
          message: "Image uploaded successfully",
          imageUrl: result.secure_url,
          publicId: result.public_id,
        });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to upload image",
          error: error.message,
        });
      }
    });

    //poost lesson
    app.post("/publicLesson", async (req, res) => {
      const {
        title,
        description,
        category,
        emotionalTone,
        image,
        imagePublicId,
        visibility,
        accessLevel,
        creatorId,
        creatorName,
        creatorEmail,
        creatorPhoto,
      } = req.body;

      const newLesson = {
        title: title.trim(),
        description: description.trim(),
        category,
        emotionalTone,
        image: image || null,
        imagePublicId: imagePublicId || null, // Store for deletion later
        visibility: visibility || "Public",
        accessLevel: accessLevel || "free",
        creatorId,
        creatorName: creatorName || "Anonymous",
        creatorEmail,
        creatorPhoto: creatorPhoto || null,
        likesCount: 0,
        favoritesCount: 0,
        commentsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await publicLessonCollection.insertOne(newLesson);

      if (result.insertedId) {
        res.status(201).json({
          success: true,
          message: "Lesson created successfully",
          lessonId: result.insertedId.toString(),
          lesson: {
            _id: result.insertedId,
            ...newLesson,
          },
        });
      } else {
        throw new Error("Failed to insert lesson");
      }
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

    //get favourites
    app.get("/favorites", async (req, res) => {
      const { userId } = req.query;

      const favorites = await favoritesCollection
        .find({ email: userId })
        .toArray();
      const favoritesWithDetails = await Promise.all(
        favorites.map(async (favorite) => {
          try {
            const lesson = await publicLessonCollection.findOne({
              _id: new ObjectId(favorite.lessonId),
            });

            return {
              _id: favorite._id.toString(),
              lessonId: favorite.lessonId,
              userId: favorite.userId,
              lessonTitle: lesson.title || "Unknown",
              lessonDescription: lesson.description || "",
              category: lesson.category || "Uncategorized",
              emotionalTone: lesson.emotionalTone || "Neutral",
              duration: lesson.duration || null,
              addedAt: favorite.favoritedAt || favorite.createdAt || new Date(),
            };
          } catch (err) {
            console.error("Error processing favorite:", err);
            return null;
          }
        })
      );

      const validFavorites = favoritesWithDetails.filter((f) => f !== null);

      res.json({
        success: true,
        favorites: validFavorites,
      });
    });

    //delete user
    app.delete("/admin/users/:id", async (req, res) => {
      const { id } = req.params;

      const user = await userCollection.findOne({ _id: new ObjectId(id) });

      await publicLessonCollection.deleteMany({ creatorEmail: user.email });

      await likesCollection.deleteMany({ email: user.email });

      await favoritesCollection.deleteMany({ email: user.email });

      await userCollection.deleteOne({ _id: new ObjectId(id) });

      res.json({
        success: true,
        message: "User and all their content deleted successfully",
      });
    });

    //delete favourite
    app.delete("/favorites/:favoriteId", async (req, res) => {
      const { favoriteId } = req.params;

      const { userId, lessonId } = req.body;

      const favorite = await favoritesCollection.findOne({
        _id: new ObjectId(favoriteId),
        email: userId,
      });

      if (!favorite) {
        return res.status(404).json({
          success: false,
          message: "Favorite not found or unauthorized",
        });
      }

      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(favoriteId),
      });

      await publicLessonCollection.updateOne(
        { _id: new ObjectId(lessonId) },
        { $inc: { favoritesCount: -1 } }
      );

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Failed to delete favorite",
        });
      }

      res.json({
        success: true,
        message: "Removed from favorites",
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

    //post repoort in monngo
    app.post("/reports", async (req, res) => {
      const {
        lessonId,
        lessonTitle,
        reporterId,
        reporterName,
        reporterEmail,
        reason,
        description,
      } = req.body;

      const reportDoc = {
        lessonId: new ObjectId(lessonId),
        lessonTitle: lessonTitle || "Untitled Lesson",
        reporterId: reporterId ? new ObjectId(reporterId) : null,
        reporterName: reporterName || "Anonymous",
        reporterEmail,
        reason,
        description: description || "",
        status: "pending",
        createdAt: new Date(),
      };
      const existing = await reportsCollection.findOne({
        lessonId: new ObjectId(lessonId),
        reporterEmail,
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You already reported this lesson",
        });
      }

      await reportsCollection.insertOne(reportDoc);

      res.status(201).json({
        success: true,
        message: "Report submitted successfully",
      });
    });

    //delete lessson
    app.delete("/publicLesson/:id", async (req, res) => {
      const { id } = req.params;
      // const { email } = req.body;

      await publicLessonCollection.deleteOne({ _id: new ObjectId(id) });
      res.json({ success: true, message: "Lesson deleted successfully" });
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
