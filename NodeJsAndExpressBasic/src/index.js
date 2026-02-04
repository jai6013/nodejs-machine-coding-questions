import express from "express";
// import fs from "fs";
import path from "path";
import fs from "fs/promises"

const app = express();
const PORT = 3000;

app.use(express.json());

const rateLimitStore = new Map();

// This fixed-window, in-memory rate limiter has burst issues at window boundaries, doesn’t scale across multiple instances, risks memory leaks, and is unsafe under concurrent requests. In production, I’d use Redis with atomic operations and a sliding window or token bucket algorithm.
const rateLimiter = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(400).json({ message: "User id missing" });
  }

  const currentTime = Date.now();
  const windowSize = 60 * 1000; // 1 minute
  const maxRequests = 5;

  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, {
      count: 1,
      startTime: currentTime,
    });
    return next();
  }

  const userData = rateLimitStore.get(userId);

  if (currentTime - userData.startTime < windowSize) {
    if (userData.count >= maxRequests) {
      return res.status(429).json({ message: "Rate limit exceeded" });
    }
    userData.count += 1;
  } else {
    // reset window
    userData.count = 1;
    userData.startTime = currentTime;
  }

  next();
};

app.use(rateLimiter);

const requestLogger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

app.use(requestLogger);

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
};

app.use(authMiddleware);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/error", (req, res) => {
  throw new Error("Something went wrong");
});

const validateUserMiddleware = (req, res, next) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return next(new Error("Invalid user data"));
  }

  req.user = { name, email };
  next();
};

app.post("/users", validateUserMiddleware, async (req, res, next) => {
  // Synchornously Adding User
  // const usersJsonFilePath = import.meta.dirname + "/users.json";
  // let users = JSON.parse(fs.readFileSync(usersJsonFilePath));
  // if (users.length) {
  //   users.push({ name: req.body.name, email: req.body.email });
  // } else {
  //   users = [{ name: req.body.name, email: req.body.email }];
  // }

  // fs.writeFileSync(usersJsonFilePath, JSON.stringify(users));

  // Asynchornously Adding User
  try {
    const usersJsonFilePath = path.join(import.meta.dirname, "users.json");

    // Read (handle missing file)
    let users = [];
    try {
      const fileData = await fs.readFile(usersJsonFilePath, "utf-8");
      users = fileData.trim() ? JSON.parse(fileData) : [];
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    // Create user (add id)
    const { name, email } = req.user;
    const newUser = {
      id: users.length ? users[users.length - 1].id + 1 : 1,
      name,
      email,
    };

    users.push(newUser);

    // Write back
    await fs.writeFile(usersJsonFilePath, JSON.stringify(users, null, 2));

    return res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(err.statusCode || 500)
    .json({ message: err.message || "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
