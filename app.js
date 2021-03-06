// Requiring npm modules
require("dotenv").config();
const express=require("express");
const ejs=require("ejs");
const bodyParser=require("body-parser");
const mongoose=require("mongoose");
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app=express();

// Setting the app the use the modules
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine","ejs");
app.use(express.static("public"));
app.use(session({
    secret: process.env.SECRETS,
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb+srv://'+process.env.USERNAME_MONGODB+':'+process.env.PASSWORD+'@cluster0.kc503.mongodb.net/userDB',{useNewUrlParser: true, useUnifiedTopology:true});
mongoose.set("useCreateIndex",true);

//Creating the model for the DB
const userSchema= new mongoose.Schema({
    email:    String,
    password: String,
    googleId: String,
    secret: String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User= mongoose.model("User",userSchema);

//Passport strategy, serialize and deserialize (create delete cookies)
passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {   
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

// set up strategy google
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
    });
  }
));

// Get Secrets routes
app.get("/",function (req,res) {
    res.render("home");
});

app.get("/login",function (req,res) {
    res.render("login");
});

app.get("/register",function (req,res) {
    res.render("register");
});

app.get("/secrets",function (req,res) {
    User.find({secret: {$ne: null}},function (err,users) {
        if (!err) {
            if (users) {
                res.render("secrets",{usersSecrets:users})
            }
        } else {
            console.log(err);
        }
    })
});

app.get("/submit",function (req,res) {
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
});

app.get("/logout",function (req,res) {
    req.logout();
    res.redirect("/");
});

// Get log in with Google
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/secrets",  
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
});

app.post("/register",function (req,res) {
    User.register({username: req.body.username}, req.body.password,function(err,user){
        if (!err) {
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            })
        } else {
            console.log(err);
            res.redirect("/register");
        }
    });
});

app.post("/login",function(req,res){
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (!err) {
            passport.authenticate("local")(req,res,function () {
                res.redirect("/secrets");
            });
        } else {
            console.log(err);
        }
    })
});

app.post("/submit",function (req,res) {
    const newSecret=req.body.secret;
    User.findById(req.user.id,function (err,user) {
        if (!err) {
            if (user) {
                user.secret=newSecret;
                user.save(function (err) {
                    res.redirect("/secrets");
                });
            } 
        } else {
            console.log(err);
        }
    })
})

app.listen(3000,function () {
    console.log("server running in port 3000");
});


