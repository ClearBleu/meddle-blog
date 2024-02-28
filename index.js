import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

//TODO: Add user log in page and authentication routes on backend
//TODO: Link user table and posts to identify which posts were made by each user and sort according to user
//TODO: add try-catch blocks for error handling on GET and POST routes to /posts
//TODO: Add password confirmation functionality when registering new user

const app = express();
const port = 3000;
const saltRounds = 10;
//Configure the use os .env file to harden database
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000  * 60 * 60 *24,
    },
  })
);

//Create database instance using variables from .env
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("styles"));
app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  const copyDate = new Date().getFullYear()
  res.render("index.ejs", {copyDate});
});

app.post(
  "/",
  passport.authenticate("local", {
    successRedirect: "/posts",
    failureRedirect: "/",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.redirect("/");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/posts");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.get("/register", (req, res) => {
  const copyDate = new Date().getFullYear()
  res.render("register.ejs", {copyDate});
});

app.get("/posts", async (req, res) => {
  //List posts in chronological order
  let posts = await db.query("SELECT * FROM public.posts ORDER BY post_id DESC")
  res.render("posts.ejs", { posts : posts.rows});
});

// app.get(
//   "/auth/google",
//   passport.authenticate("google", {
//     scope: ["profile", "email"],
//   })
// );

// app.get(
//   "/auth/google/posts",
//   passport.authenticate("google", {
//     successRedirect: "/posts",
//     failureRedirect: "/",
//   })
// );

app.post("/posts", async (req, res) => {
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
    
  res.redirect("/posts");
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
    res.redirect("/posts");
  
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
    res.redirect("/posts");
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).send("Error deleting post");
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

//TODO:Activate get info from google dev portal

// passport.use(
//   "google",
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "http://localhost:3000/auth/google/secrets",
//       userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
//     },
//     async (accessToken, refreshToken, profile, cb) => {
//       try {
//         console.log(profile);
//         const result = await db.query("SELECT * FROM users WHERE email = $1", [
//           profile.email,
//         ]);
//         if (result.rows.length === 0) {
//           const newUser = await db.query(
//             "INSERT INTO users (email, password) VALUES ($1, $2)",
//             [profile.email, "google"]
//           );
//           return cb(null, newUser.rows[0]);
//         } else {
//           return cb(null, result.rows[0]);
//         }
//       } catch (err) {
//         return cb(err);
//       }
//     }
//   )
// );

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}.`);
});
