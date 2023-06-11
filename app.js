const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const path = require("path");
let db = null;
const DbPath = path.join(__dirname, "twitterClone.db");

const ConnectionEstablishing = async () => {
  try {
    db = await open({
      filename: DbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Starting at localHost port 3000");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};
ConnectionEstablishing();

//Authentication middelWare
const Authentication = async (request, response, nextExecutable) => {
  const authTokenBody = request.headers["authorization"];

  if (authTokenBody !== undefined) {
    const authToken = authTokenBody.split(" ")[1];
    jwt.verify(authToken, "token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.payload = payload;
        nextExecutable();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//register api
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const userAlreadyExistsQuery = `select * from user where username = '${username}'`;
  const userAlreadyExists = await db.get(userAlreadyExistsQuery);
  if (userAlreadyExists === undefined) {
    if (password < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const registerUserQuery = `insert into user (username, password, name, gender)
          values ('${username}','${hashedPassword}','${name}','${gender}')`;
      const registerUser = await db.run(registerUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const loginUserQuery = `select * from user where username = '${username}'`;
  const loginUser = await db.get(loginUserQuery);

  if (loginUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatched = await bcrypt.compare(password, loginUser.password);
    if (passwordMatched === true) {
      const jwtToken = await jwt.sign(loginUser, "token");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api 3
app.get("/user/tweets/feed/", Authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;

  const getTweetIdsTweetQuery = `select username, tweet, date_time as dateTime from 
  user inner join tweet on user.user_id = tweet.user_id inner join follower on tweet.user_id = follower.following_user_id
  where follower.follower_user_id = ${user_id}
  order by dateTime
  limit 4`;

  const getUserFollowingIdsTweets = await db.all(getTweetIdsTweetQuery);

  response.send(getUserFollowingIdsTweets);
});

//api 4
app.get("/user/following/", Authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;

  const gettingUserFollowingQuery = `select username from follower inner join user
    on follower.following_user_id = user.user_id 
    where follower.follower_user_id = ${user_id}`;

  const gettingUserFollowing = await db.all(gettingUserFollowingQuery);

  response.send(gettingUserFollowing);
});

//API 5
app.get("/user/followers/", Authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;

  const userFollowersDetailsQuery = `select username from
    user inner join follower on user.user_id = follower.follower_user_id
    where follower.following_user_id = ${user_id}`;

  const userFollowersDetails = await db.all(userFollowersDetailsQuery);

  response.send(userFollowersDetails);
});

//api 6
app.get("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { tweetId } = request.params;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;

  const allTweetQuery = `select * from tweet where tweet_id = ${tweetId}`;

  const allTweet = await db.get(allTweetQuery);

  //console.log(allTweet);

  const userFollowingIdsQuery = `select * from user inner join follower 
  on user.user_id = follower.following_user_id where follower.follower_user_id = ${user_id}`;

  const userFollowingIds = await db.all(userFollowingIdsQuery);

  //response.send(userFollowingIds);

  let result = userFollowingIds.some(
    (item) => item.following_user_id === allTweet.user_id
  );

  console.log(userFollowingIds[0].user_id);

  if (result) {
    const allTweetLogQuery = `select tweet.tweet as tweet,
      count(distinct(like.like_id)) as likes, 
      count(distinct(reply.reply_id)) as replies,
      tweet.date_time as dateTime from tweet inner join like on like.tweet_id = tweet.tweet_id
      inner join reply on reply.tweet_id = tweet.tweet_id
      where tweet.tweet_id = ${tweetId} and tweet.user_id = ${userFollowingIds[0].user_id}`;

    const allTweetLog = await db.get(allTweetLogQuery);

    response.send(allTweetLog);
  } else {
    response.status(401);
    reponse.send("Invalid Request");
  }
});

//API 7
app.get(
  "/tweets/:tweetId/likes/",
  Authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id, username, name, gender } = payload;
    const tweetIdQuery = `select * from tweet where tweet_id = ${tweetId}`;
    const finalTweetId = await db.get(tweetIdQuery);
    //console.log(finalTweetId);
    const followerFollowingQuery = `select * from follower where follower_user_id = ${user_id}`;
    const followerFollowing = await db.all(followerFollowingQuery);
    // console.log(followerFollowing);

    //check userFollowing
    const checkFinalResult = followerFollowing.some(
      (object) => object.following_user_id === finalTweetId.user_id
    );

    if (checkFinalResult) {
      const gettingLikedUserNameQuery = `select * from like inner join user on
        like.user_id = user.user_id where like.tweet_id = ${tweetId}`;
      const gettingLikedUserName = await db.all(gettingLikedUserNameQuery);

      //response.send(gettingLikedUserName);
      let finalArray = [];
      const addingUserNameToArray = gettingLikedUserName.map((each) =>
        finalArray.push(each.username)
      );
      console.log(finalArray);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  Authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;

    const tweetIdQuery = `select * from tweet where tweet_id = ${tweetId}`;
    const finalTweetId = await db.get(tweetIdQuery);
    // console.log(finalTweetId);

    const followerFollowingQuery = `select * from follower where follower_user_id = ${user_id}`;
    const followerFollowing = await db.all(followerFollowingQuery);
    // console.log(followerFollowing);

    //check userFollowing
    const checkFinalResult = followerFollowing.some(
      (object) => object.following_user_id === finalTweetId.user_id
    );

    if (checkFinalResult) {
      const gettingRepliesQuery = `select user.name as name, reply.reply as reply
        from reply inner join user on user.user_id = reply.user_id where 
        reply.tweet_id = ${tweetId}`;
      const gettingReplies = await db.all(gettingRepliesQuery);
      response.send({ replies: gettingReplies });
    } else {
      response.status(401);
      response.send("Invalid request");
    }
  }
);

//API 9
app.get("/user/tweets/", Authentication, async (request, response) => {
  const { payload } = request;

  const { user_id, name, username, gender } = payload;

  const gettingDetailsOfTweetQuery = `select tweet.tweet as tweet,
    count(distinct(like.like_id)) as likes,
    count(distinct(reply.reply_id)) as replies,
    tweet.date_time as dateTime from tweet inner join like 
    on tweet.tweet_id = like.tweet_id inner join reply on 
    reply.tweet_id = tweet.tweet_id where 
    tweet.user_id = ${user_id}
    group by tweet.tweet_id`;

  const gettingDetailsOfTweet = await db.all(gettingDetailsOfTweetQuery);

  response.send(gettingDetailsOfTweet);
});

//API 10
app.post("/user/tweets/", Authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const { tweet } = request.body;

  console.log(user_id);

  const UserTweetPostingQuery = `insert into tweet 
  (tweet, user_id)
  values
  ('${tweet}', ${user_id})`;

  const UserTweetPosting = await db.run(UserTweetPostingQuery);

  response.send("Created a Tweet");
});

//API 11
app.delete("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const { tweetId } = request.params;

  const allTweetsByUserQ = `select * from tweet where user_id = ${user_id}`;

  const allTweetsByUser = await db.all(allTweetsByUserQ);

  //console.log(allTweetsByUser);
  const checkUserRequestingTweetId = allTweetsByUser.some(
    (each) => each.tweet_id === parseInt(tweetId)
  );
  //console.log(tweetId);
  if (checkUserRequestingTweetId) {
    const deleteQuery = `delete from tweet where tweet_id = ${tweetId}`;
    const postDelete = await db.run(deleteQuery);

    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
