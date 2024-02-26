import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 3000;

//Configure the use os .env file to harden database
env.config();

//TODO: Link user table and posts to identify which posts were made by each user and sort according to user

//TODO: add try-catch blocks for error handling

//Create database instance using .env variables
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("styles"))

app.get("/", async (req, res) => {
  //List posts in chronological order
  let posts = await db.query("SELECT * FROM public.posts ORDER BY post_id DESC")
  res.render("index.ejs", { posts : posts.rows});
});

app.post("/", async (req, res) => {
  //Timestamp each post and record in database
  const timeStamp ="Posted: " + new Date().toLocaleString('en-US')
  

  // Create a new post
  const newPost = {
    title: req.body.title,
    desc: req.body.description,
    body: req.body.body,
    time: timeStamp
  };
  // Add the new post to the posts table
  const result = await db.query("INSERT INTO posts (title, description, body, time) VALUES ($1, $2, $3,$4) RETURNING *",
    [newPost.title, newPost.desc, newPost.body, newPost.time])
    
  res.redirect("/");
});

app.get("/edit/:post_id", async (req, res) => {
  // Find the post with the given ID
  try {
    //Corrects strange error that occurs with NodeJS and Postgres where NaN is passed as an integer. Was interrupting the query. This fixes that
    //See this post for more information: https://stackoverflow.com/questions/76474696/api-created-using-nodejs-express-and-ejs-files-crashes-when-trying-to-fetch-da/76476887#76476887
    const editPostId = parseInt(req.params.post_id, 10);
    if (Number.isInteger(editPostId)) {
      const postToEdit = await db.query("SELECT * FROM public.posts WHERE post_id = $1", [editPostId]);

      // Render the edit form with the existing post data
      res.render("edit.ejs", { post: postToEdit.rows[0] });
    }else{
      return res.status(404).send("Post not found");
    }

  } catch (err) {
    console.error("Error retrieving post:", err);
    res.status(500).send("Error retrieving post");
  }
});

app.post("/update/:post_id", async (req, res) => {
  try {
     const postID = req.params.post_id
    
    const newTitle = req.body.title;
    const newDesc = req.body.description;
    const newBody = req.body.body;
    const newTime = "edited: " + new Date().toLocaleString('en-US');
    
    //Find post to update
    const postToEdit = await db.query("SELECT * FROM public.posts WHERE post_id = $1;", [postID]);

    if (postToEdit.rows.length === 0) {
      return res.status(404).send("Post not found");
    }

    // Update the post data with the new values
    const editedValues = await db.query("UPDATE posts SET title = $1, description = $2, body = $3, time = $4 WHERE post_id = $5;", [newTitle, newDesc, newBody, newTime, postID])

    // Redirect to the home page after updating
    res.redirect("/");
  
  } catch (err) {
    console.error("Error retrieving post:", err);
    res.status(500).send("Error retrieving post");
  }
});

app.get("/delete/:post_id", async (req, res) => {
  try {
    const postId = req.params.post_id;
    
    // Select correct post to delete
    const postToDelete = await db.query("SELECT * FROM public.posts WHERE post_id = $1", [postId]);
    
    // Check if post exists, if not throw error
    if (postToDelete.rows.length === 0) {
      return res.status(404).send("Post not found");
    }

    // Delete the post
    await db.query("DELETE FROM public.posts WHERE post_id = $1", [postId]);

    // Redirect to the home page after deletion
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).send("Error deleting post");
  }
});
  

app.listen(port, () => {
  console.log(`Listening on port ${port}.`);
});
