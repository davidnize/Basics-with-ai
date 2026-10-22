import "dotenv/config";
import express from "express";
import multer from "multer";
import axios from "axios";
import crypto from "node:crypto";

import {
  initializeDatabase,
  findUserByEmail,
  createUser,
  findSession,
  createSession,
  deleteSession,
  createReceipt,
  listReceiptsByUser,
  createStockBatch,
  listStockBatchesByUser,
  closeDatabase,
} from "./db.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
});

// --------------------
// Small helper functions
// --------------------

function getSessionId(req) {
  const cookies = req.headers.cookie || "";
  const sessionCookie = cookies
    .split(";")
    .find((cookie) => cookie.trim().startsWith("session="));

  if (!sessionCookie) return null;

  return sessionCookie.trim().split("=")[1];
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return {
    salt,
    hash,
  };
}

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) {
    return res.redirect("/login");
  }

  next();
}

function renderSalesError(res, message, status = 400) {
  return res.status(status).render("routes/sales.ejs", {
    activePage: "sales",
    Vendor: "",
    Total: "",
    Items: [],
    error: message,
  });
}

// --------------------
// Check the logged-in user
// --------------------

app.use(async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);

    if (sessionId) {
      res.locals.currentUser = await findSession(sessionId);
    } else {
      res.locals.currentUser = null;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// --------------------
// Home
// --------------------

app.get("/", (req, res) => {
  res.render("index.ejs", {
    activePage: "home",
  });
});

// --------------------
// Sales
// --------------------

app.get("/sales", (req, res) => {
  res.render("routes/sales.ejs", {
    activePage: "sales",
    Vendor: "",
    Total: "",
    Items: [],
    error: "",
  });
});


// Upload receipt and ask Gemini to read it.
app.post("/upload", upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) {
      return renderSalesError(res, "Please choose a receipt image.");
    }

    if (!process.env.GEMINI_API_KEY) {
      return renderSalesError(
        res,
        "GEMINI_API_KEY is missing from your environment variables.",
        503,
      );
    }

    const image = req.file.buffer.toString("base64");

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: req.file.mimetype,
                  data: image,
                },
              },
              {
                    text: 'Read this receipt. Reply with only JSON: {"vendor":"","total":0,"tax":0,"items":[{"name":"","price":0}]}. "tax" is the total tax, VAT or service fee printed on the receipt, or 0 if there is none. Do not list tax as an item.',
  
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      },
      {
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );

    const parts = response.data.candidates?.[0]?.content?.parts || [];

    const text = parts
      .filter((part) => part.text && !part.thought)
      .map((part) => part.text)
      .join("");

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    const cleanText = text
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const receipt = JSON.parse(cleanText);
        console.log("Parsed receipt:", receipt);

    res.render("routes/sales.ejs", {
      activePage: "sales",
      Vendor: receipt.vendor || "",
      Total: receipt.total ?? "",
      Items: Array.isArray(receipt.items) ? receipt.items : [],
      error: "",
    });
  } catch (error) {
    console.error(
      "Receipt scanning failed:",
      error.response?.status,
      error.response?.data || error.message,
    );

    return renderSalesError(
      res,
      "We could not read that receipt. Check the server logs.",
      502,
    );
  }
});
// Upload receipt and ask Grok to read it.
// app.post("/upload", upload.single("receipt"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return renderSalesError(res, "Please choose a receipt image.");
//     }

//     if (!process.env.XAI_API_KEY) {
//       return renderSalesError(
//         res,
//         "XAI_API_KEY is missing from your .env file.",
//         503,
//       );
//     }

//     const image = req.file.buffer.toString("base64");
//     const imageUrl = `data:${req.file.mimetype};base64,${image}`;

//     const response = await axios.post(
//       "https://api.x.ai/v1/responses",
//       {
//         model: "grok-4.7",
//         input: [
//           {
//             role: "user",
//             content: [
//               {
//                 type: "input_image",
//                 image_url: imageUrl,
//               },
//               {
//                 type: "input_text",
//                                 text: 'Read this receipt. Reply with only JSON: {"vendor":"","total":0,"tax":0,"items":[{"name":"","price":0}]}. "tax" is the total tax, VAT or service fee printed on the receipt, or 0 if there is none. Do not list tax as an item.',
//               },
//             ],
//           },
//         ],
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.XAI_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       },
//     );

//     const message = response.data.output.find(
//       (item) => item.type === "message",
//     );

//     const text = message?.content?.[0]?.text;

//     if (!text) {
//       throw new Error("Grok returned an empty response.");
//     }

//     const cleanText = text
//       .replace(/^```json\s*/i, "")
//       .replace(/\s*```$/i, "")
//       .trim();

//     const receipt = JSON.parse(cleanText);

//     res.render("routes/sales.ejs", {
//       activePage: "sales",
//       Vendor: receipt.vendor || "",
//       Total: receipt.total ?? "",
//       Tax: receipt.tax ?? "",
//       Items: Array.isArray(receipt.items) ? receipt.items : [],
//       error: "",
//     });
//   } catch (error) {
//     console.error(
//         "Receipt scanning failed:",
//         error.response?.status,
//         error.response?.data || error.message
//     );

//     return renderSalesError(
//         res,
//         "We could not read that receipt. Check the server logs.",
//         502
//     );
//   }
// });

// Save the scanned receipt.
app.post("/sales/save", requireLogin, async (req, res, next) => {
  try {
    const { vendor = "", total = "", tax = "", items = "[]" } = req.body;

    const parsedItems = JSON.parse(items);

    const receiptItems = Array.isArray(parsedItems)
      ? parsedItems.map((item) => ({
          id: crypto.randomUUID(),
          name: item.name,
          price: item.price,
        }))
      : [];

    await createReceipt({
      id: crypto.randomUUID(),
      userId: res.locals.currentUser.user_id,
      vendor: vendor.trim(),
      total,
      tax,
      items: receiptItems,
    });

    res.redirect("/history");
  } catch (error) {
    next(error);
  }
});

// --------------------
// Stock
// --------------------

app.get("/stock", async (req, res, next) => {
  try {
    const batches = res.locals.currentUser
      ? await listStockBatchesByUser(res.locals.currentUser.user_id)
      : [];

    const today = new Date();

    const attentionCount = batches.filter((batch) => {
      const lowStock = Number(batch.quantity) <= 5;

      if (!batch.expiresAt) {
        return lowStock;
      }

      const daysLeft = Math.ceil(
        (new Date(batch.expiresAt) - today) / (1000 * 60 * 60 * 24),
      );

      return lowStock || daysLeft <= 7;
    }).length;

    res.render("routes/stock.ejs", {
  activePage: "stock",
  batches,
  attentionCount,
  formError: "",
  formValues: {},
});
  } catch (error) {
    next(error);
  }
});

app.post("/stock", requireLogin, async (req, res, next) => {
  const {
    productName = "",
    supplier = "",
    quantity = "",
    unit = "piece",
    purchasePrice = "",
    sellingPrice = "",
    suppliedAt = "",
    expiresAt = "",
  } = req.body;

  if (!productName.trim() || Number(quantity) <= 0 || !suppliedAt) {
    const batches = await listStockBatchesByUser(
      res.locals.currentUser.user_id,
    );

    return res.status(400).render("routes/stock.ejs", {
      activePage: "stock",
      batches,
      attentionCount: 0,
      formError: "Add a product, quantity and supply date.",
      formValues: req.body,
    });
  }

  try {
    await createStockBatch({
      id: crypto.randomUUID(),
      userId: res.locals.currentUser.user_id,
      productName: productName.trim(),
      supplier: supplier.trim(),
      quantity: Number(quantity),
      unit,
      purchasePrice,
      sellingPrice,
      suppliedAt,
      expiresAt,
    });

    res.redirect("/stock");
  } catch (error) {
    next(error);
  }
});

// --------------------
// History
// --------------------

app.get("/history", async (req, res, next) => {
  try {
    const receipts = res.locals.currentUser
      ? await listReceiptsByUser(res.locals.currentUser.user_id)
      : [];

    res.render("routes/history.ejs", {
      activePage: "history",
      receipts,
    });
  } catch (error) {
    next(error);
  }
});

// --------------------
// Sign up
// --------------------

app.get("/sign-up", (req, res) => {
  if (res.locals.currentUser) {
    return res.redirect("/sales");
  }

  res.render("routes/sign-up.ejs", {
    activePage: "sign-up",
    error: "",
    success: "",
    name: "",
    email: "",
  });
});

app.post("/sign-up", async (req, res) => {
  const {
    name = "",
    email = "",
    password = "",
  } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  if (!name.trim() || !normalizedEmail || !password) {
    return res.status(400).render("routes/sign-up.ejs", {
      activePage: "sign-up",
      error: "Please complete every field.",
      success: "",
      name,
      email,
    });
  }

  if (password.length < 8) {
    return res.status(400).render("routes/sign-up.ejs", {
      activePage: "sign-up",
      error: "Your password must be at least 8 characters.",
      success: "",
      name,
      email,
    });
  }

  try {
    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(400).render("routes/sign-up.ejs", {
        activePage: "sign-up",
        error: "An account with that email already exists.",
        success: "",
        name,
        email,
      });
    }

    const { salt, hash } = hashPassword(password);

    await createUser({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
    });

    res.render("routes/sign-up.ejs", {
      activePage: "sign-up",
      error: "",
      success: "Your account was created successfully.",
      name: "",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Sign-up error:", error);
    res.status(500).render("routes/sign-up.ejs", {
      activePage: "sign-up",
      error: "Something went wrong while creating your account.",
      success: "",
      name,
      email,
    });
  }
});

// --------------------
// Login
// --------------------

app.get("/login", (req, res) => {
  if (res.locals.currentUser) {
    return res.redirect("/sales");
  }

  res.render("routes/login.ejs", {
    activePage: "login",
    error: "",
    email: "",
  });
});

app.post("/login", async (req, res) => {
  const {
    email = "",
    password = "",
  } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).render("routes/login.ejs", {
        activePage: "login",
        error: "Email or password is incorrect.",
        email,
      });
    }

    const { hash } = hashPassword(password, user.password_salt);

    const passwordMatches = crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(user.password_hash, "hex"),
    );

    if (!passwordMatches) {
      return res.status(401).render("routes/login.ejs", {
        activePage: "login",
        error: "Email or password is incorrect.",
        email,
      });
    }

    const sessionId = crypto.randomUUID();

    await createSession({
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.setHeader(
      "Set-Cookie",
      `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    );

    res.redirect("/sales");
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).render("routes/login.ejs", {
      activePage: "login",
      error: "Something went wrong while logging in.",
      email,
    });
  }
});

// --------------------
// Logout
// --------------------

app.post("/logout", async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);

    if (sessionId) {
      await deleteSession(sessionId);
    }

    res.setHeader(
      "Set-Cookie",
      "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );

    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// --------------------
// Start the server
// --------------------

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not start the server:", error);
  });

// Basic error handler.
app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).send("Something went wrong.");
});
