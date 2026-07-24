const express = require("express");
const { authMiddleware, optionalAuthMiddleware } = require("../middleware/auth");
const { uploadPostMedia, uploadAvatar } = require("../config/cloudinary");
const {
  createPost, getFeed, getUserWall, getPost, deletePost,
  likePost, unlikePost, listComments, addComment, deleteComment,
  uploadAvatar: uploadAvatarController, getPublicProfile,
  follow, unfollow, listFollowers, listFollowing, getFollowStatus,
} = require("../controllers/socialController");

const router = express.Router();

// ─── Posts ────────────────────────────────────────────────────────────────────
router.post("/posts", authMiddleware, uploadPostMedia, createPost);
router.get("/posts/feed", authMiddleware, getFeed);
router.get("/posts/user/:userId", optionalAuthMiddleware, getUserWall);
router.get("/posts/:postId", optionalAuthMiddleware, getPost);
router.delete("/posts/:postId", authMiddleware, deletePost);

router.post("/posts/:postId/like", authMiddleware, likePost);
router.delete("/posts/:postId/like", authMiddleware, unlikePost);

router.get("/posts/:postId/comments", optionalAuthMiddleware, listComments);
router.post("/posts/:postId/comments", authMiddleware, addComment);
router.delete("/comments/:commentId", authMiddleware, deleteComment);

// ─── Profile ──────────────────────────────────────────────────────────────────
router.put("/profile/picture", authMiddleware, uploadAvatar, uploadAvatarController);
router.get("/profile/:userId", optionalAuthMiddleware, getPublicProfile);

// ─── Follow ───────────────────────────────────────────────────────────────────
router.post("/follow/:userId", authMiddleware, follow);
router.delete("/follow/:userId", authMiddleware, unfollow);
router.get("/follow/:userId/followers", listFollowers);
router.get("/follow/:userId/following", listFollowing);
router.get("/follow/:userId/status", authMiddleware, getFollowStatus);

module.exports = router;
