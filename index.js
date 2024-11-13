import snoowrap from "snoowrap";
import https from "https";
import fs from "fs";
import { TwitterApi } from "twitter-api-v2";
import { config } from "dotenv";
import express from "express";
const app = express();

config();

// Reddit credentials
const reddit = new snoowrap({
  userAgent: process.env.USER_AGENT || "",
  clientId: process.env.CLIENT_ID || "",
  clientSecret: process.env.CLIENT_SECRET || "",
  username: process.env.USER_NAME || "",
  password: process.env.PASSWORD || "",
});

async function deletePicture(fileName) {
  fs.unlink(fileName, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    } else {
      console.log(`File ${fileName} deleted successfully.`);
    }
  });
}

// let previousUrl = "";

async function getPicture() {
  const r = { success: false, fileName: "", text: "" };
  const subReddit = process.env.SUB_REDDIT;
  return reddit
    .getSubreddit(subReddit)
    .getNew({ limit: 1 })
    .then((posts) => {
      if (posts.length > 0) {
        const post = posts[0];
        const imageUrl = post.url; // Get the image URL from the post
        const text = post.title;
        console.log(`Image URL: ${imageUrl}`);

        // Download the image if it has a valid extension
        if (
          imageUrl.endsWith(".jpg") ||
          imageUrl.endsWith(".png") ||
          imageUrl.endsWith(".jpeg")
          //   imageUrl !== previousUrl
        ) {
          const fileName = "meme.jpg";
          const file = fs.createWriteStream(fileName);
          //   previousUrl = imageUrl;
          return new Promise((resolve, reject) => {
            https
              .get(imageUrl, (response) => {
                response.pipe(file);
                file.on("finish", () => {
                  file.close(() => {
                    r.fileName = fileName;
                    r.success = true;
                    r.text = text;
                    console.log("Image downloaded successfully.");
                    resolve(r);
                  });
                });
              })
              .on("error", (err) => {
                fs.unlink(fileName, () => {
                  console.error("Error downloading image:", err);
                });
                reject(err);
              });
          });
        } else {
          console.log("No image found in the post.");
          return r;
        }
      } else {
        console.log("No posts found.");
        return r;
      }
    })
    .catch((err) => {
      console.error("Error fetching posts:", err);
      return r;
    });
}

async function uploadMeme() {
  const r = { success: false, message: "something wrong" };
  try {
    const { fileName, success, text } = await getPicture(); // Download image
    console.log(fileName, success, text);

    if (!success) {
      console.log("Download failed");
      return;
    } // Exit if download fails
    console.log("start");
    const appKey = process.env.APP_KEY;
    const appSecret = process.env.APP_SECRECT;
    const accessToken = process.env.ACCESS_TOKEN;
    const accessSecret = process.env.ACCESS_SECRECT;
    if (!appKey || !appSecret || !accessToken || !accessSecret) {
      console.log(
        "Please set the environment variables APP_KEY, APP_SECRECT, ACCESS_TOKEN, ACCESS_SECRECT"
      );
      return;
    }

    const twitterClient = new TwitterApi({
      appKey,
      appSecret,
      accessSecret,
      accessToken,
    });
    const rwClient = twitterClient.readWrite;

    const mediaId = await rwClient.v1.uploadMedia(fileName);

    await rwClient.v2.tweetThread([
      {
        media: { media_ids: [mediaId] },
        text,
      },
    ]);

    console.log("upload the meme successfully");
    r.success = true;
    r.message = "upload the meme successfully";
    await deletePicture(fileName);
  } catch (error) {
    console.log(error);
  }

  return r;
}

// function main() {
//   // const hrs = 0.18;
//   uploadMeme();
//   // setInterval(() => {
//   //   uploadMeme();
//   // }, hrs * 60 * 60 * 1000);
// }

// main();

app.get("/", async (req, res) => {
  const response = await uploadMeme();
  res.json(response);
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
