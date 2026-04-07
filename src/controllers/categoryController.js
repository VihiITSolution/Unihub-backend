const { Category, User } = require("../models");
const { Op } = require("sequelize");

/**
 * Get all categories (system + tutor-created)
 */
const getCategories = async (req, res, next) => {
  try {
    const { search, includeInactive = false } = req.query;

    const where = includeInactive ? {} : { isActive: true };

    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
    }

    const categories = await Category.findAll({
      where,
      attributes: [
        "id",
        "name",
        "slug",
        "description",
        "icon",
        "isActive",
        "createdByTutorId",
      ],
      order: [["name", "ASC"]],
      raw: true,
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create a new category (Tutor or System Admin)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, icon } = req.body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if category already exists
    const existingCategory = await Category.findOne({
      where: { slug },
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: `Category "${name}" already exists`,
      });
    }

    // Create new category
    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description || null,
      icon: icon || null,
      createdByTutorId: req.user?.id || null, // null for system categories
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update a category
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, icon, isActive } = req.body;

    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Only allow creator or admin to update
    if (
      category.createdByTutorId &&
      category.createdByTutorId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update categories you created",
      });
    }

    // Update basic fields
    if (name) {
      category.name = name.trim();
      category.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a category (admin only)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Only allow creator or admin to delete
    if (
      category.createdByTutorId &&
      category.createdByTutorId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete categories you created",
      });
    }

    await category.destroy();

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single category with its courses
 */
const getCategoryWithCourses = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({
      where: { slug },
      include: [
        {
          model: require("../models").Course,
          as: "courses",
          where: { isPublished: true },
          attributes: [
            "id",
            "title",
            "shortDescription",
            "thumbnail",
            "price",
            "rating",
            "enrollmentCount",
          ],
          required: false,
        },
      ],
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryWithCourses,
};
