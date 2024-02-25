import express from "express";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from 'uuid';
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 3000;
//Configure the use os .env file to harden database
env.config();

//TODO: add a user table to database for individual users after testing table for posts

//In order to integrate db, will need to rewrite functions and varibles from using posts array to using postsDB

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
// Define the posts array outside of the route handlers
var posts = [];

function generateUniqueId() {
  return uuidv4(); // Generate a random UUID
} 

app.get("/", (req, res) => {
  let getLatestPost = posts.length -1;

  let latestPost;
  //Determine if the post array is empty. If not, return latest addition to array, otherwise say there are no posts yet.
  if (getLatestPost >= 0){
    latestPost = posts[getLatestPost].title
  }else{
    latestPost = "No Posts Yet";
  }
  
  res.render("index.ejs", { posts : posts, latestPost: latestPost });
});

app.post("/", (req, res) => {
    const postId = req.body.postId;
  
    if (postId) {
      // Edit existing post
      const postIndex = posts.findIndex(post => post.id === postId);
      posts[postIndex].title = req.body.title;
      posts[postIndex].desc = req.body.description;
      posts[postIndex].blog = req.body.post;
    } else {
      // Create a new post
      const newPost = {
        id: generateUniqueId(), // You need to implement a function to generate unique IDs
        title: req.body.title,
        desc: req.body.description,
        blog: req.body.blog,
      };
  
      // Add the new post to the existing posts array
      posts.push(newPost);
    }
    
    res.redirect("/");
});
  
app.get("/edit/:postId", (req, res) => {
const postId = req.params.postId;

// Find the post with the given ID
const postToEdit = posts.find(post => post.id === postId);

// Render the edit form with the existing post data
res.render("edit.ejs", { post: postToEdit });
});

app.post("/update/:postId", (req, res) => {
const postId = req.params.postId;

// Find the index of the post with the given ID
const postIndex = posts.findIndex(post => post.id === postId);

// Update the post data with the new values
posts[postIndex].title = req.body.title;
posts[postIndex].desc = req.body.description;
posts[postIndex].blog = req.body.blog;

// Redirect to the home page or wherever you want after updating
res.redirect("/");

});

app.get("/delete/:postId", (req, res) => {
    const postId = req.params.postId;
  
    // Remove the post with the given ID from the posts array
    const updatedPosts = posts.filter(post => post.id !== postId);
    posts = updatedPosts;
  
    // Redirect to the home page or wherever you want after deletion
    res.redirect("/");
  });
  

app.listen(port, () => {
  console.log(`Listening on port ${port}.`);
});
