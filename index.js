import "dotenv/config";
import express from "express";
import multer from "multer";
import axios from "axios";

// console.log("Key loaded:", Boolean(process.env.XAI_API_KEY));

const app = express();
const port = 3000;

app.use(express.static("public"));
app.set("view engine", "ejs");

const upload = multer({ storage: multer.memoryStorage() });

app.get("/", async (req, res) => {
  try {
    //   res.send('Hello World!');
    res.render("index.ejs");
  } catch (error) {
    console.error(error);
    res.status(500).send("cannot get");
  }
});

app.post("/upload", upload.single("receipt"), async (req, res) => {
  try {
    const photo = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${photo}`;

    // console.log(photo);

    const response = await axios.post(
      "https://api.x.ai/v1/responses",
      {
        model: "grok-4.7",
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: dataUrl },
              {
                type: "input_text",
                text: 'Read this receipt. Reply with only JSON: {"vendor": "", "total": 0, "items": [{"name": "", "price": 0}]}',
              },
            ],
          },
        ],
      },
      { headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` } },
    );
    const message = response.data.output.find(
      (item) => item.type === "message",
    );
    const answer = message.content[0].text;
    console.log(answer);
    res.send("Received");
  } catch (error) {
    console.log(error.response?.data);
  }
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
