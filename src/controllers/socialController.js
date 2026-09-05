const { Op } = require("sequelize");
const { Post, PostLike, PostComment, Follow, User, Notification } = require("../models");
const { evaluateSocialActivity } = require("../services/affiliate.service");

const AUTHOR_ATTRS = ["id", "firstName", "lastName", "profileImage", "primaryRole"];

const paginate = (req) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  return { page, limit, offset: (page - 1) * limit };
};

const paginationMeta = (count, page, limit) => ({
  total: count,
  page,
  limit,
  totalPages: Math.max(Math.ceil(count / limit), 1),
});

const isAdmin = (user) =>
  user.primaryRole === "admin" || (Array.isArray(user.roles) && user.roles.includes("admin"));

const notifyUser = async (userId, type, title, message, link, metadata) => {
  try {
    await Notification.create({ userId, type, title, message, link, metadata });
  } catch (e) {
    console.error("Notification error:", e.message);
  }
};

const attachLikedByMe = async (posts, requesterId) => {
  if (!requesterId || posts.length === 0)
    return posts.map((p) => ({ ...p.toJSON(), likedByMe: false }));

  const likes = await PostLike.findAll({
    where: { userId: requesterId, postId: { [Op.in]: posts.map((p) => p.id) } },
    attributes: ["postId"],
  });
  const likedIds = new Set(likes.map((l) => l.postId));
  return posts.map((p) => ({ ...p.toJSON(), likedByMe: likedIds.has(p.id) }));
};

const visibleVisibilitiesFor = async (requesterId, targetUserId) => {
  if (requesterId && requesterId === targetUserId) return ["public", "followers"];
  if (!requesterId) return ["public"];
  const follows = await Follow.findOne({
    where: { followerId: requesterId, followingId: targetUserId },
  });
  return follows ? ["public", "followers"] : ["public"];
};

// ─── Posts ────────────────────────────────────────────────────────────────────

const createPost = async (req, res, next) => {
  try {
    const body = (req.body.body || "").trim();
    const files = req.files || [];

    if (!body && files.length === 0) {
      return res.status(400).json({ success: false, message: "A post needs text or at least one image." });
    }

    const media = files.map((file) => ({
      url: file.path,
      type: "image",
    }));

    const post = await Post.create({
      userId: req.user.id,
      body: body || null,
      media: media.length ? media : null,
      visibility: req.body.visibility === "followers" ? "followers" : "public",
    });

    const created = await Post.findByPk(post.id, {
      include: [{ association: "author", attributes: AUTHOR_ATTRS }],
    });
    await evaluateSocialActivity(req.user.id);

    res.status(201).json({ success: true, data: { post: { ...created.toJSON(), likedByMe: false } } });
  } catch (error) {
    next(error);
  }
};

const getFeed = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const follows = await Follow.findAll({
      where: { followerId: req.user.id },
      attributes: ["followingId"],
    });
    const authorIds = [req.user.id, ...follows.map((f) => f.followingId)];

    const { count, rows } = await Post.findAndCountAll({
      where: { userId: { [Op.in]: authorIds }, isDeleted: false },
      include: [{ association: "author", attributes: AUTHOR_ATTRS }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: { posts: await attachLikedByMe(rows, req.user.id), pagination: paginationMeta(count, page, limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getUserWall = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const { page, limit, offset } = paginate(req);
    const allowedVisibilities = await visibleVisibilitiesFor(req.user?.id, targetUserId);

    const { count, rows } = await Post.findAndCountAll({
      where: { userId: targetUserId, isDeleted: false, visibility: { [Op.in]: allowedVisibilities } },
      include: [{ association: "author", attributes: AUTHOR_ATTRS }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: { posts: await attachLikedByMe(rows, req.user?.id), pagination: paginationMeta(count, page, limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      where: { id: req.params.postId, isDeleted: false },
      include: [{ association: "author", attributes: AUTHOR_ATTRS }],
    });
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });

    const allowedVisibilities = await visibleVisibilitiesFor(req.user?.id, post.userId);
    if (!allowedVisibilities.includes(post.visibility))
      return res.status(403).json({ success: false, message: "This post isn't visible to you." });

    const [annotated] = await attachLikedByMe([post], req.user?.id);
    res.json({ success: true, data: { post: annotated } });
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findByPk(req.params.postId);
    if (!post || post.isDeleted) return res.status(404).json({ success: false, message: "Post not found." });
    if (post.userId !== req.user.id && !isAdmin(req.user))
      return res.status(403).json({ success: false, message: "You can only delete your own posts." });

    post.isDeleted = true;
    await post.save();
    res.json({ success: true, message: "Post deleted." });
  } catch (error) {
    next(error);
  }
};

const likePost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ where: { id: req.params.postId, isDeleted: false } });
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });

    const [, created] = await PostLike.findOrCreate({
      where: { postId: post.id, userId: req.user.id },
    });
    if (created) {
      await post.increment("likeCount");
      await post.reload();
      if (post.userId !== req.user.id) {
        await notifyUser(
          post.userId, "post_like", "New like on your post",
          `${req.user.firstName} ${req.user.lastName} liked your post.`,
          `/profile/${post.userId}`, { postId: post.id },
        );
      }
    }
    res.json({ success: true, data: { likeCount: post.likeCount, liked: true } });
  } catch (error) {
    next(error);
  }
};

const unlikePost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ where: { id: req.params.postId, isDeleted: false } });
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });

    const deleted = await PostLike.destroy({ where: { postId: post.id, userId: req.user.id } });
    if (deleted) { await post.decrement("likeCount"); await post.reload(); }
    res.json({ success: true, data: { likeCount: post.likeCount, liked: false } });
  } catch (error) {
    next(error);
  }
};

const listComments = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { count, rows } = await PostComment.findAndCountAll({
      where: { postId: req.params.postId, isDeleted: false },
      include: [{ association: "author", attributes: AUTHOR_ATTRS }],
      order: [["createdAt", "ASC"]],
      limit,
      offset,
    });
    res.json({ success: true, data: { comments: rows, pagination: paginationMeta(count, page, limit) } });
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const body = (req.body.body || "").trim();
    if (!body) return res.status(400).json({ success: false, message: "Comment body is required." });

    const post = await Post.findOne({ where: { id: req.params.postId, isDeleted: false } });
    if (!post) return res.status(404).json({ success: false, message: "Post not found." });

    const comment = await PostComment.create({ postId: post.id, userId: req.user.id, body });
    await post.increment("commentCount");

    if (post.userId !== req.user.id) {
      await notifyUser(
        post.userId, "post_comment", "New comment on your post",
        `${req.user.firstName} ${req.user.lastName} commented: "${body.slice(0, 80)}"`,
        `/profile/${post.userId}`, { postId: post.id },
      );
    }

    const created = await PostComment.findByPk(comment.id, {
      include: [{ association: "author", attributes: AUTHOR_ATTRS }],
    });
    await evaluateSocialActivity(req.user.id);
    res.status(201).json({ success: true, data: { comment: created } });
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const comment = await PostComment.findByPk(req.params.commentId);
    if (!comment || comment.isDeleted)
      return res.status(404).json({ success: false, message: "Comment not found." });
    if (comment.userId !== req.user.id && !isAdmin(req.user))
      return res.status(403).json({ success: false, message: "You can only delete your own comments." });

    comment.isDeleted = true;
    await comment.save();

    const post = await Post.findByPk(comment.postId);
    if (post && post.commentCount > 0) await post.decrement("commentCount");

    res.json({ success: true, message: "Comment deleted." });
  } catch (error) {
    next(error);
  }
};

// ─── Profile ──────────────────────────────────────────────────────────────────

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No image file provided." });

    const profileImage = req.file.path;
    req.user.profileImage = profileImage;
    await req.user.save();

    res.json({ success: true, message: "Profile photo updated.", data: { profileImage, user: req.user } });
  } catch (error) {
    next(error);
  }
};

const getPublicProfile = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const user = await User.findOne({
      where: { id: targetUserId, isActive: true },
      attributes: ["id", "firstName", "lastName", "bio", "profileImage", "primaryRole"],
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const isOwnProfile = req.user?.id === targetUserId;
    const allowedVisibilities = await visibleVisibilitiesFor(req.user?.id, targetUserId);

    const [postCount, followerCount, followingCount, isFollowing, isFollowedBy] =
      await Promise.all([
        Post.count({ where: { userId: targetUserId, isDeleted: false, visibility: { [Op.in]: allowedVisibilities } } }),
        Follow.count({ where: { followingId: targetUserId } }),
        Follow.count({ where: { followerId: targetUserId } }),
        req.user ? Follow.findOne({ where: { followerId: req.user.id, followingId: targetUserId } }) : null,
        req.user ? Follow.findOne({ where: { followerId: targetUserId, followingId: req.user.id } }) : null,
      ]);

    res.json({
      success: true,
      data: {
        user,
        counts: { posts: postCount, followers: followerCount, following: followingCount },
        isOwnProfile,
        isFollowing: !!isFollowing,
        isFollowedBy: !!isFollowedBy,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Follow ───────────────────────────────────────────────────────────────────

const follow = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    if (targetUserId === req.user.id)
      return res.status(400).json({ success: false, message: "You can't follow yourself." });

    const target = await User.findByPk(targetUserId);
    if (!target || !target.isActive)
      return res.status(404).json({ success: false, message: "User not found." });

    const [, created] = await Follow.findOrCreate({
      where: { followerId: req.user.id, followingId: targetUserId },
    });
    if (created) {
      await notifyUser(
        targetUserId, "follow", "New follower",
        `${req.user.firstName} ${req.user.lastName} started following you.`,
        `/profile/${req.user.id}`, { followerId: req.user.id },
      );
    }
    res.json({ success: true, data: { isFollowing: true } });
  } catch (error) {
    next(error);
  }
};

const unfollow = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    await Follow.destroy({ where: { followerId: req.user.id, followingId: targetUserId } });
    res.json({ success: true, data: { isFollowing: false } });
  } catch (error) {
    next(error);
  }
};

const listFollowers = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { count, rows } = await Follow.findAndCountAll({
      where: { followingId: req.params.userId },
      include: [{ association: "follower", attributes: AUTHOR_ATTRS }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    res.json({ success: true, data: { users: rows.map((r) => r.follower), pagination: paginationMeta(count, page, limit) } });
  } catch (error) {
    next(error);
  }
};

const listFollowing = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { count, rows } = await Follow.findAndCountAll({
      where: { followerId: req.params.userId },
      include: [{ association: "followee", attributes: AUTHOR_ATTRS }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    res.json({ success: true, data: { users: rows.map((r) => r.followee), pagination: paginationMeta(count, page, limit) } });
  } catch (error) {
    next(error);
  }
};

const getFollowStatus = async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);
    const [isFollowing, isFollowedBy] = await Promise.all([
      Follow.findOne({ where: { followerId: req.user.id, followingId: targetUserId } }),
      Follow.findOne({ where: { followerId: targetUserId, followingId: req.user.id } }),
    ]);
    res.json({ success: true, data: { isFollowing: !!isFollowing, isFollowedBy: !!isFollowedBy } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost, getFeed, getUserWall, getPost, deletePost,
  likePost, unlikePost, listComments, addComment, deleteComment,
  uploadAvatar, getPublicProfile,
  follow, unfollow, listFollowers, listFollowing, getFollowStatus,
  visibleVisibilitiesFor,
};
